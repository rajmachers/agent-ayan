'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Eye, Brain, Mic, Monitor, BarChart3,
  CheckCircle2, AlertTriangle, Lock,
  ChevronRight, Zap, Target, Users,
  Building2, GraduationCap, Landmark, Award,
  Cog, ArrowRight, Play, Pause, XCircle,
  Code, Fingerprint, Layers, RefreshCw,
} from 'lucide-react';
import {
  Fold, AnimateGroup, FadeUp, ScaleIn, SlideLeft, SlideRight, Pop,
  SlideIn, ZoomReveal, MaskReveal, BlindZoom, AutoRotateTabs,
  SequentialReveal, BacklitBorder, AnimatedIcon,
} from './components/ScrollEffects';

/* --- constants --- */
const INDUSTRIES = [
  { slug: 'enterprise', icon: Building2, label: 'Enterprise', color: 'cyan',
    headline: 'High-Stakes Enterprise Hiring',
    desc: 'Protect multi-million dollar recruitment pipelines with autonomous integrity verification across global candidate pools.',
    usecases: ['Technical assessments', 'Leadership evaluations', 'Compliance certifications', 'Remote hiring at scale'],
  },
  { slug: 'government', icon: Landmark, label: 'Government & PSU', color: 'blue',
    headline: 'Government Recruitment Integrity',
    desc: 'Transparent, auditable examination systems for public sector recruitment \u2014 bias-free, tamper-proof, and legally defensible.',
    usecases: ['Civil service exams', 'Defense recruitment', 'PSU entrance tests', 'Regulatory certifications'],
  },
  { slug: 'academics', icon: GraduationCap, label: 'Academia', color: 'purple',
    headline: 'Preserving Merit in Digital Assessments',
    desc: 'Fair examinations that protect academic integrity while respecting student dignity \u2014 no surveillance theatre.',
    usecases: ['University entrance exams', 'Semester assessments', 'PhD qualifying exams', 'International certifications'],
  },
  { slug: 'training', icon: Award, label: 'Training & Certification', color: 'gold',
    headline: 'Certification You Can Trust',
    desc: 'Ensure every certificate issued represents genuine competence \u2014 verified by autonomous intelligence, not checkbox rules.',
    usecases: ['Professional certifications', 'Compliance training', 'Skill assessments', 'Continuing education'],
  },
];

const AGENTIC_PILLARS = [
  { icon: Brain, title: 'Autonomous Decisions', desc: 'Pause, terminate, lock \u2014 without human delay.' },
  { icon: Eye, title: 'Perception \u2192 Reasoning', desc: 'Behavioral understanding, not event detection.' },
  { icon: RefreshCw, title: 'Continuous Learning', desc: 'Every admin decision improves accuracy.' },
  { icon: Users, title: 'Cohort-Aware Context', desc: 'Adaptive thresholds per exam population.' },
  { icon: Layers, title: 'Multi-Signal Fusion', desc: 'Vision + audio + browser + screen + behavior.' },
];

const CAPABILITIES = [
  { icon: Eye, label: 'Vision AI', sub: 'Face, gaze, person count', category: 'PERCEIVE' },
  { icon: Mic, label: 'Audio AI', sub: 'Voice, noise, speech', category: 'PERCEIVE' },
  { icon: Monitor, label: 'Screen AI', sub: 'Tab, copy, app switch', category: 'PERCEIVE' },
  { icon: Brain, label: 'Reasoning', sub: 'LLM narratives, intent', category: 'REASON' },
  { icon: BarChart3, label: 'Scoring', sub: 'Cohort baselines, z-score', category: 'REASON' },
  { icon: Fingerprint, label: 'Profiling', sub: 'Cross-session history', category: 'REASON' },
  { icon: Pause, label: 'Auto-Pause', sub: 'Suspend on low credibility', category: 'ACT' },
  { icon: Lock, label: 'Auto-Lock', sub: 'Lock on face violations', category: 'ACT' },
  { icon: XCircle, label: 'Auto-Terminate', sub: 'End critical violations', category: 'ACT' },
  { icon: RefreshCw, label: 'Feedback Loop', sub: 'Admin corrections adapt weights', category: 'LEARN' },
  { icon: Target, label: 'Accuracy Metrics', sub: 'FP/FN tracking, trends', category: 'LEARN' },
  { icon: AlertTriangle, label: 'Proctor Alerts', sub: 'Real-time notifications', category: 'ACT' },
];

const MARKET_GAP = [
  { system: 'Rule-Based AI', problem: 'Rigid thresholds, high false positives', icon: Cog },
  { system: 'Human Proctoring', problem: "Expensive, doesn't scale, fatigue-prone", icon: Users },
  { system: 'Video Recording', problem: 'Post-facto only, no real-time enforcement', icon: Play },
  { system: 'Alert Dashboards', problem: 'Reactive, requires constant human attention', icon: AlertTriangle },
];

const STORY_SLIDES = [
  {
    id: 'origin',
    label: 'The Origin',
    accent: 'cyan',
    heading: (
      <>In ancient philosophy, <span className="text-gradient">Ayan</span> represents<br />the origin of order.</>
    ),
    body: 'The force that creates structure from chaos.',
  },
  {
    id: 'mission',
    label: 'The Mission',
    accent: 'gold',
    heading: (
      <>In modern systems,<br /><span className="text-gradient">integrity</span> is that force.</>
    ),
    body: 'Fairness, discipline, and trust — without bias, without fatigue, without compromise.',
  },
  {
    id: 'third-eye',
    label: 'The Third Eye',
    accent: 'gold',
    heading: (
      <><span className="text-gradient">Ayan</span> is the Third Eye<br />of Assessments.</>
    ),
    bullets: [
      'Sees what humans miss',
      'Understands what rules cannot',
      'Acts when delay is risk',
    ],
  },
];

