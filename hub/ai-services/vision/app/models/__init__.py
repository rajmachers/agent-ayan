"""Data models for Vision AI service."""

from .detection import (
    DetectionRequest,
    DetectionResponse,
    BoundingBox,
    Detection,
    ViolationData,
    AnalysisRequest,
    AnalysisResponse
)

__all__ = [
    "DetectionRequest",
    "DetectionResponse", 
    "BoundingBox",
    "Detection",
    "ViolationData",
    "AnalysisRequest",
    "AnalysisResponse"
]