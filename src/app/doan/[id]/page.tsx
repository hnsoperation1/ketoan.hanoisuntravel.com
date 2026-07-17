'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Copy, Check, X, Pencil } from 'lucide-react'
import type { Doan, HoSoWithNhanSu, TrangThaiHoSo } from '@/types'
import { TRANG_THAI_LABELS } from '@/types'
import { buildDsHdvRows, buildTheoDoiHopDongRows } from '@/lib/export-format'
import { formatDateVN } from '@/lib/format'

const STATUS_COLORS: Record<TrangThaiHoSo, string> = {
  cho_xac_nhan_ai: 'bg-amber-50 text-amber-700',
  da_xac_nhan: 'bg-brand-50 text-brand-700',
  da_thanh_toan: 'bg-emerald-50 text-emerald-700',
  da_xuat_hd: 'bg-violet-50 text-violet-700',
  da_gui_ky_amis: 'bg-violet-50 text-violet-700',
  da_ky_xong: 'bg-emerald-50 text-emerald-700',
}

export default function DoanDetailPage() {
  const params = useParams<{ id: string }>()
  const [doan, setDoan] = useState<Doan | null>(null)
  const [hoSo, setHoSo] = useState<HoSoWithNhanSu[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<HoSoWithNhanSu | null>(null)
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{doan.ten_doan}</h1>
        <p className="text-sm text-gray-500">
          {doan.hanh_trinh ? `${doan.hanh_trinh} · ` : ''}
          {formatDateVN(doan.ngay_di)}
          {doan.ngay_ve ? ` – ${formatDateVN(doan.ngay_ve)}` : ''}
          {doan.sl_khach != null ? ` · ${doan.sl_khach} khách` : ''}
        </p>
      </div>

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
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
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
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{r.nhansu.prefix}</span>
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
    </div>
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