/* ===== MAIN PAGE - Snap-scroll slide deck ===== */
export default function Home() {
  const [activeNav, setActiveNav] = useState('hero');
  const [slideIndex, setSlideIndex] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const currentSlide = STORY_SLIDES[slideIndex];
  const hasBullets = Boolean(currentSlide.bullets);
  const moveSlide = (direction: number) => {
    setSlideIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return STORY_SLIDES.length - 1;
      if (next >= STORY_SLIDES.length) return 0;
      return next;
    });
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % STORY_SLIDES.length);
    }, 6500);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;

    const sectionIds = ['hero', 'origin', 'problem', 'agentic', 'capabilities', 'enterprise', 'academics', 'government', 'training', 'architecture', 'integration', 'vision', 'contact'];
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            setActiveNav(entry.target.id);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => { obs.disconnect(); };
  }, []);

  return (
    <div>
      {/* Fixed backgrounds */}
      <div className="fixed inset-0 bg-grid-pattern opacity-100 pointer-events-none z-0" />
      <div className="fixed inset-0 bg-gradient-radial from-cyan-400/[0.03] via-transparent to-transparent pointer-events-none z-0" />

      {/* Fixed nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-navy-950/95 backdrop-blur-xl border-b border-gold-400/20 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-20 px-6">
          <motion.div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ayan-logo.png" alt="Ayan.ai" className="h-20 object-contain" />
          </motion.div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { id: 'problem', label: 'Problem' },
              { id: 'agentic', label: 'Agentic' },
              { id: 'capabilities', label: 'Capabilities' },
              { id: 'enterprise', label: 'Enterprise' },
              { id: 'academics', label: 'Academics' },
              { id: 'government', label: 'Government/PSU' },
              { id: 'training', label: 'Learning & Dev' },
              { id: 'contact', label: 'Contact' }
            ].map((s) => (
              <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })} className="group flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full transition-all duration-300 ${activeNav === s.id ? 'bg-gold-400 scale-125 shadow-lg shadow-gold-400/50' : 'bg-white/20 group-hover:bg-white/40'}`} />
                <span className={`text-sm font-medium transition-all duration-300 ${activeNav === s.id ? 'text-gold-400 opacity-100' : 'text-gray-400 opacity-70 group-hover:opacity-100'}`}>{s.label}</span>
              </button>
            ))}
          </div>
          <a href="/admin" className="hidden md:inline-flex items-center gap-2 px-6 py-3 bg-gold-400 text-navy-950 rounded-xl text-base font-semibold hover:bg-gold-300 transition-all duration-300 hover:scale-105 shadow-lg shadow-gold-400/25">
            Launch Console <ChevronRight size={16} />
          </a>
        </div>
      </nav>

      {/* SNAP-SCROLL CONTAINER */}
      <main ref={mainRef} className="h-screen overflow-y-auto snap-y snap-mandatory scroll-smooth">

        {/* FOLD 1: HERO */}
        <Fold id="hero" className="pt-20">
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center min-h-[85vh] flex items-center justify-center">
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full -z-10"
              style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, rgba(34,211,238,0.02) 40%, transparent 70%)' }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <AnimateGroup className="flex flex-col items-center" stagger={0.12}>
              <FadeUp>
                <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-8">
                  <span className="w-12 h-px bg-cyan-400/40" />
                  Autonomous Agentic Proctoring Platform
                  <span className="w-12 h-px bg-cyan-400/40" />
                </span>
              </FadeUp>
              <FadeUp>
                <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-extrabold text-white leading-[1.02] mb-8 tracking-tight">
                  <span className="text-gradient">Ayan</span> doesn&apos;t
                  <br />watch candidates.
                  <br /><span className="text-gradient">It understands intent.</span>
                </h1>
              </FadeUp>
              <FadeUp>
                <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed">
                  The Autonomous Integrity Engine for High-Stakes Assessments.
                  <br className="hidden md:block" />
                  <span className="text-white font-medium">We don&apos;t detect violations. We reason about behavior.</span>
                </p>
              </FadeUp>
              <FadeUp>
                <div className="flex flex-col sm:flex-row gap-6 justify-center">
                  <button onClick={() => document.getElementById('agentic')?.scrollIntoView({ behavior: 'smooth' })} className="group inline-flex items-center gap-4 px-10 py-5 bg-cyan-400 text-navy-950 rounded-xl text-lg font-semibold hover:bg-cyan-300 transition-all duration-300 hover:scale-105 shadow-xl shadow-cyan-400/25">
                    See the Intelligence <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button onClick={() => document.getElementById('enterprise')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-4 px-10 py-5 border-2 border-white/20 text-white rounded-xl text-lg font-medium hover:border-white/40 hover:bg-white/5 transition-all duration-300 shadow-lg">
                    Industry Solutions
                  </button>
                </div>
              </FadeUp>
            </AnimateGroup>
            <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2" animate={{ y: [0, 12, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <div className="w-8 h-12 border-2 border-white/20 rounded-full flex justify-center pt-3">
                <motion.div className="w-2 h-2 bg-cyan-400 rounded-full" />
              </div>
            </motion.div>
          </div>
        </Fold>

        {/* FOLD 2: STORY SLIDES */}
        <Fold id="origin">
          <BlindZoom>
            <div className="max-w-6xl mx-auto px-6 w-full min-h-[90vh] flex flex-col justify-center">
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.08] bg-navy-900/85 p-10 md:p-16 shadow-2xl shadow-cyan-500/15">
                <div className="absolute inset-x-0 top-6 flex justify-center gap-3">
                  {STORY_SLIDES.map((slide, idx) => (
                    <span
                      key={slide.id}
                      className={`h-3 w-10 rounded-full transition-all duration-300 ${slideIndex === idx ? 'bg-gold-400 shadow-lg shadow-gold-400/25' : 'bg-white/15'}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                    className="relative text-center py-12 md:py-16"
                  >
                    <p className={`text-sm font-mono uppercase tracking-[0.35em] mb-6 ${currentSlide.accent === 'gold' ? 'text-gold-400/70' : 'text-cyan-400/70'}`}>
                      {currentSlide.label}
                    </p>
                    <div className="space-y-8">
                      <h2 className="text-5xl md:text-7xl font-bold text-white leading-tight">
                        {currentSlide.heading}
                      </h2>
                      <p className="text-2xl md:text-3xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                        {currentSlide.body}
                      </p>
                      {hasBullets && (
                        <div className="mt-8 grid gap-4 text-left text-gray-300 text-lg md:grid-cols-3">
                          {currentSlide.bullets?.map((bullet) => (
                            <div key={bullet} className="rounded-[2rem] bg-white/5 border border-white/[0.06] p-5 shadow-xl shadow-cyan-500/5">
                              <span className="block text-white font-semibold">{bullet}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </BlindZoom>
        </Fold>

        {/* FOLD 5: THE PROBLEM */}
        <Fold id="problem">
          <div className="max-w-6xl mx-auto px-6 w-full min-h-[80vh] flex items-center justify-center">
            <AnimateGroup className="text-center mb-10" stagger={0.1}>
              <FadeUp>
                <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-red-400/80 mb-6">
                  <span className="w-12 h-px bg-red-400/40" /> The Problem <span className="w-12 h-px bg-red-400/40" />
                </span>
              </FadeUp>
              <FadeUp><h2 className="text-5xl md:text-7xl font-bold text-white mb-4">Detection is not enough.</h2></FadeUp>
              <FadeUp><p className="text-2xl text-gray-300">Integrity requires intelligence.</p></FadeUp>
            </AnimateGroup>
            <AnimateGroup className="grid grid-cols-1 md:grid-cols-2 gap-4" stagger={0.08}>
              {MARKET_GAP.map((item) => (
                <Pop key={item.system}>
                  <div className="bg-navy-900/60 backdrop-blur-sm border border-red-400/10 rounded-2xl p-6 hover:border-red-400/20 transition-all duration-500 group">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-red-400/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <item.icon className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1">{item.system}</h3>
                        <p className="text-sm text-gray-400">{item.problem}</p>
                      </div>
                    </div>
                  </div>
                </Pop>
              ))}
            </AnimateGroup>
            <MaskReveal text="Cheating evolves faster than detection. Human proctors don't scale. AI tools alert but don't act. False positives damage fairness." className="text-lg text-gray-300/80 max-w-2xl mx-auto text-center mt-8 leading-relaxed font-light" />
          </div>
        </Fold>

        {/* FOLD 6: AGENTIC INTELLIGENCE */}
        <Fold id="agentic">
          <div className="max-w-6xl mx-auto px-6 w-full relative min-h-[85vh] flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/[0.02] to-transparent pointer-events-none" />
            <div className="w-full">
              <AnimateGroup className="text-center mb-12 relative z-10" stagger={0.1}>
                <FadeUp>
                  <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-6">
                    <span className="w-12 h-px bg-cyan-400/40" /> The Breakthrough <span className="w-12 h-px bg-cyan-400/40" />
                  </span>
                </FadeUp>
                <FadeUp>
                  <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
                    Not AI Proctoring.<br /><span className="text-gradient">Autonomous Agentic Intelligence.</span>
                  </h2>
                </FadeUp>
                <FadeUp><p className="text-xl text-gray-300 max-w-3xl mx-auto">We don&apos;t monitor exams. We govern them.</p></FadeUp>
              </AnimateGroup>
              <AnimateGroup className="grid grid-cols-2 md:grid-cols-5 gap-6 relative z-10" stagger={0.07}>
                {AGENTIC_PILLARS.map((pillar) => (
                  <Pop key={pillar.title}>
                    <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.06] rounded-xl p-6 hover:border-cyan-400/20 transition-all duration-500 group text-center h-full">
                      <div className="w-16 h-16 rounded-xl bg-cyan-400/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-cyan-400/20 transition-all duration-300">
                        <pillar.icon className="w-8 h-8 text-cyan-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{pillar.title}</h3>
                      <p className="text-sm text-gray-300 leading-relaxed">{pillar.desc}</p>
                    </div>
                  </Pop>
                ))}
              </AnimateGroup>
            </div>
          </div>
        </Fold>

        {/* FOLD 7: MATURITY MODEL */}
        <Fold>
          <div className="max-w-5xl mx-auto px-6 w-full">
            <AnimateGroup className="text-center mb-10">
              <FadeUp><h2 className="text-3xl md:text-4xl font-bold text-white">The Evolution of Proctoring</h2></FadeUp>
            </AnimateGroup>
            <SequentialReveal
              tiers={[
                { tier: 'Tier 1', label: 'Reactive', sub: 'Manual Review', desc: 'Flag events. Human reviews recordings post-exam.', color: 'gray' },
                { tier: 'Tier 2', label: 'Automated', sub: 'Rule-Based', desc: 'Static rules trigger alerts. No contextual reasoning.', color: 'gray' },
                { tier: 'Tier 3', label: 'Agentic', sub: 'Ayan.ai', desc: 'Perceive → Reason → Decide → Act → Learn. Closed-loop.', color: 'gold' },
              ]}
              delays={[0, 3000, 6000]}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 relative"
              renderTier={(tier, index, isActive) => {
                const isGoldTier = tier.color === 'gold';
                const glowClass = isActive && isGoldTier ? 'bg-gold-400/10 border-2 border-gold-400/30 shadow-[0_0_40px_rgba(245,158,11,0.24)]' : isActive ? 'bg-navy-900/80 border-2 border-cyan-400/30 glow-cyan' : 'bg-navy-900/40 border border-white/[0.06]';
                return (
                  <motion.div
                    key={tier.tier}
                    animate={isActive && isGoldTier ? { boxShadow: ['0px 0px 0px rgba(245,158,11,0.18)', '0px 0px 28px rgba(245,158,11,0.25)', '0px 0px 0px rgba(245,158,11,0.18)'] } : { boxShadow: '0px 0px 0px rgba(0,0,0,0)' }}
                    transition={{ duration: 1.5, repeat: 0, ease: 'easeInOut' }}
                    className={`relative z-10 p-8 rounded-2xl text-center transition-all duration-500 ${glowClass} ${isActive ? 'scale-105' : ''}`}
                  >
                    <div className={`w-4 h-4 rounded-full mx-auto mb-4 ${isActive ? (isGoldTier ? 'bg-gold-400 shadow-lg shadow-gold-400/50' : 'bg-cyan-400 shadow-lg shadow-cyan-400/50') : 'bg-gray-600'}`} />
                    <div className={`text-xs font-mono uppercase tracking-wider mb-2 ${isActive ? (isGoldTier ? 'text-gold-400' : 'text-cyan-400') : 'text-gray-500'}`}>{tier.tier}</div>
                    <h4 className={`text-xl font-bold mb-1 ${isActive ? 'text-white' : 'text-gray-400'}`}>{tier.label}</h4>
                    <div className={`text-sm mb-3 ${isActive ? (isGoldTier ? 'text-gold-300/90' : 'text-cyan-400/80') : 'text-gray-500'}`}>{tier.sub}</div>
                    <p className={`text-sm ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>{tier.desc}</p>
                  </motion.div>
                );
              }}
            />



          </div>
        </Fold>

        {/* FOLD 10: CAPABILITIES */}
        <Fold id="capabilities">
          <BlindZoom>
            <div className="max-w-6xl mx-auto px-6 w-full min-h-[85vh] flex items-center justify-center">
              <div className="w-full">
                <AnimateGroup className="text-center mb-12">
                  <FadeUp>
                    <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-4">
                      <span className="w-12 h-px bg-cyan-400/40" /> Live Intelligence <span className="w-12 h-px bg-cyan-400/40" />
                    </span>
                  </FadeUp>
                  <FadeUp><h2 className="text-4xl md:text-6xl font-bold text-white">The Autonomous Loop</h2></FadeUp>
                </AnimateGroup>
                <div className="space-y-6">
                  {(['PERCEIVE', 'REASON', 'ACT', 'LEARN'] as const).map((phase, pi) => {
                    const phaseItems = CAPABILITIES.filter(c => c.category === phase);
                    const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
                      PERCEIVE: { bg: 'bg-blue-400/10', text: 'text-blue-400', border: 'border-blue-400/20', glow: 'border-glow-blue' },
                      REASON: { bg: 'bg-purple-400/10', text: 'text-purple-400', border: 'border-purple-400/20', glow: 'border-glow-purple' },
                      ACT: { bg: 'bg-red-400/10', text: 'text-red-400', border: 'border-red-400/20', glow: 'border-glow-red' },
                      LEARN: { bg: 'bg-green-400/10', text: 'text-green-400', border: 'border-green-400/20', glow: 'border-glow-green' },
                    };
                    const c = colorMap[phase];
                    return (
                      <SlideIn key={phase} direction="left" delay={pi * 0.08}>
                        <div className="flex items-center gap-4">
                          <span className={`px-4 py-2 rounded-full text-sm font-mono uppercase tracking-wider ${c.bg} ${c.text} ${c.border} border flex-shrink-0 w-28 text-center`}>{phase}</span>
                          <div className="flex gap-3 flex-grow">
                            {phaseItems.map((cap) => (
                              <BacklitBorder key={cap.label} color={cap.category === 'PERCEIVE' ? 'cyan' : cap.category === 'REASON' ? 'gold' : cap.category === 'ACT' ? 'red' : 'green'} className="flex-1">
                                <div className="bg-navy-900/60 border border-white/[0.04] rounded-lg p-4 hover:border-white/10 transition-colors group h-full">
                                  <div className="flex items-center gap-3 mb-2">
                                    <AnimatedIcon icon={cap.icon} className={`w-5 h-5 ${c.text} group-hover:scale-110 transition-transform flex-shrink-0`} />
                                    <span className="text-white text-sm font-semibold">{cap.label}</span>
                                  </div>
                                  <p className="text-xs text-gray-400">{cap.sub}</p>
                                </div>
                              </BacklitBorder>
                            ))}
                          </div>
                        </div>
                      </SlideIn>
                    );
                  })}
                </div>
              </div>
            </div>
          </BlindZoom>
        </Fold>

        {/* FOLD 6: ENTERPRISE */}
        <Fold id="enterprise">
          <BlindZoom>
            <div className="max-w-6xl mx-auto px-6 w-full">
              <AnimateGroup className="text-center mb-12">
                <FadeUp>
                  <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-4">
                    <span className="w-12 h-px bg-cyan-400/40" /> Enterprise Solutions <span className="w-12 h-px bg-cyan-400/40" />
                  </span>
                </FadeUp>
                <FadeUp>
                  <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
                    High-Stakes Enterprise Hiring
                    <br /><span className="text-gradient">Without Compromise</span>
                  </h2>
                </FadeUp>
                <FadeUp>
                  <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                    Protect multi-million dollar recruitment pipelines with autonomous integrity verification across global candidate pools.
                  </p>
                </FadeUp>
              </AnimateGroup>

              <AnimateGroup className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12" stagger={0.15}>
                <BacklitBorder>
                  <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <AnimatedIcon icon={Building2} className="text-cyan-400" />
                      <h3 className="text-2xl font-bold text-white">Technical Assessments</h3>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      Code interviews, system design evaluations, and technical certifications where cheating costs millions in bad hires.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Real-time code analysis and behavior patterns</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Multi-screen detection and unauthorized tool monitoring</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Adaptive difficulty based on candidate performance</span>
                      </div>
                    </div>
                  </div>
                </BacklitBorder>

                <BacklitBorder>
                  <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <AnimatedIcon icon={Users} className="text-cyan-400" />
                      <h3 className="text-2xl font-bold text-white">Leadership Evaluations</h3>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      Executive assessments and management interviews where integrity directly impacts company culture and performance.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Behavioral analysis during video responses</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Context-aware questioning and follow-up</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Automated red flags for inconsistent responses</span>
                      </div>
                    </div>
                  </div>
                </BacklitBorder>
              </AnimateGroup>

              <AnimateGroup className="text-center">
                <FadeUp>
                  <div className="bg-gradient-to-r from-cyan-400/10 via-gold-400/10 to-cyan-400/10 rounded-2xl p-8 border border-cyan-400/20">
                    <h3 className="text-2xl font-bold text-white mb-4">Enterprise Impact</h3>
                    <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                      Reduce hiring costs by 40% through automated integrity verification, eliminate bad hires that cost companies millions,
                      and maintain brand reputation with transparent, defensible recruitment processes.
                    </p>
                  </div>
                </FadeUp>
              </AnimateGroup>
            </div>
          </BlindZoom>
        </Fold>

        {/* FOLD 7: ACADEMICS */}
        <Fold id="academics">
          <BlindZoom>
            <div className="max-w-6xl mx-auto px-6 w-full">
              <AnimateGroup className="text-center mb-12">
                <FadeUp>
                  <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-4">
                    <span className="w-12 h-px bg-cyan-400/40" /> Academic Integrity <span className="w-12 h-px bg-cyan-400/40" />
                  </span>
                </FadeUp>
                <FadeUp>
                  <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
                    Preserving Merit in
                    <br /><span className="text-gradient">Digital Assessments</span>
                  </h2>
                </FadeUp>
                <FadeUp>
                  <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                    Fair examinations that protect academic integrity while respecting student dignity — no surveillance theatre.
                  </p>
                </FadeUp>
              </AnimateGroup>

              <AnimateGroup className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12" stagger={0.15}>
                <BacklitBorder>
                  <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <AnimatedIcon icon={GraduationCap} className="text-cyan-400" />
                      <h3 className="text-2xl font-bold text-white">University Entrance Exams</h3>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      High-stakes entrance examinations where student futures depend on fair, tamper-proof assessment processes.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Continuous behavioral monitoring without invasive surveillance</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Pattern recognition for unusual answer sequences</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Real-time intervention for suspicious activities</span>
                      </div>
                    </div>
                  </div>
                </BacklitBorder>

                <BacklitBorder>
                  <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <AnimatedIcon icon={Award} className="text-cyan-400" />
                      <h3 className="text-2xl font-bold text-white">Semester Assessments</h3>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      Regular course evaluations and midterms where maintaining academic standards is crucial for educational quality.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Adaptive monitoring based on assessment difficulty</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Context-aware flagging for course-specific behaviors</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Automated grade verification and anomaly detection</span>
                      </div>
                    </div>
                  </div>
                </BacklitBorder>
              </AnimateGroup>

              <AnimateGroup className="text-center">
                <FadeUp>
                  <div className="bg-gradient-to-r from-cyan-400/10 via-gold-400/10 to-cyan-400/10 rounded-2xl p-8 border border-cyan-400/20">
                    <h3 className="text-2xl font-bold text-white mb-4">Academic Impact</h3>
                    <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                      Ensure every degree and certification represents genuine achievement, protect institutional reputation,
                      and maintain public trust in higher education systems worldwide.
                    </p>
                  </div>
                </FadeUp>
              </AnimateGroup>
            </div>
          </BlindZoom>
        </Fold>

        {/* FOLD 8: GOVERNMENT & PSU */}
        <Fold id="government">
          <BlindZoom>
            <div className="max-w-6xl mx-auto px-6 w-full">
              <AnimateGroup className="text-center mb-12">
                <FadeUp>
                  <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-4">
                    <span className="w-12 h-px bg-cyan-400/40" /> Government & PSU <span className="w-12 h-px bg-cyan-400/40" />
                  </span>
                </FadeUp>
                <FadeUp>
                  <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
                    Government Recruitment
                    <br /><span className="text-gradient">Integrity at Scale</span>
                  </h2>
                </FadeUp>
                <FadeUp>
                  <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                    Transparent, auditable examination systems for public sector recruitment — bias-free, tamper-proof, and legally defensible.
                  </p>
                </FadeUp>
              </AnimateGroup>

              <AnimateGroup className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12" stagger={0.15}>
                <BacklitBorder>
                  <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <AnimatedIcon icon={Landmark} className="text-cyan-400" />
                      <h3 className="text-2xl font-bold text-white">Civil Service Exams</h3>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      Large-scale competitive examinations for government positions requiring absolute integrity and transparency.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Nationwide monitoring with centralized audit trails</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Real-time anomaly detection across test centers</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Automated escalation for security incidents</span>
                      </div>
                    </div>
                  </div>
                </BacklitBorder>

                <BacklitBorder>
                  <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <AnimatedIcon icon={Shield} className="text-cyan-400" />
                      <h3 className="text-2xl font-bold text-white">Defense & Security</h3>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      Critical security clearance and defense recruitment where national security depends on trustworthy selection processes.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Enhanced behavioral analysis for security contexts</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Classified information handling verification</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Chain-of-custody for all assessment data</span>
                      </div>
                    </div>
                  </div>
                </BacklitBorder>
              </AnimateGroup>

              <AnimateGroup className="text-center">
                <FadeUp>
                  <div className="bg-gradient-to-r from-cyan-400/10 via-gold-400/10 to-cyan-400/10 rounded-2xl p-8 border border-cyan-400/20">
                    <h3 className="text-2xl font-bold text-white mb-4">Government Impact</h3>
                    <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                      Eliminate corruption in public recruitment, ensure merit-based selection for taxpayer-funded positions,
                      and maintain public confidence in government institutions through transparent, auditable processes.
                    </p>
                  </div>
                </FadeUp>
              </AnimateGroup>
            </div>
          </BlindZoom>
        </Fold>

        {/* FOLD 9: LEARNING & DEVELOPMENT */}
        <Fold id="training">
          <BlindZoom>
            <div className="max-w-6xl mx-auto px-6 w-full">
              <AnimateGroup className="text-center mb-12">
                <FadeUp>
                  <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-4">
                    <span className="w-12 h-px bg-cyan-400/40" /> Learning & Development <span className="w-12 h-px bg-cyan-400/40" />
                  </span>
                </FadeUp>
                <FadeUp>
                  <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
                    Certification You Can
                    <br /><span className="text-gradient">Truly Trust</span>
                  </h2>
                </FadeUp>
                <FadeUp>
                  <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                    Ensure every certificate issued represents genuine competence — verified by autonomous intelligence, not checkbox rules.
                  </p>
                </FadeUp>
              </AnimateGroup>

              <AnimateGroup className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12" stagger={0.15}>
                <BacklitBorder>
                  <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <AnimatedIcon icon={Award} className="text-cyan-400" />
                      <h3 className="text-2xl font-bold text-white">Professional Certifications</h3>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      Industry certifications and licenses where credential value depends on rigorous, cheat-proof assessment processes.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Skill demonstration verification during practical assessments</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Real-time competency validation</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Automated credential integrity monitoring</span>
                      </div>
                    </div>
                  </div>
                </BacklitBorder>

                <BacklitBorder>
                  <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 h-full">
                    <div className="flex items-center gap-4 mb-6">
                      <AnimatedIcon icon={Target} className="text-cyan-400" />
                      <h3 className="text-2xl font-bold text-white">Compliance Training</h3>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      Regulatory compliance and mandatory training where certification accuracy directly impacts legal compliance and safety.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Continuous attention monitoring during training modules</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Knowledge retention verification</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">Automated compliance reporting and audit trails</span>
                      </div>
                    </div>
                  </div>
                </BacklitBorder>
              </AnimateGroup>

              <AnimateGroup className="text-center">
                <FadeUp>
                  <div className="bg-gradient-to-r from-cyan-400/10 via-gold-400/10 to-cyan-400/10 rounded-2xl p-8 border border-cyan-400/20">
                    <h3 className="text-2xl font-bold text-white mb-4">Certification Impact</h3>
                    <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                      Restore faith in professional certifications, eliminate fake credentials from the marketplace,
                      and ensure employers can trust the qualifications they hire for.
                    </p>
                  </div>
                </FadeUp>
              </AnimateGroup>
            </div>
          </BlindZoom>
        </Fold>

        {/* FOLD 10: ARCHITECTURE */}
        <Fold id="architecture">
          <div className="max-w-6xl mx-auto px-6 w-full">
            <AnimateGroup className="text-center mb-8">
              <FadeUp>
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-cyan-400/80 mb-2">
                  <span className="w-8 h-px bg-cyan-400/40" /> Under the Hood <span className="w-8 h-px bg-cyan-400/40" />
                </span>
              </FadeUp>
              <FadeUp><h2 className="text-3xl md:text-4xl font-bold text-white mb-1">Closed-Loop Autonomous System</h2></FadeUp>
              <FadeUp><p className="text-sm text-gray-400">No human-in-the-loop required for critical enforcement</p></FadeUp>
            </AnimateGroup>
            <BlindZoom>
              <div className="bg-navy-900/80 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6">
                <ArchitectureDiagram />
              </div>
            </BlindZoom>
          </div>
        </Fold>

        {/* FOLD 11: INTEGRATION */}
        <Fold id="integration">
          <BlindZoom>
            <div className="max-w-6xl mx-auto px-6 w-full min-h-[85vh] flex items-center justify-center">
              <div className="w-full">
                <AnimateGroup className="text-center mb-12">
                  <FadeUp>
                    <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-cyan-400/80 mb-4">
                      <span className="w-12 h-px bg-cyan-400/40" /> Integration <span className="w-12 h-px bg-cyan-400/40" />
                    </span>
                  </FadeUp>
                  <FadeUp>
                    <h2 className="text-4xl md:text-6xl font-bold text-white">Live in minutes. <span className="text-gradient">Not months.</span></h2>
                  </FadeUp>
                </AnimateGroup>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    { tier: 'Tier 3 — Embed', time: '5 min', code: '<iframe src="ayan.ai/exam?id=..." />', desc: 'Zero-code iframe. Drop into any LMS.' },
                    { tier: 'Tier 1 — Script', time: '30 min', code: '<script src="ayan.ai/sdk.js" />\nAyan.init({ examId, apiKey })', desc: 'Single script tag. Full monitoring.' },
                    { tier: 'Tier 2 — SDK', time: '1-2 hrs', code: 'import { ProctorSDK } from "@ayan/sdk"\nconst proctor = new ProctorSDK(config)', desc: 'Full NPM package. Complete control.' },
                  ].map((tier) => (
                    <Pop key={tier.tier}>
                      <div className="bg-navy-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 hover:border-cyan-400/20 transition-all duration-500 group h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-mono text-cyan-400/80 uppercase tracking-wider">{tier.tier}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-400/10 text-cyan-400 text-xs font-medium">{tier.time}</span>
                        </div>
                        <p className="text-gray-400 text-sm mb-3 flex-grow">{tier.desc}</p>
                        <pre className="bg-navy-950 rounded-xl p-3 text-xs font-mono text-cyan-300/80 overflow-x-auto border border-white/[0.04]">{tier.code}</pre>
                      </div>
                    </Pop>
                  ))}
                </div>
              </div>
            </div>
          </BlindZoom>
        </Fold>
        {/* FOLD 12: TRUST */}
        <Fold>
            <div className="max-w-5xl mx-auto px-6 w-full min-h-[80vh] flex items-center justify-center">
              <ZoomReveal>
                <div className="bg-gradient-to-br from-navy-900/80 to-navy-900/40 backdrop-blur-sm border border-cyan-400/10 rounded-3xl p-12 md:p-16 text-center glow-cyan">
                  <Shield className="w-16 h-16 text-cyan-400 mx-auto mb-8" />
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">Integrity is Infrastructure</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {[
                      { label: 'Bias Reduction', desc: 'Cohort normalization eliminates population-level bias' },
                      { label: 'Explainable AI', desc: 'Every decision comes with LLM-generated reasoning' },
                      { label: 'Feedback Loop', desc: 'Admin corrections continuously improve accuracy' },
                      { label: 'Transparent Scoring', desc: 'Per-violation weights, adaptive thresholds, full audit trail' },
                    ].map((item) => (
                      <div key={item.label}>
                        <h4 className="text-white font-semibold mb-2 text-base">{item.label}</h4>
                        <p className="text-gray-300 text-sm leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
              </div>
            </ZoomReveal>
          </div>
        </Fold>

        {/* FOLD 13: VISION */}
        <Fold id="vision">
          <div className="max-w-5xl mx-auto px-6 w-full min-h-[85vh] flex items-center justify-center">
            <AnimateGroup className="flex flex-col items-center" stagger={0.12}>
              <FadeUp>
                <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.3em] text-gold-400/80 mb-4">
                  <span className="w-12 h-px bg-gold-400/40" /> Vision <span className="w-12 h-px bg-gold-400/40" />
                </span>
              </FadeUp>
              <ScaleIn>
                <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight">
                  From Proctoring<br />to <span className="text-gradient">Autonomous Governance</span>
                </h2>
              </ScaleIn>
              <FadeUp>
                <p className="text-2xl md:text-3xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed">
                  Ayan doesn&apos;t just watch candidates — it understands intent and enforces integrity in real time. Protects merit. Prevents fraud. Builds institutional trust.
                </p>
              </FadeUp>
              <FadeUp>
                <div className="flex flex-col sm:flex-row gap-5 justify-center mb-16">
                  <a href="/admin" className="group inline-flex items-center gap-4 px-10 py-5 bg-cyan-400 text-navy-950 rounded-2xl text-lg font-semibold hover:bg-cyan-300 transition-all duration-300 hover:scale-105 shadow-xl shadow-cyan-400/20">
                    Launch Admin Console <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </a>
                  <button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-4 px-10 py-5 border-2 border-white/10 text-white rounded-2xl text-lg font-medium hover:border-white/30 hover:bg-white/5 transition-all duration-300">
                    Contact Sales
                  </button>
                </div>
              </FadeUp>
            </AnimateGroup>
          </div>
        </Fold>

        {/* FOLD 14: CONTACT */}
        <Fold id="contact">
          <BlindZoom>
            <div className="max-w-6xl mx-auto px-6 w-full min-h-[85vh] flex items-center justify-center">
              <div className="w-full bg-navy-900/80 backdrop-blur-sm border border-white/[0.08] rounded-[2.5rem] p-10 md:p-14 shadow-2xl shadow-cyan-500/10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <span className="inline-flex items-center gap-3 text-sm font-mono uppercase tracking-[0.35em] text-gold-400/80">
                      <span className="w-14 h-px bg-gold-400/40" /> Contact Us <span className="w-14 h-px bg-gold-400/40" />
                    </span>
                    <div className="space-y-4">
                      <h2 className="text-5xl md:text-6xl font-bold text-white leading-tight">Let&apos;s make your next assessment system unstoppable.</h2>
                      <p className="text-xl text-gray-300 max-w-3xl leading-relaxed">
                        Speak with Ayan.ai experts to define the right autonomy model for Enterprise, Academia, Government/PSU, or Learning & Development. Fast deployment, defensible integrity, and measurable trust.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-3xl bg-navy-950/80 border border-cyan-400/10 p-6">
                        <h3 className="text-lg font-semibold text-white mb-3">Email</h3>
                        <p className="text-gray-300">contact@ayan.ai</p>
                      </div>
                      <div className="rounded-3xl bg-navy-950/80 border border-cyan-400/10 p-6">
                        <h3 className="text-lg font-semibold text-white mb-3">Schedule a meeting</h3>
                        <p className="text-gray-300">Book a tailored briefing with our product team and see Ayan in action.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="rounded-[2rem] bg-gradient-to-br from-cyan-400/10 to-gold-400/10 border border-white/[0.06] p-8 h-full flex flex-col justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/70 mb-4">Why Ayan.ai?</p>
                        <ul className="space-y-4 text-gray-300">
                          <li className="flex gap-3 items-start">
                            <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-gold-400" />
                            <span className="text-base leading-relaxed">Autonomous behavior governance, not passive proctoring.</span>
                          </li>
                          <li className="flex gap-3 items-start">
                            <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-gold-400" />
                            <span className="text-base leading-relaxed">Defensible decisions with traceable reasoning and audit trails.</span>
                          </li>
                          <li className="flex gap-3 items-start">
                            <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-gold-400" />
                            <span className="text-base leading-relaxed">Fast enterprise integration into LMS, exam engines, and certification portals.</span>
                          </li>
                        </ul>
                      </div>
                      <div className="mt-8 flex flex-col gap-4">
                        <a href="mailto:contact@ayan.ai" className="inline-flex items-center justify-center rounded-3xl bg-gold-400 px-6 py-4 text-base font-semibold text-navy-950 hover:bg-gold-300 transition">
                          Email Sales
                        </a>
                        <a href="https://calendly.com/ayan-ai/demo" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-3xl border border-white/10 px-6 py-4 text-base font-semibold text-white hover:border-cyan-400/20 hover:bg-white/5 transition">
                          Schedule Meeting</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BlindZoom>
        </Fold>

        {/* FOLD 15: FOOTER */}
        <Fold>
          <div className="max-w-6xl mx-auto px-6 w-full py-12">
            <div className="rounded-[2.5rem] bg-navy-900/70 border border-white/[0.08] p-10 md:p-14 text-center">
              <p className="text-sm uppercase tracking-[0.4em] text-cyan-400/60 mb-6">Ayan.ai Brand Promise</p>
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">Autonomous assessment integrity that scales with trust.</h3>
              <p className="text-base md:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Built for the businesses and institutions that cannot compromise on fairness or compliance. From enterprise hiring to government recruitment, from academic exams to certification programs, Ayan.ai makes integrity the foundation of every digital assessment.
              </p>
              <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-4">
                <a href="mailto:contact@ayan.ai" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-semibold text-navy-950 hover:bg-cyan-300 transition">contact@ayan.ai</a>
                <a href="https://calendly.com/ayan-ai/demo" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-white/10 px-8 py-4 text-base font-semibold text-white hover:border-cyan-400/30 hover:bg-white/5 transition">Schedule a Meeting</a>
              </div>
              <p className="text-xs text-gray-500 mt-10">A product by Tech Machers · © 2026 · Autonomous Integrity at Scale</p>
            </div>
          </div>
        </Fold>

      </main>
    </div>
  );
}

