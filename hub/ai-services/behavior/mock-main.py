"""Mock AI Behavior Service for Demo Environment"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import time
import random
import logging
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Behavior Service (Demo Mock)",
    description="Mock behavior analysis service for proctoring demo",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3002", "http://localhost:4000", "http://localhost:4001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class BehaviorAnalysisRequest(BaseModel):
    session_id: str
    timestamp: str
    participant_id: str = "candidate-123"
    session_config: Dict[str, Any] = {}
    interaction_data: Dict[str, Any] = {}  # Mouse, keyboard, screen data
    window_events: List[Dict[str, Any]] = []  # Focus changes, tab switches
    system_events: List[Dict[str, Any]] = []  # Copy/paste, screenshots, etc.

class BehaviorPattern(BaseModel):
    pattern_type: str
    confidence: float
    description: str
    start_time: str
    end_time: Optional[str] = None
    frequency: int
    intensity: str  # low, medium, high
    risk_level: str  # none, low, medium, high
    metadata: Dict[str, Any] = {}

class TypingAnalysis(BaseModel):
    words_per_minute: float
    typing_rhythm_score: float  # 0-1, consistency of typing
    pause_pattern: str  # normal, frequent_pauses, continuous
    backspace_frequency: float  # backspaces per minute
    copy_paste_events: int
    typing_confidence: float  # How confident the typing pattern is for this user

class ScreenInteraction(BaseModel):
    focus_changes: int
    tab_switches: int
    window_switches: int
    scroll_events: int
    click_patterns: Dict[str, Any]
    time_spent_areas: Dict[str, float]  # percentage of time in different screen areas

class Violation(BaseModel):
    type: str
    severity: str  # info, warning, critical
    confidence: float
    description: str
    timestamp: str
    source: str = "ai_behavior"
    duration_ms: Optional[int] = None
    evidence: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}

class BehaviorAnalysisResponse(BaseModel):
    session_id: str
    analysis_id: str
    timestamp: str
    processing_time_ms: float
    behavior_patterns: List[BehaviorPattern]
    typing_analysis: TypingAnalysis
    screen_interaction: ScreenInteraction
    violations: List[Violation]
    attention_score: float  # 0-100, how focused/engaged the user appears
    stress_indicators: Dict[str, float]
    anomaly_score: float  # 0-1, how unusual the behavior is
    engagement_level: str  # low, normal, high

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_loaded: bool
    uptime: float
    memory_usage: Dict[str, Any]

# Mock data generators
def generate_mock_behavior_patterns(session_duration_minutes: int) -> List[BehaviorPattern]:
    """Generate realistic behavior patterns."""
    patterns = []
    current_time = time.time()
    
    # Common patterns during exam sessions
    pattern_types = [
        {
            "type": "focused_reading",
            "description": "Concentrated reading behavior with minimal interruptions",
            "intensity": "medium",
            "risk": "none"
        },
        {
            "type": "rapid_typing",
            "description": "Bursts of rapid typing activity",
            "intensity": "high", 
            "risk": "none"
        },
        {
            "type": "frequent_corrections",
            "description": "High backspace/correction usage pattern",
            "intensity": "medium",
            "risk": "low"
        },
        {
            "type": "tab_switching_pattern",
            "description": "Regular switching between browser tabs",
            "intensity": "low",
            "risk": "medium" if random.random() < 0.3 else "low"
        },
        {
            "type": "pause_reflection",
            "description": "Extended thinking pauses between typing",
            "intensity": "low",
            "risk": "none"
        },
        {
            "type": "scrolling_review", 
            "description": "Systematic review through document/page",
            "intensity": "medium",
            "risk": "none"
        }
    ]
    
    # Generate 1-4 patterns per analysis
    for pattern_data in random.sample(pattern_types, random.randint(1, 4)):
        start_time = current_time - random.randint(10, 300)  # Pattern started 10s to 5min ago
        
        patterns.append(BehaviorPattern(
            pattern_type=pattern_data["type"],
            confidence=0.75 + random.random() * 0.25,
            description=pattern_data["description"],
            start_time=time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime(start_time)),
            end_time=time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime(current_time)) if random.random() < 0.6 else None,
            frequency=random.randint(1, 15),
            intensity=pattern_data["intensity"],
            risk_level=pattern_data["risk"],
            metadata={
                "pattern_strength": random.uniform(0.5, 1.0),
                "baseline_deviation": random.uniform(-0.3, 0.5),
                "confidence_interval": [0.7, 0.95]
            }
        ))
    
    return patterns

def generate_mock_typing_analysis() -> TypingAnalysis:
    """Generate mock typing behavior analysis."""
    # Realistic WPM for test-taking (usually slower than normal typing)
    base_wpm = random.uniform(25, 45)  
    
    return TypingAnalysis(
        words_per_minute=base_wpm,
        typing_rhythm_score=random.uniform(0.65, 0.95),  # Most people have decent rhythm
        pause_pattern=random.choice(["normal", "frequent_pauses", "continuous"]),
        backspace_frequency=random.uniform(2, 12),  # backspaces per minute
        copy_paste_events=random.randint(0, 3),  # Usually minimal in exams
        typing_confidence=random.uniform(0.78, 0.95)
    )

def generate_mock_screen_interaction() -> ScreenInteraction:
    """Generate mock screen interaction data."""
    return ScreenInteraction(
        focus_changes=random.randint(2, 15),
        tab_switches=random.randint(0, 8),  
        window_switches=random.randint(0, 3),
        scroll_events=random.randint(10, 80),
        click_patterns={
            "left_clicks": random.randint(15, 60),
            "right_clicks": random.randint(0, 5),
            "double_clicks": random.randint(1, 8),
            "average_click_duration_ms": random.uniform(80, 180)
        },
        time_spent_areas={
            "main_content": random.uniform(0.75, 0.95),
            "navigation": random.uniform(0.02, 0.10),
            "sidebar": random.uniform(0.01, 0.08),
            "other": random.uniform(0.01, 0.05)
        }
    )

def generate_mock_violations(typing_analysis, screen_interaction, session_duration_minutes) -> List[Violation]:
    """Generate mock behavior violations."""
    violations = []
    current_time = time.time()
    
    # Base violation chance
    base_violation_chance = 0.18
    
    # Risk factors
    time_factor = min(1.5, 1.0 + (session_duration_minutes / 60) * 0.4)  # Fatigue
    tab_switch_factor = 1.0 + min(0.5, screen_interaction.tab_switches / 10)  # Suspicious activity
    copy_paste_factor = 1.0 + (typing_analysis.copy_paste_events * 0.3)  # Potential cheating
    
    violation_chance = base_violation_chance * time_factor * tab_switch_factor * copy_paste_factor
    
    if random.random() < violation_chance:
        violation_types = [
            {
                "type": "excessive_tab_switches",
                "severity": "warning",
                "description": f"Unusual number of tab switches detected ({screen_interaction.tab_switches} in analysis window)",
                "base_confidence": 0.85,
                "evidence": {"tab_switch_count": screen_interaction.tab_switches}
            },
            {
                "type": "copy_paste_detected", 
                "severity": "critical",
                "description": f"Copy/paste activity detected ({typing_analysis.copy_paste_events} events)",
                "base_confidence": 0.97,
                "evidence": {"copy_paste_events": typing_analysis.copy_paste_events}
            },
            {
                "type": "unusual_typing_pattern",
                "severity": "info",
                "description": f"Typing pattern differs from baseline (rhythm score: {typing_analysis.typing_rhythm_score:.2f})",
                "base_confidence": 0.73,
                "evidence": {"rhythm_deviation": 1.0 - typing_analysis.typing_rhythm_score}
            },
            {
                "type": "extended_inactivity",
                "severity": "info", 
                "description": "Extended period of no screen interaction detected",
                "base_confidence": 0.89,
                "evidence": {"inactivity_duration_minutes": random.uniform(3, 8)}
            },
            {
                "type": "rapid_window_switching",
                "severity": "warning",
                "description": f"Rapid application switching detected ({screen_interaction.window_switches} window changes)",
                "base_confidence": 0.78,
                "evidence": {"window_switches": screen_interaction.window_switches}
            },
            {
                "type": "screenshot_attempt",
                "severity": "critical",
                "description": "Potential screenshot or screen capture attempt detected",
                "base_confidence": 0.82,
                "evidence": {"system_events": ["screenshot_key_combination"]}
            }
        ]
        
        # Weight violations based on detected behavior
        violation_weights = [20, 5, 25, 30, 15, 5]  # Default weights
        
        if screen_interaction.tab_switches > 5:
            violation_weights[0] *= 3  # Weight excessive tab switches higher
            
        if typing_analysis.copy_paste_events > 0:
            violation_weights[1] *= 5  # Weight copy/paste much higher
            
        if screen_interaction.window_switches > 2:
            violation_weights[4] *= 2  # Weight window switching higher
        
        violation = random.choices(violation_types, weights=violation_weights)[0]
        violations.append(Violation(
            type=violation["type"],
            severity=violation["severity"],
            confidence=violation["base_confidence"] + random.random() * 0.1 - 0.05,
            description=violation["description"],
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime(current_time)),
            duration_ms=random.randint(2000, 30000) if violation["type"] != "copy_paste_detected" else None,
            evidence=violation["evidence"],
            metadata={
                "analysis_id": f"behavior_{int(current_time * 1000)}",
                "detection_algorithm": "behavioral_ml_mock",
                "risk_assessment": "automated"
            }
        ))
    
    return violations

def calculate_attention_score(patterns, screen_interaction, violations) -> float:
    """Calculate attention/focus score (0-100)."""
    base_score = 85
    
    # Positive factors
    focused_patterns = len([p for p in patterns if "focused" in p.pattern_type or "reading" in p.pattern_type])
    base_score += focused_patterns * 5
    
    # Negative factors
    violation_penalty = len(violations) * 8
    tab_switch_penalty = min(20, screen_interaction.tab_switches * 2)
    window_switch_penalty = min(15, screen_interaction.window_switches * 4)
    
    attention_score = max(30, base_score - violation_penalty - tab_switch_penalty - window_switch_penalty + random.randint(-5, 5))
    return float(attention_score)

def calculate_stress_indicators() -> Dict[str, float]:
    """Calculate stress indicators based on behavioral patterns."""
    return {
        "typing_inconsistency": random.uniform(0.1, 0.8),  # 0-1
        "mouse_movement_erratic": random.uniform(0.05, 0.6),  # 0-1
        "pause_frequency": random.uniform(0.2, 0.9),  # 0-1
        "correction_rate": random.uniform(0.1, 0.7),  # 0-1
        "overall_stress_level": random.uniform(0.15, 0.65)  # 0-1
    }

# Service state
service_start_time = time.time()
processed_analyses = 0

@app.get("/", response_model=Dict[str, Any])
async def root():
    """Root endpoint with service information."""
    return {
        "service": "AI Behavior Service",
        "version": "1.0.0",
        "status": "operational",
        "type": "mock-demo",
        "description": "Mock behavior analysis service for proctoring demo",
        "capabilities": [
            "Typing pattern analysis",
            "Screen interaction monitoring",
            "Tab switching detection",
            "Copy/paste detection",
            "Attention level assessment",
            "Stress indicator analysis",
            "Behavioral anomaly detection"
        ],
        "endpoints": {
            "health": "GET /health",
            "analyze": "POST /api/v1/analyze/behavior", 
            "patterns": "GET /api/v1/patterns/:sessionId",
            "stats": "GET /api/v1/stats"
        },
        "mock_features": {
            "realistic_typing_analysis": True,
            "interaction_monitoring": True,
            "stress_detection": True,
            "demo_safe": True
        }
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for monitoring."""
    uptime = time.time() - service_start_time
    
    # Mock memory usage
    memory_usage = {
        "rss": random.randint(70, 110) * 1024 * 1024,  # 70-110 MB
        "heap_used": random.randint(50, 80) * 1024 * 1024,   # 50-80 MB
        "external": random.randint(8, 15) * 1024 * 1024      # 8-15 MB
    }
    
    return HealthResponse(
        status="healthy",
        service="AI Behavior Service",
        version="1.0.0",
        model_loaded=True,
        uptime=uptime,
        memory_usage=memory_usage
    )

