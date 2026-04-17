import { Router } from 'express';
import crypto from 'crypto';
import Joi from 'joi';
import { executeQuery } from '../utils/database';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';
import { asyncHandler, createApiError } from '../middleware/error';

const router = Router();

// Skip authentication for webhooks but validate signature
const validateWebhookSignature = (secret: string) => {
  return (req: any, res: any, next: any) => {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    
    if (!signature || !timestamp) {
      return res.status(401).json({
        error: 'Missing webhook signature or timestamp',
        code: 'MISSING_WEBHOOK_HEADERS'
      });
    }
    
    // Check timestamp to prevent replay attacks (5 minute window)
    const timestampMs = parseInt(timestamp);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (Math.abs(now - timestampMs) > fiveMinutes) {
      return res.status(401).json({
        error: 'Webhook timestamp too old',
        code: 'WEBHOOK_TIMESTAMP_INVALID'
      });
    }
    
    // Verify signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(timestamp + payload)
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    )) {
      return res.status(401).json({
        error: 'Invalid webhook signature',
        code: 'WEBHOOK_SIGNATURE_INVALID'
      });
    }
    
    next();
  };
};

// Validation schemas for different webhook types
const livekitWebhookSchema = Joi.object({
  event: Joi.string().required().valid(
    'room_started', 'room_finished', 
    'participant_joined', 'participant_left',
    'track_published', 'track_unpublished',
    'egress_started', 'egress_updated', 'egress_ended'
  ),
  id: Joi.string().required(),
  createdAt: Joi.number().required(),
  room: Joi.object({
    sid: Joi.string().required(),
    name: Joi.string().required(),
    creationTime: Joi.number().required(),
    metadata: Joi.string().allow('').optional(),
  }).required(),
  participant: Joi.object({
    sid: Joi.string().required(),
    identity: Joi.string().required(),
    name: Joi.string().required(),
    metadata: Joi.string().allow('').optional(),
  }).optional(),
  track: Joi.object({
    sid: Joi.string().required(),
    type: Joi.string().valid('audio', 'video', 'data').required(),
    source: Joi.string().required(),
  }).optional(),
  egressInfo: Joi.object({
    egressId: Joi.string().required(),
    status: Joi.string().required(),
    roomName: Joi.string().required(),
    roomId: Joi.string().optional(),
    startedAt: Joi.number().optional(),
    endedAt: Joi.number().optional(),
    fileResults: Joi.array().optional(),
  }).optional(),
});

const examAppWebhookSchema = Joi.object({
  event: Joi.string().required().valid(
    'exam_started', 'exam_submitted', 'exam_completed',
    'question_answered', 'tab_switch', 'window_blur'
  ),
  sessionId: Joi.string().uuid().required(),
  candidateId: Joi.string().required(),
  timestamp: Joi.number().required(),
  data: Joi.object().optional(),
});

const aiServiceWebhookSchema = Joi.object({
  event: Joi.string().required().valid(
    'violation_detected', 'score_updated', 'analysis_completed'
  ),
  sessionId: Joi.string().uuid().required(),
  component: Joi.string().required().valid('vision', 'audio', 'behavior', 'screen'),
  timestamp: Joi.number().required(),
  data: Joi.object().required(),
});

/**
 * LiveKit webhook endpoint
 * POST /api/v1/webhooks/livekit
 */
