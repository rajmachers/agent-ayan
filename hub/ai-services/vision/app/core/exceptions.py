"""Custom exceptions for Vision AI service."""

from fastapi import HTTPException


class VisionAIException(HTTPException):
    """Base exception for Vision AI service."""
    
    def __init__(self, detail: str, status_code: int = 500, error_code: str = "VISION_AI_ERROR"):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code


class ModelNotLoadedException(VisionAIException):
    """Exception for when YOLO model is not loaded."""
    
    def __init__(self, detail: str = "YOLO model not loaded"):
        super().__init__(detail=detail, status_code=503, error_code="MODEL_NOT_LOADED")


class InvalidImageException(VisionAIException):
    """Exception for invalid image input."""
    
    def __init__(self, detail: str = "Invalid image format or corrupted data"):
        super().__init__(detail=detail, status_code=400, error_code="INVALID_IMAGE")


class ProcessingException(VisionAIException):
    """Exception for processing errors."""
    
    def __init__(self, detail: str = "Error processing image"):
        super().__init__(detail=detail, status_code=500, error_code="PROCESSING_ERROR")