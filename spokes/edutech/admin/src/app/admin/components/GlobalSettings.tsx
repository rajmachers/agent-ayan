'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Users, Settings, Globe,
  BarChart3, Database, Zap, Shield,
  Eye, Mic, Brain, Monitor, Camera,
  Sliders, Save, RefreshCw, AlertCircle,
  HardDrive, Image, Film, AudioLines, Clock
} from 'lucide-react';

interface GlobalSettings {
  system: {
    maintenanceMode: boolean;
    debugMode: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    maxConcurrentSessions: number;
    sessionTimeout: number;
    autoBackup: boolean;
  };
  proctoring: {
    faceDetection: {
      enabled: boolean;
      sensitivity: number;
      interval: number;
      failureThreshold: number;
    };
    audioMonitoring: {
      enabled: boolean;
      noiseThreshold: number;
      voiceDetection: boolean;
      backgroundNoise: boolean;
    };
    screenMonitoring: {
      enabled: boolean;
      tabSwitchDetection: boolean;
      fullscreenEnforcement: boolean;
      screenshotInterval: number;
    };
    behaviorAnalysis: {
      enabled: boolean;
      motionDetection: boolean;
      eyeTracking: boolean;
      suspiciousPatterns: boolean;
    };
    violations: {
      autoTermination: boolean;
      warningLimit: number;
      strictMode: boolean;
      allowManualOverride: boolean;
    };
  };
  evidence: {
    storageMode: 'inline' | 'minio';
    captureScreenshots: boolean;
    captureWebcamFrames: boolean;
    captureAudioClips: boolean;
    retentionDays: number;
    maxEvidenceSizeKB: number;
  };
  ai: {
    visionModel: string;
    audioModel: string;
    behaviorModel: string;
    confidence: number;
    batchProcessing: boolean;
    realTimeProcessing: boolean;
  };
  integration: {
    webhookTimeout: number;
    retryAttempts: number;
    rateLimit: number;
    apiVersion: string;
    allowCORS: boolean;
  };
  security: {
    encryption: boolean;
    tokenExpiry: number;
    ipWhitelisting: boolean;
    twoFactorAuth: boolean;
    auditLogging: boolean;
  };
}

const defaultSettings: GlobalSettings = {
  system: {
    maintenanceMode: false,
    debugMode: false,
    logLevel: 'info',
    maxConcurrentSessions: 10000,
    sessionTimeout: 7200, // 2 hours
    autoBackup: true
  },
  proctoring: {
    faceDetection: {
      enabled: true,
      sensitivity: 75,
      interval: 1000, // 1 second
      failureThreshold: 3
    },
    audioMonitoring: {
      enabled: true,
      noiseThreshold: 30,
      voiceDetection: true,
      backgroundNoise: true
    },
    screenMonitoring: {
      enabled: true,
      tabSwitchDetection: true,
      fullscreenEnforcement: true,
      screenshotInterval: 30000 // 30 seconds
    },
    behaviorAnalysis: {
      enabled: true,
      motionDetection: true,
      eyeTracking: false,
      suspiciousPatterns: true
    },
    violations: {
      autoTermination: false,
      warningLimit: 5,
      strictMode: false,
      allowManualOverride: true
    }
  },
  evidence: {
    storageMode: 'inline',
    captureScreenshots: true,
    captureWebcamFrames: true,
    captureAudioClips: true,
    retentionDays: 1,
    maxEvidenceSizeKB: 200,
  },
  ai: {
    visionModel: 'yolov8n',
    audioModel: 'whisper-base',
    behaviorModel: 'mediapipe',
    confidence: 85,
    batchProcessing: false,
    realTimeProcessing: true
  },
  integration: {
    webhookTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    rateLimit: 1000, // requests per hour
    apiVersion: 'v1',
    allowCORS: true
  },
  security: {
    encryption: true,
    tokenExpiry: 3600, // 1 hour
    ipWhitelisting: false,
    twoFactorAuth: false,
    auditLogging: true
  }
};

