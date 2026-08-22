'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Loader2, X, MapPin, Users, CalendarDays, Table2, LayoutGrid, Search } from 'lucide-react'
import type { Doan } from '@/types'
import { formatDateVN } from '@/lib/format'
import { useTopbar } from '@/contexts/topbar'
import DateInput from '@/components/DateInput'
import { useResizableColumns } from '@/hooks/useResizableColumns'

const DOAN_COLS = [
  { key: 'doan', label: 'Đoàn', width: 240 },
  { key: 'tuyen', label: 'Tuyến du lịch', width: 220 },
  { key: 'ngay_di', label: 'Ngày đi', width: 120 },
  { key: 'ngay_ve', label: 'Ngày về', width: 120 },
  { key: 'so_khach', label: 'Số khách dự kiến', align: 'right' as const, width: 140 },
]

const EMPTY_FORM = {
  ten_doan: '',
  hanh_trinh: '',
  ngay_di: '',
  ngay_ve: '',
  sl_khach: '',
  loai_doan: 'tour' as 'tour' | 'su_kien',
  ten_chuong_trinh: '',
  thoi_gian_chuong_trinh: '',
  dia_diem_chuong_trinh: '',
}

export default function QuyetToanTourPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [doanList, setDoanList] = useState<Doan[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table')
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState<'' | 'tour' | 'su_kien'>('')
  const [filterNguon, setFilterNguon] = useState<'' | 'crm' | 'tay'>('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/doan')
    if (res.ok) {
      const { doan } = await res.json()
      setDoanList(doan)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách đoàn khi mount, pattern chuẩn cho fetch-on-mount
    void load()
  }, [load])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Danh sách đoàn</span>)
    setOnRefresh(load)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/doan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ten_doan: form.ten_doan.trim(),
        hanh_trinh: form.hanh_trinh.trim() || null,
        ngay_di: form.ngay_di,
        ngay_ve: form.ngay_ve || null,
        sl_khach: form.sl_khach ? Number(form.sl_khach) : null,
        loai_doan: form.loai_doan,
        ten_chuong_trinh: form.ten_chuong_trinh.trim() || null,
        thoi_gian_chuong_trinh: form.thoi_gian_chuong_trinh.trim() || null,
        dia_diem_chuong_trinh: form.dia_diem_chuong_trinh.trim() || null,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error ?? 'Có lỗi xảy ra')
      return
    }
    setShowForm(false)
    setForm(EMPTY_FORM)
    load()
  }

  const filtered = doanList.filter(d => {
    if (filterLoai && d.loai_doan !== filterLoai) return false
    if (filterNguon === 'crm' && !d.opportunity_id) return false
    if (filterNguon === 'tay' && d.opportunity_id) return false
    const q = search.trim().toLowerCase()
    if (q && !`${d.ten_doan} ${d.hanh_trinh ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
  const { widths: doanWidths, startResize: startDoanResize } = useResizableColumns('doan-list', Object.fromEntries(DOAN_COLS.map(c => [c.key, c.width])))
  const doanTotalWidth = DOAN_COLS.reduce((sum, c) => sum + (doanWidths[c.key] ?? c.width), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Danh sách đoàn tour</h1>
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([
              { key: 'card', icon: LayoutGrid, title: 'Thẻ' },
              { key: 'table', icon: Table2, title: 'Bảng (giống Excel)' },
            ] as const).map(v => (
              <button key={v.key} type="button" title={v.title} onClick={() => setViewMode(v.key)}
                className={`p-1.5 rounded-md transition-colors ${viewMode === v.key ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                <v.icon size={14} />
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={16} strokeWidth={2.5} /> Thêm đoàn
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên đoàn, tuyến du lịch..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <button onClick={() => setFilterLoai('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!filterLoai ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Tất cả <span className="opacity-70">{doanList.length}</span>
        </button>
        <button onClick={() => setFilterLoai(filterLoai === 'tour' ? '' : 'tour')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterLoai === 'tour' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Tour <span className="opacity-70">{doanList.filter(d => d.loai_doan === 'tour').length}</span>
        </button>
        <button onClick={() => setFilterLoai(filterLoai === 'su_kien' ? '' : 'su_kien')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterLoai === 'su_kien' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Sự kiện <span className="opacity-70">{doanList.filter(d => d.loai_doan === 'su_kien').length}</span>
        </button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button onClick={() => setFilterNguon(filterNguon === 'crm' ? '' : 'crm')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterNguon === 'crm' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Từ CRM <span className="opacity-70">{doanList.filter(d => d.opportunity_id).length}</span>
        </button>
        <button onClick={() => setFilterNguon(filterNguon === 'tay' ? '' : 'tay')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterNguon === 'tay' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Tạo tay <span className="opacity-70">{doanList.filter(d => !d.opportunity_id).length}</span>
        </button>
      </div>

      <p className="text-sm text-gray-400 mb-3">{filtered.length.toLocaleString('vi-VN')} đoàn</p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-300" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          {doanList.length === 0 ? <>Chưa có đoàn nào. Nhấn &quot;Thêm đoàn&quot; để bắt đầu.</> : 'Không có đoàn nào khớp bộ lọc.'}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
          <div className="overflow-x-auto">
            <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: doanTotalWidth }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {DOAN_COLS.map(c => (
                    <th key={c.key} style={{ width: doanWidths[c.key] ?? c.width }}
                      className={`relative px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {c.label}
                      <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startDoanResize(c.key, e)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/doan/${d.id}`} className="flex items-center gap-2 font-semibold text-gray-900 hover:text-brand-600 hover:underline decoration-gray-300 transition-colors">
                        {d.ten_doan}
                        {d.loai_doan === 'su_kien' && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-accent-50 text-accent-600 shrink-0">Sự kiện</span>
                        )}
                        {d.opportunity_id && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 shrink-0">Từ CRM</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[280px] truncate" title={d.hanh_trinh ?? ''}>{d.hanh_trinh ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDateVN(d.ngay_di)}</td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{d.ngay_ve ? formatDateVN(d.ngay_ve) : '—'}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-gray-700 font-semibold">{d.sl_khach ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((d) => (
            <Link
              key={d.id}
              href={`/doan/${d.id}`}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-brand-300 transition-colors"
            >
              <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-gray-400 font-semibold">Đoàn: </span>
                {d.ten_doan}
                {d.loai_doan === 'su_kien' && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-accent-50 text-accent-600">Sự kiện</span>
                )}
                {d.opportunity_id && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600">Từ CRM</span>
                )}
              </div>
              <div className="space-y-1.5 text-sm text-gray-900">
                {d.hanh_trinh && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-gray-400 shrink-0" />
                    <span className="text-gray-400">Tuyến du lịch:</span> {d.hanh_trinh}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={13} className="text-gray-400 shrink-0" />
                  <span className="text-gray-400">Ngày:</span> {formatDateVN(d.ngay_di)}
                  {d.ngay_ve ? ` – ${formatDateVN(d.ngay_ve)}` : ''}
                </div>
                {d.sl_khach != null && (
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-gray-400 shrink-0" />
                    <span className="text-gray-400">Số lượng khách dự kiến:</span> {d.sl_khach}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Thêm đoàn mới</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <Field label="Tên đoàn" required>
                  <input
                    type="text"
                    required
                    placeholder="VD: Công ty Trung Kiên - Sầm Sơn"
                    value={form.ten_doan}
                    onChange={(e) => setForm((f) => ({ ...f, ten_doan: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Loại đoàn">
                  <div className="flex gap-2">
                    {(['tour', 'su_kien'] as const).map((lo) => (
                      <button
                        key={lo}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, loai_doan: lo }))}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                          form.loai_doan === lo ? 'bg-accent-50 border-accent-300 text-accent-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {lo === 'tour' ? 'Tour' : 'Sự kiện'}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Hành trình">
                  <input
                    type="text"
                    placeholder="VD: Hà Nội - Sầm Sơn - Hà Nội"
                    value={form.hanh_trinh}
                    onChange={(e) => setForm((f) => ({ ...f, hanh_trinh: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ngày đi" required>
                    <DateInput value={form.ngay_di} onChange={(v) => setForm((f) => ({ ...f, ngay_di: v }))} className="w-full" />
                  </Field>
                  <Field label="Ngày về">
                    <DateInput value={form.ngay_ve} onChange={(v) => setForm((f) => ({ ...f, ngay_ve: v }))} className="w-full" />
                  </Field>
                </div>
                <Field label="Số khách dự kiến">
                  <input
                    type="number"
                    min={0}
                    value={form.sl_khach}
                    onChange={(e) => setForm((f) => ({ ...f, sl_khach: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                {form.loai_doan === 'su_kien' && (
                  <>
                    <Field label="Tên chương trình">
                      <input
                        type="text"
                        placeholder="VD: Biểu diễn múa khai mạc"
                        value={form.ten_chuong_trinh}
                        onChange={(e) => setForm((f) => ({ ...f, ten_chuong_trinh: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Thời gian tổ chức">
                      <input
                        type="text"
                        placeholder="VD: 19h00 ngày 20/09/2026"
                        value={form.thoi_gian_chuong_trinh}
                        onChange={(e) => setForm((f) => ({ ...f, thoi_gian_chuong_trinh: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Địa điểm tổ chức">
                      <input
                        type="text"
                        placeholder="VD: Trung tâm hội nghị quốc gia"
                        value={form.dia_diem_chuong_trinh}
                        onChange={(e) => setForm((f) => ({ ...f, dia_diem_chuong_trinh: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  </>
                )}
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    Thêm đoàn
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Huỷ
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const inputCls =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}
