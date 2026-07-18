'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import clsx from 'clsx'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Copy, Check, X, Pencil, FileText } from 'lucide-react'
import type { Doan, HoSoWithNhanSu, TrangThaiHoSo } from '@/types'
import { TRANG_THAI_LABELS } from '@/types'
import { buildDsHdvRows, buildTheoDoiHopDongRows } from '@/lib/export-format'
import { formatDateVN } from '@/lib/format'
import { useTopbar } from '@/contexts/topbar'

const STATUS_COLORS: Record<TrangThaiHoSo, string> = {
  cho_xac_nhan_ai: 'bg-amber-50 text-amber-700',
  da_xac_nhan: 'bg-brand-50 text-brand-700',
  da_thanh_toan: 'bg-emerald-50 text-emerald-700',
  da_xuat_hd: 'bg-violet-50 text-violet-700',
  da_gui_ky_amis: 'bg-violet-50 text-violet-700',
  da_ky_xong: 'bg-emerald-50 text-emerald-700',
}

type Tab = 'hdv' | 'files'

const PANEL_WIDTH_KEY = 'hns-ketoan-doan-panel-width'
const DEFAULT_PANEL_WIDTH = 288
const MIN_PANEL_WIDTH = 220
const MAX_PANEL_WIDTH = 420

