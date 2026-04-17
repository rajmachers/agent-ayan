'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Building2, Plus, Settings, Users, Globe,
  Search, MoreVertical, Eye, Edit, XCircle, CheckCircle,
  Shield, ChevronDown, X, Save, Key, User, Power
} from 'lucide-react';
import { usePlatformStats } from '../../../../hooks/usePlatformStats';

interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'suspended' | 'trial';
  plan: 'starter' | 'professional' | 'enterprise';
  spocName: string;
  spocEmail: string;
  userCount: number;
  createdAt: string;
  features: string[];
  proctoringOverrides: {
    faceDetection?: boolean;
    audioMonitoring?: boolean;
    fullscreenEnforcement?: boolean;
    evidenceCapture?: boolean;
  };
}

const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 'cs-university',
    name: 'Computer Science Department - University',
    domain: 'cs.university.edu',
    status: 'active',
    plan: 'enterprise',
    spocName: 'Dr. Rajesh Kumar',
    spocEmail: 'rajesh@cs.university.edu',
    userCount: 1254,
    createdAt: '2024-01-15',
    features: ['face-detection', 'screen-sharing', 'ai-behavior', 'advanced-analytics'],
    proctoringOverrides: {}
  },
  {
    id: 'eng-college',
    name: 'Engineering College Assessment Center',
    domain: 'eng.college.edu',
    status: 'active',
    plan: 'professional',
    spocName: 'Prof. Sarah Chen',
    spocEmail: 'sarah@eng.college.edu',
    userCount: 867,
    createdAt: '2024-02-01',
    features: ['face-detection', 'screen-sharing', 'basic-analytics'],
    proctoringOverrides: { fullscreenEnforcement: false }
  },
  {
    id: 'business-school',
    name: 'Business School Testing Services',
    domain: 'business.school.edu',
    status: 'trial',
    plan: 'starter',
    spocName: 'Mark Johnson',
    spocEmail: 'mark@business.school.edu',
    userCount: 134,
    createdAt: '2024-03-15',
    features: ['face-detection', 'basic-analytics'],
    proctoringOverrides: { audioMonitoring: false }
  }
];

