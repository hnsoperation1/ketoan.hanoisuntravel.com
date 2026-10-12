'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import clsx from 'clsx'
import { ModalOverlay } from '@/components/ModalOverlay'

// Ô CHỌN NHÂN VIÊN dùng chung (quyết định 2026-10-12, chép từ ihns.vn/src/components/UserPicker.tsx):
// bấm ô → modal có ô tìm kiếm, danh sách chỉ hiện HỌ TÊN (không kèm vai trò, không email). Modal theo quy
// tắc chung — chỉ đóng bằng nút (X / Huỷ / chọn xong). Danh sách `users` truyền vào đã lọc sẵn (vd ẩn tài
// khoản test với người không phải Super Admin — API /api/ve-may-bay/users đã làm việc đó).
// `zClass`: lớp z-* cho lớp nền modal. Mặc định z-50 (ModalOverlay); ô chọn nằm trong bảng "Phóng to"
// (khung z-[100]) phải truyền lớp cao hơn, vd "z-[200]", nếu không modal bị khung phóng to che mất.

export type PickerUser = { id: string; full_name: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

// Chữ viết tắt trên avatar: 2 chữ đầu của 2 từ CUỐI (tên Việt: "Nguyễn Văn An" → "VA"), giống ihns.vn.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase()
}

const triggerCls = {
  md: 'w-full flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-left transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60',
  sm: 'w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-left transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60',
}

// Modal chọn dùng chung — export riêng cho chỗ cần tự giữ ô nhập (vd "Sale chính" ở Tổng hợp công nợ NCC
// vẫn cho gõ tự do, chỉ mở modal này qua nút "Chọn").
export function UserPickerModal({ title, users, isSelected, onPick, allLabel, onPickAll, allSelected, onClose, footer, zClass }: {
  title: string
  users: PickerUser[]
  isSelected: (u: PickerUser) => boolean
  onPick: (u: PickerUser) => void
  allLabel?: string
  onPickAll?: () => void
  allSelected?: boolean
  onClose: () => void
  footer?: React.ReactNode
  zClass?: string
}) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const k = norm(q.trim())
    return k ? users.filter((u) => norm(u.full_name).includes(k)) : users
  }, [q, users])

  const row = (key: string, label: React.ReactNode, selected: boolean, onClick: () => void, avatar?: string) => (
    <button key={key} type="button" onClick={onClick}
      className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors', selected ? 'bg-brand-50 font-semibold text-brand-800' : 'text-gray-700 hover:bg-gray-50')}>
      {avatar !== undefined
        ? <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">{avatar}</span>
        : <span className="h-7 w-7 flex-shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected && <Check size={16} className="flex-shrink-0 text-brand-600" />}
    </button>
  )

  return (
    <ModalOverlay className={clsx('flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm', zClass)}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <p className="font-bold text-gray-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo họ tên"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Xoá tìm kiếm" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {allLabel && onPickAll && !q && row('__all', allLabel, !!allSelected, onPickAll)}
          {shown.map((u) => row(u.id, u.full_name, isSelected(u), () => onPick(u), getInitials(u.full_name)))}
          {shown.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-400">Không tìm thấy.</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          {footer ?? <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Huỷ</button>}
        </div>
      </div>
    </ModalOverlay>
  )
}

// Chọn 1 người. `allLabel` có → thêm dòng "tất cả / bỏ chọn" ở đầu danh sách (chọn → onChange(null)).
export function UserPicker({ users, value, onChange, placeholder, allLabel, title, className, size = 'md', disabled, zClass }: {
  users: PickerUser[]
  value: string | null | undefined
  onChange: (id: string | null) => void
  placeholder: string
  allLabel?: string
  title?: string
  className?: string
  size?: 'md' | 'sm'
  disabled?: boolean
  zClass?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = users.find((u) => u.id === value) ?? null
  return (
    <div className={className}>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={triggerCls[size]}>
        <span className={clsx('truncate', selected ? 'font-medium text-gray-900' : 'text-gray-400')}>{selected?.full_name ?? placeholder}</span>
        <ChevronDown size={size === 'sm' ? 13 : 15} className="flex-shrink-0 text-gray-400" />
      </button>
      {open && (
        <UserPickerModal title={title ?? placeholder} users={users} isSelected={(u) => u.id === value} zClass={zClass}
          onPick={(u) => { onChange(u.id); setOpen(false) }}
          allLabel={allLabel} allSelected={!value} onPickAll={() => { onChange(null); setOpen(false) }}
          onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

// Chọn nhiều người: tick trong modal, bấm "Xong" để áp dụng (Huỷ = bỏ thay đổi).
export function UserMultiPicker({ users, values, onChange, placeholder, title, className, size = 'md', disabled, zClass }: {
  users: PickerUser[]
  values: string[]
  onChange: (ids: string[]) => void
  placeholder: string
  title?: string
  className?: string
  size?: 'md' | 'sm'
  disabled?: boolean
  zClass?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(values)
  const names = users.filter((u) => values.includes(u.id)).map((u) => u.full_name)
  const label = names.length === 0 ? placeholder : names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
  return (
    <div className={className}>
      <button type="button" disabled={disabled} onClick={() => { setDraft(values); setOpen(true) }} className={triggerCls[size]}>
        <span className={clsx('truncate', names.length ? 'font-medium text-gray-900' : 'text-gray-400')}>{label}</span>
        <ChevronDown size={size === 'sm' ? 13 : 15} className="flex-shrink-0 text-gray-400" />
      </button>
      {open && (
        <UserPickerModal title={title ?? placeholder} users={users} isSelected={(u) => draft.includes(u.id)} zClass={zClass}
          onPick={(u) => setDraft((d) => (d.includes(u.id) ? d.filter((x) => x !== u.id) : [...d, u.id]))}
          onClose={() => setOpen(false)}
          footer={<>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Huỷ</button>
            <button type="button" onClick={() => { onChange(draft); setOpen(false) }} className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Xong ({draft.length})</button>
          </>} />
      )}
    </div>
  )
}