export default function GlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'proctoring' | 'evidence' | 'ai' | 'integration' | 'security'>('system');

  const updateSetting = (section: keyof GlobalSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const updateNestedSetting = (section: keyof GlobalSettings, subsection: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...(prev[section] as any)[subsection],
          [key]: value
        }
      }
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Push evidence settings to session manager via one-shot WebSocket
      const ws = new WebSocket('ws://localhost:8181?type=admin');
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'admin:update_settings',
          data: { evidence: settings.evidence }
        }));
        // Close after a short delay to allow processing
        setTimeout(() => ws.close(), 1000);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'settings:saved') {
            console.log('✅ Settings saved to session manager:', msg.data);
          }
        } catch (_) {}
      };
      // Also save other settings to localStorage for persistence
      localStorage.setItem('platform_settings', JSON.stringify(settings));
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Settings saved:', settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
  };

  const tabs = [
    { id: 'system', label: 'System', icon: Database },
    { id: 'proctoring', label: 'Proctoring', icon: Shield },
    { id: 'evidence', label: 'Evidence & Storage', icon: HardDrive },
    { id: 'ai', label: 'AI Models', icon: Brain },
    { id: 'integration', label: 'Integration', icon: Globe },
    { id: 'security', label: 'Security', icon: AlertCircle }
  ];

  const renderSystemSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.system.maintenanceMode}
                onChange={(e) => updateSetting('system', 'maintenanceMode', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Maintenance Mode</span>
            </label>
            <p className="text-sm text-gray-400 mt-1">Temporarily disable new sessions</p>
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.system.debugMode}
                onChange={(e) => updateSetting('system', 'debugMode', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Debug Mode</span>
            </label>
            <p className="text-sm text-gray-400 mt-1">Enable verbose logging and debugging</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Log Level</label>
            <select
              value={settings.system.logLevel}
              onChange={(e) => updateSetting('system', 'logLevel', e.target.value)}
              className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Concurrent Sessions: {settings.system.maxConcurrentSessions}
            </label>
            <input
              type="range"
              min="100"
              max="50000"
              step="100"
              value={settings.system.maxConcurrentSessions}
              onChange={(e) => updateSetting('system', 'maxConcurrentSessions', parseInt(e.target.value))}
              className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Session Timeout: {Math.floor(settings.system.sessionTimeout / 60)} minutes
            </label>
            <input
              type="range"
              min="900"
              max="14400"
              step="300"
              value={settings.system.sessionTimeout}
              onChange={(e) => updateSetting('system', 'sessionTimeout', parseInt(e.target.value))}
              className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.system.autoBackup}
                onChange={(e) => updateSetting('system', 'autoBackup', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Auto Backup</span>
            </label>
            <p className="text-sm text-gray-400 mt-1">Automatically backup configuration daily</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProctoringSettings = () => (
    <div className="space-y-8">
      {/* Face Detection */}
      <div className="bg-navy-800/30 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Face Detection
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.proctoring.faceDetection.enabled}
                onChange={(e) => updateNestedSetting('proctoring', 'faceDetection', 'enabled', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Enable Face Detection</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sensitivity: {settings.proctoring.faceDetection.sensitivity}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={settings.proctoring.faceDetection.sensitivity}
                onChange={(e) => updateNestedSetting('proctoring', 'faceDetection', 'sensitivity', parseInt(e.target.value))}
                className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Check Interval: {settings.proctoring.faceDetection.interval / 1000}s
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="500"
                value={settings.proctoring.faceDetection.interval}
                onChange={(e) => updateNestedSetting('proctoring', 'faceDetection', 'interval', parseInt(e.target.value))}
                className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Failure Threshold: {settings.proctoring.faceDetection.failureThreshold}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={settings.proctoring.faceDetection.failureThreshold}
                onChange={(e) => updateNestedSetting('proctoring', 'faceDetection', 'failureThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audio Monitoring */}
      <div className="bg-navy-800/30 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Audio Monitoring
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.proctoring.audioMonitoring.enabled}
                onChange={(e) => updateNestedSetting('proctoring', 'audioMonitoring', 'enabled', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Enable Audio Monitoring</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.proctoring.audioMonitoring.voiceDetection}
                onChange={(e) => updateNestedSetting('proctoring', 'audioMonitoring', 'voiceDetection', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Voice Detection</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.proctoring.audioMonitoring.backgroundNoise}
                onChange={(e) => updateNestedSetting('proctoring', 'audioMonitoring', 'backgroundNoise', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Background Noise Detection</span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Noise Threshold: {settings.proctoring.audioMonitoring.noiseThreshold}
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={settings.proctoring.audioMonitoring.noiseThreshold}
                onChange={(e) => updateNestedSetting('proctoring', 'audioMonitoring', 'noiseThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Screen Monitoring */}
      <div className="bg-navy-800/30 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Screen Monitoring
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.proctoring.screenMonitoring.enabled}
                onChange={(e) => updateNestedSetting('proctoring', 'screenMonitoring', 'enabled', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Enable Screen Monitoring</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.proctoring.screenMonitoring.tabSwitchDetection}
                onChange={(e) => updateNestedSetting('proctoring', 'screenMonitoring', 'tabSwitchDetection', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Tab Switch Detection</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.proctoring.screenMonitoring.fullscreenEnforcement}
                onChange={(e) => updateNestedSetting('proctoring', 'screenMonitoring', 'fullscreenEnforcement', e.target.checked)}
                className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
              />
              <span className="text-white">Fullscreen Enforcement</span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Screenshot Interval: {settings.proctoring.screenMonitoring.screenshotInterval / 1000}s
              </label>
              <input
                type="range"
                min="5000"
                max="60000"
                step="5000"
                value={settings.proctoring.screenMonitoring.screenshotInterval}
                onChange={(e) => updateNestedSetting('proctoring', 'screenMonitoring', 'screenshotInterval', parseInt(e.target.value))}
                className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Global Settings</h1>
          <p className="text-gray-400">Configure system-wide proctoring parameters and policies</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetToDefaults}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 border border-white/10 rounded-lg hover:text-white hover:border-white/20 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 disabled:bg-cyan-400/50 text-navy-950 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-navy-800/50 border border-white/10 rounded-xl">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-navy-800/50 border border-white/10 rounded-xl p-6">
        {activeTab === 'system' && renderSystemSettings()}
        {activeTab === 'proctoring' && renderProctoringSettings()}
        {activeTab === 'evidence' && (
          <div className="space-y-8">
            {/* Storage Mode */}
            <div className="bg-navy-800/30 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Storage & Delivery
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Storage Mode</label>
                    <select
                      value={settings.evidence.storageMode}
                      onChange={(e) => updateSetting('evidence', 'storageMode', e.target.value)}
                      className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      <option value="inline">Inline (Base64 in Memory) — Default</option>
                      <option value="minio">MinIO / S3 Object Storage</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {settings.evidence.storageMode === 'inline'
                        ? 'Evidence stored as base64 in session data (fast, no external deps, limited by RAM)'
                        : 'Evidence uploaded to MinIO/S3 bucket (scalable, persistent, requires MinIO running)'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Max Evidence Size: {settings.evidence.maxEvidenceSizeKB} KB
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={settings.evidence.maxEvidenceSizeKB}
                      onChange={(e) => updateSetting('evidence', 'maxEvidenceSizeKB', parseInt(e.target.value))}
                      className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <p className="text-xs text-gray-500 mt-1">Max payload size per evidence attachment</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Retention Period: {settings.evidence.retentionDays} day{settings.evidence.retentionDays !== 1 ? 's' : ''}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="90"
                      step="1"
                      value={settings.evidence.retentionDays}
                      onChange={(e) => updateSetting('evidence', 'retentionDays', parseInt(e.target.value))}
                      className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1 day</span>
                      <span>30 days</span>
                      <span>90 days</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Evidence data older than {settings.evidence.retentionDays} day(s) will be automatically cleaned up
                    </p>
                  </div>

                  {settings.evidence.storageMode === 'minio' && (
                    <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
                      <p className="text-yellow-400 text-sm font-medium">MinIO Configuration</p>
                      <p className="text-yellow-400/70 text-xs mt-1">
                        Ensure MinIO is running on port 9000. Bucket: proctor-evidence.
                        Evidence will be stored at: evidence/YYYY-MM-DD/uuid.ext
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Evidence Capture Toggles */}
            <div className="bg-navy-800/30 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Evidence Capture
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 rounded-lg p-4">
                  <label className="flex items-center space-x-3 mb-3">
                    <input
                      type="checkbox"
                      checked={settings.evidence.captureScreenshots}
                      onChange={(e) => updateSetting('evidence', 'captureScreenshots', e.target.checked)}
                      className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
                    />
                    <span className="text-white font-medium">Screenshots</span>
                  </label>
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <Image className="w-4 h-4" />
                    <span>Browser Violations</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Captures page metadata (title, URL, viewport, visibility state) on browser events like tab switch, copy/paste, right-click
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <label className="flex items-center space-x-3 mb-3">
                    <input
                      type="checkbox"
                      checked={settings.evidence.captureWebcamFrames}
                      onChange={(e) => updateSetting('evidence', 'captureWebcamFrames', e.target.checked)}
                      className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
                    />
                    <span className="text-white font-medium">Webcam Frames</span>
                  </label>
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <Film className="w-4 h-4" />
                    <span>Vision AI Violations</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Captures JPEG webcam frame (320×240, ~10-20KB) at the moment of face detection failures, camera covered, etc.
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <label className="flex items-center space-x-3 mb-3">
                    <input
                      type="checkbox"
                      checked={settings.evidence.captureAudioClips}
                      onChange={(e) => updateSetting('evidence', 'captureAudioClips', e.target.checked)}
                      className="form-checkbox h-4 w-4 text-cyan-400 bg-navy-800 border-white/20 rounded focus:ring-cyan-400"
                    />
                    <span className="text-white font-medium">Audio Clips</span>
                  </label>
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <AudioLines className="w-4 h-4" />
                    <span>Audio AI Violations</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Captures 5-10 second audio clip from ring buffer on noise spikes, voice detection, sustained noise events
                  </p>
                </div>
              </div>
            </div>

            {/* Storage info */}
            <div className="bg-navy-800/30 p-4 rounded-lg border border-white/5">
              <p className="text-gray-400 text-sm">
                <strong className="text-white">Storage estimate:</strong> With all evidence types enabled, a typical session with 20 violations uses ~400KB (inline). 
                For high-volume deployments (1000+ concurrent sessions), consider switching to MinIO storage mode.
              </p>
            </div>
          </div>
        )}
        {activeTab === 'ai' && (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">AI Model settings will be available in the next version</p>
          </div>
        )}
        {activeTab === 'integration' && (
          <div className="text-center py-12">
            <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Integration settings will be available soon</p>
          </div>
        )}
        {activeTab === 'security' && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Security settings will be available soon</p>
          </div>
        )}
      </div>
    </div>
  );
}