@app.post("/api/v1/analyze/behavior", response_model=BehaviorAnalysisResponse)
async def analyze_behavior(request: BehaviorAnalysisRequest):
    """Analyze behavioral patterns for violations - main proctoring endpoint."""
    global processed_analyses
    processed_analyses += 1
    
    start_time = time.time()
    
    logger.info(f"Analyzing behavior for session {request.session_id}")
    
    try:
        # Simulate processing delay (40-120ms for behavior analysis)
        processing_delay = random.uniform(0.04, 0.12)
        await asyncio.sleep(processing_delay)
        
        # Calculate session duration for realistic violations
        session_duration_minutes = random.randint(5, 90)  # Mock session duration
        
        # Generate mock analysis results
        behavior_patterns = generate_mock_behavior_patterns(session_duration_minutes)
        typing_analysis = generate_mock_typing_analysis() 
        screen_interaction = generate_mock_screen_interaction()
        violations = generate_mock_violations(typing_analysis, screen_interaction, session_duration_minutes)
        
        attention_score = calculate_attention_score(behavior_patterns, screen_interaction, violations)
        stress_indicators = calculate_stress_indicators()
        
        # Calculate anomaly score (0-1)
        anomaly_factors = [
            len(violations) * 0.2,
            (screen_interaction.tab_switches / 10) * 0.3,
            typing_analysis.copy_paste_events * 0.25,
            (1.0 - typing_analysis.typing_confidence) * 0.25
        ]
        anomaly_score = min(1.0, sum(anomaly_factors))
        
        # Determine engagement level
        if attention_score >= 80:
            engagement_level = "high"
        elif attention_score >= 60:
            engagement_level = "normal"
        else:
            engagement_level = "low"
        
        processing_time = (time.time() - start_time) * 1000
        analysis_id = f"behavior_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"
        
        response = BehaviorAnalysisResponse(
            session_id=request.session_id,
            analysis_id=analysis_id,
            timestamp=request.timestamp,
            processing_time_ms=processing_time,
            behavior_patterns=behavior_patterns,
            typing_analysis=typing_analysis,
            screen_interaction=screen_interaction,
            violations=violations,
            attention_score=attention_score,
            stress_indicators=stress_indicators,
            anomaly_score=anomaly_score,
            engagement_level=engagement_level
        )
        
        logger.info(
            f"Behavior analysis complete: {len(violations)} violations, "
            f"attention: {attention_score}, engagement: {engagement_level}, "
            f"processing: {processing_time:.1f}ms"
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Behavior analysis error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Behavior analysis failed: {str(e)}"
        )

