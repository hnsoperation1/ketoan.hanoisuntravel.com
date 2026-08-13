'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { RefreshCw, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { useTheme } from '@/contexts/theme'
import { useTopbar } from '@/contexts/topbar'

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

// Dùng chung cho cả 2 cách hiển thị chi tiết 1 khách: accordion inline
// (giao diện mặc định) và panel tách đôi bên dưới bảng (giao diện dày đặc
// — xem contexts/theme.tsx) — cùng 1 dữ liệu, chỉ khác VỊ TRÍ render.
function DetailPanels({ row }: { row: KhRow }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Bookings ({row.phat_sinh_rows.length})</div>
        {row.phat_sinh_rows.length === 0 ? (
          <p className="text-xs text-gray-300">Không có dòng nào.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-400">Ngày xuất</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-400">Số vé</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-400">Hành khách</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-400">Hành trình</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-gray-400">Giá bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...row.phat_sinh_rows].sort((a, b) => (a.issued_date ?? '').localeCompare(b.issued_date ?? '')).map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{d.issued_date ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{d.ticket_no ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{d.pax_name ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{d.routing ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap text-right">{formatTien(d.gia_ban ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div>
        <div className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Đã thu ({row.da_thu_rows.length})</div>
        {row.da_thu_rows.length === 0 ? (
          <p className="text-xs text-gray-300">Không có dòng nào.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-400">Ngày</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-400">Nội dung CK</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-400">STK nhận</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-gray-400">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...row.da_thu_rows].sort((a, b) => (a.ngay ?? '').localeCompare(b.ngay ?? '')).map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{d.ngay ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 max-w-[220px] truncate" title={d.dien_giai ?? ''}>{d.dien_giai ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{d.tai_khoan ?? '—'}</td>
                    <td className="px-3 py-1.5 text-emerald-600 whitespace-nowrap text-right">{formatTien(d.thu ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Báo cáo tổng hợp — không phải nơi nhập liệu. Tổng phát sinh cộng dồn từ
// gia_ban trong "Đầu vào công nợ" (/ve-may-bay/cong-no, lọc theo
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
  const { theme } = useTheme()
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Chỉ dùng khi theme === 'dense' — chọn 1 khách để hiện panel chi tiết
  // tách đôi bên dưới bảng, thay cho accordion inline (theme mặc định).
  const [selectedMaKhach, setSelectedMaKhach] = useState<string | null>(null)

  function toggleExpand(maKhach: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(maKhach)) next.delete(maKhach)
      else next.add(maKhach)
      return next
    })
  }

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

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <button onClick={() => loadMonth(selected.year, selected.month, true)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={`${selected.year}-${selected.month}`}
          onChange={e => {
            const [y, m] = e.target.value.split('-').map(Number)
            setSelected({ year: y, month: m })
          }}
          className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 border-none focus:outline-none focus:ring-2 focus:ring-brand-400">
          {MONTH_OPTIONS.map(o => (
            <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
              Tháng {o.month}/{o.year}{o.year === currentYear && o.month === currentMonth ? ' (hiện tại)' : ''}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã khách..."
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64" />
        </div>
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container">
        {/* Trước đây bọc thêm maxHeight: calc(100vh - 320px) + scroll dọc
            riêng cho div này — tạo ra 2 vùng scroll dọc lồng nhau (vùng này
            và <main> ở AppShell.tsx, vốn đã overflow-y-auto cho toàn trang).
            Trang này có hàng mở rộng (bookings/đã thu) cao thấp thất thường
            theo từng khách bấm mở, calc cố định không theo kịp nên thanh
            cuộn dọc lồng bị lệch/ngắn bất thường. Bỏ scroll dọc riêng, chỉ
            giữ overflow-x-auto cho bảng rộng — để duy nhất <main> cuộn dọc. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm list-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Mã khách', 'Tổng giá bán', 'Tổng đã thu', 'Công nợ'].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50 ${h === 'Mã khách' ? 'text-left' : 'text-right'}`}>{h}</th>
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
                // Giao diện mặc định: accordion inline (expanded). Giao
                // diện dày đặc: chọn dòng (selectedMaKhach), chi tiết hiện
                // ở panel riêng bên dưới bảng — xem khối render phía sau.
                const isOpen = theme === 'default' && expanded.has(r.ma_khach)
                const isSelected = theme === 'dense' && selectedMaKhach === r.ma_khach
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
                      className={`hover:bg-gray-50/70 transition-colors cursor-pointer ${isSelected ? 'bg-brand-50' : ''}`}
                      onClick={() => theme === 'dense'
                        ? setSelectedMaKhach(prev => prev === r.ma_khach ? null : r.ma_khach)
                        : toggleExpand(r.ma_khach)}
                    >
                      <td className="px-4 py-2 text-gray-700 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {theme === 'default' && (isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />)}
                          {r.ma_khach}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap text-right">{formatTien(r.tong_phat_sinh)}</td>
                      <td className="px-4 py-2 text-emerald-600 whitespace-nowrap text-right">{formatTien(r.tong_da_thu)}</td>
                      <td className={`px-4 py-2 whitespace-nowrap text-right font-semibold ${r.cong_no > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatTien(r.cong_no)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={4} className="px-4 py-3">
                          <DetailPanels row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {theme === 'dense' && selectedMaKhach && (() => {
        const selectedRow = filtered.find(r => r.ma_khach === selectedMaKhach)
        if (!selectedRow) return null
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 list-table-container">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">{selectedRow.ma_khach}</h3>
              <button onClick={() => setSelectedMaKhach(null)} className="text-xs text-gray-400 hover:text-gray-600">Đóng</button>
            </div>
            <DetailPanels row={selectedRow} />
          </div>
        )
      })()}
    </div>
  )
}
