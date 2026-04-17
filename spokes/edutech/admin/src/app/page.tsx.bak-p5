'use client';

import { motion } from 'framer-motion';
import {
  Shield, Eye, Brain, Mic, Monitor, BarChart3,
  Scan, CheckCircle2, AlertTriangle, Lock,
  Code2, Plug, Globe, ChevronRight, ExternalLink,
  Zap, Target, Activity, Users, Play, Building2,
} from 'lucide-react';

/* ─── animation presets ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};
const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ─── reusable components ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-cyan-400 mb-4">
      <span className="w-8 h-px bg-cyan-400/60" />
      {children}
    </span>
  );
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-navy-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 md:p-8 ${className}`}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════ */
export default function Home() {
  return (
    <main className="relative overflow-hidden">
      {/* grid bg */}
      <div className="fixed inset-0 bg-grid-pattern opacity-100 pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-radial from-cyan-400/[0.04] via-transparent to-transparent pointer-events-none" />

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-navy-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ayan-logo.png" alt="Ayan.ai" className="h-20 object-contain" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#capabilities" className="hover:text-white transition">Capabilities</a>
            <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
            <a href="#integration" className="hover:text-white transition">Integration</a>
            <a href="#safety" className="hover:text-white transition">Trust</a>
          </div>
          <a
            href="/admin"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 rounded-lg text-sm font-medium hover:bg-cyan-400/20 transition"
          >
            Launch Console <ChevronRight size={14} />
          </a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp}>
              <SectionLabel>INTRODUCING THE CREATOR OF AGENTIC AI PROCTORING</SectionLabel>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6">
              <span className="text-gradient">Ayan.</span>{' '}
              The Creator{' '}
              <span className="text-gradient">of Agents</span>{' '}
              for Enterprise.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-gray-400 max-w-xl mb-6 leading-relaxed">
              <strong className="text-cyan-400">Ayan</strong> (Sanskrit: "The Creator") builds intelligent AI agents that orchestrate assessment integrity. The world's first agentic AI proctor that wraps any assessment application with zero integration.
            </motion.p>
            <motion.div variants={fadeUp} className="mb-8">
              <div className="bg-navy-900/60 border border-cyan-400/20 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Target size={18} className="text-cyan-400" />
                  Enterprise-First Architecture
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    Self-hosted & air-gapped deployment
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    Multi-tenant with SSO integration
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    Real-time agent orchestration
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    Configurable AI policies & thresholds
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-400 text-navy-950 font-semibold rounded-lg hover:bg-cyan-300 transition text-sm"
              >
                See How It Works <Play size={16} />
              </a>
              <a
                href="#integration"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 text-white rounded-lg hover:bg-white/5 transition text-sm"
              >
                Integration Guide <Code2 size={16} />
              </a>
            </motion.div>
          </motion.div>

          {/* Hero visual — mock product UI */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative hidden lg:block"
          >
            <div className="glow-cyan rounded-2xl">
              <GlassCard className="relative overflow-hidden">
                {/* Mock session dashboard */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-gold-400/80" />
                  <div className="w-3 h-3 rounded-full bg-green-400/80" />
                  <span className="ml-3 text-xs text-gray-500 font-mono">ayan.nunmai.local/admin</span>
                </div>
                <div className="space-y-3">
                  {/* Stat cards row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Active Sessions', value: '24', color: 'text-cyan-400' },
                      { label: 'Exams Today', value: '8', color: 'text-white' },
                      { label: 'Violations', value: '12', color: 'text-gold-400' },
                      { label: 'Avg Credibility', value: '94%', color: 'text-green-400' },
                    ].map((s) => (
                      <div key={s.label} className="bg-navy-950/60 rounded-lg p-3">
                        <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Session rows */}
                  <div className="bg-navy-950/60 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[10px] text-gray-500 border-b border-white/5">
                      <span>Candidate</span><span>Exam</span><span>Status</span><span>Credibility</span><span>Risk</span>
                    </div>
                    {[
                      { name: 'Priya S.', exam: 'DSA Final', status: 'Active', cred: '97%', risk: 'Low', riskColor: 'bg-green-400' },
                      { name: 'Rahul K.', exam: 'ML Midterm', status: 'Active', cred: '82%', risk: 'Medium', riskColor: 'bg-gold-400' },
                      { name: 'Ananya M.', exam: 'OS Quiz', status: 'Active', cred: '65%', risk: 'High', riskColor: 'bg-orange-400' },
                      { name: 'Dev R.', exam: 'DBMS Final', status: 'Verifying', cred: '—', risk: '—', riskColor: 'bg-gray-600' },
                    ].map((r) => (
                      <div key={r.name} className="grid grid-cols-5 gap-2 px-3 py-2 text-[11px] border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <span className="text-white">{r.name}</span>
                        <span>{r.exam}</span>
                        <span><span className="px-1.5 py-0.5 bg-cyan-400/10 text-cyan-400 rounded text-[9px]">{r.status}</span></span>
                        <span className="text-white font-medium">{r.cred}</span>
                        <span><span className={`inline-block w-2 h-2 rounded-full ${r.riskColor} mr-1`} />{r.risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── ENTERPRISE AGENCY ─── */}
      <section className="relative py-24 md:py-32 bg-navy-900/20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}><SectionLabel>WHY AYAN LEADS ENTERPRISE AI</SectionLabel></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white">
              Built by{' '}
              <span className="text-gradient">The Creator</span>{' '}
              for Creators.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-gray-400 max-w-3xl mx-auto">
              Ayan doesn't just monitor—it orchestrates. Every enterprise assessment becomes a symphony of intelligence, 
              where AI agents collaborate to ensure integrity while maintaining human oversight and enterprise compliance.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.div variants={fadeUp} className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-cyan-400/10 rounded-xl">
                    <Brain size={24} className="text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Agentic Intelligence</h3>
                    <p className="text-gray-400">Multiple AI agents work together—Vision AI spots suspicious behavior, Audio AI detects coaching, 
                    Behavioral AI analyzes patterns, all orchestrated by a central Rule Engine that learns your organization's standards.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gold-400/10 rounded-xl">
                    <Building2 size={24} className="text-gold-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Enterprise-Native Design</h3>
                    <p className="text-gray-400">Built for universities, certification bodies, and enterprise training programs. 
                    Multi-tenant architecture, SSO integration, compliance reporting, and air-gapped deployment options.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-400/10 rounded-xl">
                    <Users size={24} className="text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Creator's Philosophy</h3>
                    <p className="text-gray-400">Ayan means "The Creator" in Sanskrit. We believe in creating tools that amplify human judgment, 
                    not replace it. Every AI decision can be reviewed, every policy can be configured, every outcome can be audited.</p>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div variants={fadeUp}>
              <GlassCard className="relative">
                <div className="text-center p-8">
                  <div className="text-6xl text-cyan-400 font-bold mb-4">∞</div>
                  <h3 className="text-2xl font-bold text-white mb-4">Infinite Adaptability</h3>
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-gray-300">Assessment Types</span>
                      <span className="text-white font-medium">Any Application</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-gray-300">Integration Time</span>
                      <span className="text-white font-medium">&lt; 5 Minutes</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-gray-300">Deployment Options</span>
                      <span className="text-white font-medium">Cloud + On-Premise</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-gray-300">Policy Configuration</span>
                      <span className="text-white font-medium">Per Exam/Tenant</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-300">Human Oversight</span>
                      <span className="text-white font-medium">Always in Control</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── MATURITY MODEL ─── */}
      <section id="maturity" className="relative py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}><SectionLabel>PARADIGM SHIFT</SectionLabel></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white">
              How Mature is Your{' '}
              <span className="text-gradient">Proctoring?</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {[
              {
                level: '01', label: 'Reactive', sub: 'Manual Review',
                desc: 'You record sessions. You review footage days later. Violations are caught post-exam — if at all.',
                icon: Eye, muted: true,
              },
              {
                level: '02', label: 'Automated', sub: 'Rule-Based Detection',
                desc: 'Alerts fire on tab switches and face loss. But 80% are false positives. Your team drowns in noise.',
                icon: AlertTriangle, muted: true,
              },
              {
                level: '03', label: 'Agentic', sub: 'Ayan.ai',
                desc: 'An AI agent verifies identity, monitors multi-modal signals, scores credibility in real-time, and intervenes — all before the exam ends.',
                icon: Brain, muted: false,
              },
            ].map((m) => (
              <motion.div key={m.level} variants={fadeUp}>
                <GlassCard className={`h-full ${!m.muted ? 'border-cyan-400/20 glow-cyan' : ''}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-xs font-mono ${m.muted ? 'text-gray-600' : 'text-cyan-400'}`}>LEVEL {m.level}</span>
                    {!m.muted && <span className="px-2 py-0.5 bg-cyan-400/10 text-cyan-400 rounded text-[10px] font-medium">CURRENT</span>}
                  </div>
                  <div className={`inline-flex p-3 rounded-xl mb-4 ${m.muted ? 'bg-gray-800/50' : 'bg-cyan-400/10'}`}>
                    <m.icon size={24} className={m.muted ? 'text-gray-600' : 'text-cyan-400'} />
                  </div>
                  <h3 className={`text-xl font-bold mb-1 ${m.muted ? 'text-gray-500' : 'text-white'}`}>{m.label}</h3>
                  <p className="text-sm text-gray-500 mb-3">{m.sub}</p>
                  <p className={`text-sm leading-relaxed ${m.muted ? 'text-gray-600' : 'text-gray-400'}`}>{m.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CAPABILITIES ─── */}
      <section id="capabilities" className="relative py-24 md:py-32 bg-navy-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}><SectionLabel>CAPABILITIES</SectionLabel></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white">
              An Intelligence Layer{' '}
              <span className="text-gradient">Built for Integrity.</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="space-y-6">
            {/* THINK */}
            <motion.div variants={fadeUp}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-cyan-400 font-mono text-xs">◆ THINK — PERCEIVE EVERY SIGNAL</span>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <GlassCard>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-cyan-400/10 rounded-lg"><Eye size={20} className="text-cyan-400" /></div>
                    <div>
                      <h4 className="text-white font-semibold">Vision AI</h4>
                      <p className="text-xs text-gray-500">MediaPipe + YOLOv8</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">Real-time face detection, gaze tracking, head pose estimation. Detects multiple persons, phones, earbuds, and suspicious objects — all running client-side and server-side simultaneously.</p>
                </GlassCard>
                <GlassCard>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-cyan-400/10 rounded-lg"><Mic size={20} className="text-cyan-400" /></div>
                    <div>
                      <h4 className="text-white font-semibold">Audio AI</h4>
                      <p className="text-xs text-gray-500">Whisper.cpp + pyannote</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">Speaker diarization identifies multiple voices. Speech-to-text detects conversations. Background noise analysis and microphone mute detection — all processed in 5-second windows.</p>
                </GlassCard>
              </div>
            </motion.div>

            {/* ACT */}
            <motion.div variants={fadeUp}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-gold-400 font-mono text-xs">◆ ACT — ENFORCE IN REAL-TIME</span>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <GlassCard>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gold-400/10 rounded-lg"><Target size={20} className="text-gold-400" /></div>
                    <div>
                      <h4 className="text-white font-semibold">Rule Engine</h4>
                      <p className="text-xs text-gray-500">Configurable per exam</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">20+ violation codes (b1–a3) with configurable weights, thresholds, and frequency rules. Visual rule editor with drag-and-drop conditions. Templates for strict, moderate, and lenient modes.</p>
                </GlassCard>
                <GlassCard>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gold-400/10 rounded-lg"><BarChart3 size={20} className="text-gold-400" /></div>
                    <div>
                      <h4 className="text-white font-semibold">Credibility Scoring</h4>
                      <p className="text-xs text-gray-500">Live, weighted, auditable</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">Base score of 100 with real-time penalty calculation. Category breakdown: Browser, Camera, Mic, Screen, AI. Risk classification from Low to Critical — updating live as the exam progresses.</p>
                </GlassCard>
              </div>
            </motion.div>

            {/* COMMAND */}
            <motion.div variants={fadeUp}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-cyan-400 font-mono text-xs">◆ COMMAND — THE UNIFIED REALITY</span>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <GlassCard>
                  <div className="p-2 bg-cyan-400/10 rounded-lg inline-flex mb-3"><Monitor size={20} className="text-cyan-400" /></div>
                  <h4 className="text-white font-semibold mb-2">Live Monitor Wall</h4>
                  <p className="text-sm text-gray-400">4/9/16-tile grid of live webcam feeds. Tiles pulse red on violations. Click to deep-dive into any session.</p>
                </GlassCard>
                <GlassCard>
                  <div className="p-2 bg-cyan-400/10 rounded-lg inline-flex mb-3"><Activity size={20} className="text-cyan-400" /></div>
                  <h4 className="text-white font-semibold mb-2">Violation Timeline</h4>
                  <p className="text-sm text-gray-400">Dual-view playback with colour-coded markers. Jump to any violation. AI bounding box overlays on recorded video.</p>
                </GlassCard>
                <GlassCard>
                  <div className="p-2 bg-cyan-400/10 rounded-lg inline-flex mb-3"><Users size={20} className="text-cyan-400" /></div>
                  <h4 className="text-white font-semibold mb-2">Audit Workflow</h4>
                  <p className="text-sm text-gray-400">Review queue sorted by risk. Per-violation confirm/dismiss. PDF reports with Tech Machers branding. CSV export for bulk analysis.</p>
                </GlassCard>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="relative py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}><SectionLabel>HOW IT WORKS</SectionLabel></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white">
              Zero Integration.{' '}
              <span className="text-gradient">Full Protection.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-gray-400 max-w-2xl mx-auto">
              Ayan.ai wraps any assessment application. The candidate goes through a proctor-hosted verification flow, then takes the exam inside a monitored shell. The exam app is never modified.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', icon: Scan, title: 'Verify', desc: 'Browser, camera, mic, screen share, face capture, ID proof, 360° environment scan — all on a proctor-hosted page branded for your organisation.' },
              { step: '02', icon: Shield, title: 'Monitor', desc: 'LiveKit streams webcam + screen. MediaPipe and YOLOv8 analyse every frame. Audio AI listens for anomalies. Browser events track tab switches and focus.' },
              { step: '03', icon: BarChart3, title: 'Score', desc: 'Rule engine evaluates 20+ violation codes. Credibility score updates in real-time with weighted penalties, frequency multipliers, and time decay.' },
              { step: '04', icon: CheckCircle2, title: 'Audit', desc: 'Dual-view playback with violation-indexed timeline. AI annotations on video. Examiner review queue. PDF reports and CSV export.' },
            ].map((s) => (
              <motion.div key={s.step} variants={fadeUp}>
                <GlassCard className="h-full relative">
                  <span className="text-[80px] font-black text-white/[0.03] absolute -top-4 -left-1 leading-none">{s.step}</span>
                  <div className="relative">
                    <div className="p-2 bg-cyan-400/10 rounded-lg inline-flex mb-4"><s.icon size={22} className="text-cyan-400" /></div>
                    <h4 className="text-white font-bold text-lg mb-2">{s.title}</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── INTEGRATION ─── */}
      <section id="integration" className="relative py-24 md:py-32 bg-navy-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}><SectionLabel>INTEGRATION</SectionLabel></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white">
              Plug Into{' '}
              <span className="text-gradient">Any Platform.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-gray-400 max-w-2xl mx-auto">
              From legacy PHP apps to modern Next.js platforms — three integration tiers to match your stack.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {[
              {
                tier: 'Tier 3', label: 'iframe Embed', effort: '5 minutes', icon: Globe,
                desc: 'Just provide your exam app URL. Ayan.ai wraps it in a monitored shell. Zero code changes to your application.',
                code: 'exam_app_url: "https://your-app.com/exam/123"',
                highlight: true,
              },
              {
                tier: 'Tier 1', label: 'Script Tag', effort: '30 minutes', icon: Plug,
                desc: 'Drop a single <script> tag on your exam page. Works with PHP, WordPress, Django, Rails — any server-rendered app.',
                code: '<script src="https://ayan.nunmai.local/agent.js"\n  data-session="{token}" async />',
                highlight: false,
              },
              {
                tier: 'Tier 2', label: 'NPM SDK', effort: '1-2 hours', icon: Code2,
                desc: 'React hooks, Vue composables, vanilla JS class. Deep integration with state management and custom UI.',
                code: 'import { useProctor } from\n  "@techmachers/proctor-sdk/react"',
                highlight: false,
              },
            ].map((t) => (
              <motion.div key={t.tier} variants={fadeUp}>
                <GlassCard className={`h-full ${t.highlight ? 'border-cyan-400/20 glow-cyan' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-cyan-400">{t.tier}</span>
                    <span className="px-2 py-0.5 bg-gold-400/10 text-gold-400 rounded text-[10px] font-medium">{t.effort}</span>
                  </div>
                  <div className="p-2 bg-cyan-400/10 rounded-lg inline-flex mb-3"><t.icon size={20} className="text-cyan-400" /></div>
                  <h4 className="text-white font-bold text-lg mb-2">{t.label}</h4>
                  <p className="text-sm text-gray-400 mb-4 leading-relaxed">{t.desc}</p>
                  <div className="bg-navy-950/80 rounded-lg p-3 font-mono text-xs text-cyan-300/80 whitespace-pre-wrap">
                    {t.code}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── TRUST & SAFETY ─── */}
      <section id="safety" className="relative py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}><SectionLabel>TRUST ARCHITECTURE</SectionLabel></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white">
              AI on a{' '}
              <span className="text-gradient">Leash.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-gray-400 max-w-2xl mx-auto">
              Designed for high-stakes assessment environments. Every decision is auditable, every action is reversible, every datum is private.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Lock, title: 'Self-Hosted', desc: 'Keycloak SSO, on-premise PostgreSQL, private MinIO storage. Your data never leaves your infrastructure. No cloud vendor lock-in.' },
              { icon: Shield, title: 'Configurable Rules', desc: 'Every violation code weight, threshold, and frequency is configurable per exam. Strict, moderate, or lenient — you decide the policy.' },
              { icon: Zap, title: 'Human Override', desc: 'Examiners approve or dismiss every AI-flagged violation. Audit review queue with per-violation notes. PDF reports for legal compliance.' },
            ].map((t) => (
              <motion.div key={t.title} variants={fadeUp}>
                <GlassCard className="h-full">
                  <div className="p-2 bg-cyan-400/10 rounded-lg inline-flex mb-4"><t.icon size={22} className="text-cyan-400" /></div>
                  <h4 className="text-white font-bold text-lg mb-2">{t.title}</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">{t.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── VIOLATION CODES ─── */}
      <section className="relative py-24 md:py-32 bg-navy-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp}><SectionLabel>DETECTION MATRIX</SectionLabel></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white">
              20+ Violation Codes.{' '}
              <span className="text-gradient">Every Signal Covered.</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                { code: 'b1', label: 'Browser unsupported', cat: 'Browser' },
                { code: 'b2', label: 'Tab/window switch', cat: 'Browser' },
                { code: 'b3', label: 'Fullscreen exit', cat: 'Browser' },
                { code: 'c1', label: 'Webcam disabled', cat: 'Camera' },
                { code: 'c2', label: 'Face not visible', cat: 'Camera' },
                { code: 'c3', label: 'Multiple faces', cat: 'Camera' },
                { code: 'c4', label: 'Face mismatch', cat: 'Camera' },
                { code: 'c5', label: 'Looking away', cat: 'Camera' },
                { code: 'k1', label: 'Atypical typing', cat: 'Keyboard' },
                { code: 'm1', label: 'Mic muted', cat: 'Mic' },
                { code: 'm2', label: 'Background noise', cat: 'Mic' },
                { code: 'm3', label: 'Mobile detected', cat: 'Object' },
                { code: 'h1', label: 'Earbuds/headphones', cat: 'Object' },
                { code: 'n1', label: 'Network lost', cat: 'Network' },
                { code: 's1', label: 'Screen not shared', cat: 'Screen' },
                { code: 's2', label: 'Suspicious content', cat: 'Screen' },
                { code: 'a1', label: 'Multiple speakers', cat: 'AI' },
                { code: 'a2', label: 'Suspicious object', cat: 'AI' },
                { code: 'a3', label: 'Behaviour anomaly', cat: 'AI' },
                { code: 'c4', label: 'ID mismatch', cat: 'Verify' },
              ].map((v, i) => (
                <motion.div key={`${v.code}-${i}`} variants={fadeUp}>
                  <div className="bg-navy-900/60 border border-white/[0.06] rounded-lg p-3 hover:border-cyan-400/20 transition group">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-cyan-400 font-bold">{v.code}</span>
                      <span className="text-[9px] text-gray-600 uppercase">{v.cat}</span>
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-gray-300 transition">{v.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp}><SectionLabel>GET STARTED</SectionLabel></motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold text-white mb-6">
              Let the Agent{' '}
              <span className="text-gradient">Prove Itself.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
              Deploy Ayan.ai alongside your existing proctoring. Run it in shadow mode — zero risk to your current workflow. See the violations it catches that your current system misses.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap gap-4 justify-center">
              <a
                href="/admin"
                className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-400 text-navy-950 font-bold rounded-lg hover:bg-cyan-300 transition"
              >
                Launch Admin Console <ChevronRight size={18} />
              </a>
              <a
                href="https://docs.ayan.nunmai.local"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/10 text-white rounded-lg hover:bg-white/5 transition"
              >
                Read the Docs <ExternalLink size={16} />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.06] bg-navy-950/80">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ayan-icon.png" alt="Ayan.ai" className="w-[120px] h-[64px] object-contain" />
              <span className="text-xs text-gray-600 border-l border-gray-700 pl-4">Agentic AI Proctoring</span>
            </div>
            <div className="flex items-center gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://machers.tech/images/logo1.png"
                alt="Tech Machers"
                className="h-7 object-contain opacity-60 hover:opacity-100 transition"
              />
              <span className="text-xs text-gray-600">A product by Tech Machers</span>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <span>© 2026 Tech Machers Pte Ltd. All rights reserved.</span>
            <div className="flex gap-6">
              <a href="#" className="hover:text-gray-400 transition">Privacy</a>
              <a href="#" className="hover:text-gray-400 transition">Terms</a>
              <a href="#" className="hover:text-gray-400 transition">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
