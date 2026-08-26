'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Pencil, Sparkles, Check } from 'lucide-react'
import type { RawCandidatePax } from './RawMatchPanel'

// Modal nhỏ giữa màn hình — bấm vào 1 tin nhắn Telegram có khách khớp được
// với dòng nào đó trong bảng công nợ nhưng CHƯA gán, hiện lên đây: "Tìm
// thấy Mã khách X, Giá bán Y, TKT Z" cho từng khách trong tin nhắn đó, có
// cây viết sửa lại nếu bot đọc sai, và nút "Áp dụng" riêng cho từng dòng
// (1 tin nhắn nhiều khách thì mỗi khách xác nhận riêng, tránh gán nhầm
// hàng loạt). Portal ra document.body + modal giữa màn hình thay vì chip
// nổi góc tin nhắn như trước — dễ thấy hơn, không phải tự đoán bấm đâu.
export function MatchSuggestionModal({ suggestions, onApply, onClose }: {
  suggestions: { pax: RawCandidatePax; rowIndex: number }[]
  onApply: (rowIndex: number, pax: RawCandidatePax, edited: { maKhach: string; giaBan: number | null; tktTag: string | null }) => void
  onClose: () => void
}) {
  if (suggestions.length === 0) return null
  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
            <Sparkles size={15} className="text-amber-500 shrink-0" />
            Tìm thấy thông tin khớp trong tin nhắn
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3">
          {suggestions.map(s => (
            <SuggestionCard key={s.pax.id} pax={s.pax} rowIndex={s.rowIndex} onApply={onApply} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SuggestionCard({ pax, rowIndex, onApply }: {
  pax: RawCandidatePax; rowIndex: number
  onApply: (rowIndex: number, pax: RawCandidatePax, edited: { maKhach: string; giaBan: number | null; tktTag: string | null }) => void
}) {
  const [maKhach, setMaKhach] = useState(pax.ma_khach ?? '')
  const [giaBan, setGiaBan] = useState(pax.gia_ban != null ? String(Math.round(pax.gia_ban)) : '')
  const [tktTag, setTktTag] = useState(pax.ve_tkt?.tkt_code ?? '')
  const [applied, setApplied] = useState(false)

  function apply() {
    onApply(rowIndex, pax, {
      maKhach: maKhach.trim(),
      giaBan: giaBan.trim() ? Number(giaBan.trim().replace(/[.,\s]/g, '')) : null,
      tktTag: tktTag.trim() || null,
    })
    setApplied(true)
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2.5">
      <div className="text-xs font-semibold text-gray-700 truncate">
        {pax.full_name || pax.ten_khach_hang || 'Không rõ tên khách'}
        {pax.ticket_no && <span className="font-normal text-gray-400"> · {pax.ticket_no}</span>}
      </div>
      <EditableField label="Mã khách" value={maKhach} onChange={setMaKhach} disabled={applied} />
      <EditableField label="Giá bán" value={giaBan} onChange={setGiaBan} disabled={applied} />
      <EditableField label="TKT" value={tktTag} onChange={setTktTag} disabled={applied} />
      <button type="button" onClick={apply} disabled={applied || !maKhach.trim()}
        className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          applied
            ? 'bg-emerald-50 text-emerald-600 cursor-default'
            : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed'
        }`}>
        {applied ? <><Check size={13} /> Đã áp dụng cho dòng này</> : 'Áp dụng cho dòng này'}
      </button>
    </div>
  )
}

// Mặc định hiện GIÁ TRỊ THÔ (không phải ô nhập) — bấm cây viết mới lộ ra ô
// sửa, giống hệt cách RawPriceCell từng làm: tránh nhìn giống ô luôn-sửa-
// được trong khi đa số trường hợp giá trị bot đọc ra đã đúng sẵn, không cần
// đụng vào.
function EditableField({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-400 shrink-0 w-16">{label}</span>
      {editing && !disabled ? (
        <input autoFocus value={value} onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false) }}
          className="flex-1 min-w-0 border border-brand-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <span className={`truncate font-semibold ${value ? 'text-gray-800' : 'text-gray-300'}`}>{value || 'Chưa có'}</span>
          {!disabled && (
            <button type="button" onClick={() => setEditing(true)} title="Sửa" className="p-0.5 text-gray-300 hover:text-brand-600 shrink-0">
              <Pencil size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
