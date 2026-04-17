"""API routes for Audio AI service."""

from .analysis import router as analysis_router
from .health import router as health_router
from .transcription import router as transcription_router

__all__ = ["analysis_router", "health_router", "transcription_router"]