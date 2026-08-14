'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { RefreshCw, Search, Download, CheckCircle2, XCircle, X } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'

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

// Toast kết quả đồng bộ — góc dưới-phải, tự trượt vào rồi tự biến mất sau
// 6s (hẹn giờ ở component cha), thay cho dòng chữ nằm lì trong layout như
// trước. Animate bằng requestAnimationFrame + transition, KHÔNG dùng class
// "animate-in" (cần plugin tailwindcss-animate, repo này chưa cài).
function SyncToast({ msg, onClose }: { msg: { ok: boolean; text: string }; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div
      className={`fixed bottom-5 right-5 z-200 flex items-start gap-2.5 bg-white rounded-2xl shadow-2xl border border-gray-100 px-4 py-3 max-w-sm transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {msg.ok ? (
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
      )}
      <p className={`text-sm flex-1 ${msg.ok ? 'text-gray-800' : 'text-red-600'}`}>{msg.text}</p>
      <button onClick={onClose} className="p-0.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}

// Dữ liệu từ sheet "Tiền mặt" hiển thị là "TM", các tài khoản ngân hàng
// khác giữ nguyên tên (TCB VA 866, TCB P889, TCB017, TCB012).
function stkNhanTien(taiKhoan: string): string {
  return taiKhoan === 'Tiền mặt' ? 'TM' : taiKhoan
}

// Bản rút gọn của /ve-may-bay/sao-ke — chỉ hiển thị dòng đã lọc sẵn ma_2 =
// "TC" (cột O gốc, đánh dấu Toàn Cầu/vé máy bay) từ API. Nút "Đồng bộ từ
// Sheet" mở cho mọi người có quyền vào trang này (requireKeToan()) — API
// /api/ve-may-bay/sao-ke/sync chỉ trả về SỐ LƯỢNG dòng đã đồng bộ, không
// trả nội dung giao dịch, nên không lộ thêm dữ liệu gì.
//
// Gọi API theo TỪNG THÁNG (không kéo hết lịch sử 1 lần) + cache trong RAM
// theo tháng đã gọi (cacheRef, sống hết đời component — đủ dùng vì trang
// không có thao tác sửa dữ liệu, chỉ xem) — tháng đã xem rồi thì bấm lại
// không gọi API nữa. RIÊNG tháng hiện tại luôn gọi API mới mỗi lần chọn
// (dữ liệu tháng này còn đang phát sinh/đồng bộ thêm), không dùng cache.
export default function SaoKeTkPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const [selected, setSelected] = useState({ year: currentYear, month: currentMonth })
  const [rows, setRows] = useState<SaoKeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [taiKhoan, setTaiKhoan] = useState('Tất cả')
  const [chiVmb, setChiVmb] = useState(false)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Toast — tự biến mất sau 6s thay vì nằm lì trong layout như trước.
  useEffect(() => {
    if (!syncMsg) return
    const t = setTimeout(() => setSyncMsg(null), 6000)
    return () => clearTimeout(t)
  }, [syncMsg])

  const cacheRef = useRef<Map<string, SaoKeRow[]>>(new Map())

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
      const res = await fetch(`/api/ve-may-bay/sao-ke-tk?year=${year}&month=${month}`)
      if (!res.ok) throw new Error('load failed')
      const { data } = await res.json()
      const list: SaoKeRow[] = Array.isArray(data) ? data : []
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
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Sao kê TK</span>)
    setOnRefresh(() => loadMonth(selected.year, selected.month, true))
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadMonth, selected])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/ve-may-bay/sao-ke/sync', { method: 'POST' })
      const json = await res.json()
      const breakdownText = Array.isArray(json.breakdown)
        ? ' — ' + json.breakdown.map((b: { tai_khoan: string; parsed: number }) => `${b.tai_khoan}: ${b.parsed}`).join(', ')
        : ''
      if (!res.ok) throw new Error((json.error ?? 'Đồng bộ thất bại') + breakdownText)
      setSyncMsg({ ok: true, text: `Đã đồng bộ${breakdownText}.` })
      await loadMonth(selected.year, selected.month, true)
    } catch (err) {
      setSyncMsg({ ok: false, text: err instanceof Error ? err.message : 'Đồng bộ thất bại' })
    } finally {
      setSyncing(false)
    }
  }, [loadMonth, selected])

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
          <button onClick={() => loadMonth(selected.year, selected.month, true)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
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
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="w-full text-sm list-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Ngày', 'Nội dung CK', 'STK nhận tiền', 'Số tiền', 'Mã KH'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center">
                  <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                  <button onClick={() => loadMonth(selected.year, selected.month, true)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-gray-400">Không có dòng nào khớp bộ lọc.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{r.ngay ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-700 max-w-[360px] truncate" title={r.dien_giai ?? ''}>{r.dien_giai ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{stkNhanTien(r.tai_khoan)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-right">
                    {r.thu ? (
                      <span className="text-emerald-600">{formatTien(r.thu)}</span>
                    ) : r.chi ? (
                      <span className="text-red-500">({formatTien(r.chi)})</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 max-w-[200px] truncate" title={r.ten_du_an ?? ''}>{r.ten_du_an ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {syncMsg && <SyncToast msg={syncMsg} onClose={() => setSyncMsg(null)} />}
    </div>
  )
}
