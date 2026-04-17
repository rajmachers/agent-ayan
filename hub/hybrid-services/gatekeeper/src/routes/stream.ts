/**
 * Live Stream Management Routes - Phase 7 Gatekeeper Service
 * REQ-026: Live stream initiation and high-res ID capture by proctor
 */
import express, { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: Router = express.Router();

// Initiate live stream setup
router.post('/initiate/:sessionId', async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { proctorId, streamType = 'webrtc' } = req.body;

    if (!proctorId) {
      return res.status(400).json({
        error: 'proctorId is required for stream initiation',
        service: 'gatekeeper-service-p7'
      });
    }

    const sessionData = await req.redis.hgetall(`gatekeeper:session:${sessionId}`);
    if (!sessionData || !sessionData.candidateId) {
      return res.status(404).json({ 
        error: 'Session not found',
        sessionId,
        service: 'gatekeeper-service-p7'
      });
    }

    // Generate stream credentials
    const streamId = uuidv4();
    const streamToken = uuidv4();
    
    // Simulate stream URL generation (would integrate with actual streaming service)
    const streamUrl = `wss://stream.proctor.local/session/${streamId}?token=${streamToken}`;
    const viewUrl = `https://proctor.dashboard.local/stream/${streamId}?auth=${streamToken}`;

    // Update session with stream information
    await req.redis.hset(`gatekeeper:session:${sessionId}`, {
      entryState: 'LIVE_STREAM_SETUP',
      streamId,
      streamUrl,
      viewUrl,
      streamInitiatedBy: proctorId,
      streamInitiatedAt: new Date().toISOString(),
      streamType,
      updatedAt: new Date().toISOString()
    });

    // Store stream metadata
    await req.redis.hset(`stream:${streamId}`, {
      sessionId,
      candidateId: sessionData.candidateId,
      proctorId,
      streamUrl,
      viewUrl,
      status: 'initializing',
      createdAt: new Date().toISOString()
    });
    await req.redis.expire(`stream:${streamId}`, 7200); // 2 hours

    req.logger.info('Live stream initiated', {
      sessionId,
      candidateId: sessionData.candidateId,
      proctorId,
      streamId,
      streamType
    });

    res.json({
      message: 'Live stream initiated successfully',
      stream: {
        streamId,
        sessionId,
        candidateId: sessionData.candidateId,
        streamUrl,
        viewUrl,
        streamType,
        status: 'initializing',
        initiatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Stream initiation error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate live stream',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Update stream status
router.put('/status/:streamId', async (req: any, res: Response) => {
  try {
    const { streamId } = req.params;
    const { status, quality, metadata } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'status is required',
        service: 'gatekeeper-service-p7'
      });
    }

    const streamExists = await req.redis.exists(`stream:${streamId}`);
    if (!streamExists) {
      return res.status(404).json({ 
        error: 'Stream not found',
        streamId,
        service: 'gatekeeper-service-p7'
      });
    }

    // Update stream status
    const updateData: any = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (quality) updateData.quality = JSON.stringify(quality);
    if (metadata) updateData.metadata = JSON.stringify(metadata);

    await req.redis.hset(`stream:${streamId}`, updateData);

    // If stream is now live, update session state
    if (status === 'live') {
      const streamData = await req.redis.hgetall(`stream:${streamId}`);
      if (streamData.sessionId) {
        await req.redis.hset(`gatekeeper:session:${streamData.sessionId}`, {
          entryState: 'LIVE_STREAM_ACTIVE',
          streamStatus: 'live',
          updatedAt: new Date().toISOString()
        });
      }
    }

    res.json({
      message: 'Stream status updated successfully',
      stream: {
        streamId,
        status,
        quality,
        metadata,
        updatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Stream status update error:', error);
    res.status(500).json({ 
      error: 'Failed to update stream status',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Get stream information
router.get('/info/:streamId', async (req: any, res: Response) => {
  try {
    const { streamId } = req.params;
    
    const streamData = await req.redis.hgetall(`stream:${streamId}`);
    if (!streamData || !streamData.sessionId) {
      return res.status(404).json({ 
        error: 'Stream not found',
        streamId,
        service: 'gatekeeper-service-p7'
      });
    }

    // Parse JSON fields
    const quality = streamData.quality ? JSON.parse(streamData.quality) : null;
    const metadata = streamData.metadata ? JSON.parse(streamData.metadata) : null;

    res.json({
      stream: {
        streamId,
        sessionId: streamData.sessionId,
        candidateId: streamData.candidateId,
        proctorId: streamData.proctorId,
        streamUrl: streamData.streamUrl,
        viewUrl: streamData.viewUrl,
        status: streamData.status,
        quality,
        metadata,
        createdAt: streamData.createdAt,
        updatedAt: streamData.updatedAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Stream info error:', error);
    res.status(500).json({ 
      error: 'Failed to get stream information',
      service: 'gatekeeper-service-p7'
    });
  }
});

// Terminate stream
router.delete('/terminate/:streamId', async (req: any, res: Response) => {
  try {
    const { streamId } = req.params;
    const { proctorId, reason } = req.body;

    const streamData = await req.redis.hgetall(`stream:${streamId}`);
    if (!streamData || !streamData.sessionId) {
      return res.status(404).json({ 
        error: 'Stream not found',
        streamId,
        service: 'gatekeeper-service-p7'
      });
    }

    // Update stream to terminated
    await req.redis.hset(`stream:${streamId}`, {
      status: 'terminated',
      terminatedBy: proctorId || 'system',
      terminatedAt: new Date().toISOString(),
      terminationReason: reason || 'manual_termination'
    });

    // Update session state
    if (streamData.sessionId) {
      await req.redis.hset(`gatekeeper:session:${streamData.sessionId}`, {
        streamStatus: 'terminated',
        updatedAt: new Date().toISOString()
      });
    }

    req.logger.info('Stream terminated', {
      streamId,
      sessionId: streamData.sessionId,
      candidateId: streamData.candidateId,
      terminatedBy: proctorId || 'system',
      reason
    });

    res.json({
      message: 'Stream terminated successfully',
      stream: {
        streamId,
        sessionId: streamData.sessionId,
        status: 'terminated',
        terminatedAt: new Date().toISOString(),
        reason
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Stream termination error:', error);
    res.status(500).json({ 
      error: 'Failed to terminate stream',
      service: 'gatekeeper-service-p7'
    });
  }
});

export default router;