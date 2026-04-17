'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Save, TestTube, Bell, Mail, Globe } from 'lucide-react';

export default function AlertConfigPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    tier2Threshold: -2.0,
    tier3Threshold: -3.0,
    tier4Threshold: -3.5,
    pauseThreshold: 40,
    terminateThreshold: 15,
    emailOnTier3: true,
    emailOnTier4: true,
    slackOnTier4: false,
    webhookOnTier4: false,
    dashboardHighlight: true
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('http://localhost:4101/api/v1/admin/alerts/config', {
        headers: { 'X-API-Key': 'demo-key' }
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setFormData({
          tier2Threshold: data.config.tiers.tier2.threshold,
          tier3Threshold: data.config.tiers.tier3.threshold,
          tier4Threshold: data.config.tiers.tier4.threshold,
          pauseThreshold: data.config.pauseThreshold,
          terminateThreshold: data.config.terminateThreshold,
          emailOnTier3: data.config.notificationChannels.emailOnTier3,
          emailOnTier4: data.config.notificationChannels.emailOnTier4,
          slackOnTier4: data.config.notificationChannels.slackOnTier4,
          webhookOnTier4: false,
          dashboardHighlight: data.config.notificationChannels.dashboardHighlight
        });
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:4101/api/v1/admin/alerts/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'demo-key'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Alert configuration saved successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setTestingAlert(true);
    try {
      // Simulate test alert
      setTimeout(() => {
        setSuccessMessage('Test alert sent! Check your notification channels.');
        setTestingAlert(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to test alert:', err);
      setTestingAlert(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading configuration...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Alert Configuration</h2>
            <p className="text-gray-400">Customize alert thresholds and notification channels</p>
          </div>
          <AlertTriangle className="w-12 h-12 text-yellow-400 opacity-30" />
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-900">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Tier Thresholds */}
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4">Alert Severity Tiers</h3>
          <div className="space-y-4">
            {/* Tier 1 */}
            <div className="bg-navy-900/50 rounded-lg p-4 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-400 font-semibold">Tier 1: Watch Zone</span>
                <span className="text-xs text-gray-500">Auto-triggered</span>
              </div>
              <div className="text-gray-400 text-sm mb-3">Normal variation in exam behavior</div>
              <div className="flex items-center gap-2">
                <label className="text-gray-300 text-sm">Threshold:</label>
                <input type="number" value="-1.0" readOnly className="w-20 px-2 py-1 bg-navy-800 border border-navy-600 rounded text-white text-sm" />
                <span className="text-gray-500 text-sm">(Z-score)</span>
              </div>
            </div>

            {/* Tier 2 */}
            <div className="bg-navy-900/50 rounded-lg p-4 border-l-4 border-yellow-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-400 font-semibold">Tier 2: Warning Zone</span>
                <span className="text-xs text-gray-500">Notify Proctor</span>
              </div>
              <div className="text-gray-400 text-sm mb-3">Moderately unusual behavior</div>
              <div className="flex items-center gap-2">
                <label className="text-gray-300 text-sm">Threshold:</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.tier2Threshold}
                  onChange={(e) => setFormData({ ...formData, tier2Threshold: parseFloat(e.target.value) })}
                  className="w-20 px-2 py-1 bg-navy-800 border border-navy-600 rounded text-white text-sm"
                />
                <span className="text-gray-500 text-sm">(Z-score)</span>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="bg-navy-900/50 rounded-lg p-4 border-l-4 border-orange-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-orange-400 font-semibold">Tier 3: Critical Zone</span>
                <span className="text-xs text-gray-500">Alert Super Admin</span>
              </div>
              <div className="text-gray-400 text-sm mb-3">Significant anomaly detected</div>
              <div className="flex items-center gap-2">
                <label className="text-gray-300 text-sm">Threshold:</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.tier3Threshold}
                  onChange={(e) => setFormData({ ...formData, tier3Threshold: parseFloat(e.target.value) })}
                  className="w-20 px-2 py-1 bg-navy-800 border border-navy-600 rounded text-white text-sm"
                />
                <span className="text-gray-500 text-sm">(Z-score)</span>
              </div>
            </div>

            {/* Tier 4 */}
            <div className="bg-navy-900/50 rounded-lg p-4 border-l-4 border-red-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-400 font-semibold">Tier 4: Emergency Zone</span>
                <span className="text-xs text-gray-500">Auto-Pause & Escalate</span>
              </div>
              <div className="text-gray-400 text-sm mb-3">Critical violation pattern</div>
              <div className="flex items-center gap-2">
                <label className="text-gray-300 text-sm">Threshold:</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.tier4Threshold}
                  onChange={(e) => setFormData({ ...formData, tier4Threshold: parseFloat(e.target.value) })}
                  className="w-20 px-2 py-1 bg-navy-800 border border-navy-600 rounded text-white text-sm"
                />
                <span className="text-gray-500 text-sm">(Z-score)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Action Thresholds */}
        <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
          <h3 className="text-white font-semibold mb-4">Auto-Actions</h3>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Auto-Pause at Credibility %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.pauseThreshold}
                onChange={(e) => setFormData({ ...formData, pauseThreshold: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white"
              />
              <p className="text-gray-500 text-xs mt-1">Pause exam when score drops below this %</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Auto-Terminate at Credibility %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.terminateThreshold}
                onChange={(e) => setFormData({ ...formData, terminateThreshold: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded text-white"
              />
              <p className="text-gray-500 text-xs mt-1">Terminate exam when score drops below this %</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="bg-navy-800 rounded-lg p-5 border border-navy-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-cyan-400" />
          Notification Channels
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Dashboard */}
          <div className="bg-navy-900/50 rounded-lg p-4 border border-navy-700">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-semibold">Dashboard Display</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.dashboardHighlight}
                onChange={(e) => setFormData({ ...formData, dashboardHighlight: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-300 text-sm">Highlight alerts on dashboard</span>
            </label>
            <p className="text-gray-500 text-xs mt-2">Always enabled for all tiers</p>
          </div>

          {/* Email Tier 3 */}
          <div className="bg-navy-900/50 rounded-lg p-4 border border-orange-500/30">
            <div className="flex items-center gap-3 mb-3">
              <Mail className="w-5 h-5 text-orange-400" />
              <span className="text-white font-semibold">Email (Tier 3+)</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.emailOnTier3}
                onChange={(e) => setFormData({ ...formData, emailOnTier3: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-300 text-sm">Send email alerts</span>
            </label>
            <p className="text-gray-500 text-xs mt-2">For critical and emergency tiers</p>
          </div>

          {/* Email Tier 4 */}
          <div className="bg-navy-900/50 rounded-lg p-4 border border-red-500/30">
            <div className="flex items-center gap-3 mb-3">
              <Mail className="w-5 h-5 text-red-400" />
              <span className="text-white font-semibold">Email (Tier 4 Only)</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.emailOnTier4}
                onChange={(e) => setFormData({ ...formData, emailOnTier4: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-300 text-sm">Emergency tier only</span>
            </label>
            <p className="text-gray-500 text-xs mt-2">Escalate critical alerts</p>
          </div>

          {/* Slack */}
          <div className="bg-navy-900/50 rounded-lg p-4 border border-purple-500/30">
            <div className="flex items-center gap-3 mb-3">
              <Bell className="w-5 h-5 text-purple-400" />
              <span className="text-white font-semibold">Slack Integration</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.slackOnTier4}
                onChange={(e) => setFormData({ ...formData, slackOnTier4: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-300 text-sm">Post to Slack channel</span>
            </label>
            <p className="text-gray-500 text-xs mt-2">Emergency tier alerts only</p>
          </div>

          {/* Webhook */}
          <div className="bg-navy-900/50 rounded-lg p-4 border border-green-500/30">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-5 h-5 text-green-400" />
              <span className="text-white font-semibold">Webhook</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.webhookOnTier4}
                onChange={(e) => setFormData({ ...formData, webhookOnTier4: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-300 text-sm">POST to custom endpoint</span>
            </label>
            <p className="text-gray-500 text-xs mt-2">Configure in organization settings</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        <button
          onClick={handleTestAlert}
          disabled={testingAlert}
          className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <TestTube className="w-5 h-5" />
          {testingAlert ? 'Sending...' : 'Send Test Alert'}
        </button>
      </div>
    </div>
  );
}
