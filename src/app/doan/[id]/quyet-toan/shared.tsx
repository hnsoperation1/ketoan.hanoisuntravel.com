'use client'

// Thành phần dùng chung của tab Quyết toán (đoàn → Quyết toán). Không phải route (thư mục không có page.tsx).

import { useCallback, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import clsx from 'clsx'
import { ModalOverlay } from '@/components/ModalOverlay'
import { formatTien } from '@/lib/format'
import type { QtBundle } from '@/lib/quyetToanBundle'
import type { KetQuaQuyetToan } from '@/lib/quyetToan'

export const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-500'
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-accent-600 disabled:opacity-50'
export const btnBrand = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50'
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50'
export const btnDanger = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50'

// Bảng nhỏ trong các mục (không phải lưới LIST TỔNG): kẻ ô mảnh theo bảng màu chuẩn ERP
export const tblCls = 'w-full border-separate border-spacing-0 text-sm [&_td]:border-b [&_td]:border-[#e0e0e0] [&_th]:border-b [&_th]:border-[#e0e0e0]'
export const thCls = 'bg-[#f8f9fa] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5f6368] whitespace-nowrap'
export const tdCls = 'px-2.5 py-1.5 align-top text-[#3c4043]'
export const tdNum = 'px-2.5 py-1.5 align-top text-right tabular-nums text-[#3c4043] whitespace-nowrap'

export type QtCtx = {
  b: QtBundle
  kq: KetQuaQuyetToan
  khoa: boolean
  call: (method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) => Promise<boolean>
  toast: (msg: string, loi?: boolean) => void
  ten: (id: string | null | undefined) => string
}

/** Gọi API của đơn (đường dẫn tương đối /api/quyet-toan/don/<opp>/…), báo lỗi bằng toast, thành công thì tải lại. */
export function useQtCall(oppId: string, reload: () => Promise<void> | void, toast: (m: string, loi?: boolean) => void) {
  return useCallback(async (method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) => {
    try {
      const res = await fetch(`/api/quyet-toan/don/${oppId}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(j.error ?? 'Lỗi lưu dữ liệu', true)
        return false
      }
      await reload()
      return true
    } catch {
      toast('Không kết nối được máy chủ', true)
      return false
    }
  }, [oppId, reload, toast])
}

export function Tien({ v, className, am = true }: { v: number | null | undefined; className?: string; am?: boolean }) {
  if (v == null) return <span className="text-[#9aa0a6]">—</span>
  return <span className={clsx('tabular-nums', am && v < 0 && 'text-red-600', className)}>{formatTien(v)}</span>
}

/** Ô nhập số tiền có dấu chấm hàng nghìn; cho phép số âm và số thập phân nhỏ (vd SL 0,08). */
export function MoneyInput({ value, onChange, disabled, placeholder, className, thapPhan = false }: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  thapPhan?: boolean
}) {
  const [text, setText] = useState<string | null>(null)
  const hien = text ?? (value == null ? '' : thapPhan ? String(value).replace('.', ',') : Math.round(value).toLocaleString('vi-VN'))
  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder}
      value={hien}
      onFocus={() => setText(value == null ? '' : thapPhan ? String(value).replace('.', ',') : String(Math.round(value)))}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const raw = (text ?? '').trim()
        setText(null)
        if (raw === '') return onChange(null)
        const s = thapPhan ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/[.,\s]/g, '')
        const x = Number(s)
        onChange(Number.isFinite(x) ? x : null)
      }}
      className={clsx(inputCls, 'text-right tabular-nums', className)}
    />
  )
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-[11px] font-semibold text-gray-500">{label}</span>
      {children}
    </label>
  )
}

export function Card({ title, actions, children, className }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-2xl border border-gray-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'brand' | 'green' | 'amber' | 'red' | 'violet' }) {
  const cls = {
    gray: 'bg-gray-100 text-gray-600',
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-700',
  }[tone]
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', cls)}>{children}</span>
}

export function EmptyRow({ cols, text = 'Chưa có dữ liệu.' }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-6 text-center text-sm text-[#9aa0a6]">{text}</td>
    </tr>
  )
}

/** Khung modal chuẩn: chỉ đóng bằng X / Huỷ / nút hoàn tất. */
export function QtModal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; wide?: boolean }) {
  return (
    <ModalOverlay className="z-[120] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className={clsx('flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <p className="font-bold text-gray-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>
      </div>
    </ModalOverlay>
  )
}

/** Modal nhập lý do (Trả lại, Từ chối, Mở khoá…). Trả về lý do qua onSubmit. */
export function LyDoModal({ title, label = 'Lý do', required = true, confirmLabel = 'Xác nhận', danger, onClose, onSubmit }: {
  title: string
  label?: string
  required?: boolean
  confirmLabel?: string
  danger?: boolean
  onClose: () => void
  onSubmit: (lyDo: string) => Promise<boolean | void>
}) {
  const [v, setV] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = !required || v.trim().length > 0
  return (
    <QtModal title={title} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnGhost}>Huỷ</button>
      <button type="button" disabled={!ok || busy} className={danger ? 'inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50' : btnBrand}
        onClick={async () => {
          setBusy(true)
          const r = await onSubmit(v.trim())
          setBusy(false)
          if (r !== false) onClose()
        }}>
        {busy && <Loader2 size={13} className="animate-spin" />}{confirmLabel}
      </button>
    </>}>
      <Field label={label}>
        <textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} rows={3} className={inputCls} />
      </Field>
    </QtModal>
  )
}

export function nccOptions(b: QtBundle, extra?: { id: string | null; ten: string | null }) {
  const opts = b.ncc_options.map((n) => ({ value: n.id, label: n.name }))
  if (extra?.id && !opts.some((o) => o.value === extra.id)) opts.unshift({ value: extra.id, label: extra.ten ?? '(NCC đã ẩn)' })
  return [{ value: '', label: '— Không chọn (nhập tên) —' }, ...opts]
}

export const VAT_OPTIONS = [0, 5, 8, 10].map((v) => ({ value: String(v), label: `${v}%` }))
