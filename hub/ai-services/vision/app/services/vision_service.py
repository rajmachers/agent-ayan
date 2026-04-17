"""Main vision service using YOLOv8 for object detection."""

import asyncio
import base64
import io
import logging
import time
from typing import List, Optional, Dict, Any
from PIL import Image
import numpy as np
import cv2
from ultralytics import YOLO

from ..core.config import settings
from ..core.exceptions import (
    ModelNotLoadedException,
    InvalidImageException, 
    ProcessingException
)
from ..models.detection import (
    Detection,
    ViolationData,
    BoundingBox,
    AnalysisResponse,
    DetectionResponse
)
from .violation_mapper import ViolationMapper


logger = logging.getLogger(__name__)


class VisionService:
    """YOLOv8-based vision service for proctoring violations."""
    
    def __init__(self):
        """Initialize the vision service."""
        self.model: Optional[YOLO] = None
        self.violation_mapper = ViolationMapper()
        self._model_loaded = False
        self._stats = {
            "frames_processed": 0,
            "violations_detected": 0,
            "average_processing_time": 0.0,
            "last_processing_time": 0.0,
            "model_version": "yolov8n"
        }
        
    async def initialize(self) -> None:
        """Initialize the YOLO model."""
        try:
            logger.info(f"Loading YOLO model: {settings.YOLO_MODEL_PATH}")
            
            # Load model in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            self.model = await loop.run_in_executor(
                None,
                self._load_model
            )
            
            # Warm up model with dummy inference
            await self._warmup_model()
            
            self._model_loaded = True
            logger.info("YOLO model loaded and warmed up successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize vision service: {e}")
            raise ProcessingException(f"Model initialization failed: {str(e)}")
            
    def _load_model(self) -> YOLO:
        """Load YOLO model (runs in thread pool)."""
        return YOLO(settings.YOLO_MODEL_PATH)
        
    async def _warmup_model(self) -> None:
        """Warm up model with dummy inference."""
        try:
            # Create dummy image
            dummy_image = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
            
            # Run inference
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self._run_inference,
                dummy_image
            )
            
            logger.info("Model warmup completed")
            
        except Exception as e:
            logger.warning(f"Model warmup failed: {e}")
            
    def is_ready(self) -> bool:
        """Check if model is loaded and ready."""
        return self._model_loaded and self.model is not None
        
    async def analyze_frame(
        self,
        image_data: str,
        session_config: Dict[str, Any] = None,
        session_id: str = None,
        participant_id: str = None,
        timestamp: float = None
    ) -> AnalysisResponse:
        """Analyze a frame for violations."""
        if not self.is_ready():
            raise ModelNotLoadedException("YOLO model not loaded")
            
        start_time = time.time()
        
        try:
            # Decode and preprocess image
            image = await self._decode_image(image_data)
            processed_image = await self._preprocess_image(image)
            
            # Run object detection
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                None,
                self._run_inference,
                processed_image
            )
            
            # Parse detections
            detections = self._parse_detections(results)
            
            # Map to violations
            violations = self.violation_mapper.map_detections_to_violations(
                detections=detections,
                session_id=session_id or "unknown",
                timestamp=timestamp or time.time()
            )
            
            # Calculate processing time
            processing_time = (time.time() - start_time) * 1000
            
            # Update statistics
            self._update_stats(processing_time, len(violations))
            
            # Clean up old violation tracking
            self.violation_mapper.cleanup_old_violations()
            
            return AnalysisResponse(
                success=True,
                violations=violations,
                detections=detections,
                confidence=self._calculate_overall_confidence(detections),
                processing_time_ms=processing_time,
                metadata={
                    "session_id": session_id,
                    "participant_id": participant_id,
                    "image_size": {
                        "width": image.width,
                        "height": image.height
                    },
                    "detections_count": len(detections),
                    "violations_count": len(violations),
                    "model_version": self._stats["model_version"],
                    "processing_device": settings.DEVICE
                }
            )
            
        except Exception as e:
            logger.error(f"Frame analysis failed: {e}")
            processing_time = (time.time() - start_time) * 1000
            
            return AnalysisResponse(
                success=False,
                violations=[],
                detections=[],
                confidence=0.0,
                processing_time_ms=processing_time,
                metadata={
                    "error": str(e),
                    "session_id": session_id,
                    "participant_id": participant_id
                }
            )
            
    async def detect_objects(
        self,
        image_data: str,
        session_id: str = None,
        frame_id: str = None
    ) -> DetectionResponse:
        """Detect objects in an image without violation mapping."""
        if not self.is_ready():
            raise ModelNotLoadedException("YOLO model not loaded")
            
        start_time = time.time()
        
        try:
            # Decode and preprocess image
            image = await self._decode_image(image_data)
            processed_image = await self._preprocess_image(image)
            
            # Run object detection
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                None,
                self._run_inference,
                processed_image
            )
            
            # Parse detections
            detections = self._parse_detections(results)
            
            processing_time = (time.time() - start_time) * 1000
            
            return DetectionResponse(
                success=True,
                detections=detections,
                processing_time_ms=processing_time,
                image_size={
                    "width": image.width,
                    "height": image.height
                },
                model_version=self._stats["model_version"],
                timestamp=time.time()
            )
            
        except Exception as e:
            logger.error(f"Object detection failed: {e}")
            raise ProcessingException(f"Detection failed: {str(e)}")
            
    async def _decode_image(self, image_data: str) -> Image.Image:
        """Decode base64 image data."""
        try:
            # Remove data URL prefix if present
            if image_data.startswith('data:image'):
                image_data = image_data.split(',', 1)[1]
                
            # Decode base64
            image_bytes = base64.b64decode(image_data)
            
            # Open with PIL
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
                
            return image
            
        except Exception as e:
            logger.error(f"Image decoding failed: {e}")
            raise InvalidImageException(f"Failed to decode image: {str(e)}")
            
    async def _preprocess_image(self, image: Image.Image) -> np.ndarray:
        """Preprocess image for YOLO inference."""
        try:
            # Resize if too large
            if max(image.width, image.height) > settings.MAX_IMAGE_SIZE:
                # Calculate new size maintaining aspect ratio
                aspect_ratio = image.width / image.height
                if image.width > image.height:
                    new_width = settings.MAX_IMAGE_SIZE
                    new_height = int(settings.MAX_IMAGE_SIZE / aspect_ratio)
                else:
                    new_height = settings.MAX_IMAGE_SIZE
                    new_width = int(settings.MAX_IMAGE_SIZE * aspect_ratio)
                    
                image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
            # Convert to numpy array for OpenCV
            image_array = np.array(image)
            
            # Convert RGB to BGR for OpenCV (YOLO expects BGR)
            image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            
            return image_bgr
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            raise ProcessingException(f"Image preprocessing failed: {str(e)}")
            
    def _run_inference(self, image: np.ndarray):
        """Run YOLO inference (called in thread pool)."""
        try:
            results = self.model(
                image,
                conf=settings.CONFIDENCE_THRESHOLD,
                iou=settings.IOU_THRESHOLD,
                max_det=settings.MAX_DETECTIONS,
                device=settings.DEVICE,
                verbose=False
            )
            return results
            
        except Exception as e:
            logger.error(f"YOLO inference failed: {e}")
            raise ProcessingException(f"Inference failed: {str(e)}")
            
    def _parse_detections(self, results) -> List[Detection]:
        """Parse YOLO results to Detection objects."""
        detections = []
        
        try:
            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue
                    
                for i in range(len(boxes)):
                    # Get box coordinates
                    box = boxes.xyxy[i].cpu().numpy()
                    x1, y1, x2, y2 = box
                    
                    # Get confidence and class
                    confidence = float(boxes.conf[i].cpu().numpy())
                    class_id = int(boxes.cls[i].cpu().numpy())
                    
                    # Get class name
                    class_name = self.model.names[class_id]
                    
                    # Create detection object
                    detection = Detection(
                        class_id=class_id,
                        class_name=class_name,
                        confidence=confidence,
                        bbox=BoundingBox(
                            x1=float(x1),
                            y1=float(y1),
                            x2=float(x2),
                            y2=float(y2)
                        )
                    )
                    
                    detections.append(detection)
                    
        except Exception as e:
            logger.error(f"Detection parsing failed: {e}")
            raise ProcessingException(f"Failed to parse detections: {str(e)}")
            
        return detections
        
    def _calculate_overall_confidence(self, detections: List[Detection]) -> float:
        """Calculate overall confidence score for the analysis."""
        if not detections:
            return 1.0  # High confidence when no objects detected
            
        # Average confidence of all detections
        avg_confidence = sum(d.confidence for d in detections) / len(detections)
        
        # Factor in number of detections (more detections = more confidence)
        detection_factor = min(len(detections) / 10.0, 1.0)
        
        return avg_confidence * (0.7 + 0.3 * detection_factor)
        
    def _update_stats(self, processing_time: float, violations_count: int) -> None:
        """Update internal statistics."""
        self._stats["frames_processed"] += 1
        self._stats["violations_detected"] += violations_count
        self._stats["last_processing_time"] = processing_time
        
        # Update rolling average processing time
        frames = self._stats["frames_processed"]
        current_avg = self._stats["average_processing_time"]
        self._stats["average_processing_time"] = \
            (current_avg * (frames - 1) + processing_time) / frames
            
    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics."""
        return {
            **self._stats,
            "model_loaded": self._model_loaded,
            "violation_stats": self.violation_mapper.get_violation_stats()
        }
        
    async def cleanup(self) -> None:
        """Clean up resources."""
        logger.info("Cleaning up vision service")
        self._model_loaded = False
        self.model = None