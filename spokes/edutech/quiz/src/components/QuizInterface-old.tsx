'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Monitor, Shield, Camera, Eye, AlertTriangle } from 'lucide-react';
import { FINANCIAL_LITERACY_QUIZ } from '@/lib/quiz-data';
import { formatTime, calculateScore, getScoreColor, getTimerColor, notifyProctorSystem } from '@/lib/utils';
import type { QuizResult } from '@/lib/utils';

interface QuizInterfaceProps {
  candidateData: {
    candidateId: string;
    accessCode: string;
    sessionId: string;
  };
  onLogout: () => void;
}

export default function QuizInterface({ candidateData, onLogout }: QuizInterfaceProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(FINANCIAL_LITERACY_QUIZ.timeLimit);
  const [startTime] = useState(Date.now());
  const [isCompleted, setIsCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Proctoring state
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [faceDetected, setFaceDetected] = useState(true);
  const [violations, setViolations] = useState<string[]>([]);
  const [isTabActive, setIsTabActive] = useState(true);
  const [violationCount, setViolationCount] = useState(0);
  const [proctorInitialized, setProctorInitialized] = useState(false);
  const [fullscreenRequested, setFullscreenRequested] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Violation recording function
  const recordViolation = (type: string, description: string, severity: 'info' | 'warning' | 'critical' = 'warning') => {
    const violation = {
      type,
      description, 
      severity,
      timestamp: new Date().toISOString()
    };
    
    console.warn(`🚨 VIOLATION DETECTED: [${violation.type}] ${description}`);
    console.log(`🔍 Violation details:`, violation);
    
    // Update local state
    setViolations(prev => [...prev, description]);
    setViolationCount(prev => prev + 1);
    
    // Show enhanced alert to candidate with violation type
    if (severity !== 'info') {
      alert(`🚨 PROCTORING ALERT [${violation.type.toUpperCase()}]: ${description}`);
    }
    
    // Notify proctor system
    notifyProctorSystem('VIOLATION_DETECTED', {
      ...violation,
      candidateId: candidateInfo.candidateId,
      sessionId: candidateData.sessionId,
      violationCount: violationCount + 1
    });
    
    // Update session via API
    fetch('/api/sessions', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'demo-key'
      },
      body: JSON.stringify({
        sessionId: candidateData.sessionId,
        violation,
        violationCount: violationCount + 1
      })
    }).catch(err => console.warn('Failed to record violation:', err));
  };
  // Extract candidate info from URL params (would come from proctoring system)
  
  // Camera and screen capture setup
  const setupCamera = async () => {
    try {
      console.log('🎯 Setting up camera with audio monitoring...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user'
        },
        audio: true // ✅ ENABLE AUDIO for background noise detection
      });
      setCameraStream(stream);
      
      // Setup audio analysis for background noise detection
      setupAudioMonitoring(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log('📹 Camera ready, video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
        };
      }
      console.log('✅ Camera and audio access granted successfully');
      return true;
    } catch (error) {
      console.error('❌ Camera setup failed:', error);
      if (proctorInitialized) {
        recordViolation('camera_blocked', 'Camera access was denied. Please enable camera access and refresh.', 'critical');
      }
      return false;
    }
  };
  
  // Audio monitoring for background noise and multiple voices detection
  const setupAudioMonitoring = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      // Monitor audio levels every 500ms
      const audioMonitoringInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        
        // Detect background noise (volume > 30 consistently)
        if (average > 30 && proctorInitialized) {
          console.log(`🔊 Audio detected: ${average} level`);
          recordViolation('background_noise', `Background audio detected (level: ${Math.round(average)}). Please ensure a quiet environment.`, 'warning');
        }
        
        // Detect multiple voices or conversations (high frequency spikes)
        const highFreqCount = dataArray.slice(128).filter(value => value > 50).length;
        if (highFreqCount > 30 && proctorInitialized) {
          recordViolation('multiple_voices', 'Multiple voices or conversation detected. Please ensure you are alone during the exam.', 'critical');
        }
      }, 500);
      
      console.log('🎤 Audio monitoring initialized');
    } catch (error) {
      console.error('❌ Audio monitoring setup failed:', error);
    }
  };
  
  const setupScreenCapture = async () => {
    try {
      console.log('🖥️ Requesting screen share...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: false
      });
      setScreenStream(stream);
      console.log('✅ Screen capture started successfully');
      
      // Listen for user stopping screen share
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (proctorInitialized) {
          recordViolation('screen_share_stopped', 'Screen sharing was stopped unexpectedly.', 'warning');
        }
        setScreenStream(null);
      });
      return true;
    } catch (error) {
      console.warn('⚠️ Screen capture declined:', error);
      if (proctorInitialized && error instanceof Error && error.name !== 'NotAllowedError') {
        recordViolation('screen_share_denied', 'Screen sharing was not enabled.', 'info');
      }
      return false;
    }
  };
  
  // Enhanced face detection with motion and contrast analysis + multiple people detection
  const detectFace = () => {
    if (!videoRef.current || !canvasRef.current || !cameraStream) {
      console.log('⚠️ Face detection: Missing video/canvas/stream');
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('⚠️ Video not ready for face detection');
      if (faceDetected && proctorInitialized) {
        setFaceDetected(false);
        recordViolation('camera_disconnected', 'Camera disconnected or not providing video feed.', 'critical');
      }
      return;
    }
    
    // Only check when video is actually playing
    if (video.paused || video.readyState < 2) {
      console.log('⚠️ Video not playing or not ready');
      return;
    }
    
    try {
      canvas.width = 320; // Increased resolution for better detection
      canvas.height = 240;
      ctx?.drawImage(video, 0, 0, 320, 240);
      
      const imageData = ctx?.getImageData(0, 0, 320, 240);
      if (imageData) {
        const data = imageData.data;
        let brightness = 0;
        let contrast = 0;
        let pixelCount = 0;
        
        // Calculate brightness and check for uniform color (blocked camera)
        const pixelValues: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          const pixelBrightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          pixelValues.push(pixelBrightness);
          brightness += pixelBrightness;
          pixelCount++;
        }
        
        brightness = brightness / pixelCount;
        
        // Calculate standard deviation for contrast detection
        const mean = brightness;
        const squaredDiffs = pixelValues.map(value => Math.pow(value - mean, 2));
        const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / pixelCount;
        contrast = Math.sqrt(variance);
        
        // Enhanced detection logic with more sensitive thresholds
        let faceVisible = true;
        let violationType = '';
        let violationMessage = '';
        
        console.log(`🔍 Face Detection - Brightness: ${brightness.toFixed(1)}, Contrast: ${contrast.toFixed(1)}`);
        
        if (brightness < 15) { // Made more sensitive (was < 10)
          // Very dark - camera likely blocked or covered
          faceVisible = false;
          violationType = 'camera_blocked';
          violationMessage = 'Camera appears to be blocked or covered.';
        } else if (brightness > 230) { // Made more sensitive (was > 240)
          // Too bright - overexposed
          faceVisible = false;
          violationType = 'camera_overexposed';
          violationMessage = 'Camera is overexposed. Please adjust lighting.';
        } else if (contrast < 20) { // Made more sensitive (was < 15)
          // Low contrast - uniform color, likely finger covering or solid object
          faceVisible = false;
          violationType = 'camera_obstructed';
          violationMessage = 'Camera is obstructed. Please ensure your face is visible.';
        } else if (brightness < 50 && contrast < 35) { // Made more sensitive
          // Dark with low contrast - person not in front of camera
          faceVisible = false;
          violationType = 'face_not_visible';
          violationMessage = 'Face not detected. Please sit in front of the camera.';
        }
        
        // Advanced multiple people detection using edge detection
        const edgeCount = detectEdges(data, 320, 240);
        if (edgeCount > 8000 && proctorInitialized) { // High edge count suggests multiple faces/people
          recordViolation('multiple_people', `Multiple people detected in camera view. Edge count: ${edgeCount}`, 'critical');
        }
        
        // Motion detection for suspicious activity
        const motionLevel = detectMotion(data);
        if (motionLevel > 50000 && proctorInitialized) {
          recordViolation('excessive_movement', `Excessive movement detected. Motion level: ${motionLevel}`, 'warning');
        }
        
        // Only record violation if state changed and we're initialized
        if (faceVisible !== faceDetected && proctorInitialized) {
          setFaceDetected(faceVisible);
          
          if (!faceVisible && violationType && violationMessage) {
            console.log(`🚨 FACE VIOLATION: ${violationType} - ${violationMessage}`);
            recordViolation(violationType, violationMessage, 'warning');
          } else if (faceVisible) {
            console.log('✅ Face detection restored');
          }
        } else if (faceVisible) {
          console.log('✅ Face detected - OK');
        }
      }
    } catch (error) {
      console.error('❌ Face detection error:', error);
      if (proctorInitialized) {
        recordViolation('face_detection_error', 'Face detection temporarily unavailable.', 'info');
      }
    }
  };
  
  // Edge detection for multiple people detection
  const detectEdges = (data: Uint8ClampedArray, width: number, height: number): number => {
    let edgeCount = 0;
    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);
      
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        const current = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const right = (data[i + 16] + data[i + 17] + data[i + 18]) / 3;
        const bottom = (data[i + width * 16] + data[i + width * 16 + 1] + data[i + width * 16 + 2]) / 3;
        
        if (Math.abs(current - right) > 30 || Math.abs(current - bottom) > 30) {
          edgeCount++;
        }
      }
    }
    return edgeCount;
  };
  
  // Motion detection
  let previousImageData: Uint8ClampedArray | null = null;
  const detectMotion = (currentData: Uint8ClampedArray): number => {
    if (!previousImageData) {
      previousImageData = new Uint8ClampedArray(currentData);
      return 0;
    }
    
    let motionLevel = 0;
    for (let i = 0; i < currentData.length; i += 16) {
      const currentPixel = (currentData[i] + currentData[i + 1] + currentData[i + 2]) / 3;
      const previousPixel = (previousImageData[i] + previousImageData[i + 1] + previousImageData[i + 2]) / 3;
      motionLevel += Math.abs(currentPixel - previousPixel);
    }
    
    previousImageData = new Uint8ClampedArray(currentData);
    return motionLevel;
  };
  
  // Manual camera restart function
  const restartCamera = async () => {
    console.log('🔄 Manually restarting camera...');
    
    // Stop existing stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    // Wait a moment then restart
    setTimeout(async () => {
      const success = await setupCamera();
      if (success) {
        console.log('✅ Camera restarted successfully');
      }
    }, 500);
  };
  
  // Browser event monitoring with improved categorization
  useEffect(() => {
    // Tab focus/blur detection with debouncing
    let focusTimeout: NodeJS.Timeout;
    
    const handleVisibilityChange = () => {
      const isActive = !document.hidden;
      setIsTabActive(isActive);
      
      if (!isActive && !isCompleted && proctorInitialized) {
        // Debounce to avoid false positives from quick tab switches
        clearTimeout(focusTimeout);
        focusTimeout = setTimeout(() => {
          recordViolation('tab_switch', 'Candidate switched to another tab during the exam.', 'warning');
        }, 1000);
      } else if (isActive) {
        clearTimeout(focusTimeout);
      }
    };
    
    // Window focus/blur with better detection
    const handleWindowFocus = () => {
      setIsTabActive(true);
      // Cancel any pending focus violations
      clearTimeout(focusTimeout);
    };
    
    const handleWindowBlur = () => {
      if (!isCompleted && proctorInitialized) {
        setIsTabActive(false);
        // Delayed check to avoid false positives
        focusTimeout = setTimeout(() => {
          if (!document.hasFocus() && proctorInitialized) {
            recordViolation('window_focus_lost', 'Exam window lost focus during the quiz.', 'warning');
          }
        }, 2000);
      }
    };
    
    // Fullscreen exit detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && proctorInitialized && fullscreenRequested) {
        recordViolation('fullscreen_exit', 'Exited fullscreen mode during the exam.', 'warning');
      }
    };
    
    // Copy/paste prevention
    const handleCopy = (e: ClipboardEvent) => {
      if (proctorInitialized) {
        e.preventDefault();
        recordViolation('copy_attempt', 'Attempted to copy content during the exam.', 'warning');
      }
    };
    
    const handlePaste = (e: ClipboardEvent) => {
      if (proctorInitialized) {
        e.preventDefault(); 
        recordViolation('paste_attempt', 'Attempted to paste content during the exam.', 'warning');
      }
    };
    
    // Right-click prevention
    const handleContextMenu = (e: MouseEvent) => {
      if (proctorInitialized) {
        e.preventDefault();
        recordViolation('right_click', 'Right-click menu accessed during the exam.', 'info');
      }
    };
    
    // DevTools detection (improved)
    const detectDevTools = () => {
      if (!proctorInitialized) return;
      
      const threshold = 160;
      const heightDiff = window.outerHeight - window.innerHeight;
      const widthDiff = window.outerWidth - window.innerWidth;
      
      if (heightDiff > threshold || widthDiff > threshold) {
        recordViolation('devtools_detected', 'Developer tools may be open.', 'warning');
      }
    };
    
    // Keyboard shortcut monitoring
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!proctorInitialized) return;
      
      // Detect common developer shortcuts
      if (e.key === 'F12' || 
         (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
         (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        recordViolation('dev_shortcut', 'Developer shortcut key detected.', 'warning');
      }
      
      // Alt+Tab detection
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        recordViolation('alt_tab', 'Alt+Tab detected - switching applications.', 'warning');
      }
    };
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    
    // DevTools detection interval
    const devToolsInterval = setInterval(detectDevTools, 10000);
    
    return () => {
      clearTimeout(focusTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(devToolsInterval);
    };
  }, [isCompleted, proctorInitialized]);

  // Extract candidate info from URL params (would come from proctoring system)
  const [candidateInfo] = useState({
    candidateId: candidateData.candidateId,
    name: 'Demo Student',
    examId: FINANCIAL_LITERACY_QUIZ.id,
    organizationId: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94' // Demo organization
  });

  const quiz = FINANCIAL_LITERACY_QUIZ;
  
  // Enhanced fullscreen management
  const requestFullscreenMode = async () => {
    if (document.fullscreenElement) {
      console.log('📺 Already in fullscreen mode');
      return true;
    }
    
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenRequested(true);
      console.log('📺 Fullscreen mode activated');
      return true;
    } catch (error) {
      console.warn('⚠️ Fullscreen request failed:', error);
      if (proctorInitialized) {
        recordViolation('fullscreen_failed', 'Could not enter fullscreen mode for enhanced security.', 'info');
      }
      return false;
    }
  };
  
  // Initialize proctoring systems with proper sequencing
  const initializeProctoringSystems = async () => {
    console.log('🚀 Initializing proctoring systems...');
    
    // Step 1: Setup camera (most critical)
    const cameraReady = await setupCamera();
    
    // Step 2: Request screen capture
    const screenReady = await setupScreenCapture();
    
    // Step 3: Enter fullscreen for security
    const fullscreenReady = await requestFullscreenMode();
    
    // Step 4: Start violations monitoring after short delay
    setTimeout(() => {
      setProctorInitialized(true);
      console.log('✅ Proctoring systems fully initialized');
      
      // Step 5: Start enhanced face detection (every 1 second for real-time monitoring)
      faceDetectionIntervalRef.current = setInterval(detectFace, 1000); // Reduced from 3000ms to 1000ms
    }, 2000); // 2-second grace period to avoid false positives
    
    return { cameraReady, screenReady, fullscreenReady };
  };
  
  // Setup proctoring when component mounts (not when quiz completes)
  useEffect(() => {
    let mounted = true;
    
    const initProctoring = async () => {
      if (!isCompleted && mounted) {
        await initializeProctoringSystems();
      }
    };
    
    // Start initialization after component is fully mounted
    const timer = setTimeout(initProctoring, 500);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
    };
  }, [isCompleted]);
  const totalQuestions = quiz.questions.length;
  
  // Enhanced cleanup when component unmounts (browser close/navigate away)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isCompleted && proctorInitialized) {
        console.log('⚠️ Browser closing - emergency proctoring cleanup');
        
        // Immediately stop all streams
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
        }
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
        }
        
        // Stop monitoring
        if (faceDetectionIntervalRef.current) {
          clearInterval(faceDetectionIntervalRef.current);
        }
        
        // Try to update session status
        navigator.sendBeacon('/api/sessions', JSON.stringify({
          sessionId: candidateData.sessionId,
          status: 'terminated',
          endedAt: new Date().toISOString(),
          reason: 'browser_closed_during_exam'
        }));
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Final cleanup on unmount
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
    };
  }, [cameraStream, screenStream, isCompleted, proctorInitialized, candidateData.sessionId]);
  
  // Enhanced cleanup when quiz completes
  useEffect(() => {
    if (isCompleted) {
      console.log('🏁 Quiz completed - cleaning up proctoring systems...');
      
      // Set proctoring as no longer active first
      setProctorInitialized(false);
      
      // Stop face detection immediately
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
        console.log('✅ Face detection stopped');
      }
      
      // Stop all media streams
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
          track.stop();
          console.log('📹 Camera track stopped:', track.label);
        });
        setCameraStream(null);
        
        // Clear video element
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
      
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          track.stop();
          console.log('🖥️ Screen track stopped:', track.label);
        });
        setScreenStream(null);
      }
      
      // Exit fullscreen after a brief delay to allow UI to stabilize
      setTimeout(() => {
        if (document.fullscreenElement) {
          document.exitFullscreen()
            .then(() => console.log('📺 Exited fullscreen mode'))
            .catch(err => console.warn('⚠️ Error exiting fullscreen:', err));
        }
      }, 1000);
      
      // Final notification to proctor system
      notifyProctorSystem('PROCTORING_ENDED', {
        sessionId: candidateData.sessionId,
        candidateId: candidateInfo.candidateId,
        endTime: Date.now(),
        reason: 'quiz_completed'
      });
      
      console.log('🎯 All proctoring systems cleaned up successfully');
    }
  }, [isCompleted, cameraStream, screenStream]);

  const currentQ = quiz.questions[currentQuestion];
  useEffect(() => {
    if (timeLeft > 0 && !isCompleted) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      submitQuiz();
    }
  }, [timeLeft, isCompleted]);

  // Notify proctor system when quiz starts
  useEffect(() => {
    const startSession = async () => {
      // Create session in our API
      try {
        await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'demo-key'
          },
          body: JSON.stringify({
            sessionId: candidateData.sessionId,
            candidateId: candidateInfo.candidateId,
            candidateName: candidateInfo.name,
            examId: candidateInfo.examId,
            examName: quiz.title,
            organizationId: candidateInfo.organizationId,
            status: 'in-progress',
            startedAt: new Date(startTime).toISOString(),
            credibilityScore: 100,
            riskLevel: 'low',
            violations: []
          })
        });
      } catch (error) {
        console.warn('Failed to create session in API:', error);
      }
    };
    
    startSession();
    
    // Notify proctor system
    notifyProctorSystem('QUIZ_STARTED', {
      examId: quiz.id,
      candidateId: candidateInfo.candidateId,
      startTime: startTime
    });

    // Notify when component unmounts (tab close, etc.)
    const handleBeforeUnload = () => {
      notifyProctorSystem('QUIZ_INTERRUPTED', {
        examId: quiz.id,
        candidateId: candidateInfo.candidateId,
        currentQuestion: currentQuestion + 1,
        answeredQuestions: Object.keys(answers).length
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const selectAnswer = (optionIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: optionIndex
    }));

    // Notify proctor system of answer selection
    notifyProctorSystem('ANSWER_SELECTED', {
      questionId: currentQ.id,
      questionNumber: currentQuestion + 1,
      selectedOption: optionIndex,
      timestamp: Date.now()
    });
  };

  const nextQuestion = () => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitQuiz = async () => {
    console.log('🏁 Quiz submission started - beginning proctoring cleanup...');
    
    // STEP 1: Immediately stop proctoring to prevent violations during submission
    setProctorInitialized(false);
    
    // STEP 2: Stop face detection and monitoring immediately
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
      console.log('✅ Face detection monitoring stopped');
    }
    
    // STEP 3: Stop all media streams immediately
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
        console.log('📹 Camera track stopped:', track.label);
      });
      setCameraStream(null);
    }
    
    if (screenStream) {
      screenStream.getTracks().forEach(track => {
        track.stop();
        console.log('🖥️ Screen capture track stopped:', track.label);
      });
      setScreenStream(null);
    }
    
    // STEP 4: Exit fullscreen mode
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        console.log('🚪 Exited fullscreen mode');
      } catch (error) {
        console.warn('⚠️ Failed to exit fullscreen:', error);
      }
    }
    
    // STEP 5: Calculate quiz results
    const endTime = Date.now();
    const correctAnswers = quiz.questions.reduce((count, q) => {
      return count + (answers[q.id] === q.correctAnswer ? 1 : 0);
    }, 0);
    
    const score = calculateScore(correctAnswers, totalQuestions);
    const passed = score >= quiz.passingScore;
    const timeSpent = Math.round((endTime - startTime) / 1000);

    const result: QuizResult = {
      examId: quiz.id,
      candidateId: candidateInfo.candidateId,
      startTime,
      endTime,
      answers,
      score,
      passed,
      timeSpent
    };

    // STEP 6: Update session as completed and closed in API
    try {
      console.log('📊 Completing session in database...');
      const sessionUpdateResponse = await fetch('/api/sessions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'demo-key'
        },
        body: JSON.stringify({
          sessionId: candidateData.sessionId,
          status: 'completed',
          completedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          duration: Math.floor((Date.now() - startTime) / 1000),
          score: result.score,
          passed: result.passed,
          violationCount,
          violations,
          credibilityScore: Math.max(20, 100 - (violationCount * 10)),
          proctorSessionClosed: true,
          finalCleanup: {
            cameraStreamsStopped: !cameraStream,
            screenStreamsStopped: !screenStream,
            monitoringStopped: faceDetectionIntervalRef.current === null,
            fullscreenExited: !document.fullscreenElement,
            timestamp: new Date().toISOString()
          }
        })
      });
      
      if (sessionUpdateResponse.ok) {
        console.log('✅ Session successfully completed and closed in database');
      } else {
        console.warn('⚠️ Session update failed:', await sessionUpdateResponse.text());
      }
    } catch (error) {
      console.error('❌ Failed to complete session in API:', error);
    }

    // STEP 7: Notify proctor system of completion
    console.log('📢 Notifying proctor system of completion...');
    notifyProctorSystem('QUIZ_COMPLETED', {
      ...result,
      proctorSessionClosed: true,
      cleanupCompleted: true
    });

    // STEP 8: Update UI state
    setIsCompleted(true);
    setShowResults(true);
    
    console.log('🎉 Quiz submission and proctoring cleanup completed successfully!');
  };

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / totalQuestions) * 100;

  if (showResults) {
    const correctAnswers = quiz.questions.reduce((count, q) => {
      return count + (answers[q.id] === q.correctAnswer ? 1 : 0);
    }, 0);
    const score = calculateScore(correctAnswers, totalQuestions);
    const passed = score >= quiz.passingScore;

    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-semibold ${passed ? 'bg-success-100 text-success-800' : 'bg-error-100 text-error-800'}`}>
            {passed ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            {passed ? 'Quiz Completed Successfully!' : 'Quiz Completed'}
          </div>
        </div>

        <div className="question-card max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6">Your Results</h2>
          
          {/* Proctoring Session Status */}
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-center gap-3 text-green-800">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                ✅ Proctoring Session Completed & Closed
              </span>
            </div>
            <div className="text-center text-xs text-green-600 mt-1">
              Camera stopped • Monitoring ended • Session archived
            </div>
          </div>
          
          <div className="space-y-4 text-center">
            <div>
              <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
                {score}%
              </div>
              <div className="text-gray-600">
                {correctAnswers} out of {totalQuestions} correct
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-semibold">Time Spent</div>
                  <div className="text-gray-600">
                    {formatTime(Math.round((Date.now() - startTime) / 1000))}
                  </div>
                </div>
                <div>
                  <div className="font-semibold">Passing Score</div>
                  <div className="text-gray-600">{quiz.passingScore}%</div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className={`text-lg font-semibold ${passed ? 'text-success-600' : 'text-error-600'}`}>
                {passed ? 'Congratulations! You passed the quiz.' : 'Sorry, you did not meet the passing requirements.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Session Header */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Session: {candidateData.sessionId.slice(-8)}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Monitor className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">AI Proctoring Active</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              Candidate: {candidateData.candidateId}
            </span>
            <button
              onClick={onLogout}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Proctoring Status Panel */}
      <div className="bg-slate-50 border-l-4 border-blue-500 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-slate-800">Proctor Monitoring Active</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${cameraStream ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <Camera className="h-4 w-4 text-slate-600" />
              <span className="text-sm text-slate-600">
                {cameraStream ? 'Camera Active' : (proctorInitialized ? 'Camera Inactive' : 'Starting...')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${screenStream ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <Monitor className="h-4 w-4 text-slate-600" />
              <span className="text-sm text-slate-600">
                {screenStream ? 'Screen Shared' : (proctorInitialized ? 'No Screen Share' : 'Requesting...')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <Eye className="h-4 w-4 text-slate-600" />
              <span className="text-sm text-slate-600">
                {proctorInitialized ? (faceDetected ? 'Face Detected' : 'No Face') : 'Initializing...'}
              </span>
            </div>
          </div>
        </div>
        
        {!proctorInitialized && (
          <div className="flex items-center gap-2 text-blue-700 bg-blue-50 p-2 rounded">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
            <span className="text-sm font-medium">Setting up proctoring systems...</span>
          </div>
        )}
        
        {violationCount > 0 && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-2 rounded">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {violationCount} violation{violationCount !== 1 ? 's' : ''} detected
            </span>
          </div>
        )}
        
        {/* Debug controls */}
        {proctorInitialized && (!cameraStream || violations.some(v => v.includes('camera'))) && (
          <div className="flex items-center gap-2 text-orange-700 bg-orange-50 p-2 rounded">
            <Camera className="h-4 w-4" />
            <span className="text-sm">Camera issue detected</span>
            <button
              onClick={restartCamera}
              className="text-xs bg-orange-200 hover:bg-orange-300 px-2 py-1 rounded font-medium"
            >
              Restart Camera
            </button>
          </div>
        )}
        
        {violations.length > 0 && (
          <details className="mt-2">
            <summary className="text-sm font-medium text-slate-600 cursor-pointer hover:text-slate-800">
              View Recent Violations ({violations.length})
            </summary>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {violations.slice(-5).map((violation, index) => (
                <div key={index} className="text-xs text-slate-600 bg-white p-2 rounded border">
                  {violation}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Hidden camera and canvas for face detection */}
      <div className="hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline
          onLoadedMetadata={() => console.log('🎬 Video metadata loaded')}
          onError={(e) => console.error('❌ Video error:', e)}
        />
        <canvas ref={canvasRef} />
      </div>

      {/* Quiz Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            <p className="text-gray-600">Question {currentQuestion + 1} of {totalQuestions}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${getTimerColor(timeLeft, quiz.timeLimit)}`}>
              <Clock className="w-5 h-5" />
              <span className="font-mono text-lg font-semibold">
                {formatTime(timeLeft)}
              </span>
            </div>
            
            <div className="text-sm text-gray-600">
              {answeredCount}/{totalQuestions} answered
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="question-card mb-6">
        <h2 className="text-xl font-semibold mb-6">
          {currentQ.question}
        </h2>

        <div className="space-y-3">
          {currentQ.options.map((option, index) => (
            <button
              key={index}
              onClick={() => selectAnswer(index)}
              className={`option-button ${answers[currentQ.id] === index ? 'selected' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${answers[currentQ.id] === index ? 'border-primary-500 bg-primary-500' : 'border-gray-300'}`}>
                  {answers[currentQ.id] === index && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevQuestion}
          disabled={currentQuestion === 0}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-3">
          {currentQuestion === totalQuestions - 1 ? (
            <button
              onClick={submitQuiz}
              disabled={answeredCount < totalQuestions}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              Submit Quiz
              <CheckCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:text-primary-700"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Question overview */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Question Overview</h3>
        <div className="grid grid-cols-10 gap-2">
          {quiz.questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(index)}
              className={`w-10 h-10 rounded text-sm font-semibold ${
                answers[q.id] !== undefined
                  ? 'bg-primary-600 text-white'
                  : currentQuestion === index
                  ? 'bg-primary-100 text-primary-600 border-2 border-primary-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}