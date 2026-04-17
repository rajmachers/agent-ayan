"""Core audio processing service using Whisper and audio analysis."""

import asyncio
import base64
import io
import logging
import time
import traceback
from typing import Optional, Dict, Any, List, Tuple
import numpy as np
import librosa
import whisper
from pyannote.audio import Pipeline
import torch

from ..core.config import settings
from ..core.exceptions import (
    ModelNotLoadedException,
    InvalidAudioException,
    ProcessingException,
    TranscriptionException
)
from ..models.analysis import (
    AudioAnalysisResponse,
    TranscriptionResponse,
    SpeakerDetectionResponse,
    NoiseAnalysis,
    SpeechAnalysis,
    SpeakerAnalysis,
    AudioMetrics,
    ViolationData
)
from .violation_mapper import ViolationMapper

logger = logging.getLogger(__name__)


class AudioService:
    """Service for audio analysis, transcription, and violation detection."""
    
    def __init__(self):
        self.whisper_model: Optional[whisper.Whisper] = None
        self.diarization_pipeline: Optional[Pipeline] = None
        self.violation_mapper = ViolationMapper()
        self.is_initialized = False
        
    async def initialize(self):
        """Initialize audio models and services."""
        try:
            logger.info("Initializing Audio AI service...")
            
            # Load Whisper model
            logger.info(f"Loading Whisper model: {settings.WHISPER_MODEL}")
            self.whisper_model = whisper.load_model(
                settings.WHISPER_MODEL, 
                device=settings.WHISPER_DEVICE
            )
            
            # Load speaker diarization pipeline if enabled
            if settings.SPEAKER_DIARIZATION_ENABLED:
                try:
                    logger.info("Loading speaker diarization pipeline...")
                    # Note: Requires huggingface token for pyannote models
                    # self.diarization_pipeline = Pipeline.from_pretrained(
                    #     "pyannote/speaker-diarization"
                    # )
                    logger.warning("Speaker diarization disabled - requires HuggingFace token")
                except Exception as e:
                    logger.warning(f"Could not load diarization pipeline: {e}")
                    self.diarization_pipeline = None
            
            self.is_initialized = True
            logger.info("Audio AI service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Audio AI service: {e}")
            logger.error(traceback.format_exc())
            raise ProcessingException(f"Initialization failed: {str(e)}")
    
    async def cleanup(self):
        """Cleanup resources."""
        logger.info("Cleaning up Audio AI service...")
        
        # Clear CUDA cache if using GPU
        if settings.WHISPER_DEVICE == "cuda" and torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        self.whisper_model = None
        self.diarization_pipeline = None
        self.is_initialized = False
        
        logger.info("Audio AI service cleanup complete")
    
    def _check_initialization(self):
        """Check if service is properly initialized."""
        if not self.is_initialized or self.whisper_model is None:
            raise ModelNotLoadedException()
    
    async def analyze_audio(
        self,
        audio_base64: str,
        sample_rate: Optional[int] = None,
        session_config: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        participant_id: Optional[str] = None
    ) -> AudioAnalysisResponse:
        """Analyze audio for violations and quality metrics."""
        self._check_initialization()
        start_time = time.time()
        
        try:
            # Decode audio
            audio_data, sr = await self._decode_audio(audio_base64, sample_rate)
            
            # Run all analysis components
            noise_analysis = await self._analyze_noise(audio_data, sr)
            speech_analysis = await self._analyze_speech(audio_data, sr)
            
            speaker_analysis = None
            if settings.SPEAKER_DIARIZATION_ENABLED and self.diarization_pipeline:
                speaker_analysis = await self._analyze_speakers(audio_data, sr)
            
            # Map to violations
            violations = self.violation_mapper.map_violations(
                noise_analysis=noise_analysis,
                speech_analysis=speech_analysis,
                speaker_analysis=speaker_analysis,
                session_id=session_id,
                participant_id=participant_id
            )
            
            processing_time = (time.time() - start_time) * 1000
            
            return AudioAnalysisResponse(
                success=True,
                violations=violations,
                noise_detection=noise_analysis,
                speech_analysis=speech_analysis,
                speaker_analysis=speaker_analysis,
                processing_time_ms=processing_time,
                metadata={
                    "sample_rate": sr,
                    "duration": len(audio_data) / sr,
                    "session_id": session_id,
                    "participant_id": participant_id
                }
            )
            
        except Exception as e:
            logger.error(f"Error analyzing audio: {e}")
            logger.error(traceback.format_exc())
            
            processing_time = (time.time() - start_time) * 1000
            
            return AudioAnalysisResponse(
                success=False,
                violations=[],
                noise_detection=NoiseAnalysis(
                    background_noise_level=0.0,
                    speech_detected=False,
                    multiple_voices=False,
                    noise_violation=False,
                    dominant_frequencies=[]
                ),
                speech_analysis=SpeechAnalysis(
                    speaking_duration=0.0,
                    silence_duration=0.0,
                    speech_clarity=0.0
                ),
                processing_time_ms=processing_time,
                metadata={"error": str(e)}
            )
    
    async def transcribe_audio(
        self,
        audio_base64: str,
        language: Optional[str] = None
    ) -> TranscriptionResponse:
        """Transcribe audio to text."""
        self._check_initialization()
        start_time = time.time()
        
        try:
            # Decode audio
            audio_data, sr = await self._decode_audio(audio_base64)
            
            # Transcribe with Whisper
            result = self.whisper_model.transcribe(
                audio_data,
                language=language or settings.WHISPER_LANGUAGE,
                task="transcribe"
            )
            
            processing_time = (time.time() - start_time) * 1000
            
            return TranscriptionResponse(
                success=True,
                transcription=result["text"],
                language=result.get("language", language or settings.WHISPER_LANGUAGE),
                confidence=self._calculate_transcription_confidence(result),
                words=result.get("words", []),
                segments=result.get("segments", []),
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            raise TranscriptionException(f"Transcription failed: {str(e)}")
    
    async def detect_speakers(
        self,
        audio_base64: str
    ) -> SpeakerDetectionResponse:
        """Detect and count speakers in audio."""
        self._check_initialization()
        start_time = time.time()
        
        try:
            if not self.diarization_pipeline:
                # Fallback to simple speaker counting
                audio_data, sr = await self._decode_audio(audio_base64)
                speaker_analysis = await self._analyze_speakers_simple(audio_data, sr)
            else:
                # Use pyannote diarization
                audio_data, sr = await self._decode_audio(audio_base64)
                speaker_analysis = await self._analyze_speakers(audio_data, sr)
            
            processing_time = (time.time() - start_time) * 1000
            
            return SpeakerDetectionResponse(
                success=True,
                speaker_count=speaker_analysis.speaker_count,
                speakers=speaker_analysis.speakers,
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            logger.error(f"Error detecting speakers: {e}")
            return SpeakerDetectionResponse(
                success=False,
                speaker_count=0,
                speakers=[],
                processing_time_ms=(time.time() - start_time) * 1000
            )
    
    async def _decode_audio(
        self, 
        audio_base64: str, 
        target_sample_rate: Optional[int] = None
    ) -> Tuple[np.ndarray, int]:
        """Decode base64 audio data."""
        try:
            # Decode base64
            audio_bytes = base64.b64decode(audio_base64)
            
            # Load with librosa
            audio_data, sr = librosa.load(
                io.BytesIO(audio_bytes),
                sr=target_sample_rate or settings.SAMPLE_RATE,
                mono=True
            )
            
            return audio_data, sr
            
        except Exception as e:
            raise InvalidAudioException(f"Could not decode audio: {str(e)}")
    
    async def _analyze_noise(self, audio_data: np.ndarray, sr: int) -> NoiseAnalysis:
        """Analyze background noise levels."""
        try:
            # Calculate RMS energy
            rms = librosa.feature.rms(y=audio_data)[0]
            background_noise = np.mean(rms)
            
            # Calculate spectral features
            stft = librosa.stft(audio_data)
            magnitude = np.abs(stft)
            
            # Find dominant frequencies
            freqs = librosa.fft_frequencies(sr=sr)
            freq_power = np.mean(magnitude, axis=1)
            dominant_indices = np.argsort(freq_power)[-10:]  # Top 10
            dominant_frequencies = freqs[dominant_indices].tolist()
            
            # Simple voice activity detection
            speech_detected = background_noise > settings.SPEECH_THRESHOLD
            
            # Check for noise violation
            noise_violation = background_noise > settings.NOISE_THRESHOLD
            
            # Estimate SNR (simplified)
            signal_power = np.mean(rms[rms > np.percentile(rms, 75)])
            noise_power = np.mean(rms[rms < np.percentile(rms, 25)])
            snr_db = 10 * np.log10(signal_power / max(noise_power, 1e-10)) if noise_power > 0 else None
            
            return NoiseAnalysis(
                background_noise_level=float(background_noise),
                speech_detected=speech_detected,
                multiple_voices=False,  # Would need more sophisticated analysis
                noise_violation=noise_violation,
                dominant_frequencies=dominant_frequencies,
                snr_db=snr_db
            )
            
        except Exception as e:
            logger.error(f"Error analyzing noise: {e}")
            return NoiseAnalysis(
                background_noise_level=0.0,
                speech_detected=False,
                multiple_voices=False,
                noise_violation=False,
                dominant_frequencies=[]
            )
    
    async def _analyze_speech(self, audio_data: np.ndarray, sr: int) -> SpeechAnalysis:
        """Analyze speech characteristics."""
        try:
            # Calculate speech/silence durations
            rms = librosa.feature.rms(y=audio_data, frame_length=2048)[0]
            
            # Voice activity detection (VAD)
            speech_threshold = settings.SPEECH_THRESHOLD
            speech_frames = rms > speech_threshold
            
            frame_duration = len(audio_data) / sr / len(rms)
            speaking_duration = np.sum(speech_frames) * frame_duration
            silence_duration = np.sum(~speech_frames) * frame_duration
            
            # Calculate speech clarity (spectral clarity)
            if speaking_duration > 0:
                speech_segments = audio_data[librosa.frames_to_samples(np.where(speech_frames)[0])]
                if len(speech_segments) > 0:
                    spectral_centroids = librosa.feature.spectral_centroid(y=speech_segments, sr=sr)[0]
                    speech_clarity = float(np.mean(spectral_centroids) / (sr/2))  # Normalize
                else:
                    speech_clarity = 0.0
            else:
                speech_clarity = 0.0
            
            # Estimate word count (very rough)
            words_detected = max(0, int(speaking_duration * 2))  # ~2 words per second
            
            return SpeechAnalysis(
                speaking_duration=float(speaking_duration),
                silence_duration=float(silence_duration),
                speech_clarity=min(speech_clarity, 1.0),
                words_detected=words_detected,
                transcription_confidence=0.8 if speaking_duration > 1.0 else 0.3
            )
            
        except Exception as e:
            logger.error(f"Error analyzing speech: {e}")
            return SpeechAnalysis(
                speaking_duration=0.0,
                silence_duration=len(audio_data) / sr,
                speech_clarity=0.0
            )
    
    async def _analyze_speakers(self, audio_data: np.ndarray, sr: int) -> SpeakerAnalysis:
        """Analyze speakers using diarization pipeline."""
        if not self.diarization_pipeline:
            return await self._analyze_speakers_simple(audio_data, sr)
        
        try:
            # Use pyannote for speaker diarization
            # This is a simplified version - real implementation would need proper file handling
            duration = len(audio_data) / sr
            
            # For now, use simplified approach
            return await self._analyze_speakers_simple(audio_data, sr)
            
        except Exception as e:
            logger.error(f"Error in speaker diarization: {e}")
            return await self._analyze_speakers_simple(audio_data, sr)
    
    async def _analyze_speakers_simple(self, audio_data: np.ndarray, sr: int) -> SpeakerAnalysis:
        """Simple speaker analysis without diarization."""
        try:
            # Very basic speaker estimation based on spectral variance
            stft = librosa.stft(audio_data, hop_length=512)
            magnitude = np.abs(stft)
            
            # Calculate spectral variance over time
            spectral_variance = np.var(magnitude, axis=0)
            
            # High variance might indicate speaker changes or multiple speakers
            variance_threshold = np.percentile(spectral_variance, 75)
            potential_changes = np.sum(spectral_variance > variance_threshold)
            
            # Very rough estimate
            speaker_count = min(max(1, potential_changes // 10), 4)
            
            duration = len(audio_data) / sr
            
            return SpeakerAnalysis(
                speaker_count=speaker_count,
                primary_speaker_duration=duration * 0.8,  # Assume primary speaker
                speaker_changes=potential_changes,
                speaker_confidence=0.6,  # Low confidence for simple method
                speakers=[
                    {
                        "id": f"speaker_{i}",
                        "duration": duration / speaker_count,
                        "confidence": 0.6
                    }
                    for i in range(speaker_count)
                ]
            )
            
        except Exception as e:
            logger.error(f"Error in simple speaker analysis: {e}")
            return SpeakerAnalysis(
                speaker_count=1,
                primary_speaker_duration=len(audio_data) / sr,
                speaker_changes=0,
                speaker_confidence=0.5,
                speakers=[]
            )
    
    def _calculate_transcription_confidence(self, whisper_result: Dict) -> float:
        """Calculate average confidence from Whisper transcription result."""
        try:
            if "segments" in whisper_result:
                confidences = []
                for segment in whisper_result["segments"]:
                    if "confidence" in segment:
                        confidences.append(segment["confidence"])
                    elif "words" in segment:
                        word_confidences = [
                            word.get("confidence", 0.5) 
                            for word in segment["words"] 
                            if "confidence" in word
                        ]
                        if word_confidences:
                            confidences.append(np.mean(word_confidences))
                
                return float(np.mean(confidences)) if confidences else 0.8
            
            return 0.8  # Default confidence
            
        except Exception:
            return 0.5