/**
 * Emergency Assignment Routes - Phase 7 Ghost Proctor Service
 * REQ-044: Emergency assignment via random distribution when all proctors at capacity
 */
import express, { Request, Response } from 'express';

const router = express.Router();

// Check system capacity and emergency status
router.get('/capacity', async (req: any, res: Response) => {
  try {
    // Get all active proctors
    const activeProctors = await req.redis.smembers('proctors:active');
    
    let totalCapacity = 0;
    let currentLoad = 0;
    let availableSlots = 0;
    const proctorDetails = [];

    for (const proctorId of activeProctors) {
      const capacityData = await req.redis.hgetall(`proctor:${proctorId}:capacity`);
      const maxConcurrent = parseInt(capacityData.max_concurrent) || 5;
      const current = parseInt(capacityData.current_load) || 0;
      
      totalCapacity += maxConcurrent;
      currentLoad += current;
      availableSlots += Math.max(0, maxConcurrent - current);

      proctorDetails.push({
        proctorId,
        maxConcurrent,
        currentLoad: current,
        availableSlots: Math.max(0, maxConcurrent - current),
        utilizationRate: maxConcurrent > 0 ? ((current / maxConcurrent) * 100).toFixed(1) : '0.0'
      });
    }

    // Calculate overall system metrics
    const utilizationRate = totalCapacity > 0 ? (currentLoad / totalCapacity) : 0;
    const queueLength = await req.redis.llen('gatekeeper:waiting_room') + 
                       await req.redis.llen('gatekeeper:pending_approval');

    // Determine emergency level
    let emergencyLevel: 'normal' | 'warning' | 'critical' = 'normal';
    let emergencyMessage = 'System operating normally';

    if (utilizationRate >= 0.95) {
      emergencyLevel = 'critical';
      emergencyMessage = 'Critical capacity - emergency assignment protocols active';
    } else if (utilizationRate >= 0.85) {
      emergencyLevel = 'warning';
      emergencyMessage = 'High capacity utilization - monitoring for overflow';
    }

    // Get recent emergency assignments
    const emergencyAssignments = await req.redis.llen('assignments:emergency');
    const overflowAssignments = await req.redis.llen('assignments:overflow');

    const capacity = {
      totalCapacity,
      currentLoad, 
      availableSlots,
      utilizationRate: (utilizationRate * 100).toFixed(1) + '%',
      queueLength,
      emergencyLevel,
      emergencyMessage,
      emergencyAssignments,
      overflowAssignments
    };

    res.json({
      capacity,
      proctorDetails,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Capacity check error:', error);
    res.status(500).json({
      error: 'Failed to check system capacity',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Request emergency assignment for a candidate
router.post('/assign/:candidateId', async (req: any, res: Response) => {
  try {
    const { candidateId } = req.params;
    const { examId, priority = 'normal', reason } = req.body;

    if (!examId) {
      return res.status(400).json({
        error: 'examId is required for emergency assignment',
        service: 'ghost-proctor-service-p7'
      });
    }

    // Check if candidate already has active assignment
    const existingAssignment = await req.redis.get(`candidate:${candidateId}:active_assignment`);
    if (existingAssignment) {
      return res.status(409).json({
        error: 'Candidate already has active assignment',
        assignmentId: existingAssignment,
        service: 'ghost-proctor-service-p7'
      });
    }

    // Process emergency assignment using the service method
    const assignment = await req.ghostService.handleEmergencyAssignment(candidateId, examId);

    // Mark candidate as assigned
    await req.redis.set(
      `candidate:${candidateId}:active_assignment`, 
      assignment.assignmentId, 
      'EX', 
      7200 // 2 hours
    );

    // Update proctor load if normal assignment
    if (assignment.assignmentType === 'normal') {
      await req.redis.hincrby(`proctor:${assignment.proctorId}:capacity`, 'current_load', 1);
    }

    // Notify via WebSocket
    req.io.emit('emergency_assignment', {
      type: 'assignment_created',
      assignment: {
        assignmentId: assignment.assignmentId,
        candidateId: assignment.candidateId,
        proctorId: assignment.proctorId,
        type: assignment.assignmentType,
        priority: assignment.priority
      },
      timestamp: new Date().toISOString()
    });

    req.logger.info('Emergency assignment created', {
      assignmentId: assignment.assignmentId,
      candidateId: assignment.candidateId,
      proctorId: assignment.proctorId,
      type: assignment.assignmentType,
      reason: assignment.reason
    });

    res.status(201).json({
      message: 'Emergency assignment created successfully',
      assignment: {
        assignmentId: assignment.assignmentId,
        candidateId: assignment.candidateId,
        proctorId: assignment.proctorId,
        ghostProctorId: assignment.ghostProctorId,
        type: assignment.assignmentType,
        reason: assignment.reason,
        priority: assignment.priority,
        createdAt: assignment.timestamp
      },
      systemStatus: assignment.context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Emergency assignment error:', error);
    
    if (error.message === 'No available proctors for emergency assignment') {
      res.status(503).json({
        error: 'Service unavailable - no proctors available',
        message: 'All proctors at capacity, please try again later',
        service: 'ghost-proctor-service-p7'
      });
    } else {
      res.status(500).json({
        error: 'Failed to create emergency assignment',
        service: 'ghost-proctor-service-p7'
      });
    }
  }
});

// Get emergency assignment queue status
router.get('/queue', async (req: any, res: Response) => {
  try {
    const { type = 'all', limit = 50 } = req.query;

    const queues = ['emergency', 'overflow', 'rebalance', 'ghost_intervention'];
    const queueData = {};

    for (const queueType of queues) {
      if (type === 'all' || type === queueType) {
        const assignmentIds = await req.redis.lrange(`assignments:${queueType}`, 0, parseInt(limit as string) - 1);
        const assignments = [];

        for (const assignmentId of assignmentIds) {
          const assignmentData = await req.redis.hgetall(`assignment:${assignmentId}`);
          if (assignmentData.candidateId) {
            assignments.push({
              assignmentId,
              candidateId: assignmentData.candidateId,
              proctorId: assignmentData.proctorId,
              ghostProctorId: assignmentData.ghostProctorId,
              assignmentType: assignmentData.assignmentType,
              reason: assignmentData.reason,
              priority: parseInt(assignmentData.priority) || 0,
              timestamp: assignmentData.timestamp,
              context: assignmentData.context ? JSON.parse(assignmentData.context) : null
            });
          }
        }

        // Sort by priority and timestamp
        assignments.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority; // Lower number = higher priority
          }
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });

        queueData[queueType] = {
          count: assignments.length,
          assignments
        };
      }
    }

    // Get overall queue statistics
    const totalEmergency = await req.redis.llen('assignments:emergency');
    const totalOverflow = await req.redis.llen('assignments:overflow');
    const totalRebalance = await req.redis.llen('assignments:rebalance');
    const totalGhost = await req.redis.llen('assignments:ghost_intervention');

    const summary = {
      totalAssignments: totalEmergency + totalOverflow + totalRebalance + totalGhost,
      byType: {
        emergency: totalEmergency,
        overflow: totalOverflow,
        rebalance: totalRebalance,
        ghost_intervention: totalGhost
      }
    };

    res.json({
      queueData,
      summary,
      filters: {
        type,
        limit: parseInt(limit as string)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Emergency queue status error:', error);
    res.status(500).json({
      error: 'Failed to get emergency queue status',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Manually trigger load rebalancing
router.post('/rebalance', async (req: any, res: Response) => {
  try {
    const { reason = 'Manual rebalancing request', ghostProctorId, targetUtilization = 80 } = req.body;

    // Get current system capacity
    const activeProctors = await req.redis.smembers('proctors:active');
    
    if (activeProctors.length === 0) {
      return res.status(400).json({
        error: 'No active proctors available for rebalancing',
        service: 'ghost-proctor-service-p7'
      });
    }

    // Calculate current load distribution
    const proctorLoads = [];
    let totalCapacity = 0;
    let totalLoad = 0;

    for (const proctorId of activeProctors) {
      const capacityData = await req.redis.hgetall(`proctor:${proctorId}:capacity`);
      const maxConcurrent = parseInt(capacityData.max_concurrent) || 5;
      const currentLoad = parseInt(capacityData.current_load) || 0;
      const utilization = maxConcurrent > 0 ? (currentLoad / maxConcurrent) * 100 : 0;

      totalCapacity += maxConcurrent;
      totalLoad += currentLoad;

      proctorLoads.push({
        proctorId,
        maxConcurrent,
        currentLoad,
        utilization,
        available: maxConcurrent - currentLoad
      });
    }

    const overallUtilization = totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0;

    // Identify overloaded and underloaded proctors
    const overloadedProctors = proctorLoads.filter(p => p.utilization > targetUtilization);
    const underloadedProctors = proctorLoads.filter(p => p.utilization < (targetUtilization - 20) && p.available > 0);

    if (overloadedProctors.length === 0) {
      return res.json({
        message: 'No rebalancing needed - all proctors within target utilization',
        currentUtilization: overallUtilization.toFixed(1) + '%',
        targetUtilization: targetUtilization + '%',
        proctorLoads,
        timestamp: new Date().toISOString()
      });
    }

    // Plan rebalancing moves
    const rebalancingPlan = [];
    let totalMoves = 0;

    for (const overloaded of overloadedProctors) {
      const excessLoad = Math.floor(overloaded.currentLoad - (overloaded.maxConcurrent * targetUtilization / 100));
      
      if (excessLoad > 0 && underloadedProctors.length > 0) {
        // Find best target proctor
        const target = underloadedProctors.sort((a, b) => b.available - a.available)[0];
        
        if (target && target.available > 0) {
          const movesToMake = Math.min(excessLoad, target.available, 3); // Limit moves per cycle
          
          if (movesToMake > 0) {
            rebalancingPlan.push({
              fromProctorId: overloaded.proctorId,
              toProctorId: target.proctorId,
              candidatesToMove: movesToMake,
              fromUtilization: overloaded.utilization.toFixed(1) + '%',
              toUtilization: target.utilization.toFixed(1) + '%'
            });

            // Update available capacity for next iteration
            target.available -= movesToMake;
            totalMoves += movesToMake;
          }
        }
      }
    }

    if (rebalancingPlan.length === 0) {
      return res.json({
        message: 'No rebalancing possible - insufficient available capacity',
        currentUtilization: overallUtilization.toFixed(1) + '%',
        overloadedProctors: overloadedProctors.length,
        underloadedProctors: underloadedProctors.length,
        timestamp: new Date().toISOString()
      });
    }

    // Execute rebalancing plan (simulation)
    const rebalanceId = require('uuid').v4();
    const executedMoves = [];

    for (const plan of rebalancingPlan) {
      // In a real implementation, this would move actual sessions
      // For now, we'll create rebalancing assignment records
      
      for (let i = 0; i < plan.candidatesToMove; i++) {
        const moveId = require('uuid').v4();
        const assignment = {
          assignmentId: moveId,
          candidateId: `candidate_${moveId}`, // Would be actual candidate IDs
          proctorId: plan.toProctorId,
          originalProctor: plan.fromProctorId,
          assignmentType: 'rebalance',
          reason: `Load rebalancing: ${reason}`,
          priority: 4,
          timestamp: new Date().toISOString(),
          rebalanceId,
          ghostProctorId
        };

        // Store assignment
        await req.redis.hset(`assignment:${moveId}`, assignment);
        await req.redis.expire(`assignment:${moveId}`, 86400);
        
        // Add to rebalance queue
        await req.redis.lpush('assignments:rebalance', moveId);
        
        executedMoves.push(assignment);
      }
    }

    // Store rebalancing operation record
    await req.redis.hset(`rebalance:${rebalanceId}`, {
      ghostProctorId: ghostProctorId || 'system',
      reason,
      targetUtilization,
      originalUtilization: overallUtilization.toFixed(1),
      plannedMoves: JSON.stringify(rebalancingPlan),
      executedMoves: totalMoves,
      timestamp: new Date().toISOString()
    });
    await req.redis.expire(`rebalance:${rebalanceId}`, 86400);

    // Notify via WebSocket
    req.io.emit('load_rebalance', {
      type: 'rebalancing_started',
      rebalanceId,
      plan: rebalancingPlan,
      totalMoves,
      timestamp: new Date().toISOString()
    });

    req.logger.info('Load rebalancing initiated', {
      rebalanceId,
      ghostProctorId,
      originalUtilization: overallUtilization.toFixed(1),
      totalMoves,
      planCount: rebalancingPlan.length
    });

    res.json({
      message: 'Load rebalancing initiated successfully',
      rebalanceId,
      plan: rebalancingPlan,
      summary: {
        originalUtilization: overallUtilization.toFixed(1) + '%',
        targetUtilization: targetUtilization + '%',
        totalMoves,
        overloadedProctors: overloadedProctors.length,
        underloadedProctors: underloadedProctors.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Load rebalancing error:', error);
    res.status(500).json({
      error: 'Failed to initiate load rebalancing',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Get assignment details  
router.get('/assignment/:assignmentId', async (req: any, res: Response) => {
  try {
    const { assignmentId } = req.params;

    const assignmentData = await req.redis.hgetall(`assignment:${assignmentId}`);

    if (!assignmentData.candidateId) {
      return res.status(404).json({
        error: 'Assignment not found',
        assignmentId,
        service: 'ghost-proctor-service-p7'
      });
    }

    // Parse complex fields
    const context = assignmentData.context ? JSON.parse(assignmentData.context) : null;
    
    const assignment = {
      assignmentId,
      candidateId: assignmentData.candidateId,
      proctorId: assignmentData.proctorId,
      ghostProctorId: assignmentData.ghostProctorId,
      assignmentType: assignmentData.assignmentType,
      reason: assignmentData.reason,
      priority: parseInt(assignmentData.priority) || 0,
      timestamp: assignmentData.timestamp,
      originalProctor: assignmentData.originalProctor,
      rebalanceId: assignmentData.rebalanceId,
      context
    };

    // Get additional details if available
    if (assignment.candidateId) {
      // Get candidate session status
      const sessionData = await req.redis.hgetall(`gatekeeper:session:${assignmentData.sessionId}`);
      if (sessionData.candidateId) {
        assignment['sessionStatus'] = {
          sessionId: assignmentData.sessionId,
          entryState: sessionData.entryState,
          verificationFlag: sessionData.verificationFlag
        };
      }
    }

    res.json({
      assignment,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    req.logger.error('Assignment details error:', error);
    res.status(500).json({
      error: 'Failed to get assignment details',
      service: 'ghost-proctor-service-p7'
    });
  }
});

// Cancel emergency assignment
router.delete('/assignment/:assignmentId', async (req: any, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const { reason = 'Assignment cancelled', ghostProctorId } = req.body;

    const assignmentData = await req.redis.hgetall(`assignment:${assignmentId}`);

    if (!assignmentData.candidateId) {
      return res.status(404).json({
        error: 'Assignment not found',
        assignmentId,
        service: 'ghost-proctor-service-p7'
      });
    }

    // Remove from queues
    const assignmentType = assignmentData.assignmentType;
    await req.redis.lrem(`assignments:${assignmentType}`, 1, assignmentId);

    // Clear candidate assignment marker
    await req.redis.del(`candidate:${assignmentData.candidateId}:active_assignment`);

    // Reduce proctor load if it was a normal assignment
    if (assignmentType === 'normal' || assignmentType === 'emergency') {
      const currentLoad = await req.redis.hget(`proctor:${assignmentData.proctorId}:capacity`, 'current_load');
      if (currentLoad && parseInt(currentLoad) > 0) {
        await req.redis.hincrby(`proctor:${assignmentData.proctorId}:capacity`, 'current_load', -1);
      }
    }

    // Mark assignment as cancelled
    await req.redis.hset(`assignment:${assignmentId}`, {
      status: 'cancelled',
      cancelledBy: ghostProctorId || 'system',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason
    });
    await req.redis.expire(`assignment:${assignmentId}`, 86400);

    // Add to cancelled assignments log
    await req.redis.lpush('assignments:cancelled', assignmentId);
    await req.redis.expire('assignments:cancelled', 86400);

    // Notify via WebSocket
    req.io.emit('assignment_cancelled', {
      type: 'assignment_cancelled',
      assignmentId,
      candidateId: assignmentData.candidateId,
      proctorId: assignmentData.proctorId,
      reason,
      timestamp: new Date().toISOString()
    });

    req.logger.info('Emergency assignment cancelled', {
      assignmentId,
      candidateId: assignmentData.candidateId,
      proctorId: assignmentData.proctorId,
      cancelledBy: ghostProctorId || 'system',
      reason
    });

    res.json({
      message: 'Assignment cancelled successfully',
      assignmentId,
      candidateId: assignmentData.candidateId,
      proctorId: assignmentData.proctorId,
      cancelledAt: new Date().toISOString(),
      reason
    });

  } catch (error) {
    req.logger.error('Assignment cancellation error:', error);
    res.status(500).json({
      error: 'Failed to cancel assignment',
      service: 'ghost-proctor-service-p7'
    });
  }
});

export default router;