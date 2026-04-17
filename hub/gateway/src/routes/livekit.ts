import { Router } from 'express';
import Joi from 'joi';
import { executeQuery } from '../utils/database';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';
import { asyncHandler, createApiError } from '../middleware/error';
import { AuthenticatedRequest, requireRoles } from '../middleware/auth';

const router = Router();

// Validation schemas
const createRoomSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  roomName: Joi.string().required(),
  maxParticipants: Joi.number().integer().min(2).max(50).default(10),
  metadata: Joi.object().default({}),
});

const joinRoomSchema = Joi.object({
  participantName: Joi.string().required(),
  participantRole: Joi.string().valid('candidate', 'proctor', 'examiner', 'observer').required(),
  metadata: Joi.object().default({}),
});

const recordingSchema = Joi.object({
  type: Joi.string().valid('audio', 'video', 'composite').default('composite'),
  layout: Joi.string().valid('speaker', 'grid', 'presentation').default('speaker'),
  preset: Joi.string().valid('H264_720P_30', 'H264_1080P_30', 'H264_720P_60').default('H264_720P_30'),
});

/**
 * Create LiveKit room for session
 * POST /api/v1/livekit/rooms
 */
router.post('/rooms', requireRoles('proctor', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  
  // Validate request body
  const { error, value } = createRoomSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  const { sessionId, roomName, maxParticipants, metadata } = value;
  
  // Verify session exists and belongs to user's org
  const sessionResult = await executeQuery(
    `SELECT 
      s.id, s.room_id, s.status,
      e.org_id,
      e.title as exam_title
    FROM sessions s
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    WHERE s.id = $1`,
    [sessionId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (sessionResult.rows.length === 0) {
    throw createApiError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  const session = sessionResult.rows[0];
  
  if (session.status !== 'created') {
    throw createApiError('Room can only be created for sessions in created status', 400, 'INVALID_SESSION_STATUS');
  }
  
  // Check if room already exists
  const existingRoomResult = await executeQuery(
    'SELECT id, livekit_room_name FROM livekit_rooms WHERE session_id = $1',
    [sessionId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (existingRoomResult.rows.length > 0) {
    throw createApiError('Room already exists for this session', 409, 'ROOM_EXISTS', {
      roomId: existingRoomResult.rows[0].id,
      roomName: existingRoomResult.rows[0].livekit_room_name
    });
  }
  
  try {
    // Create room in LiveKit (this would be an actual LiveKit API call in production)
    // For now, we'll just create the database record
    const livekitRoomName = `exam-${sessionId}-${Date.now()}`;
    
    const roomResult = await executeQuery(
      `INSERT INTO livekit_rooms (
        session_id, livekit_room_name, max_participants, metadata, status
      ) VALUES ($1, $2, $3, $4, 'created')
      RETURNING id, session_id, livekit_room_name, max_participants, metadata, status, created_at`,
      [
        sessionId,
        livekitRoomName,
        maxParticipants,
        JSON.stringify(metadata)
      ],
      user.orgId,
      user.isSuperAdmin
    );
    
    // Update session with room info
    await executeQuery(
      'UPDATE sessions SET room_id = $1 WHERE id = $2',
      [livekitRoomName, sessionId],
      user.orgId,
      user.isSuperAdmin
    );
    
    // Cache room info for quick access
    const roomData = {
      ...roomResult.rows[0],
      sessionId,
    };
    
    await cache.setJSON(`room:${sessionId}`, roomData, 7200); // 2 hour cache
    
    logger.info('LiveKit room created', {
      roomId: roomResult.rows[0].id,
      livekitRoomName,
      sessionId,
      createdBy: user.id,
    });
    
    res.status(201).json({
      room: roomResult.rows[0]
    });
  } catch (dbError: any) {
    if (dbError.code === '23505') { // Unique constraint violation
      throw createApiError('Room with this name already exists', 409, 'ROOM_NAME_EXISTS');
    }
    throw dbError;
  }
}));

/**
 * Generate join token for participant
 * POST /api/v1/livekit/rooms/:roomId/join
 */
router.post('/rooms/:roomId/join', requireRoles('proctor', 'admin', 'candidate'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const roomId = req.params.roomId;
  
  // Validate request body
  const { error, value } = joinRoomSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  const { participantName, participantRole, metadata } = value;
  
  // Get room info
  const roomResult = await executeQuery(
    `SELECT 
      r.id, r.livekit_room_name, r.max_participants, r.status,
      s.id as session_id, s.status as session_status,
      e.org_id
    FROM livekit_rooms r
    JOIN sessions s ON r.session_id = s.id
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    WHERE r.id = $1`,
    [roomId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (roomResult.rows.length === 0) {
    throw createApiError('Room not found', 404, 'ROOM_NOT_FOUND');
  }
  
  const room = roomResult.rows[0];
  
  if (room.status !== 'created' && room.status !== 'active') {
    throw createApiError('Room is not available for joining', 400, 'ROOM_NOT_AVAILABLE');
  }
  
  // Check participant count
  const participantCountResult = await executeQuery(
    'SELECT COUNT(*) as count FROM room_participants WHERE room_id = $1 AND status = \'active\'',
    [roomId],
    user.orgId,
    user.isSuperAdmin
  );
  
  const currentParticipants = parseInt(participantCountResult.rows[0].count);
  
  if (currentParticipants >= room.max_participants) {
    throw createApiError('Room is full', 409, 'ROOM_FULL', {
      maxParticipants: room.max_participants,
      currentParticipants
    });
  }
  
  // Check if participant already joined
  const existingParticipantResult = await executeQuery(
    'SELECT id FROM room_participants WHERE room_id = $1 AND participant_name = $2 AND status = \'active\'',
    [roomId, participantName],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (existingParticipantResult.rows.length > 0) {
    throw createApiError('Participant already in room', 409, 'PARTICIPANT_EXISTS');
  }
  
  try {
    // Generate access token (simplified - in production would use LiveKit SDK)
    const accessToken = `lk_token_${roomId}_${participantName}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours from now
    
    // Record participant join
    const participantResult = await executeQuery(
      `INSERT INTO room_participants (
        room_id, participant_name, participant_role, access_token, 
        expires_at, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING id, room_id, participant_name, participant_role, access_token, expires_at, created_at`,
      [
        roomId,
        participantName,
        participantRole,
        accessToken,
        expiresAt,
        JSON.stringify(metadata)
      ],
      user.orgId,
      user.isSuperAdmin
    );
    
    // Update room status to active if this is the first join
    if (currentParticipants === 0) {
      await executeQuery(
        'UPDATE livekit_rooms SET status = \'active\', activated_at = NOW() WHERE id = $1',
        [roomId],
        user.orgId,
        user.isSuperAdmin
      );
    }
    
    logger.info('Participant joined room', {
      roomId,
      participantName,
      participantRole,
      sessionId: room.session_id,
      joinedBy: user.id,
    });
    
    res.status(201).json({
      participant: participantResult.rows[0],
      room: {
        id: room.id,
        livekitRoomName: room.livekit_room_name,
      },
      joinUrl: `livekit://${room.livekit_room_name}?token=${accessToken}`,
    });
  } catch (dbError: any) {
    if (dbError.code === '23505') { // Unique constraint violation
      throw createApiError('Participant name already in use', 409, 'PARTICIPANT_NAME_EXISTS');
    }
    throw dbError;
  }
}));

/**
 * Start recording for room
 * POST /api/v1/livekit/rooms/:roomId/recording
 */
router.post('/rooms/:roomId/recording', requireRoles('proctor', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const roomId = req.params.roomId;
  
  // Validate request body
  const { error, value } = recordingSchema.validate(req.body);
  if (error) {
    throw createApiError(`Validation error: ${error.details[0].message}`, 400, 'VALIDATION_ERROR');
  }
  
  const { type, layout, preset } = value;
  
  // Get room info
  const roomResult = await executeQuery(
    `SELECT 
      r.id, r.livekit_room_name, r.status,
      s.id as session_id
    FROM livekit_rooms r
    JOIN sessions s ON r.session_id = s.id
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    WHERE r.id = $1`,
    [roomId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (roomResult.rows.length === 0) {
    throw createApiError('Room not found', 404, 'ROOM_NOT_FOUND');
  }
  
  const room = roomResult.rows[0];
  
  if (room.status !== 'active') {
    throw createApiError('Can only record active rooms', 400, 'ROOM_NOT_ACTIVE');
  }
  
  // Check if recording already active
  const existingRecordingResult = await executeQuery(
    'SELECT id FROM recordings WHERE session_id = $1 AND type = $2 AND status = \'active\'',
    [room.session_id, type],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (existingRecordingResult.rows.length > 0) {
    throw createApiError('Recording already active for this type', 409, 'RECORDING_ACTIVE');
  }
  
  try {
    // Start recording (simplified - in production would use LiveKit egress API)
    const recordingId = `rec_${room.session_id}_${type}_${Date.now()}`;
    
    const recordingResult = await executeQuery(
      `INSERT INTO recordings (
        session_id, type, livekit_egress_id, layout, preset, status
      ) VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id, session_id, type, livekit_egress_id, layout, preset, status, started_at`,
      [
        room.session_id,
        type,
        recordingId,
        layout,
        preset
      ],
      user.orgId,
      user.isSuperAdmin
    );
    
    // Update room with recording status
    await executeQuery(
      'UPDATE livekit_rooms SET recording_active = true WHERE id = $1',
      [roomId],
      user.orgId,
      user.isSuperAdmin
    );
    
    logger.info('Recording started', {
      recordingId: recordingResult.rows[0].id,
      roomId,
      type,
      sessionId: room.session_id,
      startedBy: user.id,
    });
    
    res.status(201).json({
      recording: recordingResult.rows[0]
    });
  } catch (dbError) {
    throw dbError;
  }
}));

/**
 * Stop recording
 * POST /api/v1/livekit/recordings/:recordingId/stop
 */
router.post('/recordings/:recordingId/stop', requireRoles('proctor', 'admin'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const recordingId = req.params.recordingId;
  
  // Get recording info
  const recordingResult = await executeQuery(
    `SELECT 
      r.id, r.session_id, r.type, r.status, r.livekit_egress_id,
      lr.id as room_id
    FROM recordings r
    JOIN sessions s ON r.session_id = s.id
    JOIN livekit_rooms lr ON s.id = lr.session_id
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    WHERE r.id = $1`,
    [recordingId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (recordingResult.rows.length === 0) {
    throw createApiError('Recording not found', 404, 'RECORDING_NOT_FOUND');
  }
  
  const recording = recordingResult.rows[0];
  
  if (recording.status !== 'active') {
    throw createApiError('Recording is not active', 400, 'RECORDING_NOT_ACTIVE');
  }
  
  try {
    // Stop recording (simplified - in production would call LiveKit egress API)
    await executeQuery(
      `UPDATE recordings 
       SET status = 'completed', ended_at = NOW() 
       WHERE id = $1`,
      [recordingId],
      user.orgId,
      user.isSuperAdmin
    );
    
    // Check if this was the last active recording for the room
    const activeRecordingsResult = await executeQuery(
      'SELECT COUNT(*) as count FROM recordings WHERE session_id = $1 AND status = \'active\'',
      [recording.session_id],
      user.orgId,
      user.isSuperAdmin
    );
    
    const activeCount = parseInt(activeRecordingsResult.rows[0].count);
    
    if (activeCount === 0) {
      await executeQuery(
        'UPDATE livekit_rooms SET recording_active = false WHERE id = $1',
        [recording.room_id],
        user.orgId,
        user.isSuperAdmin
      );
    }
    
    logger.info('Recording stopped', {
      recordingId,
      sessionId: recording.session_id,
      type: recording.type,
      stoppedBy: user.id,
    });
    
    res.json({
      message: 'Recording stopped successfully',
      recordingId,
    });
  } catch (dbError) {
    throw dbError;
  }
}));

/**
 * Get room status and participants
 * GET /api/v1/livekit/rooms/:roomId/status
 */
router.get('/rooms/:roomId/status', requireRoles('proctor', 'admin', 'viewer'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const roomId = req.params.roomId;
  
  // Get room details
  const roomResult = await executeQuery(
    `SELECT 
      r.*, 
      s.id as session_id, 
      s.status as session_status
    FROM livekit_rooms r
    JOIN sessions s ON r.session_id = s.id
    JOIN deliveries d ON s.delivery_id = d.id
    JOIN batches b ON d.batch_id = b.id
    JOIN exams e ON b.exam_id = e.id
    WHERE r.id = $1`,
    [roomId],
    user.orgId,
    user.isSuperAdmin
  );
  
  if (roomResult.rows.length === 0) {
    throw createApiError('Room not found', 404, 'ROOM_NOT_FOUND');
  }
  
  const room = roomResult.rows[0];
  
  // Get active participants
  const participantsResult = await executeQuery(
    `SELECT 
      id, participant_name, participant_role, joined_at, metadata
    FROM room_participants 
    WHERE room_id = $1 AND status = 'active'
    ORDER BY joined_at ASC`,
    [roomId],
    user.orgId,
    user.isSuperAdmin
  );
  
  // Get active recordings
  const recordingsResult = await executeQuery(
    `SELECT 
      id, type, layout, preset, status, started_at
    FROM recordings 
    WHERE session_id = $1 AND status = 'active'
    ORDER BY started_at ASC`,
    [room.session_id],
    user.orgId,
    user.isSuperAdmin
  );
  
  res.json({
    room,
    participants: participantsResult.rows,
    recordings: recordingsResult.rows,
    participantCount: participantsResult.rows.length,
    recordingActive: recordingsResult.rows.length > 0,
  });
}));

export { router as livekitRoutes };