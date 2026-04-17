"""Pydantic models for audio analysis."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class ViolationType(str, Enum):
    """Types of audio violations that can be detected."""
    MIC_MUTED = "audio"  # Microphone muted (m1)
    BACKGROUND_NOISE = "audio"  # Background noise detected (m2) 
    MULTIPLE_SPEAKERS = "audio"  # Multiple speakers detected (a1)
    UNAUTHORIZED_SPEECH = "audio"  # Unauthorized speech patterns


class ViolationSeverity(str, Enum):
    """Severity levels for violations."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ViolationData(BaseModel):
    """Audio violation information."""
    code: str = Field(..., description="Violation code (e.g., m1, m2, a1)")
    type: ViolationType = Field(..., description="Violation type category")
    severity: ViolationSeverity = Field(..., description="Violation severity")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    description: str = Field(..., description="Human-readable description")
    timestamp: float = Field(..., description="Unix timestamp when detected")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional data")
    duration_ms: Optional[int] = Field(None, description="Duration of violation")


class NoiseAnalysis(BaseModel):
    """Background noise analysis results."""
    background_noise_level: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Background noise level (0-1)"
    )
    speech_detected: bool = Field(..., description="Whether speech was detected")
    multiple_voices: bool = Field(..., description="Multiple voices detected")
    noise_violation: bool = Field(..., description="Noise level exceeds threshold")
    dominant_frequencies: List[float] = Field(
        default_factory=list,
        description="Dominant frequency components"
    )
    snr_db: Optional[float] = Field(None, description="Signal-to-noise ratio in dB")


class SpeechAnalysis(BaseModel):
    """Speech analysis results."""
    speaking_duration: float = Field(
        ..., 
        ge=0.0, 
        description="Duration of speech in seconds"
    )
    silence_duration: float = Field(
        ..., 
        ge=0.0, 
        description="Duration of silence in seconds"
    )
    speech_clarity: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Speech clarity score"
    )
    words_detected: int = Field(default=0, description="Number of words detected")
    transcription_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Transcription confidence"
    )
    language_detected: Optional[str] = Field(
        None,
        description="Detected language code"
    )


class SpeakerAnalysis(BaseModel):
    """Speaker diarization analysis."""
    speaker_count: int = Field(..., ge=0, description="Number of unique speakers")
    primary_speaker_duration: float = Field(
        ..., 
        ge=0.0, 
        description="Primary speaker duration"
    )
    speaker_changes: int = Field(
        default=0, 
        ge=0, 
        description="Number of speaker changes"
    )
    speaker_confidence: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Speaker detection confidence"
    )
    speakers: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Individual speaker information"
    )


class AudioMetrics(BaseModel):
    """Audio quality and processing metrics."""
    duration_seconds: float = Field(..., ge=0.0, description="Audio duration")
    sample_rate: int = Field(..., description="Audio sample rate")
    channels: int = Field(..., description="Number of audio channels")
    bit_depth: Optional[int] = Field(None, description="Audio bit depth")
    rms_level: float = Field(..., description="RMS audio level")
    peak_level: float = Field(..., description="Peak audio level")
    zero_crossing_rate: float = Field(..., description="Zero crossing rate")
    spectral_centroid: float = Field(..., description="Spectral centroid")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


class AudioAnalysisRequest(BaseModel):
    """Request model for audio analysis."""
    audio: str = Field(..., description="Base64 encoded audio data")
    sample_rate: Optional[int] = Field(
        None,
        description="Audio sample rate (will detect if not provided)"
    )
    session_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Session-specific configuration"
    )
    session_id: Optional[str] = Field(None, description="Session ID")
    participant_id: Optional[str] = Field(None, description="Participant ID")
    timestamp: Optional[float] = Field(None, description="Audio timestamp")
    chunk_id: Optional[str] = Field(None, description="Audio chunk identifier")


class TranscriptionRequest(BaseModel):
    """Request model for audio transcription."""
    audio: str = Field(..., description="Base64 encoded audio data")
    language: Optional[str] = Field(None, description="Expected language")
    session_id: Optional[str] = Field(None, description="Session ID")
    

class AudioAnalysisResponse(BaseModel):
    """Response model for comprehensive audio analysis."""
    success: bool = Field(..., description="Whether analysis was successful")
    violations: List[ViolationData] = Field(
        default_factory=list,
        description="Detected violations"
    )
    noise_detection: NoiseAnalysis = Field(..., description="Noise analysis results")
    speech_analysis: SpeechAnalysis = Field(..., description="Speech analysis results")
    speaker_analysis: Optional[SpeakerAnalysis] = Field(
        None,
        description="Speaker analysis (if enabled)"
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Overall analysis confidence"
    )
    processing_time_ms: float = Field(..., description="Processing time")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional analysis metadata"
    )


class TranscriptionResponse(BaseModel):
    """Response model for audio transcription."""
    success: bool = Field(..., description="Whether transcription was successful")
    transcription: str = Field(default="", description="Transcribed text")
    language: str = Field(..., description="Detected/used language")
    confidence: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Transcription confidence"
    )
    words: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Word-level timestamps and confidence"
    )
    segments: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Segment-level information"
    )
    processing_time_ms: float = Field(..., description="Processing time")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional transcription metadata"
    )


class SpeakerDetectionResponse(BaseModel):
    """Response model for speaker detection/diarization."""
    success: bool = Field(..., description="Whether detection was successful")
    speaker_count: int = Field(..., ge=0, description="Number of speakers detected")
    speakers: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Speaker information with timestamps"
    )
    processing_time_ms: float = Field(..., description="Processing time")
    

# Session configuration models
class SessionConfig(BaseModel):
    """Configuration for session-specific audio analysis."""
    noise_detection: bool = Field(default=True, description="Enable noise detection")
    speech_analysis: bool = Field(default=True, description="Enable speech analysis")
    speaker_diarization: bool = Field(default=True, description="Enable speaker detection")
    transcription: bool = Field(default=False, description="Enable transcription")
    
    # Thresholds
    noise_threshold: Optional[float] = Field(
        default=None,
        description="Override noise threshold"
    )
    speech_threshold: Optional[float] = Field(
        default=None, 
        description="Override speech threshold"
    )
    max_speakers_allowed: int = Field(default=1, description="Max speakers allowed")
    
    # Processing options
    chunk_duration: Optional[int] = Field(
        default=None,
        description="Override chunk duration"
    )
    language: Optional[str] = Field(
        default=None,
        description="Expected audio language"
    )