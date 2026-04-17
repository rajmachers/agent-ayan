"""FastAPI application for Audio AI service."""

import logging
import sys
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request, status

from .core.config import settings
from .core.exceptions import AudioAIException
from .services.audio_service import AudioService
from .routes import health_router, analysis_router, transcription_router
from .routes.health import set_audio_service as set_health_audio_service
from .routes.analysis import set_audio_service as set_analysis_audio_service
from .routes.transcription import set_audio_service as set_transcription_audio_service

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Global audio service instance
audio_service = AudioService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    try:
        logger.info(f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION}")
        
        # Initialize audio service
        await audio_service.initialize()
        
        # Set service instance for all route modules
        set_health_audio_service(audio_service)
        set_analysis_audio_service(audio_service) 
        set_transcription_audio_service(audio_service)
        
        logger.info("Audio AI service startup complete")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start Audio AI service: {e}")
        logger.error(traceback.format_exc())
        raise
    finally:
        logger.info("Shutting down Audio AI service...")
        try:
            await audio_service.cleanup()
            logger.info("Audio AI service shutdown complete")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")


def create_app() -> FastAPI:
    """Create FastAPI application."""
    app = FastAPI(
        title="Audio AI Service",
        description="AI-powered audio analysis and transcription for proctoring",
        version=settings.SERVICE_VERSION,
        docs_url="/docs" if settings.LOG_LEVEL.lower() == "debug" else None,
        redoc_url="/redoc" if settings.LOG_LEVEL.lower() == "debug" else None,
        openapi_url="/openapi.json" if settings.LOG_LEVEL.lower() == "debug" else None,
        lifespan=lifespan
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["*"],
    )
    
    # Add routes
    app.include_router(health_router)
    app.include_router(analysis_router)
    app.include_router(transcription_router)
    
    # Exception handlers
    @app.exception_handler(AudioAIException)
    async def audio_ai_exception_handler(request: Request, exc: AudioAIException):
        logger.error(f"Audio AI exception: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_code,
                "detail": exc.detail,
                "timestamp": request.state.start_time if hasattr(request.state, 'start_time') else None
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "INTERNAL_SERVER_ERROR",
                "detail": "An internal server error occurred",
                "timestamp": request.state.start_time if hasattr(request.state, 'start_time') else None
            }
        )
    
    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        import time
        start_time = time.time()
        request.state.start_time = start_time
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        logger.info(
            f"{request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.3f}s"
        )
        
        return response
    
    return app


# Create app instance
app = create_app()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analysis": "/analyze", 
            "transcription": "/transcribe",
            "docs": "/docs" if settings.LOG_LEVEL.lower() == "debug" else "disabled"
        }
    }

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from .core.config import settings
from .api.routes import router as api_router
from .services.audio_service import AudioService
from .core.exceptions import AudioAIException

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global audio service instance
audio_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    global audio_service
    
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION}")
    
    try:
        # Initialize audio service
        audio_service = AudioService()
        await audio_service.initialize()
        
        # Store in app state for access in routes
        app.state.audio_service = audio_service
        
        logger.info("Audio AI service initialized successfully")
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize audio service: {e}")
        raise
    finally:
        # Shutdown
        if audio_service:
            await audio_service.cleanup()
        logger.info("Audio AI service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Audio AI Service",
    description="Whisper-based audio analysis service for proctoring",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add exception handler
@app.exception_handler(AudioAIException)
async def audio_ai_exception_handler(request, exc: AudioAIException):
    """Handle custom Audio AI exceptions."""
    logger.error(f"Audio AI error: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.detail,
                "service": "ai-audio"
            }
        }
    )

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "status": "operational",
        "endpoints": {
            "health": "/health",
            "analyze": "/api/v1/analyze/audio",
            "transcribe": "/api/v1/transcribe",
            "detect_speakers": "/api/v1/detect-speakers"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    try:
        if not hasattr(app.state, 'audio_service') or not app.state.audio_service:
            raise HTTPException(status_code=503, detail="Audio service not initialized")
        
        return {
            "status": "healthy",
            "service": settings.SERVICE_NAME,
            "version": settings.SERVICE_VERSION,
            "models_loaded": app.state.audio_service.is_ready(),
            "device": settings.WHISPER_DEVICE,
            "whisper_model": settings.WHISPER_MODEL,
            "sample_rate": settings.SAMPLE_RATE
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower(),
        reload=False
    )