router.post('/livekit', 
  validateWebhookSignature(process.env.LIVEKIT_WEBHOOK_SECRET || 'livekit-secret'),
  asyncHandler(async (req, res) => {
    // Validate webhook payload
    const { error, value } = livekitWebhookSchema.validate(req.body);
    if (error) {
      throw createApiError(`Invalid webhook payload: ${error.details[0].message}`, 400, 'INVALID_WEBHOOK_PAYLOAD');
    }
    
    const { event, id, createdAt, room, participant, track, egressInfo } = value;
    
    logger.info('LiveKit webhook received', {
      event,
      id,
      roomName: room.name,
      participantIdentity: participant?.identity,
    });
    
    try {
      // Get room and session info
      const roomResult = await executeQuery(
        'SELECT id, session_id FROM livekit_rooms WHERE livekit_room_name = $1',
        [room.name]
      );
      
      if (roomResult.rows.length === 0) {
        logger.warn('Webhook for unknown room', { roomName: room.name, event });
        return res.status(200).json({ status: 'ignored', reason: 'unknown_room' });
      }
      
      const roomRecord = roomResult.rows[0];
      
      // Handle different event types
      switch (event) {
        case 'room_started':
          await executeQuery(
            'UPDATE livekit_rooms SET status = \'active\', activated_at = $1 WHERE id = $2',
            [new Date(createdAt), roomRecord.id]
          );
          
          await executeQuery(
            'UPDATE sessions SET status = \'active\', started_at = $1 WHERE id = $2',
            [new Date(createdAt), roomRecord.session_id]
          );
          break;
          
        case 'room_finished':
          await executeQuery(
            'UPDATE livekit_rooms SET status = \'completed\', ended_at = NOW() WHERE id = $1',
            [roomRecord.id]
          );
          
          // End session if not already ended
          await executeQuery(
            `UPDATE sessions 
             SET status = 'completed', ended_at = NOW() 
             WHERE id = $1 AND status IN ('created', 'active')`,
            [roomRecord.session_id]
          );
          break;
          
        case 'participant_joined':
          if (participant) {
            await executeQuery(
              `INSERT INTO room_participants (
                room_id, participant_sid, participant_name, participant_role, 
                metadata, status, joined_at
              ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
              ON CONFLICT (room_id, participant_sid) 
              DO UPDATE SET status = 'active', joined_at = $6`,
              [
                roomRecord.id,
                participant.sid,
                participant.identity,
                'candidate', // Default role, could be parsed from metadata
                participant.metadata || '{}',
                new Date(createdAt)
              ]
            );
          }
          break;
          
        case 'participant_left':
          if (participant) {
            await executeQuery(
              `UPDATE room_participants 
               SET status = 'left', left_at = $1
               WHERE room_id = $2 AND participant_sid = $3`,
              [new Date(createdAt), roomRecord.id, participant.sid]
            );
          }
          break;
          
        case 'egress_started':
          if (egressInfo) {
            await executeQuery(
              `UPDATE recordings 
               SET status = 'active', started_at = $1
               WHERE session_id = $2 AND livekit_egress_id = $3`,
              [new Date(egressInfo.startedAt || createdAt), roomRecord.session_id, egressInfo.egressId]
            );
          }
          break;
          
        case 'egress_ended':
          if (egressInfo) {
            // Update recording with file information
            const fileResults = egressInfo.fileResults || [];
            const storageUrl = fileResults.length > 0 ? fileResults[0].location : null;
            const durationSec = egressInfo.endedAt && egressInfo.startedAt 
              ? Math.floor((egressInfo.endedAt - egressInfo.startedAt) / 1000)
              : null;
            
            await executeQuery(
              `UPDATE recordings 
               SET status = 'completed', ended_at = $1, storage_url = $2, duration_sec = $3
               WHERE session_id = $4 AND livekit_egress_id = $5`,
              [
                new Date(egressInfo.endedAt || createdAt),
                storageUrl,
                durationSec,
                roomRecord.session_id,
                egressInfo.egressId
              ]
            );
          }
          break;
      }
      
      // Cache the event for real-time updates
      await cache.setJSON(`livekit_event:${room.name}:${id}`, {
        event,
        data: value,
        processedAt: new Date().toISOString(),
      }, 3600); // 1 hour cache
      
      res.status(200).json({ status: 'processed', eventId: id });
      
    } catch (dbError) {
      logger.error('Error processing LiveKit webhook', {
        event,
        roomName: room.name,
        error: dbError,
      });
      
      // Don't throw - return success to prevent retries for our internal errors
      res.status(200).json({ status: 'error', error: 'internal_error' });
    }
  })
);

/**
 * Exam app webhook endpoint
 * POST /api/v1/webhooks/exam-app
 */
router.post('/exam-app',
  validateWebhookSignature(process.env.EXAM_APP_WEBHOOK_SECRET || 'exam-app-secret'),
  asyncHandler(async (req, res) => {
    // Validate webhook payload
    const { error, value } = examAppWebhookSchema.validate(req.body);
    if (error) {
      throw createApiError(`Invalid webhook payload: ${error.details[0].message}`, 400, 'INVALID_WEBHOOK_PAYLOAD');
    }
    
    const { event, sessionId, candidateId, timestamp, data } = value;
    
    logger.info('Exam app webhook received', {
      event,
      sessionId,
      candidateId,
    });
    
    try {
      // Verify session exists
      const sessionResult = await executeQuery(
        'SELECT id, status FROM sessions WHERE id = $1 AND candidate_id = $2',
        [sessionId, candidateId]
      );
      
      if (sessionResult.rows.length === 0) {
        logger.warn('Webhook for unknown session', { sessionId, candidateId, event });
        return res.status(200).json({ status: 'ignored', reason: 'unknown_session' });
      }
      
      const session = sessionResult.rows[0];
      
      // Handle different event types
      switch (event) {
        case 'exam_started':
          if (session.status === 'created') {
            await executeQuery(
              'UPDATE sessions SET status = \'active\', started_at = $1 WHERE id = $2',
              [new Date(timestamp), sessionId]
            );
          }
          break;
          
        case 'exam_submitted':
        case 'exam_completed':
          await executeQuery(
            'UPDATE sessions SET status = \'completed\', ended_at = $1 WHERE id = $2',
            [new Date(timestamp), sessionId]
          );
          break;
          
        case 'tab_switch':
        case 'window_blur':
          // Log as browser violation
          const violationCode = event === 'tab_switch' ? 'b1' : 'b2';
          
          await executeQuery(
            `INSERT INTO violations (
              session_id, code, type, severity, confidence, weight, metadata, timestamp
            ) VALUES ($1, $2, 'browser', 0.7, 0.9, 0.3, $3, $4)`,
            [
              sessionId,
              violationCode,
              JSON.stringify(data || {}),
              new Date(timestamp)
            ]
          );
          break;
          
        case 'question_answered':
          // Store exam progress data if needed
          if (data) {
            await cache.setJSON(`exam_progress:${sessionId}`, {
              lastAction: event,
              data,
              timestamp: new Date(timestamp).toISOString(),
            }, 7200); // 2 hour cache
          }
          break;
      }
      
      res.status(200).json({ status: 'processed' });
      
    } catch (dbError) {
      logger.error('Error processing exam app webhook', {
        event,
        sessionId,
        candidateId,
        error: dbError,
      });
      
      res.status(200).json({ status: 'error', error: 'internal_error' });
    }
  })
);