/* ===== SUB-COMPONENTS ===== */

function IndustryShowcase() {
  const tabs = INDUSTRIES.map((ind, i) => ({
    id: ind.slug,
    label: ind.label,
    icon: ind.icon,
    content: (
      <motion.div
        key={ind.slug}
        initial={{ opacity: 0, x: 30, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -30, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-navy-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-center"
      >
        <h3 className="text-xl font-bold text-white mb-3">{ind.headline}</h3>
        <p className="text-sm text-gray-400 mb-6">{ind.desc}</p>
        <div className="space-y-2">
          {ind.usecases.map((uc) => (
            <div key={uc} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span className="text-sm text-gray-300">{uc}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-white/[0.06]">
          <p className="text-xs text-gray-500 italic">
            &quot;{ind.label === 'Enterprise' ? 'Trust, Automated.' : ind.label === 'Government & PSU' ? 'AI That Enforces Fairness.' : ind.label === 'Academia' ? 'Preserving Merit in Digital Assessments.' : 'Certification You Can Trust.'}&quot;
          </p>
        </div>
      </motion.div>
    ),
  }));

  return (
    <AutoRotateTabs
      tabs={tabs}
      interval={3000}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      tabClassName="space-y-3"
      contentClassName="flex flex-col justify-center"
    />
  );
}

function ArchitectureDiagram() {
  const layers = [
    { label: 'Perception', c: { bg: 'bg-blue-400/10', text: 'text-blue-400', border: 'border-blue-400/20' }, items: ['Vision AI', 'Audio AI', 'Screen Monitor', 'Browser SDK'] },
    { label: 'Reasoning', c: { bg: 'bg-purple-400/10', text: 'text-purple-400', border: 'border-purple-400/20' }, items: ['Agent Reasoning', 'Violation Classifier', 'Pattern Detector', 'Adaptive Scoring'] },
    { label: 'Action', c: { bg: 'bg-red-400/10', text: 'text-red-400', border: 'border-red-400/20' }, items: ['Decision Engine', 'Session Control', 'Proctor Alerts', 'Candidate SDK'] },
    { label: 'Learning', c: { bg: 'bg-green-400/10', text: 'text-green-400', border: 'border-green-400/20' }, items: ['Feedback Loop', 'Weight Tuning', 'Accuracy Metrics', 'Candidate Profile'] },
  ];

  return (
    <div className="space-y-3">
      {layers.map((layer, li) => (
        <SlideIn key={layer.label} direction="left" delay={li * 0.08}>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${layer.c.bg} ${layer.c.text} ${layer.c.border} border w-20 text-center flex-shrink-0`}>{layer.label}</span>
            <div className="grid grid-cols-4 gap-2 flex-grow">
              {layer.items.map((item) => (
                <div key={item} className="bg-navy-950/60 rounded-lg px-3 py-2 border border-white/[0.04] hover:border-white/10 transition-colors">
                  <span className="text-white text-xs font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </SlideIn>
      ))}
      <div className="text-center mt-4">
        <span className="inline-flex items-center gap-2 text-cyan-400/60 text-xs font-mono">
          <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} />
          Closed-loop {'\u2014'} Learning feeds back into Perception
        </span>
      </div>
    </div>
  );
}
