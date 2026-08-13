'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { RefreshCw, Search, X, Loader2, Eye, ArrowRight } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { TRANG_THAI_LABELS } from '@/types'
import type { LoaiNhanSu, TrangThaiHoSo } from '@/types'
import { formatDateVN } from '@/lib/format'

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
  ho_so: { count: number }[]
}

type DoanSummary = { id: string; ten_doan: string; ngay_di: string | null; ngay_ve: string | null; hanh_trinh: string | null }
type HoSoHistory = {
  id: string
  chi_tra: number | null
  trang_thai: TrangThaiHoSo
  doan: DoanSummary | null
}

function formatTien(n: number | null): string {
  return n ? `${n.toLocaleString('vi-VN')} đ` : '—'
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
                  <p className="text-sm text-gray-800">{r.value}</p>
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
                        <p className="text-sm font-semibold text-gray-800 truncate">{h.doan?.ten_doan ?? '(đoàn đã xoá)'}</p>
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

export default function NhanSuPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [rows, setRows] = useState<NhanSuRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLoaiId, setFilterLoaiId] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const loaiNhanSu = useLoaiNhanSuList()

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/nhansu')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setRows(Array.isArray(data.nhansu) ? data.nhansu : [])
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

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[r.loai_nhan_su_id] = (c[r.loai_nhan_su_id] ?? 0) + 1
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter(r => {
        if (filterLoaiId && r.loai_nhan_su_id !== filterLoaiId) return false
        if (q) {
          const hay = `${r.ho_ten} ${r.so_cccd ?? ''} ${r.sdt ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => normalizeName(a.ho_ten).localeCompare(normalizeName(b.ho_ten)))
  }, [rows, filterLoaiId, search])

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-400">Danh mục toàn bộ nhân sự thuê ngoài (HDV/MC/...) đã từng tham gia đoàn, không giới hạn theo 1 đoàn cụ thể.</p>
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
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setFilterLoaiId('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!filterLoaiId ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Tất cả <span className="opacity-70">{rows.length}</span>
        </button>
        {loaiNhanSu.map(l => (
          <button key={l.id} onClick={() => setFilterLoaiId(filterLoaiId === l.id ? '' : l.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterLoaiId === l.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {l.ten} <span className="opacity-70">{counts[l.id] ?? 0}</span>
          </button>
        ))}
      </div>

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
                        <span className="font-semibold text-gray-800">{r.ho_ten}</span>
                        <span className="text-gray-400"> · {r.loai_nhan_su?.ma ?? r.loai_nhan_su?.ten ?? '—'}</span>
                        {maybeDup && (
                          <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold align-middle">có thể trùng</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">CCCD: {r.so_cccd ?? '—'}</div>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <div>{r.sdt ?? '—'}</div>
                    {r.email && <div className="text-xs text-gray-400">{r.email}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{r.stk ? `${r.stk} - ${r.ten_ngan_hang ?? ''}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-gray-700 font-semibold">{r.ho_so?.[0]?.count ?? 0}</td>
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

      {viewingId && <NhanSuDetailPanel id={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  )
}
