'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Plus, Loader2, Search, X, User, Maximize2, Minimize2, Eye, Pencil } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'

type Contact = {
  id: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  tax_code: string | null
  source: string | null
  note: string | null
}

type Khach = {
  id: string
  nhom: string
  ma_khach: string
  ten_khach: string | null
  doi_tuong_quy_tac: string | null
  hinh_thuc_cong_no: string | null
  phi_xuat_ve: string | null
  active: boolean
  created_at: string
  contact_id: string | null
  contact: Contact | null
  ghi_chu: string | null
  doanh_thu: number
  loi_nhuan: number
}

const NHOM_LABELS: Record<string, string> = {
  nhan_su: 'Nhân sự HNS',
  dai_ly: 'Đại lý',
  doanh_nghiep: 'Khách hàng DN',
  ag_series: 'AG - mua vé series',
  khach_le: 'Khách lẻ',
  doan_tour: 'Đoàn đi tour',
  series_vj: 'Vé Seri Vietjet',
  series_sao_do: 'Vé Seri Sao Đỏ',
}
const NHOM_OPTIONS = Object.keys(NHOM_LABELS)

// Mã viết tắt cột "Phân loại" ở chế độ Đầy đủ — đọc từ đúng file gốc "Link
// nhập _ Phòng vé HNS (Năm 2026).xlsx" sheet "MÃ KHÁCH VÉ" cột A: chỉ 4 nhóm
// dai_ly/doanh_nghiep/ag_series/khach_le có mã thật (DLY/DN/AG/KLE), 4 nhóm
// còn lại file để trống nên tự đặt mã ngắn hợp lý.
const NHOM_SHORT_LABELS: Record<string, string> = {
  nhan_su: 'NS',
  dai_ly: 'DLY',
  doanh_nghiep: 'DN',
  ag_series: 'AG',
  khach_le: 'KLE',
  doan_tour: 'ĐOÀN',
  series_vj: 'SERI VJ',
  series_sao_do: 'SERI SĐ',
}

// Khớp đúng SOURCE_LABELS bên CRM (bảng contacts.source) — copy vì 2 repo
// riêng, không import chéo được.
const SOURCE_LABELS: Record<string, string> = {
  mkt: 'Marketing',
  sale: 'Sale',
  partner: 'Đối tác',
  bod: 'Ban Giám đốc',
  referral: 'Giới thiệu',
  cskh: 'CSKH',
  test: 'Test',
}

const INPUT = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white placeholder:text-gray-300'

const emptyForm = { nhom: 'khach_le', ma_khach: '', ten_khach: '', doi_tuong_quy_tac: '', hinh_thuc_cong_no: '', phi_xuat_ve: '', contact_id: '' as string | null }

function formatVND(n: number): string {
  return n === 0 ? '—' : `${n.toLocaleString('vi-VN')} đ`
}

