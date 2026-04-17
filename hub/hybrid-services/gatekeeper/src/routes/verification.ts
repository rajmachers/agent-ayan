/**
 * ID Verification Routes - Phase 7 Gatekeeper Service
 * REQ-026: Live stream initiation and high-res ID capture by proctor
 * REQ-027: AI pre-scanning of ID documents with Green/Amber flagging system
 */
import express, { Request, Response, Router } from 'express';
import sharp from 'sharp';

const router: Router = express.Router();

// Upload ID documents for verification
router.post('/upload/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Check session exists
    const sessionData = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
    if (!sessionData || !sessionData.candidateId) {
      return res.status(404).json({ 
        error: 'Session not found',
        sessionId,
        service: 'gatekeeper-service-p7'
      });
    }

    // Use multer middleware to handle file uploads
    req.upload.array('idDocuments', 5)(req, res, async (err: any) => {
      if (err) {
        req.logger.error('File upload error:', err);
        return res.status(400).json({
          error: 'File upload failed: ' + err.message,
          service: 'gatekeeper-service-p7'
        });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'No ID documents provided',
          service: 'gatekeeper-service-p7'
        });
      }

      // Process and optimize images
      const processedDocuments = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Optimize image using Sharp (high-res requirement REQ-026)
        const optimizedBuffer = await sharp(file.buffer)
          .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 95 })
          .toBuffer();

        processedDocuments.push({
          originalName: file.originalname,
          size: optimizedBuffer.length,
          mimetype: 'image/jpeg',
          buffer: optimizedBuffer
        });
      }

      // Process with AI verification (REQ-027)
      const verificationFlag = await req.gatekeeperService.processIdVerification(sessionId, files);
      
      // Update session state
      await req.redis.hset(`gatekeeper:session:${sessionId}`, {
        entryState: 'ID_VERIFICATION',
        verificationFlag,
        documentCount: files.length,
        updatedAt: new Date().toISOString()
      });

      req.logger.info('ID verification uploaded and processed', {
        sessionId,
        candidateId: sessionData.candidateId,
        documentCount: files.length,
        verificationFlag
      });

      res.json({
        message: 'ID documents uploaded and processed successfully',
        verificationResult: {
          flag: verificationFlag,
          documentCount: files.length,
          processedAt: new Date().toISOString()
        },
        nextStep: verificationFlag === 'GREEN' ? 'auto_approved' : 'human_review',
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    req.logger.error('ID verification error:', error);
    res.status(500).json({ 
      error: 'Failed to process ID verification',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Get verification status
router.get('/status/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const sessionData = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
    if (!sessionData || !sessionData.candidateId) {
      return res.status(404).json({ 
        error: 'Session not found',
        sessionId,
        service: 'gatekeeper-service-p7'
      });
    }

    const verificationResults = sessionData.verificationResults 
      ? JSON.parse(sessionData.verificationResults) 
      : null;

    res.json({
      verification: {
        sessionId,
        candidateId: sessionData.candidateId,
        flag: sessionData.verificationFlag || 'PENDING',
        documentCount: parseInt(sessionData.documentCount) || 0,
        completedAt: sessionData.idVerificationCompleted,
        results: verificationResults
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Verification status error:', error);
    res.status(500).json({ 
      error: 'Failed to get verification status',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Retry verification (if failed)
router.post('/retry/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Reset verification status
    await req.redis.hset(`gatekeeper:session:${sessionId}`, {
      verificationFlag: 'PENDING',
      entryState: 'WAITING_ROOM',
      updatedAt: new Date().toISOString()
    });

    // Clear previous results
    await req.redis.hdel(`gatekeeper:session:${sessionId}`, 
      'verificationResults', 'idVerificationCompleted', 'documentCount');

    res.json({
      message: 'Verification reset successfully',
      sessionId,
      newStatus: 'PENDING',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Verification retry error:', error);
    res.status(500).json({ 
      error: 'Failed to retry verification',
      service: 'gatekeeper-service-p7'
    });
  }
});

export default router;