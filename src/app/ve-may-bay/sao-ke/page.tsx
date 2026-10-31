'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { RefreshCw, Search, Download, X, AlertTriangle } from 'lucide-react'
import { ModalOverlay } from '@/components/ModalOverlay'
import { useAuth } from '@/contexts/auth'
import { useTopbar } from '@/contexts/topbar'
import { canScreen } from '@/lib/screens'
import { NoScreenAccess } from '@/components/NoScreenAccess'
import { useCellSelection } from '@/hooks/useCellSelection'
import { useResizableColumns } from '@/hooks/useResizableColumns'

const SAO_KE_COLS = [
  { key: 'ngay', label: 'Ngày', width: 100 },
  { key: 'tai_khoan', label: 'Tài khoản', width: 130 },
  { key: 'ma', label: 'Mã', width: 100 },
  { key: 'tag', label: 'Tag', width: 100 },
  { key: 'don_vi', label: 'Đơn vị', width: 160 },
  { key: 'dien_giai', label: 'Diễn giải', width: 260 },
  { key: 'thu', label: 'Thu', width: 120 },
  { key: 'chi', label: 'Chi', width: 120 },
  { key: 'du_cuoi_ky', label: 'Dư cuối kỳ', width: 120 },
  { key: 'du_an', label: 'Dự án', width: 140 },
]

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
  xoa_luc: string | null
  canh_bao: string | null
}

type TaiKhoan = { ma: string; ten: string; so_tai_khoan: string | null; ngan_hang: string | null; chu_so_huu: string; chu_tai_khoan: string | null; loai_tien: string }

