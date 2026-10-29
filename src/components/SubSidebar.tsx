'use client'

// Port từ ihns.vn/src/components/SubSidebar.tsx (giữ y hệt, Tailwind 4). Sidebar con bên trong 1 màn (mẫu: HRM → Cài đặt, 2026-10-20): sát mép trái vùng nội dung, cao hết màn, mỗi mục có icon.
// Thu nhỏ được như sidebar chính (chỉ còn icon, số đếm thành chấm) — nhớ theo `storageKey` (localStorage, lỗi thì bỏ qua).
// Điện thoại: hàng tab cuộn ngang. Nơi dùng đặt màn dạng `flex h-full min-h-0 flex-col md:flex-row` + vùng nội dung tự cuộn.

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'

export type SubSidebarItem = { id: string; label: string; Icon: LucideIcon; count?: number; tone?: 'brand' | 'red'; group?: string }

export function SubSidebar({ items, value, onChange, storageKey }: { items: SubSidebarItem[]; value: string; onChange: (id: string) => void; storageKey: string }) {
  const [thuNho, setThuNho] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc trạng thái thu nhỏ đã lưu sau khi mount (tránh lệch SSR)
    try { setThuNho(localStorage.getItem(storageKey) === '1') } catch { /* trình duyệt chặn lưu → mặc định mở */ }
  }, [storageKey])
  function doiThuNho() {
    setThuNho((v) => {
      try { localStorage.setItem(storageKey, v ? '0' : '1') } catch { /* bỏ qua */ }
      return !v
    })
  }

  const nhom = Array.from(new Set(items.map((i) => i.group ?? '')))
  const nutMuc = (it: SubSidebarItem) => {
    const on = it.id === value
    const soCls = it.tone === 'red' ? 'bg-red-50 text-red-600' : on ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700'
    return (
      <button key={it.id} type="button" onClick={() => onChange(it.id)} title={thuNho ? `${it.label}${it.count ? ` (${it.count})` : ''}` : undefined}
        className={clsx('relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
          thuNho && 'md:justify-center md:px-0',
          on ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-600 hover:bg-gray-50')}>
        <it.Icon size={14} className={clsx('shrink-0', on ? 'text-brand-500' : 'text-gray-400')} />
        <span className={clsx('whitespace-nowrap md:min-w-0 md:flex-1 md:whitespace-normal md:leading-snug', thuNho && 'md:hidden')}>{it.label}</span>
        {!!it.count && <span className={clsx('rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none', soCls, thuNho && 'md:hidden')}>{it.count}</span>}
        {!!it.count && thuNho && <span className={clsx('absolute right-2 top-1.5 hidden h-2 w-2 rounded-full md:block', it.tone === 'red' ? 'bg-red-500' : 'bg-brand-500')} />}
      </button>
    )
  }

  return (
    <nav className={clsx('flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-white p-2 transition-all duration-200 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r',
      thuNho ? 'md:w-14' : 'md:w-56')}>
      <div className={clsx('hidden md:flex', thuNho ? 'md:justify-center' : 'md:justify-end')}>
        <button type="button" onClick={doiThuNho} title={thuNho ? 'Mở rộng' : 'Thu nhỏ'} aria-label={thuNho ? 'Mở rộng' : 'Thu nhỏ'}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          {thuNho ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
      {nhom.map((g, gi) => (
        <div key={g || gi} className={clsx('contents md:flex md:flex-col md:gap-0.5', gi > 0 && 'md:mt-1.5 md:border-t md:border-gray-100 md:pt-1.5')}>
          {g && !thuNho && <p className="hidden px-2.5 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 md:block">{g}</p>}
          {items.filter((i) => (i.group ?? '') === g).map(nutMuc)}
        </div>
      ))}
    </nav>
  )
}
