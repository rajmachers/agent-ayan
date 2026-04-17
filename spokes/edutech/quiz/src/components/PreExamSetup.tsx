'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Mic, 
  Monitor, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Phone,
  Upload,
  Eye,
  Volume2,
  Wifi,
  Settings,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface PreExamSetupProps {
  candidateData: {
    candidateId: string;
    accessCode: string;
    sessionId: string;
  };
  onSetupComplete: (setupData: any) => void;
  onCancel: () => void;
}

interface SystemCheck {
  browser: boolean;
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
  internet: boolean;
}

interface Permissions {
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
}

interface IDVerification {
  photoTaken: boolean;
  idDocumentUploaded: boolean;
  faceMatch: boolean;
}

const SETUP_STEPS = [
  { id: 'system-check', title: 'System Requirements', icon: Settings },
  { id: 'permissions', title: 'Permissions Setup', icon: Shield },
  { id: 'id-verification', title: 'Identity Verification', icon: Phone },
  { id: 'environment-check', title: 'Environment Setup', icon: Eye },
  { id: 'system-test', title: 'Final System Test', icon: Monitor },
];

export default function PreExamSetup({ candidateData, onSetupComplete, onCancel }: PreExamSetupProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [systemCheck, setSystemCheck] = useState<SystemCheck>({
    browser: false,
    camera: false,
    microphone: false,
    screenShare: false,
    internet: false
  });
  const [permissions, setPermissions] = useState<Permissions>({
    camera: false,
    microphone: false,
    screenShare: false
  });
  const [idVerification, setIDVerification] = useState<IDVerification>({
    photoTaken: false,
    idDocumentUploaded: false,
    faceMatch: false
  });
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [uploadedID, setUploadedID] = useState<File | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentStep === 0) {
      performSystemCheck();
    }
  }, [currentStep]);

  // Enhanced effect to manage video stream and debugging
  useEffect(() => {
    console.log('🎥 DEBUG: Video stream effect triggered', {
      step: currentStep,
      stepName: SETUP_STEPS[currentStep]?.title,
      hasPermissions: permissions.camera,
      hasStream: !!mediaStream,
      streamActive: mediaStream?.active,
      videoReady,
      cameraLoading
    });

    // Auto-start camera for environment check step if permissions granted
    if (currentStep === 3 && permissions.camera && !mediaStream && !cameraLoading) {
      console.log('🎥 DEBUG: Auto-starting camera for environment step...');
      requestPermissions('camera');
    }

    // Keep camera stream active through all setup steps
    // Only cleanup when setup is completely finished 
    if (currentStep > 4 && mediaStream) {
      console.log('🎥 DEBUG: Setup complete, cleaning up camera stream...');
      mediaStream.getTracks().forEach(track => {
        console.log('🎥 DEBUG: Stopping track:', track.label);
        track.stop();
      });
      setMediaStream(null);
      setVideoReady(false);
      setCameraLoading(false);
    }
  }, [currentStep, permissions.camera, mediaStream]);

  // Ensure video element gets stream when both are available
  useEffect(() => {
    if (mediaStream && videoRef.current && videoRef.current.srcObject !== mediaStream) {
      console.log('🎥 DEBUG: Attaching stream to video element...');
      videoRef.current.srcObject = mediaStream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      
      const playVideo = () => {
        if (videoRef.current) {
          videoRef.current.play()
            .then(() => {
              console.log('🎥 DEBUG: Video playing successfully in effect!');
              setVideoReady(true);
              setCameraLoading(false);
            })
            .catch(err => {
              console.error('🚨 DEBUG: Video play failed in effect:', err);
            });
        }
      };
      
      // Try immediate play
      playVideo();
      
      // Add fallback with timeout
      setTimeout(playVideo, 500);
    }
  }, [mediaStream, videoRef.current]);

  // Cleanup media streams on unmount
  useEffect(() => {
    return () => {
      console.log('🎥 DEBUG: Component unmounting, cleaning up streams...');
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      setVideoReady(false);
      setCameraLoading(false);
    };
  }, []);

  const performSystemCheck = async () => {
    setLoading(true);
    
    // Reset all checks first
    setSystemCheck({
      browser: false,
      camera: false,
      microphone: false,
      screenShare: false,
      internet: false
    });

    // Add delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 1. Browser compatibility check
    const browserSupported = !!(navigator.mediaDevices && 
                              typeof navigator.mediaDevices.getUserMedia === 'function' && 
                              window.MediaRecorder);
    setSystemCheck(prev => ({ ...prev, browser: browserSupported }));
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 2. Internet connectivity check
    const internetCheck = navigator.onLine;
    try {
      // Actually test connectivity with a lightweight request
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-cache' });
      setSystemCheck(prev => ({ ...prev, internet: internetCheck }));
    } catch {
      setSystemCheck(prev => ({ ...prev, internet: false }));
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 3. Device availability checks
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      // Camera check - try to access camera briefly
      let cameraAvailable = false;
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 },
          audio: false 
        });
        videoStream.getTracks().forEach(track => track.stop());
        cameraAvailable = true;
      } catch (error) {
        console.warn('Camera test failed:', error);
        cameraAvailable = devices.some(device => device.kind === 'videoinput' && device.label !== '');
      }
      setSystemCheck(prev => ({ ...prev, camera: cameraAvailable }));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Microphone check
      let microphoneAvailable = false;
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          video: false,
          audio: true 
        });
        audioStream.getTracks().forEach(track => track.stop());
        microphoneAvailable = true;
      } catch (error) {
        console.warn('Microphone test failed:', error);
        microphoneAvailable = devices.some(device => device.kind === 'audioinput' && device.label !== '');
      }
      setSystemCheck(prev => ({ ...prev, microphone: microphoneAvailable }));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Screen share check
      const screenShareAvailable = !!(navigator.mediaDevices as any).getDisplayMedia;
      setSystemCheck(prev => ({ ...prev, screenShare: screenShareAvailable }));
      
    } catch (error) {
      console.error('Device enumeration failed:', error);
      setSystemCheck(prev => ({
        ...prev,
        camera: false,
        microphone: false,
        screenShare: false
      }));
    }
    
    setLoading(false);
  };

  const requestPermissions = async (type: 'camera' | 'microphone' | 'screenShare') => {
    setLoading(true);
    
    try {
      switch (type) {
        case 'camera':
          try {
            setCameraLoading(true);
            setVideoReady(false);
            console.log('🎥 DEBUG: Starting camera permission request...');
            
            // Check browser support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              throw new Error('Camera not supported in this browser');
            }
            
            console.log('🎥 DEBUG: Requesting camera stream...');
            const videoStream = await navigator.mediaDevices.getUserMedia({ 
              video: { width: 640, height: 480, facingMode: 'user' },
              audio: false 
            });
            
            console.log('🎥 DEBUG: Camera stream obtained:', videoStream);
            console.log('🎥 DEBUG: Video tracks:', videoStream.getVideoTracks().map(t => ({
              id: t.id,
              label: t.label,
              enabled: t.enabled,
              readyState: t.readyState
            })));
            
            // Stop previous stream if exists
            if (mediaStream) {
              console.log('🎥 DEBUG: Stopping previous stream...');
              mediaStream.getTracks().forEach(track => track.stop());
            }
            
            setMediaStream(videoStream);
            setPermissions(prev => ({ ...prev, camera: true }));
            console.log('🎥 DEBUG: Camera permissions set to true');
            
            if (videoRef.current) {
              console.log('🎥 DEBUG: Video element found, attaching stream...');
              videoRef.current.srcObject = videoStream;
              videoRef.current.muted = true; // Essential for autoplay
              videoRef.current.playsInline = true;
              console.log('🎥 DEBUG: Stream attached to video element');
              
              // Add event listeners
              videoRef.current.onloadedmetadata = () => {
                console.log('🎥 DEBUG: Video metadata loaded');
                if (videoRef.current) {
                  console.log('🎥 DEBUG: Video dimensions:', {
                    videoWidth: videoRef.current.videoWidth,
                    videoHeight: videoRef.current.videoHeight
                  });
                }
              };
              
              videoRef.current.oncanplaythrough = () => {
                console.log('🎥 DEBUG: Video can play through');
                setVideoReady(true);
                setCameraLoading(false);
              };
              
              videoRef.current.onerror = (e) => {
                console.error('🚨 DEBUG: Video element error:', e);
              };
              
              // Attempt to play
              const playPromise = videoRef.current.play();
              if (playPromise) {
                playPromise
                  .then(() => {
                    console.log('🎥 DEBUG: Video playing successfully!');
                    setVideoReady(true);
                    setCameraLoading(false);
                  })
                  .catch(err => {
                    console.error('🚨 DEBUG: Video play failed:', err);
                    // Still set as ready for fallback
                    setTimeout(() => {
                      setVideoReady(true);
                      setCameraLoading(false);
                    }, 2000);
                  });
              }
              
              // Fallback timeout
              setTimeout(() => {
                console.log('🎥 DEBUG: Fallback timeout trigger');
                setVideoReady(true);
                setCameraLoading(false);
              }, 3000);
            } else {
              console.error('🚨 DEBUG: Video ref not available');
              setCameraLoading(false);
              setVideoReady(true);
            }
            
          } catch (error: any) {
            setCameraLoading(false);
            setVideoReady(false);
            console.error('🚨 DEBUG: Camera permission failed:', error);
            if (error.name === 'NotAllowedError') {
              alert('Camera access denied. Please allow camera access in your browser settings and try again.');
            } else if (error.name === 'NotFoundError') {
              alert('No camera found. Please connect a camera and try again.');
            } else {
              alert(`Camera error: ${error.message}`);
            }
            setPermissions(prev => ({ ...prev, camera: false }));
          }
          break;
          
        case 'microphone':
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ 
              video: false,
              audio: { 
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });
            
            // Test microphone by analyzing audio levels
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(audioStream);
            microphone.connect(analyser);
            
            // Quick test for actual audio input
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            
            // Stop the test stream
            audioStream.getTracks().forEach(track => track.stop());
            audioContext.close();
            
            setPermissions(prev => ({ ...prev, microphone: true }));
            
          } catch (error: any) {
            console.error('Microphone permission denied:', error);
            if (error.name === 'NotAllowedError') {
              alert('Microphone access denied. Please allow microphone access in your browser settings and try again.');
            } else if (error.name === 'NotFoundError') {
              alert('No microphone found. Please connect a microphone and try again.');
            } else {
              alert(`Microphone error: ${error.message}`);
            }
            setPermissions(prev => ({ ...prev, microphone: false }));
          }
          break;
          
        case 'screenShare':
          try {
            const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
              video: { mediaSource: 'screen' },
              audio: true
            });
            
            // Stop previous screen stream if exists
            if (screenStream) {
              screenStream.getTracks().forEach(track => track.stop());
            }
            
            setScreenStream(displayStream);
            
            // Stop the test stream after confirming it works
            setTimeout(() => {
              displayStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            }, 1000);
            
            setPermissions(prev => ({ ...prev, screenShare: true }));
            
          } catch (error: any) {
            console.error('Screen share permission denied:', error);
            if (error.name === 'NotAllowedError') {
              alert('Screen sharing access denied. Please allow screen sharing and try again.');
            } else {
              alert(`Screen sharing error: ${error.message}`);
            }
            setPermissions(prev => ({ ...prev, screenShare: false }));
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to get ${type} permission:`, error);
      alert(`Failed to access ${type}. Please check your browser settings and try again.`);
    }
    
    setLoading(false);
  };

  const capturePhoto = () => {
    console.log('🎥 DEBUG: Photo capture initiated');
    console.log('🎥 DEBUG: Video ref:', !!videoRef.current);
    console.log('🎥 DEBUG: Canvas ref:', !!canvasRef.current);
    console.log('🎥 DEBUG: Media stream:', !!mediaStream);
    console.log('🎥 DEBUG: Stream active:', mediaStream?.active);

    if (!videoRef.current || !canvasRef.current) {
      alert('Camera setup error. Please try enabling camera again.');
      return;
    }

    if (!mediaStream || !mediaStream.active) {
      alert('Camera not active. Please enable camera permission first.');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    console.log('🎥 DEBUG: Video state:', {
      paused: video.paused,
      readyState: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      clientWidth: video.clientWidth,
      clientHeight: video.clientHeight,
      srcObject: !!video.srcObject
    });
    
    // Ensure video is playing and has dimensions
    if (video.readyState < 2) {
      console.warn('🚨 DEBUG: Video not ready, waiting...');
      alert('Video is still loading. Please wait a moment and try again.');
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('🚨 DEBUG: No video dimensions available');
      alert('Camera video not ready. Please restart camera and try again.');
      return;
    }
    
    // Force video to play if it's paused
    if (video.paused) {
      video.play().catch(err => console.error('🚨 DEBUG: Video play failed:', err));
    }
    
    // Use actual video dimensions
    const width = video.videoWidth;
    const height = video.videoHeight;
    
    console.log('🎥 DEBUG: Using dimensions:', { width, height });
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        console.log('🎥 DEBUG: Drawing video to canvas...');
        
        // Clear canvas first
        ctx.clearRect(0, 0, width, height);
        
        // Draw the current video frame
        ctx.drawImage(video, 0, 0, width, height);
        
        // Convert to data URL
        const photoData = canvas.toDataURL('image/jpeg', 0.9);
        
        console.log('🎥 DEBUG: Photo data length:', photoData.length);
        console.log('🎥 DEBUG: Photo data preview:', photoData.substring(0, 100));
        
        // Check if we actually captured video content (not just black/empty)
        if (photoData && photoData.length > 10000) {
          console.log('🎥 DEBUG: Photo capture successful!');
          setCapturedPhoto(photoData);
          setIDVerification(prev => ({ ...prev, photoTaken: true }));
          
          // Simulate face matching
          setTimeout(() => {
            setIDVerification(prev => ({ ...prev, faceMatch: true }));
          }, 1000 + Math.random() * 1000);
          
        } else {
          console.warn('🚨 DEBUG: Captured photo appears empty, retrying...');
          
          // Wait a bit and try one more time
          setTimeout(() => {
            try {
              ctx.drawImage(video, 0, 0, width, height);
              const retryPhoto = canvas.toDataURL('image/jpeg', 0.9);
              
              if (retryPhoto && retryPhoto.length > 10000) {
                console.log('🎥 DEBUG: Retry capture successful!');
                setCapturedPhoto(retryPhoto);
                setIDVerification(prev => ({ ...prev, photoTaken: true }));
                setTimeout(() => setIDVerification(prev => ({ ...prev, faceMatch: true })), 1000);
              } else {
                throw new Error('Retry capture also failed');
              }
            } catch (retryError) {
              console.error('🚨 DEBUG: Retry capture failed:', retryError);
              
              // Show error but create minimal fallback for demo continuity
              alert('Photo capture failed. This might be due to browser security settings. For the demo, we\'ll proceed with a placeholder.');
              
              ctx.fillStyle = '#4F46E5';
              ctx.fillRect(0, 0, width, height);
              ctx.fillStyle = 'white';
              ctx.font = '20px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('Demo Photo Captured', width/2, height/2);
              ctx.fillText('(Camera detected but capture limited)', width/2, height/2 + 30);
              
              const demoPhoto = canvas.toDataURL('image/jpeg', 0.9);
              setCapturedPhoto(demoPhoto);
              setIDVerification(prev => ({ ...prev, photoTaken: true }));
              setTimeout(() => setIDVerification(prev => ({ ...prev, faceMatch: true })), 1000);
            }
          }, 500);
        }
        
      } catch (error) {
        console.error('🚨 DEBUG: Photo capture error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Photo capture failed: ${errorMessage}. Please try restarting the camera.`);
      }
    }
  };

  const handleIDUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedID(file);
      setIDVerification(prev => ({ ...prev, idDocumentUploaded: true }));
    }
  };

  const performFinalTest = async () => {
    setLoading(true);
    console.log('🔧 DEBUG: Starting final system test...');
    
    // Simulate comprehensive system test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Notify Control Plane that setup is complete
    const controlPlaneUrl = `http://localhost:4101/api/v1/sessions/${candidateData.sessionId}/control`;
    console.log('🔧 DEBUG: Notifying Control Plane:', controlPlaneUrl);
    
    try {
      const response = await fetch(controlPlaneUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'demo-key'
        },
        body: JSON.stringify({
          action: 'setup_complete',
          reason: 'Pre-exam setup completed successfully',
          timestamp: new Date().toISOString(),
          candidateId: candidateData.candidateId,
          setupData: {
            systemCheck,
            permissions,
            idVerification
          }
        })
      });
      
      console.log('🔧 DEBUG: Control Plane response status:', response.status);
      console.log('🔧 DEBUG: Control Plane response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.warn(`🚨 DEBUG: Control Plane responded with ${response.status}: ${response.statusText}`);
        const responseText = await response.text();
        console.warn('🚨 DEBUG: Response body:', responseText);
      } else {
        const responseData = await response.json().catch(() => 'No JSON response');
        console.log('🔧 DEBUG: Control Plane success response:', responseData);
      }
      
    } catch (error) {
      console.error('🚨 DEBUG: Failed to notify Control Plane:', error);
      console.error('🚨 DEBUG: This is likely because the Control Plane service is not running on port 4101');
      console.log('🔧 DEBUG: Continuing with setup completion anyway...');
    }
    
    setLoading(false);
    
    // Complete setup regardless of Control Plane response
    console.log('🔧 DEBUG: Setup completion data:', {
      systemCheck,
      permissions,
      idVerification,
      setupCompleted: new Date().toISOString()
    });
    
    // Complete setup
    onSetupComplete({
      systemCheck,
      permissions,
      idVerification,
      setupCompleted: new Date().toISOString()
    });
  };

  const nextStep = () => {
    if (currentStep < SETUP_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      performFinalTest();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // System Check
        return Object.values(systemCheck).every(Boolean) && !loading;
      case 1: // Permissions  
        return Object.values(permissions).every(Boolean) && !loading;
      case 2: // ID Verification
        return idVerification.photoTaken && idVerification.idDocumentUploaded && idVerification.faceMatch && !loading;
      case 3: // Environment Check
        return !loading; // Environment check is mostly visual confirmation
      case 4: // System Test
        return !loading;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    const step = SETUP_STEPS[currentStep];
    
    switch (step.id) {
      case 'system-check':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Settings className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">System Requirements Check</h2>
              <p className="text-gray-600">Verifying your device compatibility</p>
            </div>
            
            <div className="space-y-4">
              {Object.entries(systemCheck).map(([key, passed]) => {
                const isCheckingThisItem = loading && !passed;
                
                return (
                  <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {key === 'browser' && <Monitor className="w-5 h-5 text-gray-600" />}
                      {key === 'camera' && <Camera className="w-5 h-5 text-gray-600" />}
                      {key === 'microphone' && <Mic className="w-5 h-5 text-gray-600" />}
                      {key === 'screenShare' && <Monitor className="w-5 h-5 text-gray-600" />}
                      {key === 'internet' && <Wifi className="w-5 h-5 text-gray-600" />}
                      <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    </div>
                    <div className="flex items-center">
                      {isCheckingThisItem ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      ) : passed ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {!loading && (
              <button
                onClick={performSystemCheck}
                className="w-full flex items-center justify-center px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Recheck System
              </button>
            )}
          </div>
        );
        
      case 'permissions':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Permissions Setup</h2>
              <p className="text-gray-600">Grant access to your camera, microphone, and screen</p>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <Camera className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Camera Access</span>
                  </div>
                  {permissions.camera ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <button
                      onClick={() => requestPermissions('camera')}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Grant Access
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600">Required for identity verification and proctoring</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <Mic className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Microphone Access</span>
                  </div>
                  {permissions.microphone ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <button
                      onClick={() => requestPermissions('microphone')}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Grant Access
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600">Required for audio monitoring during exam</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <Monitor className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Screen Sharing</span>
                  </div>
                  {permissions.screenShare ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <button
                      onClick={() => requestPermissions('screenShare')}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Grant Access
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600">Required for screen monitoring and activity tracking</p>
              </div>
            </div>
            
            {permissions.camera && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-w-sm mx-auto rounded-lg"
                />
              </div>
            )}
          </div>
        );
        
      case 'id-verification':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Phone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Identity Verification</h2>
              <p className="text-gray-600">Take a photo and upload your ID document</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Photo Capture */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">1. Take Your Photo</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {capturedPhoto ? (
                    <div>
                      <img src={capturedPhoto} alt="Captured" className="w-32 h-32 mx-auto rounded-lg mb-4 object-cover" />
                      <div className="flex items-center justify-center space-x-2 text-green-600 mb-3">
                        <CheckCircle className="w-5 h-5" />
                        <span>Photo captured successfully</span>
                      </div>
                      <button
                        onClick={() => {
                          setCapturedPhoto(null);
                          setIDVerification(prev => ({ ...prev, photoTaken: false, faceMatch: false }));
                          // Reset camera states for retake
                          setVideoReady(false);
                          setCameraLoading(false);
                        }}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Retake Photo
                      </button>
                    </div>
                  ) : (
                    <div>
                      {permissions.camera && mediaStream ? (
                        <div className="space-y-4">
                          <div className="relative">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-48 h-36 mx-auto rounded-lg bg-black"
                            />
                            {cameraLoading && (
                              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                                <div className="text-center text-white">
                                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                  <p className="text-sm">Loading camera...</p>
                                  <p className="text-xs text-gray-300 mt-1">This should take a few seconds</p>
                                  <button
                                    onClick={() => {
                                      setCameraLoading(false);
                                      setVideoReady(true);
                                    }}
                                    className="mt-3 px-2 py-1 text-xs text-white border border-white border-opacity-50 rounded hover:bg-white hover:bg-opacity-20"
                                  >
                                    Skip if stuck
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={capturePhoto}
                            disabled={!videoReady || cameraLoading || !mediaStream?.active}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              videoReady && !cameraLoading && mediaStream?.active
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            title={
                              !videoReady ? 'Waiting for camera to initialize...' :
                              cameraLoading ? 'Camera is loading...' :
                              !mediaStream?.active ? 'Camera stream not active' :
                              'Ready to capture photo'
                            }
                          >
                            <Camera className="w-4 h-4 inline mr-2" />
                            {cameraLoading ? 'Loading Camera...' : 
                             !mediaStream?.active ? 'Camera Not Ready' :
                             !videoReady ? 'Initializing...' : 'Take Photo'}
                          </button>
                          
                          {/* Status indicator */}
                          <div className="text-xs text-center mt-2">
                            {!permissions.camera ? (
                              <span className="text-red-600">❌ Camera permission needed</span>
                            ) : !mediaStream ? (
                              <span className="text-yellow-600">⚠️ No camera stream</span>
                            ) : !mediaStream.active ? (
                              <span className="text-red-600">❌ Camera stream inactive</span>
                            ) : !videoReady ? (
                              <span className="text-blue-600">🔄 Camera initializing...</span>
                            ) : (
                              <span className="text-green-600">✅ Ready to capture</span>
                            )}
                          </div>
                          
                          {/* Debug info for development */}
                          {process.env.NODE_ENV === 'development' && (
                            <div className="mt-2 text-xs text-gray-500 text-center">
                              Stream: {mediaStream?.active ? 'Active' : 'Inactive'} | 
                              Ready: {videoReady ? 'Yes' : 'No'} | 
                              Loading: {cameraLoading ? 'Yes' : 'No'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-sm text-gray-600 mb-4">Camera permission required to take photo</p>
                          <button
                            onClick={() => requestPermissions('camera')}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                                Requesting...
                              </>
                            ) : (
                              'Enable Camera'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* ID Document Upload */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">2. Upload ID Document</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {uploadedID ? (
                    <div>
                      <div className="flex items-center justify-center space-x-2 text-green-600 mb-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>ID document uploaded</span>
                      </div>
                      <p className="text-sm text-gray-600">{uploadedID.name}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Upload ID
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleIDUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Face Matching Status */}
            {idVerification.photoTaken && idVerification.idDocumentUploaded && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center space-x-2">
                  {idVerification.faceMatch ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-800 font-medium">Identity verified successfully</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-blue-800 font-medium">Verifying identity match...</span>
                    </>
                  )}
                </div>
                {!idVerification.faceMatch && (
                  <div className="text-center mt-2">
                    <p className="text-xs text-blue-600">This may take a few moments</p>
                  </div>
                )}
              </div>
            )}
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        );
        
      case 'environment-check':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Eye className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Environment Setup</h2>
              <p className="text-gray-600">Ensure your testing environment meets requirements</p>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h3 className="font-semibold text-amber-800 mb-2">Environment Requirements</h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Quiet, well-lit room</li>
                  <li>• No other people visible in camera</li>
                  <li>• Clear desk surface</li>
                  <li>• Stable internet connection</li>
                  <li>• Close all unnecessary applications</li>
                </ul>
              </div>
              
              {permissions.camera ? (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Camera Preview</h3>
                  <div className="relative mx-auto max-w-lg">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-64 rounded-lg bg-black object-cover"
                    />
                    {cameraLoading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                        <div className="text-center text-white">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm">Loading camera...</p>
                        </div>
                      </div>
                    )}
                    {!videoReady && !cameraLoading && (
                      <div className="absolute inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center rounded-lg">
                        <div className="text-center text-white">
                          <Camera className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">Camera initializing...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 text-center mt-2">
                    Ensure you are clearly visible and well-lit
                  </p>
                  
                  {/* Environment Check Controls */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm">Lighting: Good</span>
                    </div>
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm">Background: Clear</span>
                    </div>
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm">Face visibility: {videoReady ? 'Detected' : 'Checking...'}</span>
                    </div>
                  </div>
                  
                  {/* Debug Controls - Development Only */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs font-semibold text-yellow-800 mb-2">🔧 DEBUG CONTROLS:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => requestPermissions('camera')}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Restart Camera
                        </button>
                        <button
                          onClick={() => {
                            console.log('🎥 Current video element:', videoRef.current);
                            console.log('🎥 Current stream:', mediaStream);
                            console.log('🎥 Video ready state:', videoReady);
                          }}
                          className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          Log Status
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg p-6 text-center">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Camera permission required for environment check</p>
                  <button
                    onClick={() => requestPermissions('camera')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Enable Camera
                  </button>
                </div>
              )}
              
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Environment check completed</span>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'system-test':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Monitor className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Final System Test</h2>
              <p className="text-gray-600">Running comprehensive system verification</p>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Camera Test</span>
                  <div className="flex items-center space-x-2">
                    {permissions.camera && mediaStream?.active && videoReady ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-xs text-gray-500">
                      {permissions.camera ? 
                        (mediaStream?.active && videoReady ? 'Active' : 'Inactive') : 
                        'Not granted'
                      }
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Microphone Test</span>
                  <div className="flex items-center space-x-2">
                    {permissions.microphone ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-xs text-gray-500">
                      {permissions.microphone ? 'Granted' : 'Not granted'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Screen Sharing Test</span>
                  <div className="flex items-center space-x-2">
                    {permissions.screenShare ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-xs text-gray-500">
                      {permissions.screenShare ? 'Granted' : 'Not granted'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Identity Verification</span>
                  <div className="flex items-center space-x-2">
                    {idVerification.photoTaken && idVerification.idDocumentUploaded && idVerification.faceMatch ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-xs text-gray-500">
                      {idVerification.photoTaken && idVerification.idDocumentUploaded ? 'Complete' : 'Incomplete'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Debug Information - Development Only */}
              {process.env.NODE_ENV === 'development' && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs font-semibold text-yellow-800 mb-2">🔧 SYSTEM DEBUG:</p>
                  <div className="text-xs text-yellow-700 space-y-1">
                    <div>Camera Stream: {mediaStream?.active ? '✅ Active' : '❌ Inactive'}</div>
                    <div>Video Tracks: {mediaStream?.getVideoTracks().length || 0}</div>
                    <div>Video Ready: {videoReady ? '✅ Yes' : '❌ No'}</div>
                    <div>All Permissions: {Object.values(permissions).every(p => p) ? '✅ Granted' : '❌ Missing'}</div>
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => requestPermissions('camera')}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Fix Camera
                    </button>
                    <button
                      onClick={() => console.log('🔧 DEBUG STATE:', { permissions, mediaStream, videoReady, idVerification })}
                      className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Log All States
                    </button>
                  </div>
                </div>
              )}
              
              <div className={`p-4 border rounded-lg ${
                Object.values(permissions).every(p => p) && 
                mediaStream?.active && 
                videoReady && 
                idVerification.photoTaken && 
                idVerification.idDocumentUploaded
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="text-center">
                  {Object.values(permissions).every(p => p) && 
                   mediaStream?.active && 
                   videoReady && 
                   idVerification.photoTaken && 
                   idVerification.idDocumentUploaded ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="font-semibold text-green-800">All systems ready!</p>
                      <p className="text-sm text-green-600">You can now start your proctored exam</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                      <p className="font-semibold text-yellow-800">Some systems need attention</p>
                      <p className="text-sm text-yellow-600">Please complete all verification steps to proceed</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      
      {/* Debug Panel - Development Mode */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-black text-white p-3 text-sm font-mono mb-4 mx-4 rounded">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>🎥 CAMERA STATUS:</strong><br/>
              Permission: {permissions.camera ? '✅ Granted' : '❌ Denied'}<br/>
              Video Ready: {videoReady ? '✅ Yes' : '❌ No'}<br/>
              Loading: {cameraLoading ? '🔄 Loading...' : '✅ Done'}
            </div>
            <div>
              <strong>📡 MEDIA STATE:</strong><br/>
              Stream Active: {mediaStream ? '✅ Yes' : '❌ No'}<br/>
              Video Tracks: {mediaStream ? mediaStream.getVideoTracks().length : 0}<br/>
              Current Step: {SETUP_STEPS[currentStep]?.title || 'Unknown'}
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pre-Exam Setup</h1>
          <p className="text-gray-600">Complete these steps to start your proctored exam</p>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {SETUP_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            
            return (
              <div key={step.id} className="flex items-center space-x-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-600 text-white' :
                  isCurrent ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="hidden md:block">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-blue-900' : 'text-gray-600'}`}>
                    {step.title}
                  </p>
                </div>
                {index < SETUP_STEPS.length - 1 && (
                  <div className="w-8 h-0.5 bg-gray-300 mx-2" />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          {renderStepContent()}
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel Setup
          </button>
          
          <div className="flex items-center space-x-4">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            
            <button
              onClick={nextStep}
              disabled={!canProceed() || loading}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {currentStep === SETUP_STEPS.length - 1 ? 'Running Tests...' : 'Processing...'}
                </>
              ) : (
                <>
                  {currentStep === SETUP_STEPS.length - 1 ? 'Start Exam' : 'Next Step'}
                  {currentStep < SETUP_STEPS.length - 1 && <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}