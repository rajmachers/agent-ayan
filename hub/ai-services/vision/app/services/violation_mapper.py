"""Maps YOLO detections to violation codes."""

import time
from typing import List, Dict, Any, Set
from ..models.detection import (
    Detection, 
    ViolationData, 
    ViolationType, 
    ViolationSeverity
)
from ..core.config import settings


class ViolationMapper:
    """Maps object detections to proctoring violations."""
    
    # YOLO class mappings to violations
    VIOLATION_CLASS_MAP = {
        # COCO classes that map to violations
        0: {  # person
            "violation_code": "c3",
            "violation_type": ViolationType.MULTIPLE_PERSONS,
            "severity": ViolationSeverity.HIGH,
            "description": "Multiple persons detected in frame",
            "min_count": 2  # Trigger only if >1 person
        },
        67: {  # cell phone
            "violation_code": "m3", 
            "violation_type": ViolationType.PHONE_DETECTED,
            "severity": ViolationSeverity.CRITICAL,
            "description": "Cell phone detected"
        },
        73: {  # laptop
            "violation_code": "a2",
            "violation_type": ViolationType.UNAUTHORIZED_DEVICE, 
            "severity": ViolationSeverity.MEDIUM,
            "description": "Unauthorized laptop detected"
        },
        76: {  # keyboard (external)
            "violation_code": "a2",
            "violation_type": ViolationType.UNAUTHORIZED_DEVICE,
            "severity": ViolationSeverity.MEDIUM, 
            "description": "External keyboard detected"
        },
        84: {  # book
            "violation_code": "h1",
            "violation_type": ViolationType.PROHIBITED_OBJECT,
            "severity": ViolationSeverity.MEDIUM,
            "description": "Book or reading material detected"
        }
        # Note: YOLO doesn't have earphones class, would need custom training
    }
    
    def __init__(self):
        """Initialize violation mapper with deduplication tracking."""
        self._recent_violations: Dict[str, float] = {}
        self._violation_counts: Dict[str, int] = {}
        
    def map_detections_to_violations(
        self,
        detections: List[Detection],
        session_id: str = "unknown",
        frame_id: str = None,
        timestamp: float = None
    ) -> List[ViolationData]:
        """Convert YOLO detections to violation data."""
        if timestamp is None:
            timestamp = time.time()
            
        violations = []
        
        # Count detections by class
        class_counts = {}
        for detection in detections:
            class_id = detection.class_id
            class_counts[class_id] = class_counts.get(class_id, 0) + 1
            
        # Process each detected class
        for class_id, count in class_counts.items():
            if class_id not in self.VIOLATION_CLASS_MAP:
                continue
                
            violation_config = self.VIOLATION_CLASS_MAP[class_id]
            
            # Check minimum count requirement (e.g., >1 person)
            min_count = violation_config.get("min_count", 1)
            if count < min_count:
                continue
                
            # Create violation key for deduplication
            violation_key = f"{session_id}:{violation_config['violation_code']}"
            
            # Check deduplication window
            if self._should_deduplicate_violation(violation_key, timestamp):
                continue
                
            # Get highest confidence detection for this class
            best_detection = max(
                [d for d in detections if d.class_id == class_id],
                key=lambda d: d.confidence
            )
            
            # Create violation
            violation = ViolationData(
                code=violation_config["violation_code"],
                type=violation_config["violation_type"],
                severity=violation_config["severity"],
                confidence=best_detection.confidence,
                description=self._get_violation_description(
                    violation_config["description"],
                    count,
                    best_detection
                ),
                timestamp=timestamp,
                metadata={
                    "detection_count": count,
                    "class_id": class_id,
                    "class_name": best_detection.class_name,
                    "bbox": {
                        "x1": best_detection.bbox.x1,
                        "y1": best_detection.bbox.y1,
                        "x2": best_detection.bbox.x2,
                        "y2": best_detection.bbox.y2
                    },
                    "session_id": session_id,
                    "detection_method": "yolov8_object_detection"
                },
                frame_id=frame_id
            )
            
            violations.append(violation)
            
            # Update deduplication tracking
            self._recent_violations[violation_key] = timestamp
            self._violation_counts[violation_key] = \
                self._violation_counts.get(violation_key, 0) + 1
                
        return violations
        
    def _should_deduplicate_violation(
        self, 
        violation_key: str, 
        current_timestamp: float
    ) -> bool:
        """Check if violation should be deduplicated."""
        if violation_key not in self._recent_violations:
            return False
            
        last_timestamp = self._recent_violations[violation_key]
        time_diff = current_timestamp - last_timestamp
        
        return time_diff < settings.DEDUPLICATION_WINDOW_SECONDS
        
    def _get_violation_description(
        self,
        base_description: str,
        count: int,
        detection: Detection
    ) -> str:
        """Generate detailed violation description."""
        if "Multiple persons" in base_description:
            return f"Multiple persons detected ({count} people in frame)"
        elif count > 1:
            return f"{base_description} ({count} detected)"
        else:
            return base_description
            
    def cleanup_old_violations(self, current_timestamp: float = None) -> None:
        """Clean up old violation tracking data."""
        if current_timestamp is None:
            current_timestamp = time.time()
            
        # Remove violations older than deduplication window
        expired_keys = [
            key for key, timestamp in self._recent_violations.items()
            if current_timestamp - timestamp > settings.DEDUPLICATION_WINDOW_SECONDS * 2
        ]
        
        for key in expired_keys:
            self._recent_violations.pop(key, None)
            
    def get_violation_stats(self) -> Dict[str, Any]:
        """Get statistics about detected violations."""
        return {
            "total_violation_types": len(self._violation_counts),
            "violation_counts": dict(self._violation_counts),
            "active_tracking_keys": len(self._recent_violations),
            "last_cleanup": time.time()
        }