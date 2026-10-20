'use client'

// Ô "Ngân hàng" — vẫn gõ chữ tự do (hay kèm chi nhánh, vd "Vietcombank - CN Gò Vấp"; chữ này trộn thẳng vào
// hợp đồng) nhưng gợi ý tên ngân hàng từ danh mục chung khi gõ. Chọn gợi ý chỉ thay phần trước dấu "-", giữ
// nguyên phần chi nhánh đã gõ. Danh sách vẽ qua portal (fixed) để không bị khung modal cuộn cắt mất.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { khoaNganHang, useNganHang } from '@/lib/danhMuc'

export default function NganHangInput({ value, onChange, className }: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const { tenGoiY } = useNganHang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; width: number; top: number } | null>(null)

  const idx = value.indexOf('-')
  const phanNganHang = idx >= 0 ? value.slice(0, idx) : value
  const phanChiNhanh = idx >= 0 ? value.slice(idx) : ''

  const khoa = khoaNganHang(phanNganHang)
  const khop = khoa ? tenGoiY.filter((t) => khoaNganHang(t).includes(khoa)) : tenGoiY
  // Đã gõ đúng tên 1 ngân hàng thì thôi gợi ý
  const shown = khop.length === 1 && khoaNganHang(khop[0]) === khoa ? [] : khop

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = ref.current?.getBoundingClientRect()
      if (r) setPos({ left: r.left, width: Math.max(r.width, 200), top: r.bottom + 4 })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function chon(ten: string) {
    onChange(phanChiNhanh ? `${ten} ${phanChiNhanh.trimStart()}` : ten)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} className={className} />
      {open && shown.length > 0 && typeof document !== 'undefined' && createPortal(
        <div onMouseDown={(e) => e.preventDefault()} style={pos ? { left: pos.left, width: pos.width, top: pos.top } : { visibility: 'hidden' }}
          className="fixed z-[1000] max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white p-1 shadow-xl">
          {shown.map((t) => (
            <button key={t} type="button" onClick={() => chon(t)}
              className="flex w-full rounded-lg px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50">
              {t}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