type TomTat = { tai_khoan: string; ten: string; tren_sheet: number; them: number; sua: number; xoa: number; giu_nguyen: number; loi?: string }
type KetQuaDongBo = { tom_tat: TomTat[]; canh_bao: { id: string; tai_khoan: string; ngay: string | null; dien_giai: string | null; canh_bao: string }[] }

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
  const { user } = useAuth()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [rows, setRows] = useState<SaoKeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [taiKhoans, setTaiKhoans] = useState<TaiKhoan[]>([])
  const [taiKhoan, setTaiKhoan] = useState('Tất cả')
  const [chiVmb, setChiVmb] = useState(false)
  const [chiCanhBao, setChiCanhBao] = useState(false)
  const [ketQua, setKetQua] = useState<KetQuaDongBo | null>(null)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/ve-may-bay/sao-ke')
      if (!res.ok) throw new Error('load failed')
      const { data, tai_khoan } = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setTaiKhoans(Array.isArray(tai_khoan) ? tai_khoan : [])
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
      if (!res.ok) throw new Error(json.error ?? 'Đồng bộ thất bại')
      setKetQua({ tom_tat: json.tom_tat ?? [], canh_bao: json.canh_bao ?? [] })
      await loadData()
    } catch (err) {
      setSyncMsg({ ok: false, text: err instanceof Error ? err.message : 'Đồng bộ thất bại' })
    } finally {
      setSyncing(false)
    }
  }, [loadData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (taiKhoan !== 'Tất cả' && r.tai_khoan !== taiKhoan) return false
      if (chiVmb && (r.tag ?? '').toUpperCase() !== 'VMB') return false
      if (chiCanhBao && !r.canh_bao) return false
      if (q) {
        const hay = `${r.ma ?? ''} ${r.don_vi ?? ''} ${r.dien_giai ?? ''} ${r.ten_du_an ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, taiKhoan, chiVmb, chiCanhBao, search])

  const soCanhBao = useMemo(() => rows.filter(r => r.canh_bao).length, [rows])
  const tenTk = useMemo(() => new Map(taiKhoans.map(t => [t.ma, t.ten])), [taiKhoans])
  // Tài khoản theo danh mục (sao_ke_tai_khoan), thêm tài khoản có dữ liệu mà danh mục không có
  const tkOptions = useMemo(() => {
    const ds = taiKhoans.map(t => t.ma)
    for (const r of rows) if (!ds.includes(r.tai_khoan)) ds.push(r.tai_khoan)
    return ds
  }, [taiKhoans, rows])

  const daXem = useCallback(async (id: string) => {
    const res = await fetch(`/api/ve-may-bay/sao-ke/${id}`, { method: 'PATCH' })
    if (res.ok) setRows(prev => prev.flatMap(r => r.id !== id ? [r] : r.xoa_luc ? [] : [{ ...r, canh_bao: null }]))
  }, [])

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
  const { widths: skWidths, startResize: startSkResize } = useResizableColumns('sao-ke', Object.fromEntries(SAO_KE_COLS.map(c => [c.key, c.width])))
  const skTotalWidth = SAO_KE_COLS.reduce((sum, c) => sum + (skWidths[c.key] ?? c.width), 0)

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

  // Sổ quỹ/ngân hàng toàn công ty — chỉ người được tick màn kt-sao-ke (hoặc
  // Super Admin); chưa chạy migration screen_access thì theo luật cũ =
  // Super Admin hoặc Boss. AppShell đã chặn theo đường dẫn, chặn lại ở đây
  // cho chắc (phải đặt sau mọi hook — Rules of Hooks).
  if (!canScreen(user, 'kt-sao-ke')) return <NoScreenAccess />

  return (
    <div className="px-5 pt-2 pb-5 space-y-2">
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
        {['Tất cả', ...tkOptions].map(tk => (
          <button key={tk} onClick={() => setTaiKhoan(tk)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              taiKhoan === tk ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {tk === 'Tất cả' ? tk : tenTk.get(tk) ?? tk}
          </button>
        ))}
        <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={chiVmb} onChange={e => setChiVmb(e.target.checked)} />
          Chỉ dòng VMB
        </label>
        {soCanhBao > 0 && (
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 cursor-pointer select-none">
            <input type="checkbox" checked={chiCanhBao} onChange={e => setChiCanhBao(e.target.checked)} />
            Cảnh báo ({soCanhBao})
          </label>
        )}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm đơn vị, diễn giải, mã..."
            className="pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64" />
          {search && (
            <button onClick={() => setSearch('')} title="Bỏ tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-400">{filtered.length.toLocaleString('vi-VN')} dòng</span>
        <span className="text-emerald-600 font-semibold">Thu: {formatTien(tongThu)}</span>
        <span className="text-red-500 font-semibold">Chi: {formatTien(tongChi)}</span>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
        <div {...wrapProps} className="overflow-x-auto select-none outline-none" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: skTotalWidth }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {SAO_KE_COLS.map(c => (
                  <th key={c.key} style={{ width: skWidths[c.key] ?? c.width }}
                    className="relative text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none bg-gray-50">
                    {c.label}
                    <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startSkResize(c.key, e)} />
                  </th>
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
                  <Fragment key={r.id}>
                  <tr className={`transition-colors ${r.canh_bao ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-gray-50/70'} ${r.xoa_luc ? 'line-through' : ''}`}>
                    <td {...cellProps(ri, 0)} className={cellClassName(ri, 0, 'px-4 py-2 text-gray-600 whitespace-nowrap cursor-cell')}>
                      {r.canh_bao && <AlertTriangle size={13} className="inline mr-1 -mt-0.5 text-amber-500" />}
                      {r.ngay ?? '—'}
                    </td>
                    <td {...cellProps(ri, 1)} className={cellClassName(ri, 1, 'px-4 py-2 text-gray-500 whitespace-nowrap cursor-cell')}>{tenTk.get(r.tai_khoan) ?? r.tai_khoan}</td>
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
                  {r.canh_bao && (
                    <tr className="bg-amber-50/70">
                      <td colSpan={10} className="px-4 pb-2 pt-0 text-xs text-amber-800">
                        {r.xoa_luc && <span className="font-semibold">Đã xoá trên sheet · </span>}
                        {r.canh_bao}
                        <button onClick={() => daXem(r.id)} className="ml-2 font-semibold text-amber-700 underline hover:text-amber-900">Đã xem</button>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {menu}
      {ketQua && <KetQuaModal kq={ketQua} onClose={() => setKetQua(null)} />}
    </div>
  )
}

// Tóm tắt sau mỗi lần bấm đồng bộ: số dòng thêm / sửa / đánh dấu xoá theo tài khoản + dòng cần xem lại.
function KetQuaModal({ kq, onClose }: { kq: KetQuaDongBo; onClose: () => void }) {
  const tong = kq.tom_tat.reduce((a, t) => ({ them: a.them + t.them, sua: a.sua + t.sua, xoa: a.xoa + t.xoa }), { them: 0, sua: 0, xoa: 0 })
  const n = (v: number) => (v ? v.toLocaleString('vi-VN') : '—')
  return (
    <ModalOverlay>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <h2 className="font-bold text-gray-900">Đã đồng bộ từ Google Sheet</h2>
            <p className="text-xs text-gray-400">Thêm {n(tong.them)} · Sửa {n(tong.sua)} · Xoá {n(tong.xoa)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-3 space-y-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-200">
                <th className="text-left py-2 font-semibold">Tài khoản</th>
                <th className="text-right py-2 font-semibold">Trên sheet</th>
                <th className="text-right py-2 font-semibold">Thêm</th>
                <th className="text-right py-2 font-semibold">Sửa</th>
                <th className="text-right py-2 font-semibold">Xoá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kq.tom_tat.map(t => (
                <tr key={t.tai_khoan}>
                  <td className="py-1.5 text-gray-700">
                    {t.ten}
                    {t.loi && <p className="text-xs text-red-500">{t.loi}</p>}
                  </td>
                  <td className="py-1.5 text-right text-gray-500">{n(t.tren_sheet)}</td>
                  <td className="py-1.5 text-right text-emerald-600">{n(t.them)}</td>
                  <td className="py-1.5 text-right text-brand-600">{n(t.sua)}</td>
                  <td className="py-1.5 text-right text-red-500">{n(t.xoa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {kq.canh_bao.length > 0 && (
            <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 space-y-1.5">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle size={14} /> {kq.canh_bao.length} dòng đang gắn quyết toán cần xem lại
              </p>
              {kq.canh_bao.map(c => (
                <p key={c.id} className="text-xs text-amber-800">
                  <span className="font-semibold">{c.tai_khoan}</span> · {c.dien_giai ?? '—'} — {c.canh_bao}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-100 flex justify-center">
          <button onClick={onClose} className="flex-1 md:flex-none md:px-12 py-3 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors">Đóng</button>
        </div>
      </div>
    </ModalOverlay>
  )
}
