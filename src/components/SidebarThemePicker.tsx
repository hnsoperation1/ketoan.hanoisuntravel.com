'use client'

import { Check } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/contexts/auth'
import { SIDEBAR_THEMES, useSidebarTheme } from '@/lib/sidebarTheme'

// Chọn theme sidebar (trang Tuỳ chỉnh sidebar) — bấm là lưu, sidebar đổi ngay. Xem src/lib/sidebarTheme.ts.
export function SidebarThemePicker() {
  const { user } = useAuth()
  const { theme, save } = useSidebarTheme(user?.sidebar_theme)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <p className="mb-2 px-1 text-xs font-semibold text-gray-500">Giao diện</p>
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        {SIDEBAR_THEMES.map((t) => {
          const on = t.id === theme.id
          return (
            <button key={t.id} type="button" onClick={() => save(t.id)} aria-pressed={on}
              className={clsx('rounded-xl border p-2 text-left transition-shadow', on ? 'border-[#ef5e2f] ring-2 ring-[#ef5e2f]/30' : 'border-gray-200 hover:shadow-md')}>
              <div className="space-y-1.5 rounded-lg p-2" style={{ background: t.swatch.bg }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded px-1 py-1" style={i === 1 ? { background: t.swatch.active } : undefined}>
                    <span className={clsx('h-3 w-3 flex-shrink-0 rounded bg-gradient-to-br', ['from-sky-500 to-[#0069a0]', 'from-emerald-400 to-teal-600', 'from-amber-400 to-orange-500'][i])} />
                    <span className="h-1.5 flex-1 rounded-full" style={{ background: i === 1 ? '#ffffff' : t.swatch.text, opacity: i === 1 ? 0.9 : 0.6 }} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between px-0.5">
                <span className={clsx('text-sm', on ? 'font-semibold text-gray-900' : 'text-gray-600')}>{t.label}</span>
                {on && <Check size={15} className="text-[#ef5e2f]" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
