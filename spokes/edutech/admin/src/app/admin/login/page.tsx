'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Lock, User, Building2, LogIn } from 'lucide-react';

interface LoginForm {
  email: string;
  password: string;
  organization: string;
}

interface Organization {
  id: string;
  name: string;
  domain: string;
  type: 'tenant' | 'system-admin';
  features?: string[];
}

const organizations: Organization[] = [
  { 
    id: 'system-admin-001', 
    name: '🌟 Ayan.ai System Administration', 
    domain: 'admin.ayan.ai',
    type: 'system-admin',
    features: ['tenant-management', 'global-settings', 'analytics', 'rbac']
  },
  { 
    id: '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94', 
    name: 'Computer Science Department - University', 
    domain: 'cs.university.edu',
    type: 'tenant'
  },
  { 
    id: '123e4567-e89b-12d3-a456-426614174000', 
    name: 'Engineering College Assessment Center', 
    domain: 'eng.college.edu',
    type: 'tenant'
  },
  { 
    id: '987fcdeb-51a2-43d7-8f9e-123456789abc', 
    name: 'Business School Testing Services', 
    domain: 'business.school.edu',
    type: 'tenant'
  }
];

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({
    email: '',
    password: '',
    organization: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if already logged in
  useEffect(() => {
    const session = localStorage.getItem('tenant_session');
    if (session) {
      router.push('/admin');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Mock authentication - in real implementation this would call an auth service
      const org = organizations.find(o => o.id === form.organization);
      if (!org) {
        throw new Error('Invalid organization selected');
      }

      // Demo credentials check
      if ((form.email === 'admin@cs.university.edu' && form.password === 'demo123' && form.organization === '554be9e2-7918-4c1f-8d5b-ad2a3a2abd94') ||
          (form.email === 'proctor@eng.college.edu' && form.password === 'demo123' && form.organization === '123e4567-e89b-12d3-a456-426614174000') ||
          (form.email === 'examiner@business.school.edu' && form.password === 'demo123' && form.organization === '987fcdeb-51a2-43d7-8f9e-123456789abc') ||
          (form.email === 'superadmin@ayan.ai' && form.password === 'admin123' && form.organization === 'system-admin-001')) {
        
        // Create session
        const session = {
          userId: form.organization === 'system-admin-001' ? 'superadmin_001' : 'user_' + form.organization.slice(-8),
          email: form.email,
          organizationId: form.organization,
          organizationName: org.name,
          organizationType: org.type,
          role: form.organization === 'system-admin-001' ? 'super-admin' : 'admin',
          features: org.features || [],
          loginTime: new Date().toISOString()
        };

        // Store session
        localStorage.setItem('tenant_session', JSON.stringify(session));
        
        // Redirect to admin dashboard
        router.push('/admin');
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-cyan-400/5 via-transparent to-transparent" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ayan-logo.png" alt="Ayan.ai" className="h-20 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Proctor Admin Portal</h1>
          <p className="text-gray-400">Sign in to your organization's dashboard</p>
        </div>

        {/* Login Form */}
        <div className="bg-navy-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Organization Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                Organization
              </label>
              <select
                value={form.organization}
                onChange={(e) => setForm(prev => ({ ...prev, organization: e.target.value }))}
                className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                required
              >
                <option value="">Select Organization</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.type === 'system-admin' ? '(System Admin)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                placeholder="admin@organization.edu"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Lock className="w-4 h-4 inline mr-1" />
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-cyan-400 hover:bg-cyan-300 disabled:bg-cyan-400/50 text-navy-950 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-navy-950/20 border-t-navy-950 rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 bg-navy-900/40 border border-white/10 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Demo Credentials</h3>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-cyan-400">CS Department:</p>
              <p className="text-gray-400">admin@cs.university.edu / demo123</p>
            </div>
            <div>
              <p className="text-cyan-400">Engineering College:</p>
              <p className="text-gray-400">proctor@eng.college.edu / demo123</p>
            </div>
            <div>
              <p className="text-cyan-400">Business School:</p>
              <p className="text-gray-400">examiner@business.school.edu / demo123</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}