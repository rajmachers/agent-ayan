"""Health check endpoints for Audio AI service."""

import time
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from ..core.config import settings
from ..services.audio_service import AudioService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])

# Global service instance
audio_service: AudioService = None


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    service: str 
    version: str
    timestamp: float
    checks: Dict[str, Any]


class ReadinessResponse(BaseModel):
    """Readiness check response model."""
    ready: bool
    service: str
    checks: Dict[str, Any]


def set_audio_service(service: AudioService):
    """Set the global audio service instance."""
    global audio_service
    audio_service = service


@router.get("/", response_model=HealthResponse)
async def health_check():
    """Basic health check endpoint."""
    return HealthResponse(
        status="healthy",
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        timestamp=time.time(),
        checks={
            "api": "operational",
            "config": "loaded"
        }
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_check():
    """Readiness check - verify models are loaded."""
    checks = {}
    ready = True
    
    # Check if service is initialized
    if audio_service is None:
        checks["audio_service"] = "not_available"
        ready = False
    elif not audio_service.is_initialized:
        checks["audio_service"] = "not_initialized" 
        ready = False
    else:
        checks["audio_service"] = "ready"
        
        # Check Whisper model
        if audio_service.whisper_model is None:
            checks["whisper_model"] = "not_loaded"
            ready = False
        else:
            checks["whisper_model"] = "loaded"
            
        # Check diarization pipeline (optional)
        if settings.SPEAKER_DIARIZATION_ENABLED:
            if audio_service.diarization_pipeline is None:
                checks["diarization"] = "not_available"
                # Don't mark as not ready since it's optional
            else:
                checks["diarization"] = "loaded"
        else:
            checks["diarization"] = "disabled"
    
    if not ready:
        raise HTTPException(
            status_code=503,
            detail="Service not ready"
        )
    
    return ReadinessResponse(
        ready=ready,
        service=settings.SERVICE_NAME,
        checks=checks
    )


@router.get("/live")
async def liveness_check():
    """Liveness check for Kubernetes."""
    return {"status": "alive", "timestamp": time.time()}