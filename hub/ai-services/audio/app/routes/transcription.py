"""Audio transcription endpoints."""

import logging
from fastapi import APIRouter, HTTPException
from typing import Optional

from ..core.config import settings
from ..core.exceptions import AudioAIException
from ..models.analysis import (
    TranscriptionRequest,
    TranscriptionResponse
)
from ..services.audio_service import AudioService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transcribe", tags=["transcription"])

# Global service instance
audio_service: AudioService = None


def set_audio_service(service: AudioService):
    """Set the global audio service instance."""
    global audio_service
    audio_service = service


@router.post("/", response_model=TranscriptionResponse)
async def transcribe_audio(
    request: TranscriptionRequest
):
    """Transcribe audio to text using Whisper."""
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
        
        # Check audio size
        audio_size_mb = len(request.audio) * 0.75 / (1024 * 1024)
        if audio_size_mb > settings.MAX_AUDIO_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"Audio size ({audio_size_mb:.1f}MB) exceeds limit ({settings.MAX_AUDIO_SIZE_MB}MB)"
            )
        
        result = await audio_service.transcribe_audio(
            audio_base64=request.audio,
            language=request.language
        )
        
        # Log transcription for monitoring
        if result.success and result.transcription:
            word_count = len(result.transcription.split())
            logger.info(
                f"Transcribed audio for session {request.session_id}: "
                f"{word_count} words, confidence: {result.confidence:.2f}"
            )
        
        return result
        
    except AudioAIException as e:
        logger.error(f"Audio AI error: {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(f"Unexpected error in transcription: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during transcription"
        )


@router.post("/batch")
async def transcribe_batch(
    requests: list[TranscriptionRequest]
):
    """Transcribe multiple audio files in batch."""
    if audio_service is None:
        raise HTTPException(
            status_code=503,
            detail="Audio service not available"
        )
    
    if len(requests) > settings.BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size ({len(requests)}) exceeds limit ({settings.BATCH_SIZE})"
        )
    
    results = []
    
    for i, request in enumerate(requests):
        try:
            if not request.audio:
                results.append({
                    "index": i,
                    "success": False,
                    "error": "Audio data is required"
                })
                continue
            
            result = await audio_service.transcribe_audio(
                audio_base64=request.audio,
                language=request.language
            )
            
            results.append({
                "index": i,
                "success": result.success,
                "result": result
            })
            
        except Exception as e:
            logger.error(f"Error transcribing batch item {i}: {e}")
            results.append({
                "index": i,
                "success": False,
                "error": str(e)
            })
    
    return {
        "success": True,
        "results": results,
        "total_processed": len(results)
    }


@router.get("/languages")
async def get_supported_languages():
    """Get list of supported languages for transcription."""
    # Whisper supported languages
    languages = {
        "en": "English",
        "es": "Spanish", 
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "ru": "Russian",
        "zh": "Chinese",
        "ja": "Japanese",
        "ko": "Korean",
        "ar": "Arabic",
        "hi": "Hindi",
        "auto": "Auto-detect"
    }
    
    return {
        "supported_languages": languages,
        "default_language": settings.WHISPER_LANGUAGE,
        "model": settings.WHISPER_MODEL
    }