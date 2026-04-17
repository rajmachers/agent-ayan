"""Maps audio analysis results to violation classifications."""

from typing import List, Dict, Any, Optional
import time
import logging
from ..models.analysis import (
    ViolationData, ViolationType, ViolationSeverity,
    NoiseAnalysis, SpeechAnalysis, SpeakerAnalysis
)
from ..core.config import settings

logger = logging.getLogger(__name__)


class ViolationMapper:
    """Maps audio analysis results to proctoring violations."""
    
    def __init__(self):
        self._last_violations: Dict[str, float] = {}
        
    def map_violations(
        self,
        noise_analysis: NoiseAnalysis,
        speech_analysis: Optional[SpeechAnalysis] = None,
        speaker_analysis: Optional[SpeakerAnalysis] = None,
        session_id: Optional[str] = None,
        participant_id: Optional[str] = None
    ) -> List[ViolationData]:
        """Map analysis results to violations."""
        violations = []
        current_time = time.time()
        
        # M1: Microphone Muted Detection
        silence_violation = self._check_microphone_muted(
            speech_analysis, current_time, session_id
        )
        if silence_violation:
            violations.append(silence_violation)
            
        # M2: Background Noise Detection
        noise_violation = self._check_background_noise(
            noise_analysis, current_time, session_id
        )
        if noise_violation:
            violations.append(noise_violation)
            
        # A1: Multiple Speakers Detection
        if speaker_analysis:
            speaker_violation = self._check_multiple_speakers(
                speaker_analysis, current_time, session_id
            )
            if speaker_violation:
                violations.append(speaker_violation)
                
        return violations
    
    def _check_microphone_muted(
        self,
        speech_analysis: Optional[SpeechAnalysis],
        timestamp: float,
        session_id: Optional[str]
    ) -> Optional[ViolationData]:
        """Check for microphone muted violation (M1)."""
        if not speech_analysis:
            return None
            
        # Detect excessive silence (potential muted mic)
        total_duration = speech_analysis.speaking_duration + speech_analysis.silence_duration
        silence_ratio = speech_analysis.silence_duration / total_duration if total_duration > 0 else 1.0
        
        # Consider it muted if more than 90% silence and very low RMS
        if silence_ratio > 0.9 and speech_analysis.speech_clarity < 0.1:
            violation_key = f"m1_{session_id}"
            
            # Check deduplication
            if self._should_create_violation(violation_key, timestamp):
                self._last_violations[violation_key] = timestamp
                
                return ViolationData(
                    code="m1",
                    type=ViolationType.MIC_MUTED,
                    severity=ViolationSeverity.HIGH,
                    confidence=0.9 if silence_ratio > 0.95 else 0.7,
                    description="Microphone appears to be muted or no audio input detected",
                    timestamp=timestamp,
                    duration_ms=int(speech_analysis.silence_duration * 1000),
                    metadata={
                        "silence_ratio": silence_ratio,
                        "speech_clarity": speech_analysis.speech_clarity,
                        "silence_duration": speech_analysis.silence_duration
                    }
                )
        
        return None
    
    def _check_background_noise(
        self,
        noise_analysis: NoiseAnalysis,
        timestamp: float,
        session_id: Optional[str]
    ) -> Optional[ViolationData]:
        """Check for background noise violation (M2)."""
        if noise_analysis.noise_violation:
            violation_key = f"m2_{session_id}"
            
            # Check deduplication
            if self._should_create_violation(violation_key, timestamp):
                self._last_violations[violation_key] = timestamp
                
                # Determine severity based on noise level
                severity = ViolationSeverity.LOW
                confidence = 0.6
                
                if noise_analysis.background_noise_level > 0.8:
                    severity = ViolationSeverity.CRITICAL
                    confidence = 0.95
                elif noise_analysis.background_noise_level > 0.65:
                    severity = ViolationSeverity.HIGH
                    confidence = 0.85
                elif noise_analysis.background_noise_level > 0.5:
                    severity = ViolationSeverity.MEDIUM
                    confidence = 0.75
                
                return ViolationData(
                    code="m2",
                    type=ViolationType.BACKGROUND_NOISE,
                    severity=severity,
                    confidence=confidence,
                    description=f"Background noise detected (level: {noise_analysis.background_noise_level:.2f})",
                    timestamp=timestamp,
                    metadata={
                        "noise_level": noise_analysis.background_noise_level,
                        "snr_db": noise_analysis.snr_db,
                        "dominant_frequencies": noise_analysis.dominant_frequencies[:5]  # Top 5
                    }
                )
        
        return None
    
    def _check_multiple_speakers(
        self,
        speaker_analysis: SpeakerAnalysis,
        timestamp: float,
        session_id: Optional[str]
    ) -> Optional[ViolationData]:
        """Check for multiple speakers violation (A1)."""
        max_allowed = settings.MAX_SPEAKERS
        
        if speaker_analysis.speaker_count > max_allowed:
            violation_key = f"a1_{session_id}"
            
            # Check deduplication
            if self._should_create_violation(violation_key, timestamp):
                self._last_violations[violation_key] = timestamp
                
                # Higher severity for more speakers
                severity = ViolationSeverity.MEDIUM
                if speaker_analysis.speaker_count > 2:
                    severity = ViolationSeverity.HIGH
                if speaker_analysis.speaker_count > 3:
                    severity = ViolationSeverity.CRITICAL
                
                return ViolationData(
                    code="a1",
                    type=ViolationType.MULTIPLE_SPEAKERS,
                    severity=severity,
                    confidence=speaker_analysis.speaker_confidence,
                    description=f"Multiple speakers detected ({speaker_analysis.speaker_count} speakers, max allowed: {max_allowed})",
                    timestamp=timestamp,
                    metadata={
                        "speaker_count": speaker_analysis.speaker_count,
                        "max_allowed": max_allowed,
                        "speaker_changes": speaker_analysis.speaker_changes,
                        "primary_speaker_duration": speaker_analysis.primary_speaker_duration,
                        "speakers": speaker_analysis.speakers
                    }
                )
        
        return None
    
    def _should_create_violation(self, violation_key: str, current_time: float) -> bool:
        """Check if we should create a new violation based on deduplication rules."""
        if violation_key not in self._last_violations:
            return True
            
        last_time = self._last_violations[violation_key]
        time_diff = current_time - last_time
        
        # Use cooldown to prevent spam
        return time_diff >= settings.VIOLATION_COOLDOWN_SECONDS
    
    def clear_session_violations(self, session_id: str):
        """Clear violations for a specific session."""
        keys_to_remove = [
            key for key in self._last_violations.keys() 
            if key.endswith(f"_{session_id}")
        ]
        for key in keys_to_remove:
            del self._last_violations[key]
            
        logger.info(f"Cleared {len(keys_to_remove)} violation records for session {session_id}")