"""Data models for Audio AI service."""

from .analysis import (
    AudioAnalysisRequest,
    AudioAnalysisResponse,
    TranscriptionRequest,
    TranscriptionResponse,
    SpeakerDetectionResponse,
    ViolationData,
    AudioMetrics,
    NoiseAnalysis,
    SpeechAnalysis,
    SpeakerAnalysis
)

__all__ = [
    "AudioAnalysisRequest",
    "AudioAnalysisResponse",
    "TranscriptionRequest", 
    "TranscriptionResponse",
    "SpeakerDetectionResponse",
    "ViolationData",
    "AudioMetrics",
    "NoiseAnalysis",
    "SpeechAnalysis",
    "SpeakerAnalysis"
]