'use client';

import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, AlertCircle, Zap, CheckCircle, Save, RefreshCw } from 'lucide-react';

interface AlertTierConfig {
  threshold: number;
  type: string;
  action: string;
  label: string;
  description: string;
}

export default function AlertConfiguration() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tier2, setTier2] = useState(-2.0);
  const [tier3, setTier3] = useState(-3.0);
  const [tier4, setTier4] = useState(-3.5);
  const [emailTier4, setEmailTier4] = useState(true);
  const [slackTier4, setSlackTier4] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4101/api/v1/admin/alerts/config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setTier2(data.config.tiers.tier2.threshold);
        setTier3(data.config.tiers.tier3.threshold);
        setTier4(data.config.tiers.tier4.threshold);
        setEmailTier4(data.config.notificationChannels.emailOnTier4);
        setSlackTier4(data.config.notificationChannels.slackOnTier4);
      }
    } catch (err) {
      console.error('Failed to fetch alert config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:4101/api/v1/admin/alerts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier2Threshold: tier2,
          tier3Threshold: tier3,
          tier4Threshold: tier4,
          emailOnTier4: emailTier4,
          slackOnTier4: slackTier4
        })
      });
      
      if (res.ok) {
        await fetchConfig();
      }
    } catch (err) {
      console.error('Failed to save alert config:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const tiers = [
    {
      id: 'tier1',
      name: 'Watch Zone',
      threshold: -1.0,
      color: 'bg-blue-900/20 border-blue-500/30',
      icon: <CheckCircle className="w-5 h-5 text-blue-400" />,
      description: 'Normal variation - display to proctor only',
      editable: false
    },
    {
      id: 'tier2',
      name: 'Warning Zone',
      threshold: tier2,
      color: 'bg-yellow-900/20 border-yellow-500/30',
      icon: <AlertCircle className="w-5 h-5 text-yellow-400" />,
      description: 'Moderately unusual - notify proctor',
      editable: true,
      value: tier2,
      onChange: setTier2
    },
    {
      id: 'tier3',
      name: 'Critical Zone',
      threshold: tier3,
      color: 'bg-orange-900/20 border-orange-500/30',
      icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
      description: 'Significant anomaly - alert super admin',
      editable: true,
      value: tier3,
      onChange: setTier3
    },
    {
      id: 'tier4',
      name: 'Emergency Zone',
      threshold: tier4,
      color: 'bg-red-900/20 border-red-500/30',
      icon: <Zap className="w-5 h-5 text-red-400" />,
      description: 'Critical violation pattern - auto pause & escalate',
      editable: true,
      value: tier4,
      onChange: setTier4
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-xl font-bold text-white">Alert & Escalation Tiers</h3>
            <p className="text-sm text-gray-400 mt-1">Configure Z-score thresholds for automatic alerts and actions</p>
          </div>
        </div>
        <button
          onClick={fetchConfig}
          className="px-3 py-1 rounded text-sm text-gray-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Z-Score Visual */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <p className="text-gray-400 text-sm mb-4">Z-Score Distribution Reference</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-gray-400">-4σ (Very Rare)</span>
            <span className="text-gray-400">0σ (Mean)</span>
            <span className="text-gray-400">+3σ (Suspicious)</span>
          </div>
          <div className="h-12 bg-gradient-to-r from-red-900/40 via-green-900/40 to-red-900/40 rounded-lg border border-white/10 relative">
            {[tier4, tier3, tier2, -1].map((t, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-0.5 bg-white/30"
                style={{ left: `${((t + 4) / 8) * 100}%` }}
                title={`Tier ${i + 1}: ${t}σ`}
              ></div>
            ))}
          </div>
        </div>
      </div>

      {/* Tier Configuration */}
      <div className="space-y-4">
        {tiers.map((tier, idx) => (
          <div key={tier.id} className={`border rounded-lg p-6 ${tier.color}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                {tier.icon}
                <div>
                  <h4 className="text-lg font-semibold text-white">{tier.name}</h4>
                  <p className="text-sm text-gray-400 mt-1">{tier.description}</p>
                </div>
              </div>
              <div className="text-right">
                {tier.editable ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={tier.value}
                      onChange={(e) => tier.onChange?.(parseFloat(e.target.value))}
                      className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm text-right"
                    />
                    <span className="text-gray-400 text-sm">σ</span>
                  </div>
                ) : (
                  <span className="text-lg font-mono text-white">{tier.threshold}σ</span>
                )}
              </div>
            </div>

            {/* Action Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Default Action</p>
                <p className="text-white font-medium mt-1">
                  {config?.tiers[tier.id]?.action.replace(/_/g, ' ').toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Alert Type</p>
                <p className="text-white font-medium mt-1 capitalize">{config?.tiers[tier.id]?.type}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notification Channels */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Notification Channels</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailTier4}
              onChange={(e) => setEmailTier4(e.target.checked)}
              className="w-4 h-4 rounded bg-white/10 border border-white/20 accent-purple-500"
            />
            <span className="text-white">Email alerts on Tier 4 (Emergency)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={slackTier4}
              onChange={(e) => setSlackTier4(e.target.checked)}
              className="w-4 h-4 rounded bg-white/10 border border-white/20 accent-purple-500"
            />
            <span className="text-white">Slack notifications on Tier 4 (Emergency)</span>
          </label>
        </div>
      </div>

      {/* Session Thresholds */}
      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Automatic Session Actions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-gray-400 text-sm mb-2">Pause Threshold</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={config?.pauseThreshold || 40}
                disabled
                className="flex-1 px-3 py-2 rounded bg-white/5 border border-white/10 text-white"
              />
              <span className="text-gray-400">% credibility</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Auto-pause when credibility drops below this</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm mb-2">Terminate Threshold</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={config?.terminateThreshold || 15}
                disabled
                className="flex-1 px-3 py-2 rounded bg-white/5 border border-white/10 text-white"
              />
              <span className="text-gray-400">% credibility</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Manual review recommended before auto-termination</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          <strong>Note:</strong> Z-score thresholds determine when alerts are triggered. Lower thresholds (more negative) = stricter criteria. 
          Tier 4 enables automatic session pause; Tier 3+ triggers admin notifications.
        </p>
      </div>
    </div>
  );
}
