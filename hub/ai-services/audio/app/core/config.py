"""Configuration settings for Audio AI service."""

import os
from typing import List, Optional
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application settings."""
    
    # Service Configuration
    SERVICE_NAME: str = Field(default="ai-audio", description="Service name")
    SERVICE_VERSION: str = Field(default="1.0.0", description="Service version")
    PORT: int = Field(default=8002, description="Service port")
    HOST: str = Field(default="0.0.0.0", description="Service host")
    LOG_LEVEL: str = Field(default="info", description="Logging level")
    
    # Whisper Configuration
    WHISPER_MODEL: str = Field(default="base", description="Whisper model size")
    WHISPER_DEVICE: str = Field(default="cpu", description="Device for Whisper inference")
    WHISPER_LANGUAGE: str = Field(default="en", description="Primary language for transcription")
    
    # Audio Processing Configuration
    SAMPLE_RATE: int = Field(default=16000, description="Audio sample rate")
    CHUNK_DURATION_SECONDS: int = Field(default=5, description="Audio chunk duration")
    SILENCE_THRESHOLD: float = Field(default=0.01, description="Silence detection threshold")
    NOISE_THRESHOLD: float = Field(default=0.5, description="Background noise threshold")
    SPEECH_THRESHOLD: float = Field(default=0.3, description="Speech detection threshold")
    
    # Speaker Detection
    MAX_SPEAKERS: int = Field(default=1, description="Maximum allowed speakers")
    SPEAKER_DIARIZATION_ENABLED: bool = Field(default=True, description="Enable speaker diarization")
    SPEAKER_CONFIDENCE_THRESHOLD: float = Field(default=0.5, description="Speaker detection confidence")
    
    # Violation Configuration
    DEDUPLICATION_WINDOW_SECONDS: int = Field(default=10, description="Deduplication window")
    VIOLATION_COOLDOWN_SECONDS: int = Field(default=5, description="Violation cooldown")
    
    # Performance Configuration
    MAX_AUDIO_SIZE_MB: int = Field(default=50, description="Maximum audio file size")
    BATCH_SIZE: int = Field(default=1, description="Batch size for processing")
    MAX_CONCURRENT_ANALYSIS: int = Field(default=3, description="Max concurrent analysis")
    
    # API Configuration
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3003", "http://localhost:3001"],
        description="Allowed CORS origins"
    )
    
    # Monitoring
    METRICS_ENABLED: bool = Field(default=True, description="Enable metrics collection")
    HEALTH_CHECK_INTERVAL: int = Field(default=30, description="Health check interval")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()