/**
 * AI service webhook endpoint
 * POST /api/v1/webhooks/ai
 */
router.post('/ai',
  validateWebhookSignature(process.env.AI_WEBHOOK_SECRET || 'ai-secret'),
  asyncHandler(async (req, res) => {
    // Validate webhook payload
    const { error, value } = aiServiceWebhookSchema.validate(req.body);
    if (error) {
      throw createApiError(`Invalid webhook payload: ${error.details[0].message}`, 400, 'INVALID_WEBHOOK_PAYLOAD');
    }
    
    const { event, sessionId, component, timestamp, data } = value;
    
    logger.info('AI service webhook received', {
      event,
      sessionId,
      component,
    });
    
    try {
      // Verify session exists and is active
      const sessionResult = await executeQuery(
        'SELECT id, status FROM sessions WHERE id = $1',
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) {
        logger.warn('AI webhook for unknown session', { sessionId, event, component });
        return res.status(200).json({ status: 'ignored', reason: 'unknown_session' });
      }
      
      const session = sessionResult.rows[0];
      
      if (session.status !== 'active') {
        logger.warn('AI webhook for inactive session', { sessionId, status: session.status, event });
        return res.status(200).json({ status: 'ignored', reason: 'session_not_active' });
      }
      
      // Handle different event types
      switch (event) {
        case 'violation_detected':
          const { code, severity, confidence, metadata } = data;
          
          await executeQuery(
            `INSERT INTO violations (
              session_id, code, type, severity, confidence, weight, metadata, timestamp
            ) VALUES ($1, $2, $3, $4, $5, 0.5, $6, $7)`,
            [
              sessionId,
              code,
              component, // vision, audio, behavior, screen
              parseFloat(severity) || 0.5,
              parseFloat(confidence) || 0.5,
              JSON.stringify(metadata || {}),
              new Date(timestamp)
            ]
          );
          
          // Cache violation for real-time updates
          await cache.setJSON(`violation:${sessionId}:${component}:latest`, {
            code,
            severity,
            confidence,
            metadata,
            timestamp: new Date(timestamp).toISOString(),
            component,
          }, 1800); // 30 minute cache
          
          break;
          
        case 'score_updated':
          const { score, breakdown } = data;
          
          // Update session credibility score
          await executeQuery(
            'UPDATE sessions SET credibility_score = $1, updated_at = NOW() WHERE id = $2',
            [parseFloat(score), sessionId]
          );
          
          // Log score history
          await executeQuery(
            `INSERT INTO score_history (session_id, score, breakdown, timestamp)
             VALUES ($1, $2, $3, $4)`,
            [
              sessionId,
              parseFloat(score),
              JSON.stringify(breakdown || {}),
              new Date(timestamp)
            ]
          );
          
          // Cache current score
          await cache.setJSON(`score:${sessionId}:current`, {
            score: parseFloat(score),
            breakdown,
            updatedAt: new Date(timestamp).toISOString(),
          }, 1800); // 30 minute cache
          
          break;
          
        case 'analysis_completed':
          // Update session with analysis results
          const { riskLevel, summary } = data;
          
          await executeQuery(
            'UPDATE sessions SET risk_level = $1, notes = $2, updated_at = NOW() WHERE id = $3',
            [riskLevel, summary, sessionId]
          );
          
          break;
      }
      
      res.status(200).json({ status: 'processed' });
      
    } catch (dbError) {
      logger.error('Error processing AI webhook', {
        event,
        sessionId,
        component,
        error: dbError,
      });
      
      res.status(200).json({ status: 'error', error: 'internal_error' });
    }
  })
);

/**
 * Generic webhook health check
 * GET /api/v1/webhooks/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      livekit: '/api/v1/webhooks/livekit',
      examApp: '/api/v1/webhooks/exam-app',
      ai: '/api/v1/webhooks/ai',
    },
  });
});

export { router as webhookRoutes };