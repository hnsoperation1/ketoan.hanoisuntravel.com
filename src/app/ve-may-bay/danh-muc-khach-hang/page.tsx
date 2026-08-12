'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Plus, Loader2, Search } from 'lucide-react'

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

const INPUT = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white placeholder:text-gray-300'

const emptyForm = { nhom: 'khach_le', ma_khach: '', ten_khach: '', doi_tuong_quy_tac: '', hinh_thuc_cong_no: '', phi_xuat_ve: '' }

// Danh mục mã khách chuẩn (kế toán VMB) — import từ file "Link nhập _
// Phòng vé HNS (Năm 2026).xlsx" (170 mã, xem migration_vmb_khach_hang.sql).
// Dùng để tra cứu/đối chiếu mã khách gõ tay ở "Đầu vào công nợ"/"Đầu vào
// sao kê"/tin nhắn Telegram — CHƯA nối tự động, chỉ là danh mục xem/quản lý.
export default function DanhMucKhachHangPage() {
  const [rows, setRows] = useState<Khach[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterNhom, setFilterNhom] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

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
    })
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

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Danh mục khách hàng VMB</h1>
          <p className="text-sm text-gray-400 mt-0.5">Mã khách chuẩn để đối chiếu với Đầu vào công nợ/sao kê/tin nhắn Telegram.</p>
        </div>
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

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setFormOpen(false)}>
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
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container">
        <div className="overflow-x-auto">
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
        </div>
      </div>
    </div>
  )
}
