'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Search, X } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { useResizableColumns } from '@/hooks/useResizableColumns'

const PHAT_SINH_COLS = [
  { key: 'ngay_xuat', label: 'Ngày xuất', width: 110 },
  { key: 'so_ve', label: 'Số vé', width: 130 },
  { key: 'hanh_khach', label: 'Hành khách', width: 180 },
  { key: 'hanh_trinh', label: 'Hành trình', width: 180 },
  { key: 'gia_ban', label: 'Giá bán', align: 'right' as const, width: 130 },
]
const DA_THU_COLS = [
  { key: 'ngay', label: 'Ngày', width: 110 },
  { key: 'noi_dung', label: 'Nội dung CK', width: 260 },
  { key: 'stk', label: 'STK nhận', width: 160 },
  { key: 'so_tien', label: 'Số tiền', align: 'right' as const, width: 130 },
]
const CN_KH_COLS = [
  { key: 'ma_khach', label: 'Mã khách', width: 160 },
  { key: 'tong_gia_ban', label: 'Tổng giá bán', align: 'right' as const, width: 150 },
  { key: 'tong_da_thu', label: 'Tổng đã thu', align: 'right' as const, width: 150 },
  { key: 'cong_no', label: 'Công nợ', align: 'right' as const, width: 150 },
]

type PhatSinhRow = { ticket_no: string | null; pax_name: string | null; issued_date: string | null; routing: string | null; gia_ban: number | null }
type DaThuRow = { ngay: string | null; dien_giai: string | null; thu: number | null; tai_khoan: string | null }
type KhRow = {
  ma_khach: string
  nhom: string | null
  tong_phat_sinh: number
  tong_da_thu: number
  cong_no: number
  phat_sinh_rows: PhatSinhRow[]
  da_thu_rows: DaThuRow[]
}

// Khớp đúng NHOM_LABELS ở /ve-may-bay/danh-muc-khach-hang — copy vì mỗi
// trang tự đứng riêng, không import chéo giữa 2 page.
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
const CHUA_PHAN_LOAI = 'Chưa phân loại'
function nhomLabel(nhom: string | null): string {
  return nhom ? (NHOM_LABELS[nhom] ?? nhom) : CHUA_PHAN_LOAI
}

function formatTien(n: number): string {
  return Math.round(n).toLocaleString('vi-VN')
}