export default function DoanDetailPage() {
  const params = useParams<{ id: string }>()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [doan, setDoan] = useState<Doan | null>(null)
  const [hoSo, setHoSo] = useState<HoSoWithNhanSu[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<HoSoWithNhanSu | null>(null)
  const [editingDoan, setEditingDoan] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Number(localStorage.getItem(PANEL_WIDTH_KEY)) || DEFAULT_PANEL_WIDTH : DEFAULT_PANEL_WIDTH,
  )
  const [dragging, setDragging] = useState(false)
  const panelOpenRef = useRef(panelOpen)
  panelOpenRef.current = panelOpen
  const panelWidthRef = useRef(panelWidth)
  panelWidthRef.current = panelWidth
  const [tab, setTab] = useState<Tab>('hdv')
  const [copied, setCopied] = useState<'ds' | 'td' | null>(null)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
    const x0 = e.clientX
    const w0 = panelOpenRef.current ? panelWidthRef.current : 0

    function onMove(ev: MouseEvent) {
      const raw = w0 + (ev.clientX - x0)
      if (raw < 40) {
        if (panelOpenRef.current) setPanelOpen(false)
        return
      }
      if (!panelOpenRef.current) setPanelOpen(true)
      setPanelWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, raw)))
    }
    function onUp() {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidthRef.current))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/doan/${params.id}`)
    if (res.ok) {
      const data = await res.json()
      setDoan(data.doan)
      setHoSo(data.ho_so)
    }
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải chi tiết đoàn khi mount, pattern chuẩn cho fetch-on-mount
    void load()
  }, [load])

  useEffect(() => {
    setBreadcrumb(
      <span className="text-sm font-semibold text-gray-700 flex items-center">
        <Link href="/doan" className="text-gray-400 hover:text-brand-600 transition-colors">
          Quyết toán tour
        </Link>
        <span className="text-gray-300 mx-1">/</span> {doan?.ten_doan ?? '...'}
      </span>,
    )
    setOnRefresh(load)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, doan?.ten_doan, load])

  async function handleCopy(kind: 'ds' | 'td') {
    if (!doan) return
    const text = kind === 'ds' ? buildDsHdvRows(doan, hoSo) : buildTheoDoiHopDongRows(doan, hoSo)
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 1500)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-300" size={28} />
      </div>
    )
  }

  if (!doan) {
    return <div className="p-6 text-center text-gray-400 text-sm">Không tìm thấy đoàn</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <Link href="/doan" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2 min-w-0">
          <span className="text-gray-400 font-semibold shrink-0">ĐOÀN:</span>
          <span className="truncate">{doan.ten_doan}</span>
          <button
            onClick={() => setEditingDoan(true)}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-brand-500 transition-colors shrink-0"
          >
            <Pencil size={14} />
          </button>
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <aside
          className="w-full shrink-0 overflow-hidden border-b lg:border-b-0 border-gray-200 bg-white lg:w-(--panel-w)"
          style={
            {
              '--panel-w': `${panelOpen ? panelWidth : 0}px`,
              transition: dragging ? 'none' : 'width 200ms ease-in-out',
            } as React.CSSProperties
          }
        >
          {/* width cố định = panelWidth (không đổi theo panelOpen) để nội dung giữ nguyên hình dạng,
              chỉ bị cha (aside) clip dần theo width khi đóng — tạo hiệu ứng trượt. Mobile: full width tự nhiên. */}
          <div className="p-5 lg:w-(--panel-content-w)" style={{ '--panel-content-w': `${panelWidth}px` } as React.CSSProperties}>
            <PanelContent doan={doan} />
          </div>
        </aside>

        <div
          className="hidden lg:flex relative items-stretch w-3 shrink-0 cursor-col-resize group"
          onMouseDown={startResize}
          title="Kéo để chỉnh độ rộng, bấm để ẩn/hiện"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gray-200 group-hover:bg-brand-300 transition-colors" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPanelOpen((o) => !o)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={panelOpen ? 'Ẩn thông tin chung' : 'Hiện thông tin chung'}
            className="absolute top-4 left-1/2 -translate-x-1/2 w-6 h-6 z-10 flex items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm text-gray-400 hover:text-brand-600 hover:border-brand-300 transition-colors cursor-pointer"
          >
            {panelOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex gap-6 px-6 border-b border-gray-200 bg-white">
            <TabButton active={tab === 'hdv'} onClick={() => setTab('hdv')}>
              Hướng dẫn viên
            </TabButton>
            <TabButton active={tab === 'files'} onClick={() => setTab('files')}>
              File hợp đồng
            </TabButton>
          </div>

          <div className="p-6">
            {tab === 'hdv' && (
              <>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => handleCopy('ds')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {copied === 'ds' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    Copy DS HDV (29 cột)
                  </button>
                  <button
                    onClick={() => handleCopy('td')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {copied === 'td' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    Copy Theo dõi HĐ (4 cột)
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Người', 'SĐT', 'CCCD', 'Ngân hàng', 'Số tiền chi trả', 'Trạng thái', ''].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {hoSo.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{r.nhansu.ho_ten}</div>
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              {r.nhansu.prefix}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{r.nhansu.sdt ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs">{r.nhansu.so_cccd ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {r.nhansu.stk ? (
                              <>
                                <div>{r.nhansu.stk}</div>
                                <div className="text-gray-400">{r.nhansu.ten_ngan_hang}</div>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {r.so_tien_chi_tra != null ? r.so_tien_chi_tra.toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.trang_thai]}`}>
                              {TRANG_THAI_LABELS[r.trang_thai]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setEditing(r)}
                              className="p-1.5 rounded-lg hover:bg-sky-50 text-gray-300 hover:text-sky-500 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {hoSo.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-14 text-center text-gray-400">
                            Chưa có ai trong đoàn này. Gửi ảnh CCCD/thẻ HDV cho Telegram bot để thêm.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === 'files' && <FilesTab hoSo={hoSo} />}
          </div>
        </div>
      </div>

      {editing && (
        <EditHoSoModal
          hoSo={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {editingDoan && (
        <EditDoanModal
          doan={doan}
          onClose={() => setEditingDoan(false)}
          onSaved={() => {
            setEditingDoan(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function PanelContent({ doan }: { doan: Doan }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 whitespace-nowrap">Thông tin chung</p>
      <div className="space-y-4">
        <InfoField label="Tuyến du lịch" value={doan.hanh_trinh} />
        <InfoField
          label="Ngày"
          value={`${formatDateVN(doan.ngay_di)}${doan.ngay_ve ? ` – ${formatDateVN(doan.ngay_ve)}` : ''}`}
        />
        <InfoField label="Số khách dự kiến" value={doan.sl_khach != null ? String(doan.sl_khach) : null} />
      </div>
    </>
  )
}

function InfoField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || <span className="text-gray-300 font-normal">—</span>}</p>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
        active ? 'border-accent-500 text-accent-600' : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

const FILE_FIELDS = [
  { key: 'anh_cccd_truoc_url', label: 'CCCD mặt trước' },
  { key: 'anh_cccd_sau_url', label: 'CCCD mặt sau' },
  { key: 'anh_the_hdv_url', label: 'Thẻ HDV' },
  { key: 'anh_xac_nhan_url', label: 'Xác nhận' },
] as const

function FilesTab({ hoSo }: { hoSo: HoSoWithNhanSu[] }) {
  if (hoSo.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-14">Chưa có hồ sơ nào.</p>
  }

  return (
    <div className="space-y-3">
      {hoSo.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="font-semibold text-gray-900 mb-3">{r.nhansu.ho_ten}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FILE_FIELDS.map((f) => {
              const url = r[f.key]
              return url ? (
                <a
                  key={f.key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  <FileText size={13} className="shrink-0" /> {f.label}
                </a>
              ) : (
                <div
                  key={f.key}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-300"
                >
                  <FileText size={13} className="shrink-0" /> {f.label}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function EditDoanModal({ doan, onClose, onSaved }: { doan: Doan; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    ten_doan: doan.ten_doan,
    hanh_trinh: doan.hanh_trinh ?? '',
    ngay_di: doan.ngay_di,
    ngay_ve: doan.ngay_ve ?? '',
    sl_khach: doan.sl_khach?.toString() ?? '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    await fetch(`/api/doan/${doan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ten_doan: form.ten_doan.trim(),
        hanh_trinh: form.hanh_trinh.trim() || null,
        ngay_di: form.ngay_di,
        ngay_ve: form.ngay_ve || null,
        sl_khach: form.sl_khach ? Number(form.sl_khach) : null,
      }),
    })
    setSubmitting(false)
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Sửa thông tin đoàn</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <Field label="Tên đoàn">
              <input
                required
                value={form.ten_doan}
                onChange={(e) => setForm((f) => ({ ...f, ten_doan: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Tuyến du lịch">
              <input
                value={form.hanh_trinh}
                onChange={(e) => setForm((f) => ({ ...f, hanh_trinh: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày đi">
                <input
                  type="date"
                  required
                  value={form.ngay_di}
                  onChange={(e) => setForm((f) => ({ ...f, ngay_di: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Ngày về">
                <input
                  type="date"
                  value={form.ngay_ve}
                  onChange={(e) => setForm((f) => ({ ...f, ngay_ve: e.target.value }))}
                  className={inputCls}
                />
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
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Lưu
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

function EditHoSoModal({
  hoSo,
  onClose,
  onSaved,
}: {
  hoSo: HoSoWithNhanSu
  onClose: () => void
  onSaved: () => void
}) {
  const [nhansu, setNhansu] = useState({
    sdt: hoSo.nhansu.sdt ?? '',
    email: hoSo.nhansu.email ?? '',
    stk: hoSo.nhansu.stk ?? '',
    ten_ngan_hang: hoSo.nhansu.ten_ngan_hang ?? '',
  })
  const [hs, setHs] = useState({
    ngay_dich_vu: hoSo.ngay_dich_vu ?? '',
    so_ngay_cong_tac: hoSo.so_ngay_cong_tac?.toString() ?? '',
    don_gia_ngay: hoSo.don_gia_ngay?.toString() ?? '',
    so_tien_chi_tra: hoSo.so_tien_chi_tra?.toString() ?? '',
    loai_hop_dong: hoSo.loai_hop_dong ?? '',
    tinh_trang_thanh_toan: hoSo.tinh_trang_thanh_toan ?? '',
    trang_thai: hoSo.trang_thai,
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    await fetch(`/api/ho-so/${hoSo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nhansu,
        ho_so: {
          ngay_dich_vu: hs.ngay_dich_vu || null,
          so_ngay_cong_tac: hs.so_ngay_cong_tac ? Number(hs.so_ngay_cong_tac) : null,
          don_gia_ngay: hs.don_gia_ngay ? Number(hs.don_gia_ngay) : null,
          so_tien_chi_tra: hs.so_tien_chi_tra ? Number(hs.so_tien_chi_tra) : null,
          loai_hop_dong: hs.loai_hop_dong || null,
          tinh_trang_thanh_toan: hs.tinh_trang_thanh_toan || null,
          trang_thai: hs.trang_thai,
        },
      }),
    })
    setSubmitting(false)
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
            <h2 className="text-lg font-bold text-gray-900">{hoSo.nhansu.ho_ten}</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bổ sung thông tin cá nhân</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SĐT">
                <input value={nhansu.sdt} onChange={(e) => setNhansu((f) => ({ ...f, sdt: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Email">
                <input value={nhansu.email} onChange={(e) => setNhansu((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="STK">
                <input value={nhansu.stk} onChange={(e) => setNhansu((f) => ({ ...f, stk: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Ngân hàng">
                <input
                  value={nhansu.ten_ngan_hang}
                  onChange={(e) => setNhansu((f) => ({ ...f, ten_ngan_hang: e.target.value }))}
                  className={inputCls}
                />
              </Field>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-2">Hợp đồng</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày dịch vụ">
                <input
                  type="date"
                  value={hs.ngay_dich_vu}
                  onChange={(e) => setHs((f) => ({ ...f, ngay_dich_vu: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Số ngày công tác">
                <input
                  type="number"
                  value={hs.so_ngay_cong_tac}
                  onChange={(e) => setHs((f) => ({ ...f, so_ngay_cong_tac: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Đơn giá/ngày">
                <input
                  type="number"
                  value={hs.don_gia_ngay}
                  onChange={(e) => setHs((f) => ({ ...f, don_gia_ngay: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Số tiền chi trả">
                <input
                  type="number"
                  value={hs.so_tien_chi_tra}
                  onChange={(e) => setHs((f) => ({ ...f, so_tien_chi_tra: e.target.value }))}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Loại hợp đồng">
              <input
                placeholder="VD: HĐ điện tử"
                value={hs.loai_hop_dong}
                onChange={(e) => setHs((f) => ({ ...f, loai_hop_dong: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Tình trạng thanh toán">
              <input
                placeholder="VD: Ngày 17/01/2026 - TCB017"
                value={hs.tinh_trang_thanh_toan}
                onChange={(e) => setHs((f) => ({ ...f, tinh_trang_thanh_toan: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Trạng thái">
              <select
                value={hs.trang_thai}
                onChange={(e) => setHs((f) => ({ ...f, trang_thai: e.target.value as TrangThaiHoSo }))}
                className={inputCls}
              >
                {Object.entries(TRANG_THAI_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Lưu
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

const inputCls =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
