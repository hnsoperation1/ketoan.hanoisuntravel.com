'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Plus, Loader2, Search, X, User, Maximize2, Minimize2 } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'

type Contact = {
  id: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  tax_code: string | null
  source: string | null
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formContact, setFormContact] = useState<Contact | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'co_ban' | 'day_du'>('co_ban')
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
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
    setEditingId(null)
    setForm(emptyForm)
    setFormContact(null)
    setFormOpen(true)
  }

  function openEdit(k: Khach) {
    setEditingId(k.id)
    setForm({
      nhom: k.nhom,
      ma_khach: k.ma_khach,
      ten_khach: k.ten_khach ?? '',
      doi_tuong_quy_tac: k.doi_tuong_quy_tac ?? '',
      hinh_thuc_cong_no: k.hinh_thuc_cong_no ?? '',
      phi_xuat_ve: k.phi_xuat_ve ?? '',
      contact_id: k.contact_id,
    })
    setFormContact(k.contact)
    setFormOpen(true)
  }

  async function save() {
    if (!form.ma_khach.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/ve-may-bay/vmb-khach-hang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form, active: true }),
      })
      if (res.ok) {
        setFormOpen(false)
        loadData()
      }
    } finally {
      setSaving(false)
    }
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
        {viewMode === 'co_ban' ? (
          <table className="w-full text-sm list-table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Nhóm', 'Mã khách', 'Tên khách', 'Đối tượng & quy tắc', 'Hình thức công nợ', 'Phí xuất vé', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{NHOM_LABELS[k.nhom] ?? k.nhom}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-gray-800">{k.ma_khach}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-[220px] truncate" title={k.ten_khach ?? ''}>{k.ten_khach ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[240px] truncate" title={k.doi_tuong_quy_tac ?? ''}>{k.doi_tuong_quy_tac ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[240px] truncate" title={k.hinh_thuc_cong_no ?? ''}>{k.hinh_thuc_cong_no ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[240px] truncate" title={k.phi_xuat_ve ?? ''}>{k.phi_xuat_ve ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(k)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm list-table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Nguồn', 'Phân loại', 'Mã khách', 'Người làm việc', 'SĐT', 'Tên cty', 'Email', 'Địa chỉ', 'MST', 'Doanh thu', 'Lợi nhuận', ''].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${h === 'Doanh thu' || h === 'Lợi nhuận' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={12} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={12} className="px-5 py-14 text-center">
                  <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                  <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="px-5 py-14 text-center text-gray-400">Không có mã khách nào khớp bộ lọc.</td></tr>
              ) : filtered.map(k => (
                <tr key={k.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{k.contact?.source ? (SOURCE_LABELS[k.contact.source] ?? k.contact.source) : '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-500" title={NHOM_LABELS[k.nhom] ?? k.nhom}>{NHOM_SHORT_LABELS[k.nhom] ?? k.nhom}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-gray-800">{k.ma_khach}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                    {k.contact ? (
                      <span className="inline-flex items-center gap-1"><User size={12} className="text-gray-300" />{k.contact.name}</span>
                    ) : (
                      <button onClick={() => openEdit(k)} className="text-gray-300 hover:text-brand-600 text-xs">+ Thêm liên hệ</button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{k.contact?.phone ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[200px] truncate" title={k.contact?.company ?? ''}>{k.contact?.company ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[200px] truncate" title={k.contact?.email ?? ''}>{k.contact?.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[200px] truncate">—</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{k.contact?.tax_code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold text-gray-800">{formatVND(k.doanh_thu)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold text-emerald-600">{formatVND(k.loi_nhuan)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(k)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  const formModal = formOpen && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4" onClick={() => setFormOpen(false)}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-900 mb-3">{editingId ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h2>
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

  if (expanded && mounted) {
    return createPortal(
      <>
        {tableSection}
        {formModal}
      </>,
      document.body,
    )
  }

  return (
    <div className="p-5 space-y-4">
      {formModal}
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

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-400">{filtered.length.toLocaleString('vi-VN')} mã khách</p>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setViewMode('co_ban')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${viewMode === 'co_ban' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
            Cơ bản
          </button>
          <button onClick={() => setViewMode('day_du')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${viewMode === 'day_du' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
            Đầy đủ
          </button>
        </div>
      </div>

      {tableSection}
    </div>
  )
}
