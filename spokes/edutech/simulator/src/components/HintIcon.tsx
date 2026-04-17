'use client'

import { useState } from 'react'

interface HintProps {
  title: string
  description: string
  examples?: string[]
  details?: string
  size?: 'sm' | 'md' | 'lg'
  icon?: string
}

export const HintIcon: React.FC<HintProps> = ({
  title,
  description,
  examples = [],
  details,
  size = 'md',
  icon = 'ℹ️',
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-sm',
    lg: 'w-6 h-6 text-base',
  }

  return (
    <>
      {/* Hint Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center ${sizeClasses[size]} rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-200 border border-blue-500/30 hover:border-blue-400 transition-all cursor-help`}
        title={`Help: ${title}`}
      >
        {icon}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <h3 className="text-lg font-bold text-blue-300">{title}</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xl font-bold leading-none"
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <p className="text-slate-300 mb-3 text-sm leading-relaxed">{description}</p>

            {/* Examples */}
            {examples.length > 0 && (
              <div className="mb-4">
                <p className="text-slate-400 text-xs font-semibold uppercase mb-2">Examples:</p>
                <ul className="space-y-1">
                  {examples.map((example, idx) => (
                    <li key={idx} className="text-slate-300 text-sm ml-4 before:content-['•'] before:mr-2 before:text-blue-400">
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Details */}
            {details && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 mb-4">
                <p className="text-slate-300 text-sm">{details}</p>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-semibold transition-all"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Inline Tooltip Component
export const HintTooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="flex items-center gap-1"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 whitespace-nowrap z-50 shadow-lg">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  )
}
