'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Copy, Check, X, Pencil, FileText, Upload } from 'lucide-react'
import type { Doan, HoSoWithNhanSu, TrangThaiHoSo, HoSoHopDongFile } from '@/types'
import { TRANG_THAI_LABELS } from '@/types'
import { buildDsHdvRows, buildTheoDoiHopDongRows } from '@/lib/export-format'
import { formatDateVN } from '@/lib/format'
import { useTopbar } from '@/contexts/topbar'
import DateInput from '@/components/DateInput'
import ImageViewer from '@/components/ImageViewer'

const STATUS_COLORS: Record<TrangThaiHoSo, string> = {
  cho_xac_nhan_ai: 'bg-amber-50 text-amber-700',
  da_xac_nhan: 'bg-brand-50 text-brand-700',
  da_thanh_toan: 'bg-emerald-50 text-emerald-700',
  da_xuat_hd: 'bg-violet-50 text-violet-700',
  da_gui_ky_amis: 'bg-violet-50 text-violet-700',
  da_ky_xong: 'bg-emerald-50 text-emerald-700',
}

type Tab = 'info' | 'hdv' | 'files'

export default function DoanDetailPage() {
  const params = useParams<{ id: string }>()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [doan, setDoan] = useState<Doan | null>(null)
  const [hoSo, setHoSo] = useState<HoSoWithNhanSu[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<HoSoWithNhanSu | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [copied, setCopied] = useState<'ds' | 'td' | null>(null)

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
      <div className="h-12 md:h-10 flex items-center gap-3 px-6 border-b border-gray-200 bg-white shrink-0">
        <Link href="/doan" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2 min-w-0">
          <span className="text-gray-400 font-semibold shrink-0">ĐOÀN:</span>
          <span className="truncate">{doan.ten_doan}</span>
          <button
            onClick={() => setTab('info')}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-brand-500 transition-colors shrink-0"
            title="Sửa thông tin đoàn"
          >
            <Pencil size={14} />
          </button>
        </h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="h-11 md:h-9 flex items-stretch gap-6 px-6 border-b border-gray-200 bg-white">
          <TabButton active={tab === 'info'} onClick={() => setTab('info')}>
            Thông tin đoàn
          </TabButton>
          <TabButton active={tab === 'hdv'} onClick={() => setTab('hdv')}>
            Nhân sự
          </TabButton>
          <TabButton active={tab === 'files'} onClick={() => setTab('files')}>
            File hợp đồng
          </TabButton>
        </div>

        <div className="p-6">
          {tab === 'info' && <DoanInfoTab doan={doan} onSaved={load} />}

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
                            <button
                              onClick={() => setViewing(r)}
                              className="font-semibold text-gray-900 hover:text-brand-600 hover:underline decoration-gray-300 transition-colors text-left"
                            >
                              {r.nhansu.ho_ten}
                            </button>
                            <div>
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                {r.nhansu.prefix}
                              </span>
                            </div>
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
                              onClick={() => setViewing(r)}
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

      {viewing && (
        <HoSoDetailModal
          hoSo={viewing}
          onClose={() => setViewing(null)}
          onSaved={(updated) => {
            setHoSo((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
            setViewing(updated)
          }}
          onExported={(updated) => {
            setHoSo((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
            setViewing(updated)
          }}
        />
      )}
    </div>
  )
}

function DoanInfoTab({ doan, onSaved }: { doan: Doan; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <div className="max-w-xl">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <ViewField label="Tên đoàn" value={doan.ten_doan} />
          <ViewField label="Tuyến du lịch" value={doan.hanh_trinh} />
          <div className="grid grid-cols-2 gap-4">
            <ViewField label="Ngày đi" value={formatDateVN(doan.ngay_di)} />
            <ViewField label="Ngày về" value={formatDateVN(doan.ngay_ve)} />
          </div>
          <ViewField label="Số khách dự kiến" value={doan.sl_khach != null ? String(doan.sl_khach) : null} />
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 mt-4 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Pencil size={14} /> Sửa
        </button>
      </div>
    )
  }

  return <DoanInfoForm doan={doan} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved() }} />
}

function DoanInfoForm({ doan, onCancel, onSaved }: { doan: Doan; onCancel: () => void; onSaved: () => void }) {
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
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
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
            <DateInput value={form.ngay_di} onChange={(v) => setForm((f) => ({ ...f, ngay_di: v }))} className="w-full" />
          </Field>
          <Field label="Ngày về">
            <DateInput value={form.ngay_ve} onChange={(v) => setForm((f) => ({ ...f, ngay_ve: v }))} className="w-full" />
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
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Lưu thay đổi
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Huỷ
        </button>
      </div>
    </form>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center text-sm font-semibold border-b-2 transition-colors ${
        active ? 'border-accent-500 text-accent-600' : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

function FilesTab({ hoSo }: { hoSo: HoSoWithNhanSu[] }) {
  const withFile = hoSo.filter((r) => r.file_hop_dong_url)

  if (withFile.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-14">Chưa có hợp đồng nào được tạo.</p>
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['Người', 'Số hợp đồng', 'Ngày ký', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {withFile.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
              <td className="px-4 py-3 font-semibold text-gray-900">{r.nhansu.ho_ten}</td>
              <td className="px-4 py-3 text-gray-600">{r.so_hop_dong || '—'}</td>
              <td className="px-4 py-3 text-gray-600">{formatDateVN(r.ngay_ky)}</td>
              <td className="px-4 py-3">
                <a
                  href={r.file_hop_dong_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
                >
                  <FileText size={13} /> Xem file
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DETAIL_IMAGE_FIELDS = [
  { key: 'anh_cccd_truoc_url', label: 'CCCD mặt trước' },
  { key: 'anh_cccd_sau_url', label: 'CCCD mặt sau' },
  { key: 'anh_the_hdv_url', label: 'Thẻ HDV' },
  { key: 'anh_xac_nhan_url', label: 'Xác nhận' },
] as const

function HoSoDetailModal({
  hoSo,
  onClose,
  onSaved,
  onExported,
}: {
  hoSo: HoSoWithNhanSu
  onClose: () => void
  onSaved: (updated: HoSoWithNhanSu) => void
  onExported: (updated: HoSoWithNhanSu) => void
}) {
  const n = hoSo.nhansu
  const [editing, setEditing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [viewerImage, setViewerImage] = useState<{ url: string; label: string } | null>(null)
  const [files, setFiles] = useState<HoSoHopDongFile[]>([])

  const loadFiles = useCallback(async () => {
    const res = await fetch(`/api/ho-so/${hoSo.id}/hop-dong-files`)
    if (res.ok) {
      const data = await res.json()
      setFiles(data.files)
    }
  }, [hoSo.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải lịch sử file khi mở modal, pattern chuẩn cho fetch-on-mount
    void loadFiles()
  }, [loadFiles])

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportError('')
    const res = await fetch(`/api/ho-so/${hoSo.id}/xuat-hop-dong`, { method: 'POST' })
    const data = await res.json()
    setExporting(false)
    if (!res.ok) {
      setExportError(data.error ?? 'Có lỗi xảy ra')
      return
    }
    onExported(data.ho_so)
    loadFiles()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{n.ho_ten}</h2>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{n.prefix}</span>
            </div>
            <div className="flex items-center gap-2">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Pencil size={13} /> Sửa
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>
          </div>

          {editing ? (
            <HoSoEditForm
              hoSo={hoSo}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setEditing(false)
                onSaved(updated)
              }}
            />
          ) : (
            <div className="grid md:grid-cols-[260px_1fr] gap-6 p-6">
              <ImagePanel hoSo={hoSo} onUploaded={onSaved} onView={(url, label) => setViewerImage({ url, label })} />

              <div className="space-y-6 min-w-0">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">CCCD</p>
                    <div className="space-y-3">
                      <ViewField label="Số CCCD" value={n.so_cccd} mono />
                      <ViewField label="Ngày sinh" value={formatDateVN(n.ngay_sinh)} />
                      <ViewField label="Ngày cấp" value={formatDateVN(n.ngay_cap)} />
                      <ViewField label="Nơi cấp" value={n.noi_cap} />
                      <ViewField label="Địa chỉ" value={n.dia_chi} />
                      <ViewField label="MS thuế TNCN" value={n.ma_so_thue_tncn} />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Thẻ HDV</p>
                      <div className="space-y-3">
                        <ViewField label="Số thẻ" value={n.so_the_hdv} />
                        <ViewField label="Loại thẻ" value={n.loai_the_hdv} />
                        <ViewField label="Hạn thẻ" value={formatDateVN(n.han_the_hdv)} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Liên hệ &amp; ngân hàng</p>
                      <div className="space-y-3">
                        <ViewField label="SĐT" value={n.sdt} />
                        <ViewField label="Email" value={n.email} />
                        <ViewField label="STK" value={n.stk} />
                        <ViewField label="Ngân hàng" value={n.ten_ngan_hang} />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Hợp đồng</p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <ViewField label="Số hợp đồng" value={hoSo.so_hop_dong} />
                    <ViewField label="Ngày dịch vụ" value={formatDateVN(hoSo.ngay_dich_vu)} />
                    <ViewField label="Số ngày công tác" value={hoSo.so_ngay_cong_tac?.toString() ?? null} />
                    <ViewField label="Đơn giá/ngày" value={hoSo.don_gia_ngay?.toLocaleString('vi-VN') ?? null} />
                    <ViewField label="Số tiền chi trả" value={hoSo.so_tien_chi_tra?.toLocaleString('vi-VN') ?? null} />
                    <ViewField label="Thuế nộp" value={hoSo.thue_nop?.toLocaleString('vi-VN') ?? null} />
                    <ViewField label="Chi trả" value={hoSo.chi_tra?.toLocaleString('vi-VN') ?? null} />
                    <ViewField label="Loại hợp đồng" value={hoSo.loai_hop_dong} />
                    <ViewField label="Tình trạng thanh toán" value={hoSo.tinh_trang_thanh_toan} />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Trạng thái</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[hoSo.trang_thai]}`}>
                        {TRANG_THAI_LABELS[hoSo.trang_thai]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">File hợp đồng</p>
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                    >
                      {exporting && <Loader2 size={13} className="animate-spin" />}
                      Xuất hợp đồng (.docx)
                    </button>
                  </div>
                  {exportError && <p className="text-xs text-red-500 mb-2">{exportError}</p>}
                  {files.length === 0 ? (
                    <p className="text-xs text-gray-400">Chưa có file nào được xuất.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {files.map((f) => (
                        <a
                          key={f.id}
                          href={`/api/ho-so/${hoSo.id}/hop-dong-files/${f.id}/download`}
                          className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 text-xs hover:bg-gray-50 transition-colors"
                        >
                          <span className="flex items-center gap-1.5 text-brand-600 font-medium truncate">
                            <FileText size={13} className="shrink-0" /> {f.file_name ?? 'Xem file'}
                          </span>
                          <span className="text-gray-400">
                            {new Date(f.created_at).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewerImage && (
        <ImageViewer url={viewerImage.url} label={viewerImage.label} onClose={() => setViewerImage(null)} />
      )}
    </>
  )
}

function ImagePanel({
  hoSo,
  onUploaded,
  onView,
}: {
  hoSo: HoSoWithNhanSu
  onUploaded: (updated: HoSoWithNhanSu) => void
  onView: (url: string, label: string) => void
}) {
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  async function handleUpload(field: string, file: File) {
    setUploadingField(field)
    const formData = new FormData()
    formData.append('field', field)
    formData.append('file', file)
    const res = await fetch(`/api/ho-so/${hoSo.id}/anh`, { method: 'POST', body: formData })
    setUploadingField(null)
    if (res.ok) {
      const data = await res.json()
      onUploaded(data.ho_so)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ảnh hồ sơ</p>
      {DETAIL_IMAGE_FIELDS.map((f) => {
        const url = hoSo[f.key]
        const uploading = uploadingField === f.key
        return (
          <div key={f.key} className="relative group">
            {url ? (
              <button
                onClick={() => onView(url, f.label)}
                className="w-full aspect-4/3 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh từ Supabase Storage (signed URL động), không phù hợp next/image */}
                <img src={url} alt={f.label} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
              </button>
            ) : (
              <div className="w-full aspect-4/3 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-300">
                <FileText size={20} />
              </div>
            )}
            <label className="absolute bottom-1.5 right-1.5 flex items-center justify-center w-7 h-7 rounded-lg bg-white/90 border border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-300 shadow-sm transition-colors cursor-pointer">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(f.key, file)
                  e.target.value = ''
                }}
              />
            </label>
            <p className="text-[11px] text-gray-500 mt-1 text-center">{f.label}</p>
          </div>
        )
      })}
    </div>
  )
}

function ViewField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className={`text-sm text-gray-900 ${mono ? 'font-mono' : 'font-medium'}`}>
        {value || <span className="text-gray-300 font-normal">—</span>}
      </p>
    </div>
  )
}

function HoSoEditForm({
  hoSo,
  onCancel,
  onSaved,
}: {
  hoSo: HoSoWithNhanSu
  onCancel: () => void
  onSaved: (updated: HoSoWithNhanSu) => void
}) {
  const [nhansu, setNhansu] = useState({
    so_cccd: hoSo.nhansu.so_cccd ?? '',
    ngay_sinh: hoSo.nhansu.ngay_sinh ?? '',
    ngay_cap: hoSo.nhansu.ngay_cap ?? '',
    noi_cap: hoSo.nhansu.noi_cap ?? '',
    dia_chi: hoSo.nhansu.dia_chi ?? '',
    ma_so_thue_tncn: hoSo.nhansu.ma_so_thue_tncn ?? '',
    so_the_hdv: hoSo.nhansu.so_the_hdv ?? '',
    loai_the_hdv: hoSo.nhansu.loai_the_hdv ?? '',
    han_the_hdv: hoSo.nhansu.han_the_hdv ?? '',
    sdt: hoSo.nhansu.sdt ?? '',
    email: hoSo.nhansu.email ?? '',
    stk: hoSo.nhansu.stk ?? '',
    ten_ngan_hang: hoSo.nhansu.ten_ngan_hang ?? '',
  })
  const [hs, setHs] = useState({
    so_hop_dong: hoSo.so_hop_dong ?? '',
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
    const res = await fetch(`/api/ho-so/${hoSo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nhansu: {
          so_cccd: nhansu.so_cccd || null,
          ngay_sinh: nhansu.ngay_sinh || null,
          ngay_cap: nhansu.ngay_cap || null,
          noi_cap: nhansu.noi_cap || null,
          dia_chi: nhansu.dia_chi || null,
          ma_so_thue_tncn: nhansu.ma_so_thue_tncn || null,
          so_the_hdv: nhansu.so_the_hdv || null,
          loai_the_hdv: nhansu.loai_the_hdv || null,
          han_the_hdv: nhansu.han_the_hdv || null,
          sdt: nhansu.sdt || null,
          email: nhansu.email || null,
          stk: nhansu.stk || null,
          ten_ngan_hang: nhansu.ten_ngan_hang || null,
        },
        ho_so: {
          so_hop_dong: hs.so_hop_dong || null,
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
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) onSaved(data.ho_so)
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">CCCD</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số CCCD">
                <input
                  value={nhansu.so_cccd}
                  onChange={(e) => setNhansu((f) => ({ ...f, so_cccd: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="MS thuế TNCN">
                <input
                  value={nhansu.ma_so_thue_tncn}
                  onChange={(e) => setNhansu((f) => ({ ...f, ma_so_thue_tncn: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Ngày sinh">
                <DateInput value={nhansu.ngay_sinh} onChange={(v) => setNhansu((f) => ({ ...f, ngay_sinh: v }))} className="w-full" />
              </Field>
              <Field label="Ngày cấp">
                <DateInput value={nhansu.ngay_cap} onChange={(v) => setNhansu((f) => ({ ...f, ngay_cap: v }))} className="w-full" />
              </Field>
              <Field label="Nơi cấp">
                <input
                  value={nhansu.noi_cap}
                  onChange={(e) => setNhansu((f) => ({ ...f, noi_cap: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Địa chỉ">
                <input
                  value={nhansu.dia_chi}
                  onChange={(e) => setNhansu((f) => ({ ...f, dia_chi: e.target.value }))}
                  className={inputCls}
                />
              </Field>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-2">Thẻ HDV</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số thẻ">
                <input
                  value={nhansu.so_the_hdv}
                  onChange={(e) => setNhansu((f) => ({ ...f, so_the_hdv: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Loại thẻ">
                <input
                  value={nhansu.loai_the_hdv}
                  onChange={(e) => setNhansu((f) => ({ ...f, loai_the_hdv: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Hạn thẻ">
                <DateInput value={nhansu.han_the_hdv} onChange={(v) => setNhansu((f) => ({ ...f, han_the_hdv: v }))} className="w-full" />
              </Field>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-2">Liên hệ &amp; ngân hàng</p>
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
            <Field label="Số hợp đồng">
              <input
                placeholder="VD: 015/2026/HĐHDV"
                value={hs.so_hop_dong}
                onChange={(e) => setHs((f) => ({ ...f, so_hop_dong: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày dịch vụ">
                <DateInput value={hs.ngay_dich_vu} onChange={(v) => setHs((f) => ({ ...f, ngay_dich_vu: v }))} className="w-full" />
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
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
            </div>
          </form>
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
