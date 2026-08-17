'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { RefreshCw, Search, Download } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { useCellSelection } from '@/hooks/useCellSelection'

type SaoKeRow = {
  id: string
  tai_khoan: string
  stt: number | null
  ngay: string | null
  ma: string | null
  tag: string | null
  don_vi: string | null
  dien_giai: string | null
  thu: number | null
  chi: number | null
  vay: number | null
  so_du_cuoi_ky: number | null
  ten_du_an: string | null
  ma_tk: string | null
  ma_1: string | null
  ma_2: string | null
  ma_3: string | null
}

const TAI_KHOAN_OPTIONS = ['Tất cả', 'Tiền mặt', 'TCB VA 866', 'TCB P889', 'TCB017', 'TCB012']

function formatTien(n: number | null): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('vi-VN')
}

// ngay lưu dạng TEXT "DD/MM/YYYY" (nguyên văn đọc từ Google Sheet, không
// phải cột DATE thật) — đổi sang ISO để sort/group đúng theo ngày thực,
// không theo thứ tự chuỗi (vd "09/08/2026" > "10/07/2026" theo string
// nhưng sai theo ngày thực).
function toIsoDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  if (!d || !m || !y) return null
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export default function SaoKePage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [rows, setRows] = useState<SaoKeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [taiKhoan, setTaiKhoan] = useState('Tất cả')
  const [chiVmb, setChiVmb] = useState(false)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/ve-may-bay/sao-ke')
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
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Đầu vào sao kê</span>)
    setOnRefresh(loadData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadData])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/ve-may-bay/sao-ke/sync', { method: 'POST' })
      const json = await res.json()
      const breakdownText = Array.isArray(json.breakdown)
        ? ' — ' + json.breakdown.map((b: any) => `${b.tai_khoan}: ${b.parsed}`).join(', ')
        : ''
      if (!res.ok) throw new Error((json.error ?? 'Đồng bộ thất bại') + breakdownText)
      setSyncMsg({ ok: true, text: `Đã đồng bộ ${Number(json.synced).toLocaleString('vi-VN')} dòng từ Google Sheet${breakdownText}.` })
      await loadData()
    } catch (err: any) {
      setSyncMsg({ ok: false, text: err?.message ?? 'Đồng bộ thất bại' })
    } finally {
      setSyncing(false)
    }
  }, [loadData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (taiKhoan !== 'Tất cả' && r.tai_khoan !== taiKhoan) return false
      if (chiVmb && (r.tag ?? '').toUpperCase() !== 'VMB') return false
      if (q) {
        const hay = `${r.ma ?? ''} ${r.don_vi ?? ''} ${r.dien_giai ?? ''} ${r.ten_du_an ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, taiKhoan, chiVmb, search])

  const tongThu = useMemo(() => filtered.reduce((s, r) => s + (r.thu ?? 0), 0), [filtered])
  const tongChi = useMemo(() => filtered.reduce((s, r) => s + (r.chi ?? 0), 0), [filtered])

  const rowIndexById = useMemo(() => new Map(filtered.map((r, i) => [r.id, i])), [filtered])
  const { cellProps, cellClassName, wrapProps, menu } = useCellSelection((r, c) => {
    const row = filtered[r]
    if (!row) return ''
    switch (c) {
      case 0: return row.ngay ?? ''
      case 1: return row.tai_khoan ?? ''
      case 2: return row.ma ?? ''
      case 3: return row.tag ?? ''
      case 4: return row.don_vi ?? ''
      case 5: return row.dien_giai ?? ''
      case 6: return row.thu ? formatTien(row.thu) : ''
      case 7: return row.chi ? formatTien(row.chi) : ''
      case 8: return formatTien(row.so_du_cuoi_ky)
      case 9: return row.ten_du_an ?? ''
      default: return ''
    }
  })

  // Phân theo tháng, mới nhất trước — cả thứ tự tháng lẫn thứ tự giao dịch
  // trong từng tháng đều sort giảm dần theo ngày thực (ISO), không theo
  // thứ tự API trả về (vốn sort theo tai_khoan/row_index, không phải ngày).
  const groupedByMonth = useMemo(() => {
    const map = new Map<string, { label: string; rows: typeof filtered }>()
    for (const r of filtered) {
      const iso = toIsoDate(r.ngay)
      const key = iso ? iso.slice(0, 7) : '0000-00'
      const label = iso ? `Tháng ${Number(iso.slice(5, 7))}/${iso.slice(0, 4)}` : 'Chưa rõ ngày'
      if (!map.has(key)) map.set(key, { label, rows: [] })
      map.get(key)!.rows.push(r)
    }
    for (const g of Array.from(map.values())) {
      g.rows.sort((a, b) => (toIsoDate(b.ngay) ?? '').localeCompare(toIsoDate(a.ngay) ?? ''))
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, g]) => g)
  }, [filtered])

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} className={syncing ? 'animate-pulse' : ''} />
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Sheet'}
          </button>
          <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {syncMsg && (
        <p className={`text-sm ${syncMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{syncMsg.text}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {TAI_KHOAN_OPTIONS.map(tk => (
          <button key={tk} onClick={() => setTaiKhoan(tk)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
              taiKhoan === tk ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {tk}
          </button>
        ))}
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={chiVmb} onChange={e => setChiVmb(e.target.checked)} />
          Chỉ dòng VMB
        </label>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm đơn vị, diễn giải, mã..."
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-400">{filtered.length.toLocaleString('vi-VN')} dòng</span>
        <span className="text-emerald-600 font-semibold">Thu: {formatTien(tongThu)}</span>
        <span className="text-red-500 font-semibold">Chi: {formatTien(tongChi)}</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container">
        <div {...wrapProps} className="overflow-x-auto select-none outline-none" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="w-full text-sm list-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Ngày', 'Tài khoản', 'Mã', 'Tag', 'Đơn vị', 'Diễn giải', 'Thu', 'Chi', 'Dư cuối kỳ', 'Dự án'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={10} className="px-5 py-14 text-center">
                  <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                  <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-14 text-center text-gray-400">Không có dòng nào khớp bộ lọc.</td></tr>
              ) : groupedByMonth.map(g => (
                <Fragment key={g.label}>
                <tr>
                  <td colSpan={10} className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-700">
                    {g.label} <span className="text-gray-400 font-normal">({g.rows.length} dòng)</span>
                  </td>
                </tr>
                {g.rows.map(r => {
                  const ri = rowIndexById.get(r.id) ?? 0
                  return (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                    <td {...cellProps(ri, 0)} className={cellClassName(ri, 0, 'px-4 py-2 text-gray-600 whitespace-nowrap cursor-cell')}>{r.ngay ?? '—'}</td>
                    <td {...cellProps(ri, 1)} className={cellClassName(ri, 1, 'px-4 py-2 text-gray-500 whitespace-nowrap cursor-cell')}>{r.tai_khoan}</td>
                    <td {...cellProps(ri, 2)} className={cellClassName(ri, 2, 'px-4 py-2 text-gray-500 whitespace-nowrap cursor-cell')}>{r.ma ?? '—'}</td>
                    <td {...cellProps(ri, 3)} className={cellClassName(ri, 3, 'px-4 py-2 whitespace-nowrap cursor-cell')}>
                      {r.tag && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.tag.toUpperCase() === 'VMB' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.tag}
                        </span>
                      )}
                    </td>
                    <td {...cellProps(ri, 4)} className={cellClassName(ri, 4, 'px-4 py-2 text-gray-700 max-w-[200px] truncate cursor-cell')} title={r.don_vi ?? ''}>{r.don_vi ?? '—'}</td>
                    <td {...cellProps(ri, 5)} className={cellClassName(ri, 5, 'px-4 py-2 text-gray-700 max-w-[320px] truncate cursor-cell')} title={r.dien_giai ?? ''}>{r.dien_giai ?? '—'}</td>
                    <td {...cellProps(ri, 6)} className={cellClassName(ri, 6, 'px-4 py-2 text-emerald-600 whitespace-nowrap text-right cursor-cell')}>{r.thu ? formatTien(r.thu) : '—'}</td>
                    <td {...cellProps(ri, 7)} className={cellClassName(ri, 7, 'px-4 py-2 text-red-500 whitespace-nowrap text-right cursor-cell')}>{r.chi ? formatTien(r.chi) : '—'}</td>
                    <td {...cellProps(ri, 8)} className={cellClassName(ri, 8, 'px-4 py-2 text-gray-500 whitespace-nowrap text-right cursor-cell')}>{formatTien(r.so_du_cuoi_ky)}</td>
                    <td {...cellProps(ri, 9)} className={cellClassName(ri, 9, 'px-4 py-2 text-gray-500 max-w-[180px] truncate cursor-cell')} title={r.ten_du_an ?? ''}>{r.ten_du_an ?? '—'}</td>
                  </tr>
                  )
                })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {menu}
    </div>
  )
}
