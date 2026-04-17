'use client'

import Link from 'next/link'
import { useSimulation } from '@/context/SimulationContext'
import { HintIcon } from '@/components/HintIcon'

export default function RulesConfigurationPage() {
  const { session } = useSimulation()

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No active session. Please start from Setup page.</p>
      </div>
    )
  }

  // Default rules configuration
  const defaultRules = {
    vision: {
      detectMultiplePeople: true,
      detectPhones: true,
      detectDocuments: true,
    },
    audio: {
      detectMultipleSpeakers: true,
      checkNoiseLevel: true,
      noiseLevelThreshold: 60,
    },
    behavior: {
      detectScreenSwitch: true,
      detectHeadTurning: true,
      headTurningThreshold: 30,
      detectHandMovements: true,
    },
    penalties: {
      vision: 2.0,
      audio: 1.5,
      behavior: 1.0,
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-2">
          📋 Rules Configuration
          <HintIcon
            icon="ℹ️"
            size="md"
            title="Rules Configuration"
            description="Violation detection rules and thresholds for the proctoring system."
            examples={['Adjust sensitivity levels', 'Set detection thresholds', 'View enabled categories']}
            details="Rules determine how violations are detected and scored."
          />
        </h1>
        <p className="text-slate-400">View violation detection and scoring rules</p>
      </div>

      {/* Vision Rules */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">👁️ Vision Detection Rules</h2>
          <HintIcon
            icon="?"
            size="sm"
            title="Vision Detection"
            description="Rules for detecting people, unauthorized items, and environment issues via camera."
            examples={['Detect multiple people', 'Detect non-candidate faces', 'Detect phones or documents']}
            details="Uses YOLOv8 for real-time object detection."
          />
        </div>

        <div className="space-y-4">
          {/* Person Detection */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Detect Multiple People</label>
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Multiple People Detection"
                  description="Alerts when more than one person is detected in the camera frame."
                  examples={['Someone enters the room', 'Candidate with proctor', 'Tailgating']}
                  details="Violation: Person detected (non-candidate)"
                />
              </div>
              <span className="text-lg">{defaultRules.vision.detectMultiplePeople ? '✅' : '❌'}</span>
            </div>
            <p className="text-xs opacity-75">Enable to detect when unauthorized people enter the frame</p>
          </div>

          {/* Phone Detection */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Detect Phones/Devices</label>
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Phone Detection"
                  description="Alerts when phones, tablets, or other devices are detected."
                  examples={['Candidate holding phone', 'Device on desk', 'Smartwatch detected']}
                  details="Violation: Unauthorized device detected"
                />
              </div>
              <span className="text-lg">{defaultRules.vision.detectPhones ? '✅' : '❌'}</span>
            </div>
            <p className="text-xs opacity-75">Enable to detect unauthorized devices in frame</p>
          </div>

          {/* Document Detection */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Detect Documents/Notes</label>
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Document Detection"
                  description="Alerts when physical documents, notes, or printed materials are detected."
                  examples={['Candidate with notes', 'Textbook visible', 'Cheat sheet detected']}
                  details="Violation: Unauthorized materials detected"
                />
              </div>
              <span className="text-lg">{defaultRules.vision.detectDocuments ? '✅' : '❌'}</span>
            </div>
            <p className="text-xs opacity-75">Enable to detect unauthorized materials in view</p>
          </div>
        </div>
      </div>

      {/* Audio Rules */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">🎤 Audio Detection Rules</h2>
          <HintIcon
            icon="?"
            size="sm"
            title="Audio Detection"
            description="Rules for detecting background noise, multiple speakers, and suspicious audio patterns."
            examples={['Detect multiple speakers', 'Detect unusual noise', 'Detect background voices']}
            details="Uses Whisper for speech-to-text and analysis."
          />
        </div>

        <div className="space-y-4">
          {/* Multiple Speakers */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Detect Multiple Speakers</label>
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Multiple Speakers Detection"
                  description="Alerts when multiple distinct voices are detected in audio."
                  examples={['Someone talking in background', 'Candidate gets help', 'Background conversation']}
                  details="Violation: Multiple speakers detected"
                />
              </div>
              <span className="text-lg">{defaultRules.audio.detectMultipleSpeakers ? '✅' : '❌'}</span>
            </div>
            <p className="text-xs opacity-75">Enable to detect when multiple people are speaking</p>
          </div>

          {/* Noise Level */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Check Noise Levels</label>
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Noise Level Detection"
                  description="Alerts when background noise exceeds configured threshold."
                  examples={['Loud TV in background', 'Construction noise', 'Loud music nearby']}
                  details="Violation: Excessive background noise detected"
                />
              </div>
              <span className="text-lg">{defaultRules.audio.checkNoiseLevel ? '✅' : '❌'}</span>
            </div>
            <p className="text-xs opacity-75">Enable to monitor excessive background noise</p>
            <div className="flex items-center gap-2">
              <label className="text-sm">Threshold (dB):</label>
              <div className="text-sm font-mono bg-slate-800 px-3 py-1 rounded">{defaultRules.audio.noiseLevelThreshold}</div>
              <HintIcon
                icon="?"
                size="sm"
                title="Noise Threshold"
                description="Decibel level above which background noise is flagged as violation."
                examples={['60dB: Stricter (normal office)', '70dB: Moderate (some background)', '80dB+: Lenient']}
                details="Lower threshold = stricter enforcement"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Behavior Rules */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">🎯 Behavior Detection Rules</h2>
          <HintIcon
            icon="?"
            size="sm"
            title="Behavior Detection"
            description="Rules for detecting suspicious behavior like leaving screen, looking away, hand movements."
            examples={['Detect window blur/alt-tab', 'Detect head turning', 'Detect unusual hand movements']}
            details="Uses computer vision to track user attention and behavior."
          />
        </div>

        <div className="space-y-4">
          {/* Screen Switching */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Detect Screen Switches (Alt+Tab)</label>
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Screen Switch Detection"
                  description="Alerts when candidate switches away from exam window."
                  examples={['Alt+Tab to browser', 'Minimize exam window', 'Switch to search engine']}
                  details="Violation: Focus left exam window"
                />
              </div>
              <span className="text-lg">{defaultRules.behavior.detectScreenSwitch ? '✅' : '❌'}</span>
            </div>
            <p className="text-xs opacity-75">Enable to track exam window focus</p>
          </div>

          {/* Head Turning */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Detect Head Turning</label>
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Head Position Detection"
                  description="Alerts when head turns significantly away from screen."
                  examples={['Looking to the side', 'Looking down at notes', 'Checking reflection']}
                  details="Violation: Head turned away from screen"
                />
              </div>
              <span className="text-lg">{defaultRules.behavior.detectHeadTurning ? '✅' : '❌'}</span>
            </div>
            <p className="text-xs opacity-75">Enable to monitor eye contact with screen</p>
            <div className="flex items-center gap-2">
              <label className="text-sm">Angle Threshold (°):</label>
              <div className="text-sm font-mono bg-slate-800 px-3 py-1 rounded">{defaultRules.behavior.headTurningThreshold}°</div>
              <HintIcon
                icon="?"
                size="sm"
                title="Head Angle Threshold"
                description="Degrees of head rotation before flagging as violation."
                examples={['15°: Very strict', '30°: Moderate', '45°+: Lenient']}
                details="Lower angle = stricter monitoring"
              />
            </div>
          </div>

          {/* Hand Detection */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Detect Suspicious Hand Movements</label>
                <HintIcon
                  icon="?"
                  size="sm"
                  title="Hand Movement Detection"
                  description="Alerts on unusual hand movements or gestures suggesting cheating."
                  examples={['Reaching off-screen', 'Unusual hand signals', 'Gesturing to camera']}
                  details="Violation: Suspicious hand movement detected"
                />
              </div>
              <span className="text-lg">{defaultRules.behavior.detectHandMovements ? '✅' : '❌'}</span>
            </div>
            <p className="text-xs opacity-75">Enable to monitor hand position and movements</p>
          </div>
        </div>
      </div>

      {/* Scoring Penalties */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">⚖️ Scoring Penalties</h2>
          <HintIcon
            icon="?"
            size="sm"
            title="Scoring Penalties"
            description="Configure how many points each category of violations deduct from the score."
            examples={['High severity = large deduction', 'Medium severity = moderate deduction', 'Low severity = small deduction']}
            details="Higher penalties = detection weighted more heavily in final score."
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <label className="font-semibold">Vision Penalty</label>
            <HintIcon
              icon="?"
              size="sm"
              title="Vision Penalty"
              description="Points deducted per vision violation."
              examples={['2.0: Moderate impact', '3.0: Heavy impact', '1.0: Light impact']}
              details="Each vision violation deducts this amount from score."
            />
            <div className="text-lg font-bold">{defaultRules.penalties.vision} pts</div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <label className="font-semibold">Audio Penalty</label>
            <HintIcon
              icon="?"
              size="sm"
              title="Audio Penalty"
              description="Points deducted per audio violation."
              examples={['1.5: Moderate impact', '2.0: Heavy impact', '0.5: Light impact']}
              details="Each audio violation deducts this amount from score."
            />
            <div className="text-lg font-bold">{defaultRules.penalties.audio} pts</div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <label className="font-semibold">Behavior Penalty</label>
            <HintIcon
              icon="?"
              size="sm"
              title="Behavior Penalty"
              description="Points deducted per behavior violation."
              examples={['1.0: Moderate impact', '1.5: Heavy impact', '0.5: Light impact']}
              details="Each behavior violation deducts this amount from score."
            />
            <div className="text-lg font-bold">{defaultRules.penalties.behavior} pts</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/exam-monitor">
          <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all">
            ← Back to Monitor
          </button>
        </Link>
      </div>
    </div>
  )
}