// Ô tìm + chọn liên hệ CRM (bảng contacts, cùng Supabase project) — gán
// contact_id cho 1 mã khách VMB. Tạm 1 chiều (xem migration_vmb_khach_hang_contact.sql),
// chưa đồng bộ 2 bảng khách hàng.
function ContactPicker({
  selected,
  onSelect,
}: {
  selected: Contact | null
  onSelect: (c: Contact | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ve-may-bay/contacts-search?q=${encodeURIComponent(query.trim())}`)
        if (res.ok) {
          const { data } = await res.json()
          setResults(Array.isArray(data) ? data : [])
        }
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{selected.name}</p>
          <p className="text-xs text-gray-400 truncate">{[selected.company, selected.phone].filter(Boolean).join(' · ') || '—'}</p>
        </div>
        <button type="button" onClick={() => onSelect(null)} className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Tìm tên, công ty, SĐT liên hệ CRM..."
        className={INPUT}
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {searching ? (
            <p className="px-3.5 py-3 text-xs text-gray-400">Đang tìm...</p>
          ) : results.length === 0 ? (
            <p className="px-3.5 py-3 text-xs text-gray-400">Không tìm thấy liên hệ nào khớp.</p>
          ) : (
            results.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelect(c); setQuery(''); setOpen(false) }}
                className="w-full text-left px-3.5 py-2 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-400">{[c.company, c.phone].filter(Boolean).join(' · ') || '—'}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// Modal nhỏ RIÊNG BIỆT — nhập tay tên/SĐT để tạo 1 liên hệ CRM mới và gán
// cho 1 mã khách, không lẫn với các field chính sách khác (nhóm/mã khách/
// quy tắc...) như modal "Thêm khách hàng". Cố tình KHÔNG có ô tìm — bấm Lưu
// là tạo luôn, chỉ khi trùng SĐT với 1 liên hệ có sẵn thì dùng lại liên hệ
// đó (không tạo trùng) + báo cho kế toán biết (yêu cầu 2026-08-13).
function ContactAssignModal({
  khach,
  onClose,
  onAssigned,
}: {
  khach: Khach
  onClose: () => void
  onAssigned: (contact: Contact) => Promise<boolean>
}) {
  const [name, setName] = useState(khach.contact?.name ?? '')
  const [phone, setPhone] = useState(khach.contact?.phone ?? '')
  const [note, setNote] = useState(khach.contact?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicateMsg, setDuplicateMsg] = useState('')

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/ve-may-bay/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null, note: note.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Có lỗi, thử lại giúp em ạ.')
        return
      }
      const ok = await onAssigned(data.contact as Contact)
      if (!ok) {
        setError('Lưu liên hệ vào mã khách thất bại, thử lại giúp em ạ.')
        return
      }
      if (data.duplicate) {
        setDuplicateMsg(`Đã có sẵn liên hệ trùng SĐT — dùng lại: ${data.contact.name}`)
        return
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-900">Liên hệ phụ trách</h2>
        <p className="text-xs text-gray-400 mb-3">{khach.ma_khach}</p>

        {duplicateMsg ? (
          <>
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3.5 py-2.5">{duplicateMsg}</p>
            <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors">Đóng</button>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Họ tên *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={INPUT} placeholder="VD: Nguyễn Văn A" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">SĐT</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className={INPUT} placeholder="VD: 0912345678" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Ghi chú</label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} className={INPUT} />
              </div>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            <div className="flex items-center gap-2 mt-4">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors">Huỷ</button>
              <button onClick={save} disabled={saving || !name.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {saving && <Loader2 size={14} className="animate-spin" />} Lưu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

type PolicyForm = {
  nhom: string
  ma_khach: string
  ten_khach: string
  doi_tuong_quy_tac: string
  hinh_thuc_cong_no: string
  phi_xuat_ve: string
}

function policyFormFrom(k: Khach): PolicyForm {
  return {
    nhom: k.nhom,
    ma_khach: k.ma_khach,
    ten_khach: k.ten_khach ?? '',
    doi_tuong_quy_tac: k.doi_tuong_quy_tac ?? '',
    hinh_thuc_cong_no: k.hinh_thuc_cong_no ?? '',
    phi_xuat_ve: k.phi_xuat_ve ?? '',
  }
}

// Slide over bên phải — "Thông tin khách hàng" đầy đủ cho 1 mã khách: các
// field chính sách (nhóm/mã khách/tên khách/quy tắc/công nợ/phí xuất vé,
// sửa được qua nút Sửa/Huỷ/Lưu ngay trong panel), liên hệ CRM phụ trách
// (chỉ xem — đổi/gán qua ContactAssignModal riêng, không trộn vào đây),
// doanh thu/lợi nhuận, và ghi chú (lưu riêng).
function CustomerDetailPanel({
  khach,
  onClose,
  onSave,
  onOpenAssignContact,
}: {
  khach: Khach
  onClose: () => void
  onSave: (id: string, patch: Partial<Khach>) => Promise<boolean>
  onOpenAssignContact: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<'info' | 'policy'>('info')
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<PolicyForm>(() => policyFormFrom(khach))
  const [ghiChu, setGhiChu] = useState(khach.ghi_chu ?? '')
  const [savingGhiChu, setSavingGhiChu] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  function startEditing() {
    setForm(policyFormFrom(khach))
    setEditing(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ma_khach.trim()) return
    setSubmitting(true)
    try {
      const ok = await onSave(khach.id, {
        nhom: form.nhom,
        ma_khach: form.ma_khach.trim(),
        ten_khach: form.ten_khach.trim() || null,
        doi_tuong_quy_tac: form.doi_tuong_quy_tac.trim() || null,
        hinh_thuc_cong_no: form.hinh_thuc_cong_no.trim() || null,
        phi_xuat_ve: form.phi_xuat_ve.trim() || null,
      })
      if (ok) setEditing(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function saveGhiChu() {
    setSavingGhiChu(true)
    try {
      await onSave(khach.id, { ghi_chu: ghiChu.trim() || null })
    } finally {
      setSavingGhiChu(false)
    }
  }

  const c = khach.contact
  const contactRows: { label: string; value: string }[] = [
    { label: 'Nguồn', value: c?.source ? (SOURCE_LABELS[c.source] ?? c.source) : '—' },
    { label: 'Người làm việc', value: c?.name ?? '—' },
    { label: 'SĐT', value: c?.phone ?? '—' },
    { label: 'Tên công ty', value: c?.company ?? '—' },
    { label: 'Email', value: c?.email ?? '—' },
    { label: 'MST', value: c?.tax_code ?? '—' },
    { label: 'Ghi chú', value: c?.note ?? '—' },
  ]

  return createPortal(
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-150 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        className={`fixed inset-y-0 right-0 z-160 w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Thông tin khách hàng</p>
            <p className="font-bold text-gray-900 truncate">{khach.ma_khach}</p>
            <p className="text-xs text-gray-400 truncate">{NHOM_LABELS[khach.nhom] ?? khach.nhom}</p>
          </div>
          <button onClick={close} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 px-5 border-b border-gray-200 shrink-0">
          {([
            { key: 'info', label: 'Thông tin' },
            { key: 'policy', label: 'Chính sách' },
          ] as const).map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {tab === 'info' && (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Nhóm</p>
                  {editing ? (
                    <select value={form.nhom} onChange={e => setForm(f => ({ ...f, nhom: e.target.value }))} className={INPUT}>
                      {NHOM_OPTIONS.map(n => <option key={n} value={n}>{NHOM_LABELS[n]}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-800">{NHOM_LABELS[khach.nhom] ?? khach.nhom}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Mã khách</p>
                  {editing ? (
                    <input value={form.ma_khach} onChange={e => setForm(f => ({ ...f, ma_khach: e.target.value }))} className={INPUT} />
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">{khach.ma_khach}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Tên khách</p>
                  {editing ? (
                    <input value={form.ten_khach} onChange={e => setForm(f => ({ ...f, ten_khach: e.target.value }))} className={INPUT} />
                  ) : (
                    <p className="text-sm text-gray-800">{khach.ten_khach ?? '—'}</p>
                  )}
                </div>
              </div>
            )}

            {tab === 'policy' && (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Đối tượng áp dụng / Quy tắc đặt mã</p>
                  {editing ? (
                    <textarea rows={3} value={form.doi_tuong_quy_tac} onChange={e => setForm(f => ({ ...f, doi_tuong_quy_tac: e.target.value }))} className={INPUT} />
                  ) : (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{khach.doi_tuong_quy_tac ?? '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Hình thức công nợ</p>
                  {editing ? (
                    <textarea rows={2} value={form.hinh_thuc_cong_no} onChange={e => setForm(f => ({ ...f, hinh_thuc_cong_no: e.target.value }))} className={INPUT} />
                  ) : (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{khach.hinh_thuc_cong_no ?? '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Phí xuất vé</p>
                  {editing ? (
                    <textarea rows={2} value={form.phi_xuat_ve} onChange={e => setForm(f => ({ ...f, phi_xuat_ve: e.target.value }))} className={INPUT} />
                  ) : (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{khach.phi_xuat_ve ?? '—'}</p>
                  )}
                </div>
              </div>
            )}

            {editing ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors">Huỷ</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors">
                  {submitting && <Loader2 size={13} className="animate-spin" />} Lưu
                </button>
              </div>
            ) : (
              <button type="button" onClick={startEditing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <Pencil size={13} /> Sửa
              </button>
            )}

            {tab === 'info' && (
              <>
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Người phụ trách</p>
                    <button type="button" onClick={onOpenAssignContact} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                      {c ? 'Đổi liên hệ' : 'Thêm liên hệ'}
                    </button>
                  </div>
                  {!c ? (
                    <p className="text-sm text-gray-400">Chưa có liên hệ nào cho mã khách này.</p>
                  ) : (
                    <div className="space-y-3">
                      {contactRows.map(r => (
                        <div key={r.label}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{r.label}</p>
                          <p className="text-sm text-gray-800">{r.value}</p>
                        </div>
                      ))}
                      <p className="text-xs text-gray-400">Địa chỉ chưa hỗ trợ (nằm ở bảng Công ty bên CRM, chưa nối tới đây).</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Doanh thu / Lợi nhuận</p>
                  <p className="text-sm text-gray-800">{formatVND(khach.doanh_thu)} / <span className="text-emerald-600 font-semibold">{formatVND(khach.loi_nhuan)}</span></p>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Ghi chú</p>
                  <textarea
                    rows={4}
                    value={ghiChu}
                    onChange={e => setGhiChu(e.target.value)}
                    className={INPUT}
                  />
                  <button
                    type="button"
                    onClick={saveGhiChu}
                    disabled={savingGhiChu || ghiChu.trim() === (khach.ghi_chu ?? '')}
                    className="mt-2 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                  >
                    {savingGhiChu && <Loader2 size={13} className="animate-spin" />} Lưu ghi chú
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </>,
    document.body,
  )
}

// Danh mục mã khách chuẩn (kế toán VMB) — import từ file "Link nhập _
// Phòng vé HNS (Năm 2026).xlsx" (170 mã, xem migration_vmb_khach_hang.sql).
// Dùng để tra cứu/đối chiếu mã khách gõ tay ở "Đầu vào công nợ"/"Đầu vào
// sao kê"/tin nhắn Telegram — CHƯA nối tự động, chỉ là danh mục xem/quản lý.
export default function DanhMucKhachHangPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [rows, setRows] = useState<Khach[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterNhom, setFilterNhom] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formContact, setFormContact] = useState<Contact | null>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [viewingKhach, setViewingKhach] = useState<Khach | null>(null)
  const [assigningContactFor, setAssigningContactFor] = useState<Khach | null>(null)
  useEffect(() => setMounted(true), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/ve-may-bay/vmb-khach-hang')
      if (!res.ok) throw new Error('load failed')
      const { data } = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Danh mục khách hàng</span>)
    setOnRefresh(loadData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadData])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[r.nhom] = (c[r.nhom] ?? 0) + 1
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filterNhom && r.nhom !== filterNhom) return false
      if (q && !r.ma_khach.toLowerCase().includes(q) && !(r.ten_khach ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filterNhom, search])

  function openAdd() {
    setForm(emptyForm)
    setFormContact(null)
    setFormOpen(true)
  }

  async function save() {
    if (!form.ma_khach.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/ve-may-bay/vmb-khach-hang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, active: true }),
      })
      if (res.ok) {
        setFormOpen(false)
        loadData()
      }
    } finally {
      setSaving(false)
    }
  }

  // Lưu tổng quát cho CustomerDetailPanel/ContactAssignModal — patch chỉ
  // cần chứa field muốn đổi, hàm tự gộp với dòng hiện có rồi gửi NGUYÊN cả
  // dòng lên API (route yêu cầu đủ nhom/ma_khach), tránh làm mất dữ liệu ở
  // các field không đổi.
  async function saveKhach(id: string, patch: Partial<Khach>): Promise<boolean> {
    const k = rows.find(r => r.id === id)
    if (!k) return false
    const merged: Khach = { ...k, ...patch }
    const res = await fetch('/api/ve-may-bay/vmb-khach-hang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: merged.id,
        nhom: merged.nhom,
        ma_khach: merged.ma_khach,
        ten_khach: merged.ten_khach,
        doi_tuong_quy_tac: merged.doi_tuong_quy_tac,
        hinh_thuc_cong_no: merged.hinh_thuc_cong_no,
        phi_xuat_ve: merged.phi_xuat_ve,
        active: merged.active,
        contact_id: merged.contact_id,
        ghi_chu: merged.ghi_chu,
      }),
    })
    if (!res.ok) return false
    setRows(prev => prev.map(r => (r.id === id ? merged : r)))
    setViewingKhach(prev => (prev && prev.id === id ? merged : prev))
    return true
  }

  // "Phóng to": render qua Portal thẳng vào document.body, giống cách
  // /ve-may-bay/cong-no đang làm — thoát hẳn khỏi layout trang (Sidebar/
  // Topbar) để bảng nhiều cột ở chế độ "Đầy đủ" chiếm trọn màn hình. Chỉ
  // phóng to riêng khối bảng, KHÔNG kèm thanh tìm kiếm/bộ lọc phía trên.
  const tableSection = (
    <div className={expanded ? 'fixed inset-0 z-[100] bg-white flex flex-col' : 'bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container'}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-xs text-gray-400">{filtered.length.toLocaleString('vi-VN')} mã khách</span>
        <button onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-200 transition-colors">
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {expanded ? 'Thu nhỏ' : 'Phóng to'}
        </button>
      </div>
      <div className={expanded ? 'flex-1 overflow-auto' : 'overflow-x-auto'}>
        <table className="w-full text-sm list-table">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Nguồn', 'Phân loại', 'Mã khách', 'Tên khách', 'Người làm việc', 'Doanh thu', 'Lợi nhuận'].map(h => (
                <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${h === 'Doanh thu' || h === 'Lợi nhuận' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={7} className="px-5 py-14 text-center">
                <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-14 text-center text-gray-400">Không có mã khách nào khớp bộ lọc.</td></tr>
            ) : filtered.map(k => (
              <tr key={k.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{k.contact?.source ? (SOURCE_LABELS[k.contact.source] ?? k.contact.source) : '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-gray-500" title={NHOM_LABELS[k.nhom] ?? k.nhom}>{NHOM_SHORT_LABELS[k.nhom] ?? k.nhom}</td>
                <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-gray-800">
                  <span className="inline-flex items-center gap-1.5">
                    {k.ma_khach}
                    <button
                      onClick={() => setViewingKhach(k)}
                      title="Xem chi tiết"
                      className="p-1 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      <Eye size={13} />
                    </button>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate" title={k.ten_khach ?? ''}>{k.ten_khach ?? '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {k.contact ? (
                    <button
                      onClick={() => setAssigningContactFor(k)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-medium hover:border-brand-300 hover:text-brand-600 transition-colors"
                    >
                      <User size={12} className="text-gray-400" />{k.contact.name}
                    </button>
                  ) : (
                    <button
                      onClick={() => setAssigningContactFor(k)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                    >
                      <Plus size={12} />
                      Thêm liên hệ
                    </button>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold text-gray-800">{formatVND(k.doanh_thu)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold text-emerald-600">{formatVND(k.loi_nhuan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const formModal = formOpen && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4" onClick={() => setFormOpen(false)}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-900 mb-3">Thêm khách hàng</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nhóm *</label>
            <select value={form.nhom} onChange={e => setForm(f => ({ ...f, nhom: e.target.value }))} className={INPUT}>
              {NHOM_OPTIONS.map(n => <option key={n} value={n}>{NHOM_LABELS[n]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Mã khách *</label>
            <input value={form.ma_khach} onChange={e => setForm(f => ({ ...f, ma_khach: e.target.value }))} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tên khách</label>
            <input value={form.ten_khach} onChange={e => setForm(f => ({ ...f, ten_khach: e.target.value }))} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Đối tượng áp dụng / Quy tắc đặt mã</label>
            <textarea rows={3} value={form.doi_tuong_quy_tac} onChange={e => setForm(f => ({ ...f, doi_tuong_quy_tac: e.target.value }))} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hình thức công nợ</label>
            <textarea rows={2} value={form.hinh_thuc_cong_no} onChange={e => setForm(f => ({ ...f, hinh_thuc_cong_no: e.target.value }))} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Phí xuất vé</label>
            <textarea rows={2} value={form.phi_xuat_ve} onChange={e => setForm(f => ({ ...f, phi_xuat_ve: e.target.value }))} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Người làm việc (liên hệ CRM)</label>
            <ContactPicker
              selected={formContact}
              onSelect={c => { setFormContact(c); setForm(f => ({ ...f, contact_id: c?.id ?? null })) }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => setFormOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors">Huỷ</button>
          <button onClick={save} disabled={saving || !form.ma_khach.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving && <Loader2 size={14} className="animate-spin" />} Lưu
          </button>
        </div>
      </div>
    </div>
  )

  const customerDetailPanel = viewingKhach && (
    <CustomerDetailPanel
      khach={viewingKhach}
      onClose={() => setViewingKhach(null)}
      onSave={saveKhach}
      onOpenAssignContact={() => setAssigningContactFor(viewingKhach)}
    />
  )

  const contactAssignModal = assigningContactFor && (
    <ContactAssignModal
      khach={assigningContactFor}
      onClose={() => setAssigningContactFor(null)}
      onAssigned={c => saveKhach(assigningContactFor.id, { contact_id: c.id, contact: c })}
    />
  )

  if (expanded && mounted) {
    return createPortal(
      <>
        {tableSection}
        {formModal}
        {customerDetailPanel}
        {contactAssignModal}
      </>,
      document.body,
    )
  }

  return (
    <div className="p-5 space-y-4">
      {formModal}
      {customerDetailPanel}
      {contactAssignModal}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-400">Mã khách chuẩn để đối chiếu với Đầu vào công nợ/sao kê/tin nhắn Telegram.</p>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={15} /> Thêm khách
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã khách, tên khách..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setFilterNhom('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!filterNhom ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Tất cả <span className="opacity-70">{rows.length}</span>
        </button>
        {NHOM_OPTIONS.map(n => (
          <button key={n} onClick={() => setFilterNhom(filterNhom === n ? '' : n)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterNhom === n ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {NHOM_LABELS[n]} <span className="opacity-70">{counts[n] ?? 0}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-400">{filtered.length.toLocaleString('vi-VN')} mã khách</p>

      {tableSection}
    </div>
  )
}
