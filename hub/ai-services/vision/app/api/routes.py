"""API routes for Vision AI service."""

import logging
import time
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, Depends, File, UploadFile
from fastapi.responses import JSONResponse
import base64

from ..models.detection import (
    AnalysisRequest,
    AnalysisResponse,
    DetectionRequest,
    DetectionResponse
)
from ..services.vision_service import VisionService
from ..core.exceptions import VisionAIException
from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


def get_vision_service(request: Request) -> VisionService:
    """Dependency to get vision service from app state."""
    if not hasattr(request.app.state, 'vision_service'):
        raise HTTPException(status_code=503, detail="Vision service not initialized")
    
    vision_service = request.app.state.vision_service
    if not vision_service.is_ready():
        raise HTTPException(status_code=503, detail="Vision service not ready")
        
    return vision_service


@router.post("/analyze/frame", response_model=AnalysisResponse)
async def analyze_frame(
    request: AnalysisRequest,
    vision_service: VisionService = Depends(get_vision_service)
) -> AnalysisResponse:
    """Analyze a frame for violations.
    
    This is the main endpoint used by the Agent Runtime service.
    """
    try:
        logger.debug(f"Analyzing frame for session {request.session_id}")
        
        response = await vision_service.analyze_frame(
            image_data=request.image,
            session_config=request.session_config,
            session_id=request.session_id,
            participant_id=request.participant_id,
            timestamp=request.timestamp
        )
        
        logger.info(
            f"Frame analysis complete: {len(response.violations)} violations, "
            f"{response.processing_time_ms:.1f}ms"
        )
        
        return response
        
    except VisionAIException:
        raise
    except Exception as e:
        logger.error(f"Frame analysis error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Frame analysis failed: {str(e)}"
        )


@router.post("/detect", response_model=DetectionResponse)
async def detect_objects(
    request: DetectionRequest,
    vision_service: VisionService = Depends(get_vision_service)
) -> DetectionResponse:
    """Detect objects in an image without violation mapping."""
    try:
        logger.debug(f"Running object detection for session {request.session_id}")
        
        response = await vision_service.detect_objects(
            image_data=request.image,
            session_id=request.session_id,
            frame_id=request.frame_id
        )
        
        logger.info(
            f"Object detection complete: {len(response.detections)} objects, "
            f"{response.processing_time_ms:.1f}ms"
        )
        
        return response
        
    except VisionAIException:
        raise
    except Exception as e:
        logger.error(f"Object detection error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Object detection failed: {str(e)}"
        )


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    vision_service: VisionService = Depends(get_vision_service)
) -> DetectionResponse:
    """Upload and analyze an image file."""
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail="File must be an image"
            )
            
        # Check file size
        max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        file_content = await file.read()
        
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {settings.MAX_FILE_SIZE_MB}MB"
            )
            
        # Encode to base64
        image_b64 = base64.b64encode(file_content).decode('utf-8')
        
        # Run detection
        response = await vision_service.detect_objects(
            image_data=image_b64,
            session_id="upload",
            frame_id=f"upload_{int(time.time())}"
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"File processing failed: {str(e)}"
        )


@router.get("/stats")
async def get_stats(
    vision_service: VisionService = Depends(get_vision_service)
) -> Dict[str, Any]:
    """Get service statistics and performance metrics."""
    try:
        stats = vision_service.get_stats()
        
        return {
            "success": True,
            "data": {
                "service": {
                    "name": settings.SERVICE_NAME,
                    "version": settings.SERVICE_VERSION,
                    "device": settings.DEVICE,
                    "model_path": settings.YOLO_MODEL_PATH
                },
                "performance": {
                    "frames_processed": stats["frames_processed"],
                    "violations_detected": stats["violations_detected"],
                    "average_processing_time_ms": stats["average_processing_time"],
                    "last_processing_time_ms": stats["last_processing_time"]
                },
                "model": {
                    "loaded": stats["model_loaded"],
                    "version": stats["model_version"],
                    "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
                    "iou_threshold": settings.IOU_THRESHOLD
                },
                "violations": stats["violation_stats"]
            },
            "timestamp": time.time()
        }
        
    except Exception as e:
        logger.error(f"Stats retrieval error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve stats: {str(e)}"
        )


@router.get("/config")
async def get_config() -> Dict[str, Any]:
    """Get current service configuration."""
    return {
        "success": True,
        "data": {
            "service_name": settings.SERVICE_NAME,
            "version": settings.SERVICE_VERSION,
            "model_config": {
                "model_path": settings.YOLO_MODEL_PATH,
                "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
                "iou_threshold": settings.IOU_THRESHOLD,
                "max_detections": settings.MAX_DETECTIONS,
                "device": settings.DEVICE
            },
            "processing_config": {
                "max_image_size": settings.MAX_IMAGE_SIZE,
                "batch_size": settings.BATCH_SIZE,
                "max_file_size_mb": settings.MAX_FILE_SIZE_MB
            },
            "violation_config": {
                "deduplication_window_seconds": settings.DEDUPLICATION_WINDOW_SECONDS,
                "violation_cooldown_seconds": settings.VIOLATION_COOLDOWN_SECONDS
            }
        }
    }


@router.post("/test")
async def test_service(
    vision_service: VisionService = Depends(get_vision_service)
) -> Dict[str, Any]:
    """Test the service with a sample image."""
    try:
        # Create a simple test image (100x100 white square)
        import numpy as np
        from PIL import Image
        import io
        
        # Create test image
        test_image = np.ones((100, 100, 3), dtype=np.uint8) * 255
        pil_image = Image.fromarray(test_image)
        
        # Convert to base64
        buffer = io.BytesIO()
        pil_image.save(buffer, format='JPEG')
        image_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Run detection
        start_time = time.time()
        response = await vision_service.detect_objects(
            image_data=image_b64,
            session_id="test",
            frame_id="test_frame"
        )
        test_time = (time.time() - start_time) * 1000
        
        return {
            "success": True,
            "data": {
                "test_completed": True,
                "test_time_ms": test_time,
                "detections_found": len(response.detections),
                "processing_time_ms": response.processing_time_ms,
                "model_ready": vision_service.is_ready()
            }
        }
        
    except Exception as e:
        logger.error(f"Service test error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Service test failed: {str(e)}"
        )