"""Pydantic models for detection and analysis."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class ViolationType(str, Enum):
    """Types of violations that can be detected."""
    MULTIPLE_PERSONS = "face"  # Multiple people detected (c3)
    PHONE_DETECTED = "motion"  # Cell phone detected (m3) 
    PROHIBITED_OBJECT = "environmental"  # Book, earphones, etc. (h1)
    LOOKING_AWAY = "gaze"  # Head pose indicating looking away (c5)
    UNAUTHORIZED_DEVICE = "environmental"  # Unauthorized electronic device (a2)


class ViolationSeverity(str, Enum):
    """Severity levels for violations."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class BoundingBox(BaseModel):
    """Bounding box coordinates."""
    x1: float = Field(..., description="Top-left x coordinate")
    y1: float = Field(..., description="Top-left y coordinate")  
    x2: float = Field(..., description="Bottom-right x coordinate")
    y2: float = Field(..., description="Bottom-right y coordinate")
    
    @property
    def width(self) -> float:
        return self.x2 - self.x1
    
    @property
    def height(self) -> float:
        return self.y2 - self.y1
    
    @property
    def center_x(self) -> float:
        return (self.x1 + self.x2) / 2
    
    @property
    def center_y(self) -> float:
        return (self.y1 + self.y2) / 2


class Detection(BaseModel):
    """Single object detection result."""
    class_id: int = Field(..., description="YOLO class ID")
    class_name: str = Field(..., description="Detected object class name")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    bbox: BoundingBox = Field(..., description="Bounding box coordinates")
    
    
class ViolationData(BaseModel):
    """Violation information derived from detections."""
    code: str = Field(..., description="Violation code (e.g., c3, m3, h1)")
    type: ViolationType = Field(..., description="Violation type category")
    severity: ViolationSeverity = Field(..., description="Violation severity")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Violation confidence")
    description: str = Field(..., description="Human-readable description")
    timestamp: float = Field(..., description="Unix timestamp when detected")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional violation data")
    frame_id: Optional[str] = Field(None, description="Frame ID if applicable")
    duration_ms: Optional[int] = Field(None, description="Duration of violation in milliseconds")


class DetectionRequest(BaseModel):
    """Request model for object detection."""
    image: str = Field(..., description="Base64 encoded image")
    session_id: Optional[str] = Field(None, description="Session ID for context")
    participant_id: Optional[str] = Field(None, description="Participant ID")
    timestamp: Optional[float] = Field(None, description="Frame timestamp")
    frame_id: Optional[str] = Field(None, description="Unique frame identifier")
    
    
class AnalysisRequest(BaseModel):
    """Request model for comprehensive frame analysis."""
    image: str = Field(..., description="Base64 encoded image")
    session_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Session-specific configuration"
    )
    session_id: Optional[str] = Field(None, description="Session ID")
    participant_id: Optional[str] = Field(None, description="Participant ID")
    timestamp: Optional[float] = Field(None, description="Frame timestamp")
    
    
class DetectionResponse(BaseModel):
    """Response model for object detection."""
    success: bool = Field(..., description="Whether detection was successful")
    detections: List[Detection] = Field(default_factory=list, description="List of detections")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    image_size: Dict[str, int] = Field(..., description="Original image dimensions")
    model_version: str = Field(..., description="YOLO model version used")
    timestamp: float = Field(..., description="Response timestamp")
    
    
class AnalysisResponse(BaseModel):
    """Response model for comprehensive frame analysis."""
    success: bool = Field(..., description="Whether analysis was successful")
    violations: List[ViolationData] = Field(
        default_factory=list,
        description="Detected violations"
    )
    detections: List[Detection] = Field(
        default_factory=list,
        description="Raw object detections"
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Overall analysis confidence"
    )
    processing_time_ms: float = Field(..., description="Total processing time")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional analysis metadata"
    )
    
    
# Session configuration models
class SessionConfig(BaseModel):
    """Configuration for session-specific analysis."""
    face_verification: bool = Field(default=True, description="Enable face verification")
    object_detection: bool = Field(default=True, description="Enable object detection")
    head_pose_analysis: bool = Field(default=True, description="Enable head pose analysis")
    motion_detection: bool = Field(default=True, description="Enable motion detection")
    
    # Thresholds
    confidence_threshold: Optional[float] = Field(
        default=None,
        description="Override default confidence threshold"
    )
    max_persons_allowed: int = Field(default=1, description="Maximum persons allowed")
    
    # Violation settings
    violation_sensitivity: float = Field(
        default=1.0,
        ge=0.1,
        le=2.0,
        description="Violation sensitivity multiplier"
    )