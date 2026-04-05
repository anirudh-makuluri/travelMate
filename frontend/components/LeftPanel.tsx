'use client'

import { useAppStore } from '@/store/appStore'
import { SparkleIcon } from './Icons'
import { cn } from '@/lib/utils'

export const LeftPanel = () => {
  const preferences = useAppStore((state) => state.preferences)

  return (
    <div className="fixed left-0 top-0 h-screen w-[220px] border-r border-white/60 bg-gradient-to-b from-[#f8f4ee] via-[#f7f4ef] to-[#f3efe8] p-6 flex flex-col overflow-y-auto shadow-[inset_-1px_0_0_rgba(255,255,255,0.7)]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <SparkleIcon size={16} />
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">
            Your Travel DNA
          </h2>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Your AI learns your style as we chat
        </p>
      </div>

      {/* Preferences */}
      <div className="space-y-3 flex-1">
        {preferences.map((pref, index) => (
          <div
            key={pref.key}
            className={cn(
              'section-reveal is-visible px-3 py-2.5 rounded-[22px] bg-white/88 glass-panel border border-white/80 flex items-center gap-2 text-sm transition-all duration-300 hover:-translate-y-0.5',
              pref.updated && 'pref-update border-teal ring-2 ring-teal/10'
            )}
            style={{ transitionDelay: `${index * 45}ms` }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#fff7ea] to-[#f3fbfa] text-base leading-none shadow-sm">
              {pref.icon}
            </span>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{pref.label}</div>
              <div className="text-xs font-semibold text-text-primary truncate">
                {pref.value}
              </div>
            </div>
            <div className="h-2 w-2 rounded-full bg-teal/20 shadow-[0_0_0_4px_rgba(13,115,119,0.06)]" />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="w-2 h-2 rounded-full bg-teal-light pulse-soft"></span>
          <span>Updating as you chat...</span>
        </div>
      </div>
    </div>
  )
}
