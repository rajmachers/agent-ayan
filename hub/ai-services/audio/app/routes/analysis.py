"""Audio analysis endpoints."""

import logging
import time
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional, Dict, Any

from ..core.config import settings
from ..core.exceptions import AudioAIException, ModelNotLoadedException
from ..models.analysis import (
    AudioAnalysisRequest,
    AudioAnalysisResponse,
    SpeakerDetectionResponse,
    SessionConfig
)
from ..services.audio_service import AudioService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analyze", tags=["analysis"])

# Global service instance
audio_service: AudioService = None


def set_audio_service(service: AudioService):
    """Set the global audio service instance."""
    global audio_service
    audio_service = service


@router.post("/audio", response_model=AudioAnalysisResponse)
async def analyze_audio(
    request: AudioAnalysisRequest,
    background_tasks: BackgroundTasks
):
    """Analyze audio for violations and quality metrics."""
    if audio_service is None:
        raise HTTPException(
            status_code=503,
            detail="Audio service not available"
        )
    
    try:
        # Validate request
        if not request.audio:
            raise HTTPException(
                status_code=400,
                detail="Audio data is required"
            )
        
        # Check audio size (base64 encoded size)
        audio_size_mb = len(request.audio) * 0.75 / (1024 * 1024)  # Approximate decoded size
        if audio_size_mb > settings.MAX_AUDIO_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"Audio size ({audio_size_mb:.1f}MB) exceeds limit ({settings.MAX_AUDIO_SIZE_MB}MB)"
            )
        
        # Perform analysis
        result = await audio_service.analyze_audio(
            audio_base64=request.audio,
            sample_rate=request.sample_rate,
            session_config=request.session_config,
            session_id=request.session_id,
            participant_id=request.participant_id
        )
        
        # Log violations for monitoring
        if result.violations:
            violation_codes = [v.code for v in result.violations]
            logger.info(
                f"Detected violations in session {request.session_id}: {violation_codes}"
            )
        
        return result
        
    except AudioAIException as e:
        logger.error(f"Audio AI error: {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(f"Unexpected error in audio analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during audio analysis"
        )


@router.post("/speakers", response_model=SpeakerDetectionResponse)
async def detect_speakers(
    request: AudioAnalysisRequest
):
    """Detect and count speakers in audio."""
    if audio_service is None:
        raise HTTPException(
            status_code=503,
            detail="Audio service not available"
        )
    
    try:
        if not request.audio:
            raise HTTPException(
                status_code=400,
                detail="Audio data is required"
            )
        
        result = await audio_service.detect_speakers(request.audio)
        
        # Log speaker detection results
        if result.success and result.speaker_count > 1:
            logger.info(
                f"Multiple speakers detected in session {request.session_id}: "
                f"{result.speaker_count} speakers"
            )
        
        return result
        
    except AudioAIException as e:
        logger.error(f"Audio AI error: {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(f"Unexpected error in speaker detection: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during speaker detection"
        )


@router.post("/noise")
async def analyze_noise(
    request: AudioAnalysisRequest
):
    """Analyze background noise levels."""
    if audio_service is None:
        raise HTTPException(
            status_code=503,
            detail="Audio service not available"
        )
    
    try:
        if not request.audio:
            raise HTTPException(
                status_code=400,
                detail="Audio data is required"
            )
        
        # Perform full analysis and extract noise component
        result = await audio_service.analyze_audio(
            audio_base64=request.audio,
            sample_rate=request.sample_rate,
            session_config=request.session_config,
            session_id=request.session_id,
            participant_id=request.participant_id
        )
        
        return {
            "success": result.success,
            "noise_analysis": result.noise_detection,
            "processing_time_ms": result.processing_time_ms
        }
        
    except AudioAIException as e:
        logger.error(f"Audio AI error: {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(f"Unexpected error in noise analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during noise analysis"
        )


@router.delete("/session/{session_id}")
async def clear_session(
    session_id: str,
    background_tasks: BackgroundTasks
):
    """Clear session-specific data and violations."""
    if audio_service is None:
        raise HTTPException(
            status_code=503,
            detail="Audio service not available"
        )
    
    try:
        # Clear violations for session
        background_tasks.add_task(
            audio_service.violation_mapper.clear_session_violations,
            session_id
        )
        
        return {
            "success": True,
            "message": f"Session {session_id} cleared",
            "timestamp": time.time()
        }
        
    except Exception as e:
        logger.error(f"Error clearing session {session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during session cleanup"
        )


@router.get("/config")
async def get_analysis_config():
    """Get current analysis configuration."""
    return {
        "whisper_model": settings.WHISPER_MODEL,
        "sample_rate": settings.SAMPLE_RATE,
        "chunk_duration": settings.CHUNK_DURATION_SECONDS,
        "thresholds": {
            "silence": settings.SILENCE_THRESHOLD,
            "noise": settings.NOISE_THRESHOLD,
            "speech": settings.SPEECH_THRESHOLD
        },
        "speaker_settings": {
            "diarization_enabled": settings.SPEAKER_DIARIZATION_ENABLED,
            "max_speakers": settings.MAX_SPEAKERS,
            "confidence_threshold": settings.SPEAKER_CONFIDENCE_THRESHOLD
        },
        "violation_settings": {
            "deduplication_window": settings.DEDUPLICATION_WINDOW_SECONDS,
            "cooldown": settings.VIOLATION_COOLDOWN_SECONDS
        },
        "performance": {
            "max_audio_size_mb": settings.MAX_AUDIO_SIZE_MB,
            "max_concurrent": settings.MAX_CONCURRENT_ANALYSIS,
            "batch_size": settings.BATCH_SIZE
        }
    }