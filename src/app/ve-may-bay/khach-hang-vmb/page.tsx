'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Search } from 'lucide-react'

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filter !== 'tat_ca' && r.trang_thai !== filter) return false
      if (q && !r.ma_khach.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filter, search])

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-gray-900">Khách hàng VMB</h1>
        <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Mã khách', 'Trạng thái', 'Số dòng công nợ', 'Tổng phát sinh', 'Số dòng sao kê', 'Tổng đã thu'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50">{h}</th>
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
              ) : filtered.map(r => (
                <tr key={r.ma_khach} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-2 text-gray-700 font-medium whitespace-nowrap">{r.ma_khach}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE[r.trang_thai].cls}`}>{BADGE[r.trang_thai].text}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap text-right">{r.so_dong_cong_no || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap text-right">{r.so_dong_cong_no ? formatTien(r.tong_phat_sinh) : '—'}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap text-right">{r.so_dong_sao_ke || '—'}</td>
                  <td className="px-4 py-2 text-emerald-600 whitespace-nowrap text-right">{r.so_dong_sao_ke ? formatTien(r.tong_da_thu) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
