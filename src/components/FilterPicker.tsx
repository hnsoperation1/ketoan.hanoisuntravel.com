'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

type Option = { value: string; label: string }

export default function FilterPicker({
  label, value, onChange, options, colorMap, align = 'left', wide = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  colorMap?: Record<string, string>
  align?: 'left' | 'right'
  wide?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)
  const isActive = !!value

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
          isActive
            ? 'bg-brand-50 border-brand-200 text-brand-700'
            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`}
      >
        {isActive ? (selected?.label ?? label) : label}
        {isActive ? (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={10} />
          </span>
        ) : (
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className={`absolute top-full mt-1.5 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl p-3 ${align === 'right' ? 'right-0' : 'left-0'} ${wide ? 'w-[420px] max-w-[80vw]' : 'min-w-[160px] max-w-[280px]'}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-0.5">{label}</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { onChange(''); setOpen(false) }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                !value ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Tất cả
            </button>
            {options.map(o => {
              const sel = value === o.value
              const activeColor = colorMap?.[o.value]
              return (
                <button
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    sel
                      ? (activeColor ?? 'bg-brand-600 text-white')
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
