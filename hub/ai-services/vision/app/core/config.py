"""Configuration settings for Vision AI service."""

import os
from typing import List, Optional
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application settings."""
    
    # Service Configuration
    SERVICE_NAME: str = Field(default="ai-vision", description="Service name")
    SERVICE_VERSION: str = Field(default="1.0.0", description="Service version")
    PORT: int = Field(default=8001, description="Service port")
    HOST: str = Field(default="0.0.0.0", description="Service host")
    LOG_LEVEL: str = Field(default="info", description="Logging level")
    
    # Model Configuration
    YOLO_MODEL_PATH: str = Field(default="yolov8n.pt", description="YOLOv8 model path")
    CONFIDENCE_THRESHOLD: float = Field(default=0.25, description="Detection confidence threshold")
    IOU_THRESHOLD: float = Field(default=0.45, description="IoU threshold for NMS")
    MAX_DETECTIONS: int = Field(default=100, description="Maximum detections per image")
    
    # Violation Configuration
    DEDUPLICATION_WINDOW_SECONDS: int = Field(default=10, description="Deduplication window")
    VIOLATION_COOLDOWN_SECONDS: int = Field(default=5, description="Violation cooldown")
    
    # Performance Configuration
    MAX_IMAGE_SIZE: int = Field(default=1280, description="Maximum image size for processing")
    BATCH_SIZE: int = Field(default=1, description="Batch size for inference")
    DEVICE: str = Field(default="cpu", description="Device for inference (cpu/cuda)")
    
    # API Configuration
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3003", "http://localhost:3001"],
        description="Allowed CORS origins"
    )
    MAX_FILE_SIZE_MB: int = Field(default=10, description="Maximum file size in MB")
    
    # Monitoring
    METRICS_ENABLED: bool = Field(default=True, description="Enable metrics collection")
    HEALTH_CHECK_INTERVAL: int = Field(default=30, description="Health check interval in seconds")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()