export default function TenantManagement() {
  const { stats } = usePlatformStats(5000);
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('platform_tenants');
      if (saved) try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_TENANTS;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [viewTenant, setViewTenant] = useState<string | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [settingsTenant, setSettingsTenant] = useState<Tenant | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const saveTenants = useCallback((t: Tenant[]) => {
    setTenants(t);
    localStorage.setItem('platform_tenants', JSON.stringify(t));
  }, []);

  const filteredTenants = tenants.filter(t => {
    if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase()) && !t.domain.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (planFilter !== 'all' && t.plan !== planFilter) return false;
    return true;
  });

  const toggleStatus = (id: string) => {
    saveTenants(tenants.map(t => t.id === id ? { ...t, status: t.status === 'active' ? 'suspended' as const : 'active' as const } : t));
    setActiveMenu(null);
  };

  const deleteTenant = (id: string) => {
    if (confirm('Remove this tenant?')) {
      saveTenants(tenants.filter(t => t.id !== id));
    }
    setActiveMenu(null);
  };

  // Get real session counts per tenant org from platform stats
  const getOrgStats = (domain: string) => {
    return stats.orgStats.find(o => o.name === domain) || { sessions: 0, violations: 0 };
  };

  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10 border-green-400/20',
    suspended: 'text-red-400 bg-red-400/10 border-red-400/20',
    trial: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  };
  const planColors: Record<string, string> = {
    starter: 'text-blue-400 bg-blue-400/10',
    professional: 'text-purple-400 bg-purple-400/10',
    enterprise: 'text-orange-400 bg-orange-400/10'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Tenant Management</h1>
            <div className="flex items-center gap-2 px-2 py-1 bg-green-400/10 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-xs font-medium">LIVE DATA</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm">Manage organizations and their proctoring configurations</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-navy-950 px-4 py-2 rounded-lg font-medium">
          <Plus className="w-4 h-4" /> Add Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="bg-navy-800/50 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="Search tenants..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white">
          <option value="all">All Plans</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Tenant list */}
      <div className="space-y-4">
        {filteredTenants.map(tenant => {
          const orgStat = getOrgStats(tenant.domain);
          return (
            <div key={tenant.id} className="bg-navy-800/50 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Building2 className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-semibold text-white">{tenant.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[tenant.status]}`}>
                      {tenant.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${planColors[tenant.plan]}`}>
                      {tenant.plan}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-3 text-sm">
                    <div><span className="text-gray-400">Domain</span><div className="text-white font-medium">{tenant.domain}</div></div>
                    <div><span className="text-gray-400">SPOC</span><div className="text-white font-medium">{tenant.spocName}</div></div>
                    <div><span className="text-gray-400">Users</span><div className="text-white font-medium">{tenant.userCount.toLocaleString()}</div></div>
                    <div><span className="text-gray-400">Live Sessions</span><div className="text-cyan-400 font-medium">{orgStat.sessions}</div></div>
                    <div><span className="text-gray-400">Live Violations</span><div className="text-yellow-400 font-medium">{orgStat.violations}</div></div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tenant.features.map(f => (
                      <span key={f} className="px-2 py-0.5 bg-navy-700 text-cyan-400 text-xs rounded border border-cyan-400/20">{f.replace(/-/g, ' ')}</span>
                    ))}
                    {Object.entries(tenant.proctoringOverrides).filter(([,v]) => v === false).map(([k]) => (
                      <span key={k} className="px-2 py-0.5 bg-red-400/10 text-red-400 text-xs rounded border border-red-400/20">
                        {k.replace(/([A-Z])/g, ' $1').trim()} OFF
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 relative">
                  <button onClick={() => setViewTenant(viewTenant === tenant.id ? null : tenant.id)} title="View Sessions"
                    className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-navy-700 rounded-lg"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => setSettingsTenant(settingsTenant?.id === tenant.id ? null : tenant)} title="Proctoring Settings"
                    className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-navy-700 rounded-lg"><Settings className="w-4 h-4" /></button>
                  <button onClick={() => setActiveMenu(activeMenu === tenant.id ? null : tenant.id)} title="Actions"
                    className="p-2 text-gray-400 hover:text-white hover:bg-navy-700 rounded-lg"><MoreVertical className="w-4 h-4" /></button>

                  {/* Dropdown menu */}
                  {activeMenu === tenant.id && (
                    <div className="absolute right-0 top-10 z-50 w-56 bg-navy-800 border border-white/10 rounded-lg shadow-xl py-1">
                      <button onClick={() => { setEditTenant(tenant); setActiveMenu(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-navy-700 hover:text-white">
                        <Edit className="w-4 h-4" /> Edit Tenant Info
                      </button>
                      <button onClick={() => toggleStatus(tenant.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-navy-700 hover:text-white">
                        <Power className="w-4 h-4" /> {tenant.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => { setEditTenant({ ...tenant, _resetPassword: true } as any); setActiveMenu(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-navy-700 hover:text-white">
                        <Key className="w-4 h-4" /> Reset SPOC Password
                      </button>
                      <button onClick={() => { setEditTenant({ ...tenant, _changeSpoc: true } as any); setActiveMenu(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-navy-700 hover:text-white">
                        <User className="w-4 h-4" /> Change SPOC
                      </button>
                      <div className="border-t border-white/10 my-1" />
                      <button onClick={() => deleteTenant(tenant.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10">
                        <XCircle className="w-4 h-4" /> Remove Tenant
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded tenant view — shows real sessions */}
              {viewTenant === tenant.id && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2"><Eye className="w-4 h-4 text-cyan-400" /> Tenant Live Sessions</h4>
                  {orgStat.sessions > 0 ? (
                    <div className="bg-navy-900/60 rounded-lg p-4">
                      <p className="text-gray-300 text-sm">{orgStat.sessions} active session(s) with {orgStat.violations} violation(s)</p>
                      <p className="text-gray-500 text-xs mt-1">Switch to Tenant View from the top bar to see full session details for this organization.</p>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm bg-navy-900/60 rounded-lg p-4">No active sessions for this tenant right now.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Settings modal */}
      {settingsTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSettingsTenant(null)}>
          <div className="bg-navy-800 border border-white/10 rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Proctoring Overrides — {settingsTenant.name.split(' ')[0]}</h3>
              <button onClick={() => setSettingsTenant(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">Override global proctoring settings for this tenant. Unchecked items use global defaults.</p>
            <div className="space-y-3">
              {[
                { key: 'faceDetection', label: 'Face Detection', desc: 'Camera-based face presence checks' },
                { key: 'audioMonitoring', label: 'Audio Monitoring', desc: 'Microphone noise/voice detection' },
                { key: 'fullscreenEnforcement', label: 'Fullscreen Enforcement', desc: 'Force fullscreen during exam' },
                { key: 'evidenceCapture', label: 'Evidence Capture', desc: 'Screenshots, webcam frames, audio clips' },
              ].map(item => (
                <label key={item.key} className="flex items-center justify-between bg-white/5 rounded-lg p-3 cursor-pointer hover:bg-white/10">
                  <div>
                    <div className="text-white text-sm font-medium">{item.label}</div>
                    <div className="text-gray-500 text-xs">{item.desc}</div>
                  </div>
                  <input type="checkbox"
                    checked={(settingsTenant.proctoringOverrides as any)[item.key] !== false}
                    onChange={e => {
                      const updated = { ...settingsTenant, proctoringOverrides: { ...settingsTenant.proctoringOverrides, [item.key]: e.target.checked } };
                      setSettingsTenant(updated);
                    }}
                    className="form-checkbox h-5 w-5 text-cyan-400 bg-navy-800 border-white/20 rounded" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setSettingsTenant(null)} className="px-4 py-2 text-gray-400 border border-white/10 rounded-lg hover:text-white">Cancel</button>
              <button onClick={() => {
                saveTenants(tenants.map(t => t.id === settingsTenant.id ? { ...t, proctoringOverrides: settingsTenant.proctoringOverrides } : t));
                setSettingsTenant(null);
              }} className="px-4 py-2 bg-cyan-400 text-navy-950 rounded-lg font-medium hover:bg-cyan-300 flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Overrides
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit tenant modal */}
      {editTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditTenant(null)}>
          <div className="bg-navy-800 border border-white/10 rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">
                {(editTenant as any)._resetPassword ? 'Reset SPOC Password' : (editTenant as any)._changeSpoc ? 'Change SPOC Contact' : 'Edit Tenant'}
              </h3>
              <button onClick={() => setEditTenant(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {(editTenant as any)._resetPassword ? (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">Generate a new password for SPOC: <strong className="text-white">{editTenant.spocEmail}</strong></p>
                <div className="bg-white/5 rounded-lg p-3 font-mono text-cyan-400 text-center text-lg">
                  {Math.random().toString(36).slice(2, 10) + '!' + Math.floor(Math.random()*90+10)}
                </div>
                <p className="text-gray-500 text-xs">Copy this password and share securely with the SPOC. It cannot be retrieved later.</p>
                <div className="flex justify-end"><button onClick={() => setEditTenant(null)} className="px-4 py-2 bg-cyan-400 text-navy-950 rounded-lg font-medium">Done</button></div>
              </div>
            ) : (editTenant as any)._changeSpoc ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">New SPOC Name</label>
                  <input type="text" defaultValue={editTenant.spocName} onChange={e => editTenant.spocName = e.target.value}
                    className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">New SPOC Email</label>
                  <input type="email" defaultValue={editTenant.spocEmail} onChange={e => editTenant.spocEmail = e.target.value}
                    className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setEditTenant(null)} className="px-4 py-2 text-gray-400 border border-white/10 rounded-lg">Cancel</button>
                  <button onClick={() => {
                    saveTenants(tenants.map(t => t.id === editTenant.id ? { ...t, spocName: editTenant.spocName, spocEmail: editTenant.spocEmail } : t));
                    setEditTenant(null);
                  }} className="px-4 py-2 bg-cyan-400 text-navy-950 rounded-lg font-medium">Save Changes</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Tenant Name</label>
                  <input type="text" defaultValue={editTenant.name} onChange={e => editTenant.name = e.target.value}
                    className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Domain</label>
                  <input type="text" defaultValue={editTenant.domain} onChange={e => editTenant.domain = e.target.value}
                    className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Plan</label>
                  <select defaultValue={editTenant.plan} onChange={e => editTenant.plan = e.target.value as any}
                    className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white">
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setEditTenant(null)} className="px-4 py-2 text-gray-400 border border-white/10 rounded-lg">Cancel</button>
                  <button onClick={() => {
                    saveTenants(tenants.map(t => t.id === editTenant.id ? { ...t, name: editTenant.name, domain: editTenant.domain, plan: editTenant.plan } : t));
                    setEditTenant(null);
                  }} className="px-4 py-2 bg-cyan-400 text-navy-950 rounded-lg font-medium">Save Changes</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add tenant modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddForm(false)}>
          <div className="bg-navy-800 border border-white/10 rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Add New Tenant</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const nt: Tenant = {
                id: Math.random().toString(36).slice(2, 10),
                name: fd.get('name') as string,
                domain: fd.get('domain') as string,
                status: 'active',
                plan: fd.get('plan') as any,
                spocName: fd.get('spocName') as string,
                spocEmail: fd.get('spocEmail') as string,
                userCount: 0,
                createdAt: new Date().toISOString().slice(0, 10),
                features: ['face-detection'],
                proctoringOverrides: {}
              };
              saveTenants([...tenants, nt]);
              setShowAddForm(false);
            }}>
              <div className="space-y-3">
                <input name="name" placeholder="Organization Name" required className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-gray-400" />
                <input name="domain" placeholder="Domain (e.g. org.edu)" required className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-gray-400" />
                <select name="plan" className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white">
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
                <input name="spocName" placeholder="SPOC Name" required className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-gray-400" />
                <input name="spocEmail" placeholder="SPOC Email" required type="email" className="w-full px-3 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-gray-400" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-gray-400 border border-white/10 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-cyan-400 text-navy-950 rounded-lg font-medium">Create Tenant</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {filteredTenants.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No tenants found</p>
        </div>
      )}
    </div>
  );
}
