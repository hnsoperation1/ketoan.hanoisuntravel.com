'use client'

// Ô CHỌN 1 GIÁ TRỊ tự vẽ — thay cho <select> của trình duyệt (quy tắc chung toàn ERP 2026-10-16: không
// dùng dropdown/lịch hệ thống). Copy từ ihns.vn/src/components/SelectMenu.tsx, chỉ khác lớp z danh sách (z-[1000]:
// modal ở app này lên tới z-300). Danh sách thả xuống ngay dưới ô (không đủ chỗ thì lật lên trên), vẽ qua portal
// ra body với vị trí fixed nên không bị khung cha overflow-hidden / cuộn cắt mất; đóng khi chọn / bấm ra ngoài / Esc.
// Nhiều lựa chọn (> 8) tự có ô tìm (có nút X xoá). `taoMoi` → dòng "+ ..." cuối danh sách để tạo mục mới
// (nhận chữ đang tìm để điền sẵn).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react'

export type SelectOption = { value: string; label: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

export function SelectMenu({ value, onChange, options, placeholder = 'Chọn...', className = '', disabled = false, size = 'md', taoMoi }: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
  size?: 'md' | 'sm'
  taoMoi?: { label: string; onClick: (q: string) => void }
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null)

  // Tính vị trí danh sách theo ô chọn; cuộn / đổi cỡ cửa sổ thì tính lại
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const gap = 6, margin = 8
      const below = window.innerHeight - r.bottom - gap - margin
      const above = r.top - gap - margin
      const want = Math.min(360, menuRef.current?.scrollHeight ?? 320)
      const width = Math.max(r.width, 200)
      const left = Math.min(r.left, window.innerWidth - width - margin)
      if (below >= want || below >= above) setPos({ left, width, top: r.bottom + gap, maxH: Math.min(360, Math.max(120, below)) })
      else setPos({ left, width, bottom: window.innerHeight - r.top + gap, maxH: Math.min(360, Math.max(120, above)) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => { const t = e.target as Node; if (ref.current && !ref.current.contains(t) && !menuRef.current?.contains(t)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)
  const coTim = options.length > 8
  const shown = useMemo(() => {
    const k = norm(q.trim())
    return k ? options.filter((o) => norm(o.label).includes(k)) : options
  }, [options, q])

  const trigger = size === 'sm'
    ? 'rounded-lg px-2.5 py-1.5 text-xs'
    : 'rounded-xl px-3 py-2.5 text-sm'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" disabled={disabled} onClick={() => { setQ(''); setOpen((o) => !o) }}
        className={`flex w-full items-center justify-between gap-2 border bg-white text-left transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${trigger} ${open ? 'border-brand-400 ring-2 ring-brand-100' : 'border-gray-200 hover:border-gray-300'}`}>
        <span className={`truncate ${selected ? 'font-medium text-gray-900' : 'text-gray-400'}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={size === 'sm' ? 13 : 15} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={pos ? { left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH } : { visibility: 'hidden' }}
          className="fixed z-[1000] flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
          {coTim && (
            <div className="border-b border-gray-100 p-2">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm"
                  className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-7 text-sm outline-none focus:ring-2 focus:ring-brand-100" />
                {q && <button type="button" onClick={() => setQ('')} aria-label="Xoá tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {shown.length === 0 ? <p className="px-3 py-3 text-center text-sm text-gray-400">Không tìm thấy.</p> : shown.map((o) => {
              const on = o.value === value
              return (
                <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {on && <Check size={15} className="shrink-0 text-brand-600" />}
                </button>
              )
            })}
          </div>
          {taoMoi && (
            <button type="button" onClick={() => { setOpen(false); taoMoi.onClick(q.trim()) }}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm font-semibold text-brand-600 hover:bg-brand-50">
              <Plus size={15} /> {taoMoi.label}
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
