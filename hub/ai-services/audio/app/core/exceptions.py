"""Custom exceptions for Audio AI service."""

from fastapi import HTTPException


class AudioAIException(HTTPException):
    """Base exception for Audio AI service."""
    
    def __init__(self, detail: str, status_code: int = 500, error_code: str = "AUDIO_AI_ERROR"):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code


class ModelNotLoadedException(AudioAIException):
    """Exception for when audio models are not loaded."""
    
    def __init__(self, detail: str = "Audio models not loaded"):
        super().__init__(detail=detail, status_code=503, error_code="MODEL_NOT_LOADED")


class InvalidAudioException(AudioAIException):
    """Exception for invalid audio input."""
    
    def __init__(self, detail: str = "Invalid audio format or corrupted data"):
        super().__init__(detail=detail, status_code=400, error_code="INVALID_AUDIO")


class ProcessingException(AudioAIException):
    """Exception for processing errors."""
    
    def __init__(self, detail: str = "Error processing audio"):
        super().__init__(detail=detail, status_code=500, error_code="PROCESSING_ERROR")


class TranscriptionException(AudioAIException):
    """Exception for transcription errors."""
    
    def __init__(self, detail: str = "Error transcribing audio"):
        super().__init__(detail=detail, status_code=500, error_code="TRANSCRIPTION_ERROR")