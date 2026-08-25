'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { useCellSelection } from '@/hooks/useCellSelection'
import { useResizableColumns } from '@/hooks/useResizableColumns'

const VMB_COLS = [
  { key: 'ma_khach', label: 'Mã khách', width: 160 },
  { key: 'trang_thai', label: 'Trạng thái', width: 140 },
  { key: 'so_dong_cn', label: 'Số dòng công nợ', width: 140 },
  { key: 'tong_ps', label: 'Tổng phát sinh', width: 140 },
  { key: 'so_dong_sk', label: 'Số dòng sao kê', width: 140 },
  { key: 'tong_da_thu', label: 'Tổng đã thu', width: 140 },
]

type TrangThai = 'khop' | 'chi_cong_no' | 'chi_sao_ke'
type KhRow = {
  ma_khach: string
  so_dong_cong_no: number
  tong_phat_sinh: number
  so_dong_sao_ke: number
  tong_da_thu: number
  trang_thai: TrangThai
}

const FILTERS: { key: TrangThai | 'tat_ca'; label: string }[] = [
  { key: 'tat_ca', label: 'Tất cả' },
  { key: 'khop', label: 'Khớp cả 2 nguồn' },
  { key: 'chi_cong_no', label: 'Chỉ ở Đầu vào công nợ' },
  { key: 'chi_sao_ke', label: 'Chỉ ở Đầu vào sao kê' },
]

const BADGE: Record<TrangThai, { text: string; cls: string }> = {
  khop: { text: 'Khớp', cls: 'bg-emerald-50 text-emerald-700' },
  chi_cong_no: { text: 'Chỉ công nợ', cls: 'bg-amber-50 text-amber-700' },
  chi_sao_ke: { text: 'Chỉ sao kê', cls: 'bg-blue-50 text-blue-700' },
}

function formatTien(n: number): string {
  return Math.round(n).toLocaleString('vi-VN')
}

// Đối chiếu danh mục mã khách giữa "Đầu vào công nợ" (ma_khach) và "Đầu vào
// sao kê" (ten_du_an/Dự án) — công cụ dọn dữ liệu, không phải màn tính công
// nợ (xem /ve-may-bay/cong-no-khach-hang cho việc đó).
export default function KhachHangVmbPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [rows, setRows] = useState<KhRow[]>([])
  const [counts, setCounts] = useState({ khop: 0, chi_cong_no: 0, chi_sao_ke: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState<TrangThai | 'tat_ca'>('tat_ca')
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/ve-may-bay/khach-hang-vmb')
      if (!res.ok) throw new Error('load failed')
      const json = await res.json()
      setRows(Array.isArray(json.data) ? json.data : [])
      setCounts({ khop: json.tong_khop ?? 0, chi_cong_no: json.tong_chi_cong_no ?? 0, chi_sao_ke: json.tong_chi_sao_ke ?? 0 })
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
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Khách hàng VMB</span>)
    setOnRefresh(loadData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filter !== 'tat_ca' && r.trang_thai !== filter) return false
      if (q && !r.ma_khach.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filter, search])

  const { cellProps, cellClassName, wrapProps, menu } = useCellSelection((r, c) => {
    const row = filtered[r]
    if (!row) return ''
    switch (c) {
      case 0: return row.ma_khach
      case 1: return BADGE[row.trang_thai].text
      case 2: return row.so_dong_cong_no ? String(row.so_dong_cong_no) : ''
      case 3: return row.so_dong_cong_no ? formatTien(row.tong_phat_sinh) : ''
      case 4: return row.so_dong_sao_ke ? String(row.so_dong_sao_ke) : ''
      case 5: return row.so_dong_sao_ke ? formatTien(row.tong_da_thu) : ''
      default: return ''
    }
  })
  const { widths: vmbWidths, startResize: startVmbResize } = useResizableColumns('khach-hang-vmb', Object.fromEntries(VMB_COLS.map(c => [c.key, c.width])))
  const vmbTotalWidth = VMB_COLS.reduce((sum, c) => sum + (vmbWidths[c.key] ?? c.width), 0)

  return (
    <div className="px-5 pb-5 space-y-2">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filter === f.key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {f.label}
            {f.key !== 'tat_ca' && <span className="ml-1.5 opacity-70">{counts[f.key]}</span>}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã khách..."
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64" />
        </div>
      </div>

      <p className="text-sm text-gray-400">{filtered.length.toLocaleString('vi-VN')} mã khách</p>

      <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
        <div {...wrapProps} className="overflow-x-auto select-none outline-none" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: vmbTotalWidth }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {VMB_COLS.map(c => (
                  <th key={c.key} style={{ width: vmbWidths[c.key] ?? c.width }}
                    className="relative text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none bg-gray-50">
                    {c.label}
                    <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startVmbResize(c.key, e)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center">
                  <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                  <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-gray-400">Không có dòng nào khớp bộ lọc.</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.ma_khach} className="hover:bg-gray-50/70 transition-colors">
                  <td {...cellProps(i, 0)} className={cellClassName(i, 0, 'px-4 py-2 text-gray-700 font-medium whitespace-nowrap cursor-cell')}>{r.ma_khach}</td>
                  <td {...cellProps(i, 1)} className={cellClassName(i, 1, 'px-4 py-2 whitespace-nowrap cursor-cell')}>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE[r.trang_thai].cls}`}>{BADGE[r.trang_thai].text}</span>
                  </td>
                  <td {...cellProps(i, 2)} className={cellClassName(i, 2, 'px-4 py-2 text-gray-500 whitespace-nowrap text-right cursor-cell')}>{r.so_dong_cong_no || '—'}</td>
                  <td {...cellProps(i, 3)} className={cellClassName(i, 3, 'px-4 py-2 text-gray-600 whitespace-nowrap text-right cursor-cell')}>{r.so_dong_cong_no ? formatTien(r.tong_phat_sinh) : '—'}</td>
                  <td {...cellProps(i, 4)} className={cellClassName(i, 4, 'px-4 py-2 text-gray-500 whitespace-nowrap text-right cursor-cell')}>{r.so_dong_sao_ke || '—'}</td>
                  <td {...cellProps(i, 5)} className={cellClassName(i, 5, 'px-4 py-2 text-emerald-600 whitespace-nowrap text-right cursor-cell')}>{r.so_dong_sao_ke ? formatTien(r.tong_da_thu) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {menu}
    </div>
  )
}