@app.get("/api/v1/patterns/{session_id}")
async def get_behavior_patterns(session_id: str):
    """Get historical behavior patterns for a session."""
    try:
        patterns = generate_mock_behavior_patterns(30)  # Mock 30-minute session
        
        return {
            "session_id": session_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "pattern_count": len(patterns),
            "patterns": patterns,
            "summary": {
                "dominant_patterns": [p.pattern_type for p in patterns[:3]],
                "average_confidence": sum(p.confidence for p in patterns) / len(patterns) if patterns else 0,
                "risk_levels": {level: len([p for p in patterns if p.risk_level == level]) for level in ["none", "low", "medium", "high"]}
            }
        }
        
    except Exception as e:
        logger.error(f"Pattern retrieval error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Pattern retrieval failed: {str(e)}"
        )

@app.get("/api/v1/stats")
async def get_stats():
    """Get service statistics."""
    uptime = time.time() - service_start_time
    
    return {
        "service": "AI Behavior Service",
        "status": "operational",
        "uptime_seconds": uptime,
        "processed_analyses": processed_analyses,
        "average_processing_time_ms": random.uniform(45, 85),
        "current_load": {
            "cpu_usage": random.uniform(8, 30),      # %
            "memory_usage": random.uniform(70, 110), # MB
            "active_sessions": random.randint(0, 5),
            "concurrent_analyses": random.randint(0, 3)
        },
        "model_info": {
            "typing_analysis": "Behavioral ML Model v2.3",
            "pattern_recognition": "Neural Pattern Classifier",
            "anomaly_detection": "Isolation Forest (mock)",
            "loaded": True,
            "accuracy": 0.87,
            "inference_time_ms": random.uniform(30, 80)
        },
        "detection_capabilities": {
            "typing_patterns": True,
            "screen_interactions": True,
            "tab_switching": True,
            "copy_paste": True,
            "window_management": True,
            "stress_indicators": True,
            "attention_tracking": True
        }
    }

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Handle HTTP exceptions."""
    logger.error(f"HTTP error: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "service": "ai-behavior"
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error",
                "service": "ai-behavior"
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        }
    )

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Application startup."""
    logger.info("AI Behavior Service (Mock) starting up...")
    logger.info(f"Service ready on port 5002")
    logger.info("Mock features: typing analysis, interaction monitoring, stress detection")

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5002,
        log_level="info",
        reload=False
    )