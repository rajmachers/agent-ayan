'use client';

import { ReactNode, useState, useEffect } from 'react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   SNAP-SCROLL SLIDE DECK COMPONENTS
   Full-viewport folds with staggered intra-fold animations
   ═══════════════════════════════════════════════════════ */

/* ─── Framer Motion Variants ─── */
export const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const scaleUpVariant: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const slideLeftVariant: Variants = {
  hidden: { opacity: 0, x: -36 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const slideRightVariant: Variants = {
  hidden: { opacity: 0, x: 36 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const popVariant: Variants = {
  hidden: { opacity: 0, scale: 0.7, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

/* ─── Fold — full-viewport snap-aligned slide ─── */
export function Fold({
  children,
  id,
  className = '',
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`min-h-screen w-full flex items-center justify-center relative overflow-hidden snap-start snap-always ${className}`}
    >
      {children}
    </section>
  );
}

/* ─── AnimateGroup — stagger-reveal its children when fold is in view ─── */
export function AnimateGroup({
  children,
  className = '',
  stagger = 0.1,
  delay = 0.05,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Item wrappers (use as children of AnimateGroup) ─── */
export function FadeUp({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <motion.div variants={fadeUpVariant} className={className}>{children}</motion.div>;
}

export function ScaleIn({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <motion.div variants={scaleUpVariant} className={className}>{children}</motion.div>;
}

export function SlideLeft({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <motion.div variants={slideLeftVariant} className={className}>{children}</motion.div>;
}

export function SlideRight({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <motion.div variants={slideRightVariant} className={className}>{children}</motion.div>;
}

export function Pop({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <motion.div variants={popVariant} className={className}>{children}</motion.div>;
}

/* ─── Standalone animated elements (outside AnimateGroup) ─── */
export function SlideIn({
  children,
  direction = 'up',
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
  delay?: number;
}) {
  const offsets = {
    left: { x: -30, y: 0 },
    right: { x: 30, y: 0 },
    up: { x: 0, y: 30 },
    down: { x: 0, y: -30 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...offsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      viewport={{ once: true, amount: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ZoomReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      viewport={{ once: true, amount: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MaskReveal({ text, className = '' }: { text: string; className?: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      viewport={{ once: true, amount: 0.5 }}
      className={className}
    >
      {text}
    </motion.p>
  );
}

export function ScaleText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      viewport={{ once: true, amount: 0.5 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Blind/zoom effect that scales content to fill viewport */
export function BlindZoom({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      viewport={{ once: true, amount: 0.1 }}
      className={`w-full h-full flex items-center justify-center ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Auto-rotating tabs with pause on click */
export function AutoRotateTabs({
  tabs,
  interval = 3000,
  className = '',
  tabClassName = '',
  contentClassName = '',
}: {
  tabs: Array<{ id: string; label: string; icon: any; content: ReactNode }>;
  interval?: number;
  className?: string;
  tabClassName?: string;
  contentClassName?: string;
}) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % tabs.length);
    }, interval);
    return () => clearInterval(timer);
  }, [tabs.length, interval, isPaused]);

  const handleTabClick = (index: number) => {
    setActive(index);
    setIsPaused(true);
  };

  return (
    <div className={className}>
      <div className={tabClassName}>
        {tabs.map((tab, i) => {
          const isActive = active === i;
          return (
            <FadeUp key={tab.id}>
              <motion.button
                onClick={() => handleTabClick(i)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-500 ${isActive ? 'bg-navy-900/80 border-cyan-400/30 shadow-lg' : 'bg-navy-900/30 border-white/[0.04] hover:border-white/10'}`}
                layout
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-cyan-400/20' : 'bg-white/5'}`}>
                    <tab.icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-gray-400'}`}>{tab.label}</h3>
                  </div>
                  <ChevronRight className={`ml-auto w-4 h-4 flex-shrink-0 transition-transform duration-300 ${isActive ? 'text-cyan-400 rotate-90' : 'text-gray-600'}`} />
                </div>
              </motion.button>
            </FadeUp>
          );
        })}
      </div>
      <div className={contentClassName}>
        <AnimatePresence mode="wait">
          {tabs[active]?.content}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Sequential tier reveal with timing */
export function SequentialReveal({
  tiers,
  renderTier,
  delays = [0, 3000, 6000],
  className = '',
}: {
  tiers: any[];
  renderTier: (tier: any, index: number, isActive: boolean) => ReactNode;
  delays?: number[];
  className?: string;
}) {
  const [activeTier, setActiveTier] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const totalCycle = delays[delays.length - 1] + 5000;

    const scheduleCycle = () => {
      setActiveTier(0);
      delays.forEach((delay, index) => {
        if (index === 0) return;
        if (index < tiers.length) {
          timers.push(setTimeout(() => setActiveTier(index), delay));
        }
      });
      timers.push(setTimeout(scheduleCycle, totalCycle));
    };

    scheduleCycle();
    return () => timers.forEach(clearTimeout);
  }, [delays, tiers.length]);

  return (
    <div className={className}>
      {tiers.map((tier, index) => (
        <div key={index}>
          {renderTier(tier, index, index <= activeTier)}
        </div>
      ))}
    </div>
  );
}

/** Backlit border effect */
export function BacklitBorder({
  children,
  color = 'cyan',
  className = '',
}: {
  children: ReactNode;
  color?: 'cyan' | 'gold' | 'red' | 'green';
  className?: string;
}) {
  const colorClasses = {
    cyan: 'border-cyan-400/30 shadow-lg shadow-cyan-400/20',
    gold: 'border-gold-400/30 shadow-lg shadow-gold-400/20',
    red: 'border-red-400/30 shadow-lg shadow-red-400/20',
    green: 'border-green-400/30 shadow-lg shadow-green-400/20',
  };

  return (
    <div className={`border-2 rounded-2xl transition-all duration-500 ${colorClasses[color]} ${className}`}>
      {children}
    </div>
  );
}

/** Animated icon with pulse/glow */
export function AnimatedIcon({
  icon: Icon,
  color = 'cyan',
  className = '',
}: {
  icon: any;
  color?: 'cyan' | 'gold' | 'red' | 'green';
  className?: string;
}) {
  const colorClasses = {
    cyan: 'text-cyan-400',
    gold: 'text-gold-400',
    red: 'text-red-400',
    green: 'text-green-400',
  };

  return (
    <motion.div
      animate={{
        scale: [1, 1.1, 1],
        filter: ['brightness(1)', 'brightness(1.2)', 'brightness(1)'],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`inline-flex ${className}`}
    >
      <Icon className={`w-6 h-6 ${colorClasses[color]}`} />
    </motion.div>
  );
}
