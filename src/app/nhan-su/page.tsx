'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { RefreshCw, Search, X, Loader2, Eye, ArrowRight } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { TRANG_THAI_LABELS } from '@/types'
import type { LoaiNhanSu, TrangThaiHoSo } from '@/types'
import { formatDateVN } from '@/lib/format'
import DateInput from '@/components/DateInput'

type NhanSuRow = {
  id: string
  ho_ten: string
  dia_chi: string | null
  tinh_tp: string | null
  so_cccd: string | null
  ngay_sinh: string | null
  sdt: string | null
  email: string | null
  so_the_hdv: string | null
  loai_the_hdv: string | null
  stk: string | null
  ten_ngan_hang: string | null
  loai_nhan_su_id: string
  loai_nhan_su: LoaiNhanSu | null
}

type DoanSummary = { id: string; ten_doan: string; ngay_di: string | null; ngay_ve: string | null; hanh_trinh: string | null }
type HoSoHistory = {
  id: string
  chi_tra: number | null
  trang_thai: TrangThaiHoSo
  doan: DoanSummary | null
}

// Dòng phẳng ho_so (mọi đoàn, mọi nhân sự) — nguồn dữ liệu chung cho tab
// "Tổng hợp" (gom theo nhân sự, lọc theo ngày) và 2 tab thanh toán (lọc
// theo trang_thai, hiện từng dòng tham gia đoàn) — xem GET /api/nhansu/ho-so-list.
type HoSoFlat = {
  id: string
  doan_id: string
  nhansu_id: string
  ngay_dich_vu: string | null
  chi_tra: number | null
  trang_thai: TrangThaiHoSo
  nhansu: { id: string; ho_ten: string; loai_nhan_su_id: string; loai_nhan_su: LoaiNhanSu | null } | null
  doan: DoanSummary | null
}

type Tab = 'tong_hop' | 'can_thanh_toan' | 'da_thanh_toan'
type DateFilterMode = 'all' | 'thang' | 'quy' | 'tuy_chon'

// "Đã thanh toán" = trang_thai đã QUA MỐC da_thanh_toan trong quy trình
// (cho_xac_nhan_ai → da_xac_nhan → da_thanh_toan → da_xuat_hd →
// da_gui_ky_amis → da_ky_xong, xem TRANG_THAI_LABELS) — các bước SAU
// da_thanh_toan cũng tính là đã thanh toán vì đã đi qua bước đó rồi.
const DA_THANH_TOAN_SET = new Set<TrangThaiHoSo>(['da_thanh_toan', 'da_xuat_hd', 'da_gui_ky_amis', 'da_ky_xong'])
const CAN_THANH_TOAN_SET = new Set<TrangThaiHoSo>(['cho_xac_nhan_ai', 'da_xac_nhan'])

function formatTien(n: number | null): string {
  return n ? `${n.toLocaleString('vi-VN')} đ` : '—'
}

// Ngày đại diện cho 1 dòng ho_so — ưu tiên ngay_dich_vu riêng (nếu người
// này tham gia lệch ngày so với cả đoàn), mặc định lấy ngay_di của đoàn.
function effectiveDate(h: HoSoFlat): string | null {
  return h.ngay_dich_vu ?? h.doan?.ngay_di ?? null
}

// Chuẩn hoá tên để SẮP các dòng trùng/gần trùng tên đứng SÁT NHAU trong
// danh sách — bỏ dấu tiếng Việt, viết hoa, gộp khoảng trắng thừa, để lệch
// hoa/thường hay có/không dấu (vd "Nguyễn Văn A" vs "NGUYEN VAN A") không
// bị tách xa nhau như khi sort theo chuỗi gốc. Tạm thời CHỈ sắp gần nhau
// để kế toán tự soát bằng mắt — chưa tự gộp/xoá gì (xem trao đổi 2026-08-13).
const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g')
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function useLoaiNhanSuList() {
  const [list, setList] = useState<LoaiNhanSu[]>([])
  useEffect(() => {
    async function load() {
      const res = await fetch('/api/loai-nhan-su')
      if (!res.ok) return
      const data = await res.json()
      setList((data.loai_nhan_su ?? []) as LoaiNhanSu[])
    }
    void load()
  }, [])
  return list
}

function NhanSuDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nhansu, setNhansu] = useState<NhanSuRow | null>(null)
  const [hoSo, setHoSo] = useState<HoSoHistory[]>([])

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/nhansu/${id}`)
      if (res.ok) {
        const data = await res.json()
        setNhansu(data.nhansu)
        setHoSo(data.ho_so ?? [])
      }
      setLoading(false)
    }
    void load()
  }, [id])

  function close() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const rows: { label: string; value: string }[] = nhansu
    ? [
        { label: 'CCCD', value: nhansu.so_cccd ?? '—' },
        { label: 'Ngày sinh', value: formatDateVN(nhansu.ngay_sinh) || '—' },
        { label: 'Địa chỉ', value: [nhansu.dia_chi, nhansu.tinh_tp].filter(Boolean).join(', ') || '—' },
        { label: 'SĐT', value: nhansu.sdt ?? '—' },
        { label: 'Email', value: nhansu.email ?? '—' },
        { label: 'Thẻ HDV', value: nhansu.so_the_hdv ? `${nhansu.so_the_hdv} (${nhansu.loai_the_hdv ?? '—'})` : '—' },
        { label: 'Ngân hàng', value: nhansu.stk ? `${nhansu.stk} - ${nhansu.ten_ngan_hang ?? '—'}` : '—' },
      ]
    : []

  return createPortal(
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-150 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        className={`fixed inset-y-0 right-0 z-160 w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Chi tiết nhân sự</p>
            <p className="font-bold text-gray-900 truncate">{nhansu?.ho_ten ?? '...'}</p>
            <p className="text-xs text-gray-400 truncate">{nhansu?.loai_nhan_su?.ten ?? '—'}</p>
          </div>
          <button onClick={close} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-300" size={24} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="space-y-3">
              {rows.map(r => (
                <div key={r.label}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{r.label}</p>
                  <p className="text-sm text-gray-900">{r.value}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Đã tham gia ({hoSo.length} đoàn)</p>
              {hoSo.length === 0 ? (
                <p className="text-sm text-gray-400">Chưa tham gia đoàn nào.</p>
              ) : (
                <div className="space-y-2">
                  {hoSo.map(h => (
                    <Link
                      key={h.id}
                      href={h.doan ? `/doan/${h.doan.id}` : '#'}
                      className="block p-3 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/40 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{h.doan?.ten_doan ?? '(đoàn đã xoá)'}</p>
                        <ArrowRight size={13} className="text-gray-300 group-hover:text-brand-500 transition-colors shrink-0" />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.doan?.ngay_di ? formatDateVN(h.doan.ngay_di) : '—'} → {h.doan?.ngay_ve ? formatDateVN(h.doan.ngay_ve) : '—'}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-gray-500">{TRANG_THAI_LABELS[h.trang_thai]}</span>
                        <span className="text-xs font-semibold text-gray-700">{formatTien(h.chi_tra)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

const SELECT = 'px-3 py-1.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 border-none focus:outline-none focus:ring-2 focus:ring-brand-400'
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

export default function NhanSuPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [tab, setTab] = useState<Tab>('tong_hop')
  const [rows, setRows] = useState<NhanSuRow[]>([])
  const [hoSoList, setHoSoList] = useState<HoSoFlat[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLoaiId, setFilterLoaiId] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const loaiNhanSu = useLoaiNhanSuList()

  const [dateMode, setDateMode] = useState<DateFilterMode>('all')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [nhansuRes, hoSoRes] = await Promise.all([
        fetch('/api/nhansu'),
        fetch('/api/nhansu/ho-so-list'),
      ])
      if (!nhansuRes.ok || !hoSoRes.ok) throw new Error('load failed')
      const nhansuData = await nhansuRes.json()
      const hoSoData = await hoSoRes.json()
      setRows(Array.isArray(nhansuData.nhansu) ? nhansuData.nhansu : [])
      setHoSoList(Array.isArray(hoSoData.ho_so) ? hoSoData.ho_so : [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách khi mount, pattern chuẩn cho fetch-on-mount
    loadData()
  }, [loadData])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Nhân sự thuê ngoài</span>)
    setOnRefresh(loadData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadData])

  // Khoảng ngày hiệu lực theo dateMode — null = không lọc (tất cả thời gian).
  const dateRange = useMemo((): { from: string | null; to: string | null } | null => {
    if (dateMode === 'thang') {
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      return { from, to }
    }
    if (dateMode === 'quy') {
      const startMonth = (quarter - 1) * 3 + 1
      const endMonth = startMonth + 2
      const from = `${year}-${String(startMonth).padStart(2, '0')}-01`
      const lastDay = new Date(year, endMonth, 0).getDate()
      const to = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      return { from, to }
    }
    if (dateMode === 'tuy_chon') {
      if (!fromDate && !toDate) return null
      return { from: fromDate || null, to: toDate || null }
    }
    return null
  }, [dateMode, year, month, quarter, fromDate, toDate])

  const hoSoInRange = useMemo(() => {
    if (!dateRange) return hoSoList
    return hoSoList.filter(h => {
      const d = effectiveDate(h)
      if (!d) return false
      if (dateRange.from && d < dateRange.from) return false
      if (dateRange.to && d > dateRange.to) return false
      return true
    })
  }, [hoSoList, dateRange])

  const countsByNhanSu = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of hoSoInRange) {
      if (!h.nhansu_id) continue
      m.set(h.nhansu_id, (m.get(h.nhansu_id) ?? 0) + 1)
    }
    return m
  }, [hoSoInRange])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) {
      if (dateRange && (countsByNhanSu.get(r.id) ?? 0) === 0) continue
      c[r.loai_nhan_su_id] = (c[r.loai_nhan_su_id] ?? 0) + 1
    }
    return c
  }, [rows, dateRange, countsByNhanSu])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter(r => {
        if (dateRange && (countsByNhanSu.get(r.id) ?? 0) === 0) return false
        if (filterLoaiId && r.loai_nhan_su_id !== filterLoaiId) return false
        if (q) {
          const hay = `${r.ho_ten} ${r.so_cccd ?? ''} ${r.sdt ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => normalizeName(a.ho_ten).localeCompare(normalizeName(b.ho_ten)))
  }, [rows, filterLoaiId, search, dateRange, countsByNhanSu])

  const paymentRows = useMemo(() => {
    if (tab === 'tong_hop') return []
    const set = tab === 'can_thanh_toan' ? CAN_THANH_TOAN_SET : DA_THANH_TOAN_SET
    const q = search.trim().toLowerCase()
    return hoSoList
      .filter(h => set.has(h.trang_thai))
      .filter(h => {
        if (!q) return true
        const hay = `${h.nhansu?.ho_ten ?? ''} ${h.doan?.ten_doan ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => (effectiveDate(b) ?? '').localeCompare(effectiveDate(a) ?? ''))
  }, [hoSoList, tab, search])

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 border-b border-gray-200 -mb-px">
          {([
            { key: 'tong_hop', label: 'Tổng hợp' },
            { key: 'can_thanh_toan', label: 'Cần thanh toán' },
            { key: 'da_thanh_toan', label: 'Đã thanh toán' },
          ] as const).map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, CCCD, SĐT..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>

        {tab === 'tong_hop' && (
          <>
            <select value={dateMode} onChange={e => setDateMode(e.target.value as DateFilterMode)} className={SELECT}>
              <option value="all">Tất cả thời gian</option>
              <option value="thang">Theo tháng</option>
              <option value="quy">Theo quý</option>
              <option value="tuy_chon">Tuỳ chọn khoảng ngày</option>
            </select>
            {dateMode === 'thang' && (
              <>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className={SELECT}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className={SELECT}>
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
            {dateMode === 'quy' && (
              <>
                <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} className={SELECT}>
                  {[1, 2, 3, 4].map(q => <option key={q} value={q}>Quý {q}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className={SELECT}>
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
            {dateMode === 'tuy_chon' && (
              <div className="flex items-center gap-1.5">
                <DateInput value={fromDate} onChange={setFromDate} className="w-32" />
                <span className="text-xs text-gray-400">→</span>
                <DateInput value={toDate} onChange={setToDate} className="w-32" />
              </div>
            )}
          </>
        )}
      </div>

      {tab === 'tong_hop' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setFilterLoaiId('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!filterLoaiId ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            Tất cả <span className="opacity-70">{filtered.length}</span>
          </button>
          {loaiNhanSu.map(l => (
            <button key={l.id} onClick={() => setFilterLoaiId(filterLoaiId === l.id ? '' : l.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterLoaiId === l.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {l.ten} <span className="opacity-70">{counts[l.id] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'tong_hop' ? (
        <>
          <p className="text-sm text-gray-400">{filtered.length.toLocaleString('vi-VN')} nhân sự</p>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container">
            <div className="overflow-x-auto">
              <table className="w-full text-sm list-table">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Nhân sự', 'Liên hệ', 'Ngân hàng', 'Số đoàn', ''].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${h === 'Số đoàn' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
                  ) : loadError ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center">
                      <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                      <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                    </td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-gray-400">Không có nhân sự nào khớp bộ lọc.</td></tr>
                  ) : filtered.map((r, i) => {
                    const nameKey = normalizeName(r.ho_ten)
                    const maybeDup = (i > 0 && normalizeName(filtered[i - 1].ho_ten) === nameKey)
                      || (i < filtered.length - 1 && normalizeName(filtered[i + 1].ho_ten) === nameKey)
                    return (
                    <tr key={r.id} className={`hover:bg-gray-50/70 transition-colors ${maybeDup ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setViewingId(r.id)} className="text-left hover:text-brand-600 transition-colors">
                          <div className="whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{r.ho_ten}</span>
                            <span className="text-gray-400"> · {r.loai_nhan_su?.ma ?? r.loai_nhan_su?.ten ?? '—'}</span>
                            {maybeDup && (
                              <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold align-middle">có thể trùng</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">CCCD: {r.so_cccd ?? '—'}</div>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-900">
                        <div>{r.sdt ?? '—'}</div>
                        {r.email && <div className="text-xs text-gray-400">{r.email}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-900">{r.stk ? `${r.stk} - ${r.ten_ngan_hang ?? ''}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap text-gray-900 font-semibold">{countsByNhanSu.get(r.id) ?? 0}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => setViewingId(r.id)} title="Xem chi tiết" className="p-1 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-400">{paymentRows.length.toLocaleString('vi-VN')} lượt tham gia</p>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container">
            <div className="overflow-x-auto">
              <table className="w-full text-sm list-table">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Nhân sự', 'Đoàn', 'Ngày dịch vụ', 'CTP', 'Trạng thái'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${h === 'CTP' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
                  ) : loadError ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center">
                      <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                      <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                    </td></tr>
                  ) : paymentRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-gray-400">Không có dòng nào khớp bộ lọc.</td></tr>
                  ) : paymentRows.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button onClick={() => h.nhansu_id && setViewingId(h.nhansu_id)} className="text-left hover:text-brand-600 transition-colors">
                          <span className="font-semibold text-gray-900">{h.nhansu?.ho_ten ?? '—'}</span>
                          <span className="text-gray-400"> · {h.nhansu?.loai_nhan_su?.ma ?? h.nhansu?.loai_nhan_su?.ten ?? '—'}</span>
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        {h.doan ? (
                          <Link href={`/doan/${h.doan.id}`} className="text-gray-900 hover:text-brand-600 hover:underline decoration-gray-300 transition-colors">{h.doan.ten_doan}</Link>
                        ) : '(đoàn đã xoá)'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-900">{formatDateVN(effectiveDate(h)) || '—'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold text-gray-900">{formatTien(h.chi_tra)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-900">{TRANG_THAI_LABELS[h.trang_thai]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewingId && <NhanSuDetailPanel id={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  )
}