// Slide over bên phải — chi tiết công nợ 1 mã khách (Bookings + Đã thu),
// thay cho accordion inline/panel tách rời bên dưới bảng trước đây (2 cách
// hiển thị cũ đều gây rối/xa dòng vừa bấm, nhất là từ khi bảng dài ra do
// phân nhóm — đổi hẳn sang slide over 2026-08-13, khớp cách "xem chi tiết"
// đã dùng ở các trang khác trong app).
function KhachDetailSlideOver({ row, onClose }: { row: KhRow; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<'bookings' | 'sao_ke'>('bookings')
  const { widths: psWidths, startResize: startPsResize } = useResizableColumns('cn-kh-phat-sinh', Object.fromEntries(PHAT_SINH_COLS.map(c => [c.key, c.width])))
  const psTotalWidth = PHAT_SINH_COLS.reduce((sum, c) => sum + (psWidths[c.key] ?? c.width), 0)
  const { widths: dtWidths, startResize: startDtResize } = useResizableColumns('cn-kh-da-thu', Object.fromEntries(DA_THU_COLS.map(c => [c.key, c.width])))
  const dtTotalWidth = DA_THU_COLS.reduce((sum, c) => sum + (dtWidths[c.key] ?? c.width), 0)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return createPortal(
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-150 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        className={`fixed inset-y-0 right-0 z-160 w-full max-w-4xl bg-white shadow-2xl flex flex-col transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Chi tiết công nợ</p>
            <p className="font-bold text-gray-900 text-lg truncate">{row.ma_khach}</p>
            <p className="text-xs text-gray-400 truncate">{nhomLabel(row.nhom)}</p>
          </div>
          <button onClick={close} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 text-sm shrink-0">
          <span className="text-gray-900 font-semibold">Giá bán: {formatTien(row.tong_phat_sinh)}</span>
          <span className="text-emerald-600 font-semibold">Đã thu: {formatTien(row.tong_da_thu)}</span>
          <span className={`font-semibold ${row.cong_no > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Công nợ: {formatTien(row.cong_no)}</span>
        </div>

        <div className="flex items-center gap-1 px-6 border-b border-gray-200 shrink-0">
          {([
            { key: 'bookings', label: `Bảng kê (${row.phat_sinh_rows.length})` },
            { key: 'sao_ke', label: `Sao kê (${row.da_thu_rows.length})` },
          ] as const).map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'bookings' ? (
            row.phat_sinh_rows.length === 0 ? (
              <p className="text-sm text-gray-400">Không có dòng nào.</p>
            ) : (
              <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
                <div className="overflow-x-auto">
                <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: psTotalWidth }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {PHAT_SINH_COLS.map(c => (
                        <th key={c.key} style={{ width: psWidths[c.key] ?? c.width }}
                          className={`relative px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {c.label}
                          <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startPsResize(c.key, e)} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...row.phat_sinh_rows].sort((a, b) => (a.issued_date ?? '').localeCompare(b.issued_date ?? '')).map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">{d.issued_date ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">{d.ticket_no ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">{d.pax_name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">{d.routing ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap text-right">{formatTien(d.gia_ban ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )
          ) : (
            row.da_thu_rows.length === 0 ? (
              <p className="text-sm text-gray-400">Không có dòng nào.</p>
            ) : (
              <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
                <div className="overflow-x-auto">
                <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: dtTotalWidth }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {DA_THU_COLS.map(c => (
                        <th key={c.key} style={{ width: dtWidths[c.key] ?? c.width }}
                          className={`relative px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {c.label}
                          <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startDtResize(c.key, e)} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...row.da_thu_rows].sort((a, b) => (a.ngay ?? '').localeCompare(b.ngay ?? '')).map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">{d.ngay ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-900" title={d.dien_giai ?? ''}>{d.dien_giai ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">{d.tai_khoan ?? '—'}</td>
                        <td className="px-4 py-2.5 text-emerald-600 whitespace-nowrap text-right">{formatTien(d.thu ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

// Báo cáo tổng hợp — không phải nơi nhập liệu. Tổng phát sinh cộng dồn từ
// gia_ban trong "Đầu vào công nợ" (/ve-may-bay/cong-no-ncc, lọc theo
// issued_date), tổng đã thu cộng dồn từ thu trong "Đầu vào sao kê"
// (/ve-may-bay/sao-ke, lọc theo ngay), nối theo mã khách — xem chú thích
// nối dữ liệu trong route GET.
//
// Gọi API theo TỪNG THÁNG + cache trong RAM (cùng cách với /ve-may-bay/
// sao-ke-tk) — tháng đã xem rồi thì bấm lại không gọi API nữa. RIÊNG
// tháng hiện tại luôn gọi API mới mỗi lần chọn (dữ liệu tháng này còn
// đang phát sinh/đồng bộ thêm), không dùng cache.
//
// Chỉ hiện khách CÒN công nợ (cong_no != 0) — khách đã tất toán đúng 0đ
// trong tháng đó bị ẩn khỏi bảng, đỡ rác mắt (xem filtered bên dưới).
export default function CongNoKhachHangPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const [selected, setSelected] = useState({ year: currentYear, month: currentMonth })
  const [rows, setRows] = useState<KhRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterNhom, setFilterNhom] = useState('')
  const [viewingMaKhach, setViewingMaKhach] = useState<string | null>(null)

  const cacheRef = useRef<Map<string, KhRow[]>>(new Map())

  const loadMonth = useCallback(async (year: number, month: number, force = false) => {
    const key = `${year}-${month}`
    const isCurrent = year === currentYear && month === currentMonth
    if (!isCurrent && !force && cacheRef.current.has(key)) {
      setRows(cacheRef.current.get(key)!)
      setLoadError(false)
      return
    }
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch(`/api/ve-may-bay/cong-no-khach-hang?year=${year}&month=${month}`)
      if (!res.ok) throw new Error('load failed')
      const { data } = await res.json()
      const list: KhRow[] = Array.isArray(data) ? data : []
      cacheRef.current.set(key, list)
      setRows(list)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [currentYear, currentMonth])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMonth(selected.year, selected.month)
  }, [selected, loadMonth])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Công nợ KH</span>)
    setOnRefresh(() => loadMonth(selected.year, selected.month, true))
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadMonth, selected])

  const withDebt = useMemo(() => rows.filter(r => r.cong_no !== 0), [rows]) // đã tất toán = 0 thì ẩn

  const nhomCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of withDebt) c[r.nhom ?? ''] = (c[r.nhom ?? ''] ?? 0) + 1
    return c
  }, [withDebt])

  // Nhóm theo phân loại (sắp xếp lại) rồi mới sắp công nợ giảm dần TRONG
  // từng nhóm — để dòng phân cách nhóm bên dưới ăn khớp.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return withDebt
      .filter(r => {
        if (filterNhom && (r.nhom ?? '') !== filterNhom) return false
        if (q && !r.ma_khach.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        const la = nhomLabel(a.nhom)
        const lb = nhomLabel(b.nhom)
        return la !== lb ? la.localeCompare(lb) : b.cong_no - a.cong_no
      })
  }, [withDebt, filterNhom, search])

  const tongPhatSinh = useMemo(() => filtered.reduce((s, r) => s + r.tong_phat_sinh, 0), [filtered])
  const tongDaThu = useMemo(() => filtered.reduce((s, r) => s + r.tong_da_thu, 0), [filtered])
  const tongCongNo = tongPhatSinh - tongDaThu
  const viewingRow = viewingMaKhach ? filtered.find(r => r.ma_khach === viewingMaKhach) ?? null : null
  const { widths: cnKhWidths, startResize: startCnKhResize } = useResizableColumns('cong-no-khach-hang', Object.fromEntries(CN_KH_COLS.map(c => [c.key, c.width])))
  const cnKhTotalWidth = CN_KH_COLS.reduce((sum, c) => sum + (cnKhWidths[c.key] ?? c.width), 0)

  return (
    <div className="px-5 pt-2 pb-5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={`${selected.year}-${selected.month}`}
          onChange={e => {
            const [y, m] = e.target.value.split('-').map(Number)
            setSelected({ year: y, month: m })
          }}
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-white text-gray-600 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400">
          {MONTH_OPTIONS.map(o => (
            <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
              Tháng {o.month}/{o.year}{o.year === currentYear && o.month === currentMonth ? ' (hiện tại)' : ''}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã khách..."
            className="pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64" />
          {search && (
            <button onClick={() => setSearch('')} title="Bỏ tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => loadMonth(selected.year, selected.month, true)} title="Làm mới" className="ml-auto p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setFilterNhom('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!filterNhom ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Tất cả <span className="opacity-70">{withDebt.length}</span>
        </button>
        {[...Object.keys(NHOM_LABELS), ''].filter(n => nhomCounts[n]).map(n => (
          <button key={n || 'chua-phan-loai'} onClick={() => setFilterNhom(filterNhom === n ? '' : n)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterNhom === n ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {nhomLabel(n || null)} <span className="opacity-70">{nhomCounts[n] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="text-gray-400">{filtered.length.toLocaleString('vi-VN')} khách</span>
        <span className="text-gray-600 font-semibold">Tổng giá bán: {formatTien(tongPhatSinh)}</span>
        <span className="text-emerald-600 font-semibold">Đã thu: {formatTien(tongDaThu)}</span>
        <span className={`font-semibold ${tongCongNo > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Công nợ: {formatTien(tongCongNo)}</span>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
        <div className="overflow-x-auto">
          <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: cnKhTotalWidth }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {CN_KH_COLS.map(c => (
                  <th key={c.key} style={{ width: cnKhWidths[c.key] ?? c.width }}
                    className={`relative px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none bg-gray-50 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {c.label}
                    <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startCnKhResize(c.key, e)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={4} className="px-5 py-14 text-center">
                  <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                  <button onClick={() => loadMonth(selected.year, selected.month, true)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-14 text-center text-gray-400">Không có dòng nào khớp bộ lọc.</td></tr>
              ) : filtered.map((r, i) => {
                const groupLabel = nhomLabel(r.nhom)
                const showGroupHeader = i === 0 || groupLabel !== nhomLabel(filtered[i - 1].nhom)
                return (
                  <Fragment key={r.ma_khach}>
                    {showGroupHeader && (
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          {groupLabel} <span className="font-normal normal-case text-gray-300">({nhomCounts[r.nhom ?? ''] ?? 0})</span>
                        </td>
                      </tr>
                    )}
                    <tr
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                      onClick={() => setViewingMaKhach(r.ma_khach)}
                    >
                      <td className="px-4 py-2 text-gray-700 font-medium whitespace-nowrap">{r.ma_khach}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap text-right">{formatTien(r.tong_phat_sinh)}</td>
                      <td className="px-4 py-2 text-emerald-600 whitespace-nowrap text-right">{formatTien(r.tong_da_thu)}</td>
                      <td className={`px-4 py-2 whitespace-nowrap text-right font-semibold ${r.cong_no > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatTien(r.cong_no)}</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {viewingRow && <KhachDetailSlideOver row={viewingRow} onClose={() => setViewingMaKhach(null)} />}
    </div>
  )
}
