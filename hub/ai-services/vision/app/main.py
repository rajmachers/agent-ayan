"""Main FastAPI application for Vision AI service."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from .core.config import settings
from .api.routes import router as api_router
from .services.vision_service import VisionService
from .core.exceptions import VisionAIException

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global vision service instance
vision_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    global vision_service
    
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION}")
    
    try:
        # Initialize vision service
        vision_service = VisionService()
        await vision_service.initialize()
        
        # Store in app state for access in routes
        app.state.vision_service = vision_service
        
        logger.info("Vision AI service initialized successfully")
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize vision service: {e}")
        raise
    finally:
        # Shutdown
        if vision_service:
            await vision_service.cleanup()
        logger.info("Vision AI service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Vision AI Service",
    description="YOLOv8-based computer vision service for proctoring",
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
@app.exception_handler(VisionAIException)
async def vision_ai_exception_handler(request, exc: VisionAIException):
    """Handle custom Vision AI exceptions."""
    logger.error(f"Vision AI error: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.detail,
                "service": "ai-vision"
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
            "analyze": "/api/v1/analyze/frame",
            "detect": "/api/v1/detect",
            "stream": "/api/v1/stream" # WebSocket endpoint
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    try:
        if not hasattr(app.state, 'vision_service') or not app.state.vision_service:
            raise HTTPException(status_code=503, detail="Vision service not initialized")
        
        return {
            "status": "healthy",
            "service": settings.SERVICE_NAME,
            "version": settings.SERVICE_VERSION,
            "model_loaded": app.state.vision_service.is_ready(),
            "device": settings.DEVICE,
            "model_path": settings.YOLO_MODEL_PATH
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