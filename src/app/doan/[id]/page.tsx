'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  X,
  Pencil,
  FileText,
  Upload,
  UserPlus,
  ImagePlus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Eye,
  Trash2,
  Plus,
} from 'lucide-react'
import type { Doan, HoSoWithNhanSu, TrangThaiHoSo, HoSoHopDongFile, AiExtractedFields, ImageKind, HopDongTemplate, LoaiNhanSu } from '@/types'
import { TRANG_THAI_LABELS } from '@/types'
import { buildDsHdvRows } from '@/lib/export-format'
import { buildContractFileName } from '@/lib/contract-file-name'
import { formatDateVN, deriveTinhTp } from '@/lib/format'
import { useTopbar } from '@/contexts/topbar'
import DateInput from '@/components/DateInput'

const STATUS_COLORS: Record<TrangThaiHoSo, string> = {
  cho_xac_nhan_ai: 'bg-amber-50 text-amber-700',
  da_xac_nhan: 'bg-brand-50 text-brand-700',
  da_thanh_toan: 'bg-emerald-50 text-emerald-700',
  da_xuat_hd: 'bg-violet-50 text-violet-700',
  da_gui_ky_amis: 'bg-violet-50 text-violet-700',
  da_ky_xong: 'bg-emerald-50 text-emerald-700',
}

type Tab = 'info' | 'hdv' | 'files'

const LOAI_THE_HDV_OPTIONS = ['Nội địa', 'Quốc tế']

// Các mức CTP/ngày hay dùng, 800k để đầu (vị trí dễ bấm nhất) + tô nổi bật
const CTP_NGAY_CHIPS = [800000, 500000, 700000, 900000, 1000000, 2000000, 3000000, 4000000, 5000000, 10000000]
const SO_NGAY_CHIPS = [1, 2, 3, 4, 5, 6]

function formatChipMoney(v: number) {
  return v >= 1_000_000 ? `${v / 1_000_000} tr` : `${v / 1000}k`
}

/** Input số tiền có dấu chấm hàng nghìn, click vào hiện chips mức hay dùng. */
function MoneyChipInput({
  value,
  onChange,
  onCommit,
  placeholder,
  className,
}: {
  value: string
  onChange: (digits: string) => void
  onCommit?: () => void
  placeholder?: string
  className?: string
}) {
  const [showChips, setShowChips] = useState(false)
  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={value ? Number(value).toLocaleString('vi-VN') : ''}
        onFocus={() => setShowChips(true)}
        onBlur={() => {
          setShowChips(false)
          onCommit?.()
        }}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className={className ?? inputCls}
      />
      {showChips && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {CTP_NGAY_CHIPS.map((v) => (
            <button
              key={v}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(String(v))
                onCommit?.()
              }}
              className={
                v === 800000
                  ? 'px-2.5 py-1 rounded-full bg-accent-500 text-white text-xs font-bold hover:bg-accent-600 transition-colors'
                  : 'px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors'
              }
            >
              {formatChipMoney(v)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Input số ngày, click vào hiện chips 1-6. */
function DayChipInput({
  value,
  onChange,
  onCommit,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onCommit?: () => void
  className?: string
}) {
  const [showChips, setShowChips] = useState(false)
  return (
    <div>
      <input
        type="number"
        value={value}
        onFocus={() => setShowChips(true)}
        onBlur={() => {
          setShowChips(false)
          onCommit?.()
        }}
        onChange={(e) => onChange(e.target.value)}
        className={className ?? inputCls}
      />
      {showChips && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SO_NGAY_CHIPS.map((v) => (
            <button
              key={v}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(String(v))
                onCommit?.()
              }}
              className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Danh mục "Loại nhân sự" — do kế toán tự tạo (vd "HDV", "MC", "Lái xe"...), có
 *  mã ngắn (`ma`) dùng để đặt tên file hợp đồng + khớp biểu mẫu Word. Mỗi nơi cần
 *  danh sách này tự gọi hook riêng (đơn giản hơn truyền props xuyên nhiều modal độc lập). */
function useLoaiNhanSuList() {
  const [list, setList] = useState<LoaiNhanSu[]>([])

  useEffect(() => {
    async function loadList() {
      const res = await fetch('/api/loai-nhan-su')
      if (!res.ok) return
      const data = await res.json()
      setList((data.loai_nhan_su ?? []) as LoaiNhanSu[])
    }
    void loadList()
  }, [])

  async function create(ten: string): Promise<LoaiNhanSu | null> {
    const res = await fetch('/api/loai-nhan-su', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ten }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const created = data.loai_nhan_su as LoaiNhanSu
    setList((prev) => [...prev, created].sort((a, b) => a.ten.localeCompare(b.ten)))
    return created
  }

  return { list, create }
}

/** Modal nhỏ để nhập tên loại nhân sự mới — dùng chung ở dropdown lọc và ở form thêm/sửa nhân sự. */
function CreateLoaiNhanSuModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (ten: string) => Promise<LoaiNhanSu | null>
}) {
  const [ten, setTen] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!ten.trim() || saving) return
    setSaving(true)
    setError('')
    const created = await onCreate(ten.trim())
    setSaving(false)
    if (!created) {
      setError('Có lỗi xảy ra, thử lại nhé')
      return
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={() => !saving && onClose()} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Tạo loại nhân sự mới</h3>
          <input
            autoFocus
            value={ten}
            onChange={(e) => setTen(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="VD: HDV nội địa, Lái xe..."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300"
          />
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !ten.trim()}
              className="flex-1 px-3 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function DoanDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [doan, setDoan] = useState<Doan | null>(null)
  const [hoSo, setHoSo] = useState<HoSoWithNhanSu[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<HoSoWithNhanSu | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [addingNhanSu, setAddingNhanSu] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [filterLoaiId, setFilterLoaiId] = useState('')
  const [creatingLoai, setCreatingLoai] = useState(false)
  const loaiNhanSu = useLoaiNhanSuList()
  const filteredHoSo = filterLoaiId ? hoSo.filter((r) => r.nhansu.loai_nhan_su_id === filterLoaiId) : hoSo

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  async function handleDeleteDoan() {
    if (!doan || deleting) return
    setDeleting(true)
    const res = await fetch(`/api/doan/${doan.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) router.push('/doan')
  }

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

  async function handleCopy() {
    if (!doan) return
    const text = buildDsHdvRows(doan, hoSo)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
        <button
          onClick={() => setDeleteOpen(true)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0"
          title="Xóa đoàn"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="h-11 md:h-9 flex items-stretch gap-6 px-6 border-b border-gray-200 bg-white">
          <TabButton active={tab === 'info'} onClick={() => setTab('info')}>
            Thông tin đoàn
          </TabButton>
          <TabButton active={tab === 'hdv'} onClick={() => setTab('hdv')}>
            Nhân sự ({hoSo.length})
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
                    onClick={() => setAddingNhanSu(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold transition-colors"
                  >
                    <UserPlus size={13} />
                    Thêm nhân sự
                  </button>
                  <select
                    value={filterLoaiId}
                    onChange={(e) => setFilterLoaiId(e.target.value)}
                    className="text-xs border border-gray-200 rounded-xl px-2.5 py-2 bg-white text-gray-600"
                  >
                    <option value="">Tất cả loại nhân sự</option>
                    {loaiNhanSu.list.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.ten}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCreatingLoai(true)}
                    title="Tạo loại nhân sự mới"
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                  >
                    <Plus size={13} />
                    Loại nhân sự
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    Copy danh sách
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['', 'Nhân sự', 'Liên hệ', 'Thẻ HDV', 'CTP (thực nhận)', 'CTP', 'Ngân hàng', 'Trạng thái'].map((h) => (
                          <th
                            key={h}
                            className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${
                              h === 'CTP (thực nhận)' || h === 'CTP' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredHoSo.map((r) => (
                        <HoSoRow
                          key={`${r.id}:${r.so_ngay_cong_tac}:${r.chi_tra}`}
                          r={r}
                          onView={() => setViewing(r)}
                          onSaved={(updated) => setHoSo((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                          onDeleted={(deletedId) => {
                            setHoSo((prev) => prev.filter((x) => x.id !== deletedId))
                            showToast('Đã xóa khỏi đoàn')
                          }}
                          onToast={showToast}
                        />
                      ))}
                      {filteredHoSo.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-14 text-center text-gray-400">
                            {hoSo.length === 0
                              ? 'Chưa có ai trong đoàn này. Gửi ảnh CCCD/thẻ HDV cho Telegram bot để thêm.'
                              : 'Không có ai thuộc loại nhân sự này.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

          {tab === 'files' && <FilesTab doan={doan} hoSo={hoSo} />}
        </div>
      </div>

      {creatingLoai && (
        <CreateLoaiNhanSuModal onClose={() => setCreatingLoai(false)} onCreate={loaiNhanSu.create} />
      )}

      {viewing && doan && (
        <HoSoDetailModal
          hoSo={viewing}
          doan={doan}
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

      {addingNhanSu && doan && (
        <AddNhanSuModal
          doanId={doan.id}
          existingHoSo={hoSo}
          onClose={() => setAddingNhanSu(false)}
          onAdded={(created) => {
            setHoSo((prev) => [...prev, created])
            showToast(`Đã thêm ${created.nhansu.ho_ten}`)
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {deleteOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => !deleting && setDeleteOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Xóa đoàn?</h3>
              <p className="text-xs text-gray-500 mb-4">
                Xóa đoàn <span className="font-semibold text-gray-700">{doan.ten_doan}</span>? Đoàn sẽ ẩn khỏi danh sách,
                hồ sơ/file hợp đồng bên trong vẫn được giữ lại (xóa mềm, có thể khôi phục nếu cần).
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDeleteDoan}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
                >
                  {deleting && <Loader2 size={14} className="animate-spin" />}
                  Xóa
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** 1 dòng bảng Nhân sự — CTP/ngày (thực nhận) và Số ngày công tác sửa trực tiếp tại đây
 *  (nhập tay hoặc chọn chip), tự lưu khi rời ô hoặc chọn chip xong. */
function HoSoRow({
  r,
  onView,
  onSaved,
  onDeleted,
  onToast,
}: {
  r: HoSoWithNhanSu
  onView: () => void
  onSaved: (updated: HoSoWithNhanSu) => void
  onDeleted: (id: string) => void
  onToast: (msg: string) => void
}) {
  const n = r.nhansu
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [ctp, setCtp] = useState(() =>
    r.chi_tra != null && r.so_ngay_cong_tac ? String(Math.round(r.chi_tra / r.so_ngay_cong_tac)) : '',
  )
  const [soNgay, setSoNgay] = useState(() => r.so_ngay_cong_tac?.toString() ?? '')

  const soNgayNum = Number(soNgay) || 0
  const ctpNum = Number(ctp) || 0
  const chiTra = ctpNum * soNgayNum
  const soTienChiTra = chiTra > 0 ? Math.round(chiTra / 0.9) : 0
  const thueNop = soTienChiTra - chiTra
  const donGiaNgay = soNgayNum > 0 ? Math.round(soTienChiTra / soNgayNum) : 0

  async function commit() {
    const update: Record<string, number | null> = {}
    if (soNgay !== (r.so_ngay_cong_tac?.toString() ?? '')) {
      update.so_ngay_cong_tac = soNgayNum > 0 ? soNgayNum : null
    }
    if (soTienChiTra > 0) {
      update.don_gia_ngay = donGiaNgay
      update.so_tien_chi_tra = soTienChiTra
    }
    if (Object.keys(update).length === 0) return
    const res = await fetch(`/api/ho-so/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ho_so: update }),
    })
    if (res.ok) {
      const data = await res.json()
      onSaved(data.ho_so)
      onToast('Đã lưu')
    }
  }

  function closeEdit() {
    commit()
    setEditOpen(false)
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    const res = await fetch(`/api/ho-so/${r.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setDeleteOpen(false)
      onDeleted(r.id)
    }
  }

  return (
    <>
    <tr className="hover:bg-gray-50/70 transition-colors align-top">
      <td className="px-4 py-3">
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            title="Xem"
            onClick={onView}
            className="p-1 rounded-lg hover:bg-sky-50 text-gray-300 hover:text-sky-500 transition-colors"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            title="Xóa"
            onClick={() => setDeleteOpen(true)}
            className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onView}
          className="font-semibold text-gray-900 hover:text-brand-600 hover:underline decoration-gray-300 transition-colors text-left block"
        >
          <span className="text-gray-400 font-medium">{n.loai_nhan_su?.ma || 'NS'}:</span> {n.ho_ten}
        </button>
        <div className="text-xs text-gray-900 font-mono mt-1">CCCD: {n.so_cccd ?? '-'}</div>
        <div className="text-xs text-gray-900 mt-1">Ngày sinh: {formatDateVN(n.ngay_sinh) || '-'}</div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-900">
        <div>SĐT: {n.sdt ?? '-'}</div>
        <div className="mt-1">Email: {n.email ?? '-'}</div>
        <div className="mt-1">ĐC: {n.dia_chi ?? '-'}</div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-900">
        <div>Số thẻ: {n.so_the_hdv ?? '-'}</div>
        <div className="mt-1">Loại thẻ: {n.loai_the_hdv ?? '-'}</div>
        <div className="mt-1">Hạn thẻ: {formatDateVN(n.han_the_hdv) || '-'}</div>
      </td>
      <td className="px-4 py-3 min-w-42.5">
        <div className="flex items-start justify-end gap-1">
          <div className="text-xs text-gray-900 font-bold text-right">
            <div>Số ngày: {soNgayNum > 0 ? soNgayNum : '-'}</div>
            <div className="mt-1">CTP/ngày: {ctpNum > 0 ? `${ctpNum.toLocaleString('vi-VN')} VNĐ` : '-'}</div>
            <div className="text-red-600 mt-1">
              Tổng: {soTienChiTra > 0 ? `${chiTra.toLocaleString('vi-VN')} VNĐ` : '-'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="p-1 rounded-lg hover:bg-sky-50 text-gray-300 hover:text-sky-500 transition-colors shrink-0"
          >
            <Pencil size={13} />
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-900 font-bold text-right">
        <div>TNCN: {soTienChiTra > 0 ? `${thueNop.toLocaleString('vi-VN')} VNĐ` : '-'}</div>
        <div className="mt-1">CTP/ngày: {soTienChiTra > 0 ? `${donGiaNgay.toLocaleString('vi-VN')} VNĐ` : '-'}</div>
        <div className="mt-1">Tổng: {soTienChiTra > 0 ? `${soTienChiTra.toLocaleString('vi-VN')} VNĐ` : '-'}</div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-900">
        <div>STK: {n.stk ?? '-'}</div>
        <div className="mt-1">Ngân hàng: {n.ten_ngan_hang ?? '-'}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.trang_thai]}`}>
          {TRANG_THAI_LABELS[r.trang_thai]}
        </span>
      </td>
    </tr>

    {editOpen &&
      createPortal(
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeEdit} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">
                  <span className="text-gray-400 font-medium">{n.loai_nhan_su?.ma || 'NS'}:</span> {n.ho_ten}
                </h3>
                <button onClick={closeEdit} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">CTP/ngày</div>
                  <MoneyChipInput value={ctp} onChange={setCtp} onCommit={commit} placeholder="VD: 800.000" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Số ngày</div>
                  <DayChipInput value={soNgay} onChange={setSoNgay} onCommit={commit} />
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-[10px] text-gray-400 mb-1">Tổng</div>
                  <div className="text-base font-bold text-red-600">
                    {soTienChiTra > 0 ? `${chiTra.toLocaleString('vi-VN')} VNĐ` : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}

    {deleteOpen &&
      createPortal(
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => !deleting && setDeleteOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Xóa khỏi đoàn?</h3>
              <p className="text-xs text-gray-500 mb-4">
                Xóa <span className="font-semibold text-gray-700">{n.ho_ten}</span> khỏi đoàn này? Hồ sơ và file hợp đồng đã xuất
                cho người này trong đoàn sẽ mất. Thông tin CCCD/thẻ của người này vẫn được giữ lại (dùng cho đoàn khác).
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
                >
                  {deleting && <Loader2 size={14} className="animate-spin" />}
                  Xóa
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

const IMAGE_KIND_LABELS: Record<ImageKind, string> = {
  cccd_truoc: 'CCCD trước',
  cccd_sau: 'CCCD sau',
  the_hdv: 'Thẻ HDV',
  xac_nhan: 'Xác nhận',
}

const VIEWER_MIN_ZOOM = 0.5
const VIEWER_MAX_ZOOM = 5

/** Khung xem ảnh nhúng (không phải lightbox toàn màn hình) — zoom/xoay/kéo, để
 *  kế toán vừa xem ảnh phóng to vừa đối chiếu với form bên cạnh cùng lúc. Select
 *  ở thanh trên cho sửa lại loại ảnh nếu AI đoán sai. */
function InlineImageViewer({
  url,
  label,
  kind,
  onKindChange,
}: {
  url: string
  label?: string
  kind?: ImageKind | null
  onKindChange?: (kind: ImageKind) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset zoom/xoay khi đổi ảnh đang xem, không phải state phát sinh từ props
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }, [url])

  function clampZoom(z: number) {
    return Math.min(VIEWER_MAX_ZOOM, Math.max(VIEWER_MIN_ZOOM, z))
  }
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom((z) => clampZoom(z - e.deltaY * 0.0015))
  }
  function handleMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setDragging(true)
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    })
  }
  function endDrag() {
    dragRef.current = null
    setDragging(false)
  }
  function reset() {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-900 overflow-hidden select-none">
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-800">
        {onKindChange ? (
          <select
            value={kind ?? ''}
            onChange={(e) => onKindChange(e.target.value as ImageKind)}
            className="text-[11px] bg-transparent text-white/90 border border-white/20 rounded-md px-1 py-0.5"
          >
            <option value="" className="text-gray-900">
              Không rõ
            </option>
            {(Object.keys(IMAGE_KIND_LABELS) as ImageKind[]).map((k) => (
              <option key={k} value={k} className="text-gray-900">
                {IMAGE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[11px] text-white/70 truncate px-0.5">{label}</span>
        )}
        <div className="flex items-center gap-0.5">
          <button type="button" title="Thu nhỏ" onClick={() => setZoom((z) => clampZoom(z - 0.25))} className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10">
            <ZoomOut size={13} />
          </button>
          <button type="button" title="Phóng to" onClick={() => setZoom((z) => clampZoom(z + 0.25))} className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10">
            <ZoomIn size={13} />
          </button>
          <button type="button" title="Xoay trái" onClick={() => setRotation((r) => r - 90)} className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10">
            <RotateCcw size={13} />
          </button>
          <button type="button" title="Xoay phải" onClick={() => setRotation((r) => r + 90)} className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10">
            <RotateCw size={13} />
          </button>
        </div>
      </div>
      <div
        className="h-105 overflow-hidden flex items-center justify-center"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={reset}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Supabase Storage (signed URL động) trong khung xem zoom/xoay */}
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform 0.1s ease-out',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>
    </div>
  )
}

function emptyAiFields(): Record<keyof AiExtractedFields, string> {
  return {
    ho_ten: '',
    so_cccd: '',
    ngay_sinh: '',
    ngay_cap: '',
    noi_cap: '',
    dia_chi: '',
    tinh_tp: '',
    so_the_hdv: '',
    loai_the_hdv: '',
    han_the_hdv: '',
    sdt: '',
    ma_so_thue_tncn: '',
    stk: '',
    ten_ngan_hang: '',
    email: '',
  }
}

/** Modal "Thêm nhân sự": dán/thả bộ ảnh của 1 người → AI đọc + tự phân loại ảnh →
 *  kế toán soát/sửa field → Lưu. Lưu xong tự dọn để thêm tiếp người khác luôn,
 *  không phải mở lại modal (paste liên tục cho nhanh, mỗi lần chỉ 1 người để AI
 *  khỏi nhầm ảnh của ai với ai). */
function AddNhanSuModal({
  doanId,
  existingHoSo,
  onClose,
  onAdded,
}: {
  doanId: string
  existingHoSo: HoSoWithNhanSu[]
  onClose: () => void
  onAdded: (created: HoSoWithNhanSu) => void
}) {
  const [phase, setPhase] = useState<'pick' | 'review'>('pick')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [extracting, setExtracting] = useState(false)
  const [images, setImages] = useState<{ url: string; kind: ImageKind | null }[]>([])
  const [selectedImg, setSelectedImg] = useState(0)
  const [fields, setFields] = useState(emptyAiFields)
  const [loaiNhanSuId, setLoaiNhanSuId] = useState('')
  const [creatingLoai, setCreatingLoai] = useState(false)
  const loaiNhanSu = useLoaiNhanSuList()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [addedCount, setAddedCount] = useState(0)

  // Mặc định chọn loại "HDV" (giống default cũ của prefix) ngay khi danh mục tải xong,
  // kế toán vẫn đổi tay sang loại khác nếu cần.
  useEffect(() => {
    if (loaiNhanSuId || loaiNhanSu.list.length === 0) return
    const hdv = loaiNhanSu.list.find((l) => l.ma.toUpperCase() === 'HDV')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tự chọn sẵn loại mặc định khi danh mục tải xong, kế toán vẫn đổi tay được
    setLoaiNhanSuId((hdv ?? loaiNhanSu.list[0]).id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần tự chọn 1 lần khi danh mục tải xong lần đầu
  }, [loaiNhanSu.list])

  // Trùng CCCD với người đã có sẵn trong CHÍNH đoàn này (không phải toàn hệ thống)
  // — kiểm tra ngay khi biết CCCD, không đợi đến lúc bấm Lưu mới báo.
  const duplicateInDoan = fields.so_cccd
    ? existingHoSo.find((r) => r.nhansu.so_cccd === fields.so_cccd)
    : undefined

  function addFiles(newFiles: File[]) {
    const imgFiles = newFiles.filter((f) => f.type.startsWith('image/'))
    if (imgFiles.length === 0) return
    setFiles((f) => [...f, ...imgFiles])
    setPreviews((p) => [...p, ...imgFiles.map((f) => URL.createObjectURL(f))])
  }

  function removeFile(i: number) {
    setFiles((f) => f.filter((_, idx) => idx !== i))
    setPreviews((p) => p.filter((_, idx) => idx !== i))
  }

  function handlePasteEvent(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    const imgFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) imgFiles.push(file)
      }
    }
    if (imgFiles.length > 0) {
      e.preventDefault()
      addFiles(imgFiles)
    }
  }

  function resetAll() {
    setPhase('pick')
    setFiles([])
    setPreviews([])
    setImages([])
    setSelectedImg(0)
    setFields(emptyAiFields())
    setError('')
  }

  async function handleExtract() {
    if (files.length === 0 || extracting) return
    setExtracting(true)
    setError('')
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    const res = await fetch(`/api/doan/${doanId}/nhansu-moi/extract`, { method: 'POST', body: formData })
    const data = await res.json()
    setExtracting(false)
    if (!res.ok) {
      setError(data.error ?? 'Có lỗi khi đọc ảnh')
      return
    }
    setImages(data.images)
    const f: AiExtractedFields = data.fields ?? {}
    setFields({
      ho_ten: f.ho_ten ?? '',
      so_cccd: f.so_cccd ?? '',
      ngay_sinh: f.ngay_sinh ?? '',
      ngay_cap: f.ngay_cap ?? '',
      noi_cap: f.noi_cap ?? '',
      dia_chi: f.dia_chi ?? '',
      tinh_tp: f.tinh_tp || deriveTinhTp(f.dia_chi),
      so_the_hdv: f.so_the_hdv ?? '',
      loai_the_hdv: f.loai_the_hdv ?? '',
      han_the_hdv: f.han_the_hdv ?? '',
      sdt: f.sdt ?? '',
      ma_so_thue_tncn: f.ma_so_thue_tncn ?? '',
      stk: f.stk ?? '',
      ten_ngan_hang: f.ten_ngan_hang ?? '',
      email: f.email ?? '',
    })
    setPhase('review')
  }

  function setImageKind(i: number, kind: ImageKind) {
    setImages((imgs) => imgs.map((img, idx) => (idx === i ? { ...img, kind } : img)))
  }

  async function saveNhanSu(): Promise<HoSoWithNhanSu | null> {
    if (!fields.ho_ten || saving || duplicateInDoan) return null
    setSaving(true)
    setError('')
    const byKind = (k: ImageKind) => images.find((img) => img.kind === k)?.url ?? null
    const res = await fetch(`/api/doan/${doanId}/nhansu-moi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields,
        loai_nhan_su_id: loaiNhanSuId || undefined,
        anh_cccd_truoc_url: byKind('cccd_truoc'),
        anh_cccd_sau_url: byKind('cccd_sau'),
        anh_the_hdv_url: byKind('the_hdv'),
        anh_xac_nhan_url: byKind('xac_nhan'),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Có lỗi khi lưu')
      return null
    }
    return data.ho_so as HoSoWithNhanSu
  }

  async function handleSaveAndContinue() {
    const created = await saveNhanSu()
    if (!created) return
    onAdded(created)
    setAddedCount((c) => c + 1)
    resetAll()
  }

  async function handleSaveAndClose() {
    const created = await saveNhanSu()
    if (!created) return
    onAdded(created)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col ${phase === 'review' ? 'max-w-5xl' : 'max-w-lg'}`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Thêm nhân sự</h2>
              {addedCount > 0 && <p className="text-xs text-emerald-600 font-medium">Đã thêm {addedCount} người</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>

          {phase === 'pick' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    addFiles(Array.from(e.dataTransfer.files))
                  }}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-8 px-4 text-center hover:border-brand-300 transition-colors"
                >
                  <ImagePlus size={28} className="text-gray-300" />
                  <p className="text-sm text-gray-500">
                    Kéo thả ảnh vào đây, hoặc{' '}
                    <label className="text-brand-600 font-semibold cursor-pointer hover:underline">
                      chọn ảnh
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addFiles(Array.from(e.target.files ?? []))
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-gray-400 mb-1">CCCD 2 mặt, thẻ HDV, ảnh xác nhận — của 1 người</p>
                  <input
                    type="text"
                    autoFocus
                    onPaste={handlePasteEvent}
                    placeholder="Bấm vào đây rồi dán ảnh (Ctrl+V)"
                    className="w-full max-w-xs text-sm text-center border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder:text-gray-400"
                  />
                </div>

                {previews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {previews.map((src, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
                        {/* eslint-disable-next-line @next/next/no-img-element -- preview ảnh local (blob URL), không phù hợp next/image */}
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={files.length === 0 || extracting}
                  className="w-full flex items-center justify-center gap-2 mt-4 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
                >
                  {extracting && <Loader2 size={14} className="animate-spin" />}
                  {extracting ? 'Đang đọc ảnh...' : 'Trích xuất thông tin'}
                </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-[380px_1fr] flex-1 min-h-0">
              <div className="space-y-2 overflow-y-auto p-6 border-r border-gray-100">
                  {images[selectedImg] && (
                    <InlineImageViewer
                      url={images[selectedImg].url}
                      kind={images[selectedImg].kind}
                      onKindChange={(k) => setImageKind(selectedImg, k)}
                    />
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, i) => (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => setSelectedImg(i)}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                          i === selectedImg ? 'border-brand-500' : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail ảnh Supabase Storage (signed URL động) */}
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 space-y-3 overflow-y-auto p-6">
                  {duplicateInDoan && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl px-3 py-2.5">
                      <span>
                        <strong>{duplicateInDoan.nhansu.ho_ten}</strong> (CCCD {fields.so_cccd}) đã có trong đoàn này rồi — không thể thêm trùng. Đóng lại và sửa trực tiếp hồ sơ đã có thay vì tạo mới.
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Họ tên">
                      <input value={fields.ho_ten} onChange={(e) => setFields((f) => ({ ...f, ho_ten: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="Số CCCD">
                      <input value={fields.so_cccd} onChange={(e) => setFields((f) => ({ ...f, so_cccd: e.target.value }))} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Loại nhân sự">
                    <div className="flex gap-2">
                      <select value={loaiNhanSuId} onChange={(e) => setLoaiNhanSuId(e.target.value)} className={`${inputCls} flex-1`}>
                        {loaiNhanSu.list.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.ten}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setCreatingLoai(true)}
                        title="Tạo loại nhân sự mới"
                        className="shrink-0 px-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ngày sinh">
                      <DateInput value={fields.ngay_sinh} onChange={(v) => setFields((f) => ({ ...f, ngay_sinh: v }))} className="w-full" />
                    </Field>
                    <Field label="Địa chỉ">
                      <input value={fields.dia_chi} onChange={(e) => setFields((f) => ({ ...f, dia_chi: e.target.value }))} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Ngày cấp">
                      <DateInput value={fields.ngay_cap} onChange={(v) => setFields((f) => ({ ...f, ngay_cap: v }))} className="w-full" />
                    </Field>
                    <Field label="Nơi cấp">
                      <input value={fields.noi_cap} onChange={(e) => setFields((f) => ({ ...f, noi_cap: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="Tỉnh/TP">
                      <input value={fields.tinh_tp} onChange={(e) => setFields((f) => ({ ...f, tinh_tp: e.target.value }))} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Số thẻ HDV">
                      <input value={fields.so_the_hdv} onChange={(e) => setFields((f) => ({ ...f, so_the_hdv: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="Loại thẻ">
                      <select
                        value={fields.loai_the_hdv}
                        onChange={(e) => setFields((f) => ({ ...f, loai_the_hdv: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="">- Chọn -</option>
                        {LOAI_THE_HDV_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Hạn thẻ">
                      <DateInput value={fields.han_the_hdv} onChange={(v) => setFields((f) => ({ ...f, han_the_hdv: v }))} className="w-full" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="SĐT">
                      <input value={fields.sdt} onChange={(e) => setFields((f) => ({ ...f, sdt: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="Email">
                      <input value={fields.email} onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="MS thuế TNCN">
                      <input value={fields.ma_so_thue_tncn} onChange={(e) => setFields((f) => ({ ...f, ma_so_thue_tncn: e.target.value }))} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="STK">
                      <input value={fields.stk} onChange={(e) => setFields((f) => ({ ...f, stk: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="Ngân hàng">
                      <input value={fields.ten_ngan_hang} onChange={(e) => setFields((f) => ({ ...f, ten_ngan_hang: e.target.value }))} className={inputCls} />
                    </Field>
                  </div>

                  {error && <p className="text-xs text-red-500">{error}</p>}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveAndContinue}
                      disabled={!fields.ho_ten || saving || !!duplicateInDoan}
                      className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
                    >
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      Lưu và thêm nhân sự khác
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAndClose}
                      disabled={!fields.ho_ten || saving || !!duplicateInDoan}
                      className="px-4 py-2.5 rounded-xl border border-accent-300 text-sm font-semibold text-accent-600 hover:bg-accent-50 disabled:opacity-50 transition-colors"
                    >
                      Lưu và đóng
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
      {creatingLoai && (
        <CreateLoaiNhanSuModal
          onClose={() => setCreatingLoai(false)}
          onCreate={async (ten) => {
            const created = await loaiNhanSu.create(ten)
            if (created) setLoaiNhanSuId(created.id)
            return created
          }}
        />
      )}
    </>
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

function FilesTab({ doan, hoSo }: { doan: Doan; hoSo: HoSoWithNhanSu[] }) {
  const withFile = hoSo.filter((r) => r.file_hop_dong_url)
  const withFileIds = withFile.map((r) => r.id).join(',')
  const [latestFileId, setLatestFileId] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function loadLatestFileIds() {
      const ids = withFileIds ? withFileIds.split(',') : []
      const entries = await Promise.all(
        ids.map(async (hoSoId) => {
          const res = await fetch(`/api/ho-so/${hoSoId}/hop-dong-files`)
          if (!res.ok) return null
          const data = await res.json()
          const latest = (data.files as HoSoHopDongFile[] | undefined)?.[0]
          return latest ? ([hoSoId, latest.id] as const) : null
        }),
      )
      if (cancelled) return
      setLatestFileId(Object.fromEntries(entries.filter((e): e is [string, string] => e !== null)))
    }
    void loadLatestFileIds()
    return () => {
      cancelled = true
    }
  }, [withFileIds])

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
                {latestFileId[r.id] ? (
                  <a
                    href={`/api/ho-so/${r.id}/hop-dong-files/${latestFileId[r.id]}/download`}
                    className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
                  >
                    <FileText size={13} /> {buildContractFileName(doan, r)}
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    <FileText size={13} /> {buildContractFileName(doan, r)}
                  </span>
                )}
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

function nhansuFormFrom(hoSo: HoSoWithNhanSu) {
  const n = hoSo.nhansu
  return {
    so_cccd: n.so_cccd ?? '',
    ngay_sinh: n.ngay_sinh ?? '',
    ngay_cap: n.ngay_cap ?? '',
    noi_cap: n.noi_cap ?? '',
    dia_chi: n.dia_chi ?? '',
    tinh_tp: n.tinh_tp ?? '',
    ma_so_thue_tncn: n.ma_so_thue_tncn ?? '',
    so_the_hdv: n.so_the_hdv ?? '',
    loai_the_hdv: n.loai_the_hdv ?? '',
    han_the_hdv: n.han_the_hdv ?? '',
    sdt: n.sdt ?? '',
    email: n.email ?? '',
    stk: n.stk ?? '',
    ten_ngan_hang: n.ten_ngan_hang ?? '',
    loai_nhan_su_id: n.loai_nhan_su_id ?? '',
  }
}

function hsFormFrom(hoSo: HoSoWithNhanSu, doan: Doan) {
  return {
    so_hop_dong: hoSo.so_hop_dong ?? '',
    ngay_ky: hoSo.ngay_ky ?? '',
    // Mặc định lấy ngày đi/về của đoàn — kế toán chỉ sửa riêng khi người này
    // tham gia lệch ngày so với cả đoàn.
    ngay_dich_vu: hoSo.ngay_dich_vu ?? doan.ngay_di ?? '',
    ngay_ket_thuc: hoSo.ngay_ket_thuc ?? doan.ngay_ve ?? '',
    so_ngay_cong_tac: hoSo.so_ngay_cong_tac?.toString() ?? '',
    ctp_ngay_thuc_nhan:
      hoSo.chi_tra != null && hoSo.so_ngay_cong_tac
        ? String(Math.round(hoSo.chi_tra / hoSo.so_ngay_cong_tac))
        : '',
    loai_hop_dong: hoSo.loai_hop_dong ?? '',
    tinh_trang_thanh_toan: hoSo.tinh_trang_thanh_toan ?? '',
    trang_thai: hoSo.trang_thai,
  }
}

function HoSoDetailModal({
  hoSo,
  doan,
  onClose,
  onSaved,
  onExported,
}: {
  hoSo: HoSoWithNhanSu
  doan: Doan
  onClose: () => void
  onSaved: (updated: HoSoWithNhanSu) => void
  onExported: (updated: HoSoWithNhanSu) => void
}) {
  const n = hoSo.nhansu
  const [editing, setEditing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [files, setFiles] = useState<HoSoHopDongFile[]>([])
  const [templates, setTemplates] = useState<HopDongTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [creatingLoai, setCreatingLoai] = useState(false)
  const loaiNhanSu = useLoaiNhanSuList()

  const [nhansu, setNhansu] = useState(() => nhansuFormFrom(hoSo))
  const [hs, setHs] = useState(() => hsFormFrom(hoSo, doan))
  const [submitting, setSubmitting] = useState(false)

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

  useEffect(() => {
    async function loadTemplates() {
      const res = await fetch('/api/hop-dong-templates')
      if (!res.ok) return
      const data = await res.json()
      const list = ((data.templates ?? []) as HopDongTemplate[]).filter((t) => t.is_active)
      setTemplates(list)
      const ma = n.loai_nhan_su?.ma?.toLowerCase() ?? ''
      const matched = list.find((t) => t.loai?.toLowerCase() === ma)
      setTemplateId((matched ?? list[0])?.id ?? '')
    }
    void loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- n.loai_nhan_su gắn với hoSo.id, chỉ cần chạy lại khi đổi hồ sơ đang xem
  }, [hoSo.id])

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportError('')
    const res = await fetch(`/api/ho-so/${hoSo.id}/xuat-hop-dong`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId || undefined }),
    })
    const data = await res.json()
    setExporting(false)
    if (!res.ok) {
      setExportError(data.error ?? 'Có lỗi xảy ra')
      return
    }
    onExported(data.ho_so)
    loadFiles()
  }

  function startEditing() {
    setNhansu(nhansuFormFrom(hoSo))
    setHs(hsFormFrom(hoSo, doan))
    setEditing(true)
  }

  // Kế toán chỉ gõ công tác phí thực nhận/ngày (a1, vd 800k) — các cột còn lại
  // tự tính ra để khớp đúng công thức thuế 10%/90% đã áp dụng ở server.
  const soNgay = Number(hs.so_ngay_cong_tac) || 0
  const ctpNgayThucNhan = Number(hs.ctp_ngay_thuc_nhan) || 0
  const chiTra = ctpNgayThucNhan * soNgay
  const soTienChiTra = chiTra > 0 ? Math.round(chiTra / 0.9) : 0
  const thueNop = soTienChiTra - chiTra
  const donGiaNgay = soNgay > 0 ? Math.round(soTienChiTra / soNgay) : 0

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
          tinh_tp: nhansu.tinh_tp || null,
          ma_so_thue_tncn: nhansu.ma_so_thue_tncn || null,
          so_the_hdv: nhansu.so_the_hdv || null,
          loai_the_hdv: nhansu.loai_the_hdv || null,
          han_the_hdv: nhansu.han_the_hdv || null,
          sdt: nhansu.sdt || null,
          email: nhansu.email || null,
          stk: nhansu.stk || null,
          ten_ngan_hang: nhansu.ten_ngan_hang || null,
          loai_nhan_su_id: nhansu.loai_nhan_su_id || null,
        },
        ho_so: {
          so_hop_dong: hs.so_hop_dong || null,
          ngay_ky: hs.ngay_ky || null,
          ngay_dich_vu: hs.ngay_dich_vu || null,
          ngay_ket_thuc: hs.ngay_ket_thuc || null,
          so_ngay_cong_tac: hs.so_ngay_cong_tac ? Number(hs.so_ngay_cong_tac) : null,
          don_gia_ngay: soTienChiTra > 0 ? donGiaNgay : null,
          so_tien_chi_tra: soTienChiTra > 0 ? soTienChiTra : null,
          loai_hop_dong: hs.loai_hop_dong || null,
          tinh_trang_thanh_toan: hs.tinh_trang_thanh_toan || null,
          trang_thai: hs.trang_thai,
        },
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      setEditing(false)
      onSaved(data.ho_so)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                <span className="text-gray-400 font-semibold">{n.loai_nhan_su?.ma || 'NS'}:</span> {n.ho_ten}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    form="ho-so-edit-form"
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                  >
                    {submitting && <Loader2 size={13} className="animate-spin" />}
                    Lưu
                  </button>
                </>
              ) : (
                <button
                  onClick={startEditing}
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

          <form id="ho-so-edit-form" onSubmit={handleSubmit} className="grid md:grid-cols-[40%_1fr] flex-1 min-h-0">
            <div className="overflow-y-auto p-6 border-r border-gray-100">
              <ImagePanel hoSo={hoSo} onUploaded={onSaved} />
            </div>

            <div className="space-y-6 min-w-0 overflow-y-auto p-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Phân loại</p>
                  <InfoField
                    editing={editing}
                    label="Loại nhân sự"
                    value={loaiNhanSu.list.find((l) => l.id === n.loai_nhan_su_id)?.ten ?? null}
                    input={
                      <div className="flex gap-2">
                        <select
                          value={nhansu.loai_nhan_su_id}
                          onChange={(e) => setNhansu((f) => ({ ...f, loai_nhan_su_id: e.target.value }))}
                          className={`${inputCls} flex-1`}
                        >
                          {loaiNhanSu.list.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.ten}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setCreatingLoai(true)}
                          title="Tạo loại nhân sự mới"
                          className="shrink-0 px-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    }
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">CCCD</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <InfoField
                        editing={editing}
                        label="Số CCCD"
                        value={n.so_cccd}
                        mono
                        input={<input value={nhansu.so_cccd} onChange={(e) => setNhansu((f) => ({ ...f, so_cccd: e.target.value }))} className={inputCls} />}
                      />
                      <InfoField
                        editing={editing}
                        label="Ngày sinh"
                        value={formatDateVN(n.ngay_sinh)}
                        input={<DateInput value={nhansu.ngay_sinh} onChange={(v) => setNhansu((f) => ({ ...f, ngay_sinh: v }))} className="w-full" />}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoField
                        editing={editing}
                        label="Ngày cấp"
                        value={formatDateVN(n.ngay_cap)}
                        input={<DateInput value={nhansu.ngay_cap} onChange={(v) => setNhansu((f) => ({ ...f, ngay_cap: v }))} className="w-full" />}
                      />
                      <InfoField
                        editing={editing}
                        label="Nơi cấp"
                        value={n.noi_cap}
                        input={<input value={nhansu.noi_cap} onChange={(e) => setNhansu((f) => ({ ...f, noi_cap: e.target.value }))} className={inputCls} />}
                      />
                    </div>
                    <InfoField
                      editing={editing}
                      label="Địa chỉ"
                      value={n.dia_chi}
                      input={<input value={nhansu.dia_chi} onChange={(e) => setNhansu((f) => ({ ...f, dia_chi: e.target.value }))} className={inputCls} />}
                    />
                    <InfoField
                      editing={editing}
                      label="Tỉnh/TP"
                      value={n.tinh_tp}
                      input={<input value={nhansu.tinh_tp} onChange={(e) => setNhansu((f) => ({ ...f, tinh_tp: e.target.value }))} className={inputCls} />}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Thẻ HDV</p>
                  <div className="grid grid-cols-3 gap-4">
                    <InfoField
                      editing={editing}
                      label="Số thẻ"
                      value={n.so_the_hdv}
                      input={<input value={nhansu.so_the_hdv} onChange={(e) => setNhansu((f) => ({ ...f, so_the_hdv: e.target.value }))} className={inputCls} />}
                    />
                    <InfoField
                      editing={editing}
                      label="Loại thẻ"
                      value={n.loai_the_hdv}
                      input={
                        <select
                          value={nhansu.loai_the_hdv}
                          onChange={(e) => setNhansu((f) => ({ ...f, loai_the_hdv: e.target.value }))}
                          className={inputCls}
                        >
                          <option value="">- Chọn -</option>
                          {LOAI_THE_HDV_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      }
                    />
                    <InfoField
                      editing={editing}
                      label="Hạn thẻ"
                      value={formatDateVN(n.han_the_hdv)}
                      input={<DateInput value={nhansu.han_the_hdv} onChange={(v) => setNhansu((f) => ({ ...f, han_the_hdv: v }))} className="w-full" />}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Liên hệ</p>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoField
                      editing={editing}
                      label="SĐT"
                      value={n.sdt}
                      input={<input value={nhansu.sdt} onChange={(e) => setNhansu((f) => ({ ...f, sdt: e.target.value }))} className={inputCls} />}
                    />
                    <InfoField
                      editing={editing}
                      label="Email"
                      value={n.email}
                      input={<input value={nhansu.email} onChange={(e) => setNhansu((f) => ({ ...f, email: e.target.value }))} className={inputCls} />}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Ngân hàng</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <InfoField
                        editing={editing}
                        label="STK"
                        value={n.stk}
                        input={<input value={nhansu.stk} onChange={(e) => setNhansu((f) => ({ ...f, stk: e.target.value }))} className={inputCls} />}
                      />
                      <InfoField
                        editing={editing}
                        label="Ngân hàng"
                        value={n.ten_ngan_hang}
                        input={<input value={nhansu.ten_ngan_hang} onChange={(e) => setNhansu((f) => ({ ...f, ten_ngan_hang: e.target.value }))} className={inputCls} />}
                      />
                    </div>
                    <InfoField
                      editing={editing}
                      label="MS thuế TNCN"
                      value={n.ma_so_thue_tncn}
                      input={<input value={nhansu.ma_so_thue_tncn} onChange={(e) => setNhansu((f) => ({ ...f, ma_so_thue_tncn: e.target.value }))} className={inputCls} />}
                    />
                  </div>
                </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Hợp đồng</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <InfoField
                    editing={editing}
                    stacked
                    label="Số hợp đồng"
                    value={hoSo.so_hop_dong}
                    input={<input placeholder="VD: 015/2026/HĐHDV" value={hs.so_hop_dong} onChange={(e) => setHs((f) => ({ ...f, so_hop_dong: e.target.value }))} className={inputCls} />}
                  />
                  <InfoField
                    editing={editing}
                    stacked
                    label="Ngày ký"
                    value={formatDateVN(hoSo.ngay_ky)}
                    input={<DateInput value={hs.ngay_ky} onChange={(v) => setHs((f) => ({ ...f, ngay_ky: v }))} className="w-full" />}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <InfoField
                    editing={editing}
                    stacked
                    label="Ngày đi"
                    value={formatDateVN(hoSo.ngay_dich_vu)}
                    input={<DateInput value={hs.ngay_dich_vu} onChange={(v) => setHs((f) => ({ ...f, ngay_dich_vu: v }))} className="w-full" />}
                  />
                  <InfoField
                    editing={editing}
                    stacked
                    label="Ngày về"
                    value={formatDateVN(hoSo.ngay_ket_thuc)}
                    input={<DateInput value={hs.ngay_ket_thuc} onChange={(v) => setHs((f) => ({ ...f, ngay_ket_thuc: v }))} className="w-full" />}
                  />
                </div>
                <div className="grid sm:grid-cols-3 gap-4 mt-4">
                  <InfoField
                    editing={editing}
                    stacked
                    right
                    label="CTP/ngày (thực nhận)"
                    value={hoSo.chi_tra != null && hoSo.so_ngay_cong_tac ? Math.round(hoSo.chi_tra / hoSo.so_ngay_cong_tac).toLocaleString('vi-VN') : null}
                    input={
                      <MoneyChipInput
                        value={hs.ctp_ngay_thuc_nhan}
                        onChange={(digits) => setHs((f) => ({ ...f, ctp_ngay_thuc_nhan: digits }))}
                        placeholder="VD: 800.000"
                      />
                    }
                  />
                  <InfoField
                    editing={editing}
                    stacked
                    right
                    label="Số ngày công tác"
                    value={hoSo.so_ngay_cong_tac?.toString() ?? null}
                    input={
                      <DayChipInput
                        value={hs.so_ngay_cong_tac}
                        onChange={(v) => setHs((f) => ({ ...f, so_ngay_cong_tac: v }))}
                      />
                    }
                  />
                  <InfoField
                    editing={editing}
                    stacked
                    right
                    label="Tổng thực nhận"
                    value={hoSo.chi_tra?.toLocaleString('vi-VN') ?? null}
                    emphasize
                    input={
                      <input
                        readOnly
                        value={soTienChiTra > 0 ? chiTra.toLocaleString('vi-VN') : ''}
                        className="w-full text-sm border border-gray-200 bg-gray-50 text-red-600 font-bold rounded-xl px-3 py-2 cursor-not-allowed"
                      />
                    }
                  />
                  <InfoField
                    editing={editing}
                    stacked
                    right
                    label="CTP/ngày"
                    value={hoSo.don_gia_ngay?.toLocaleString('vi-VN') ?? null}
                    input={<input readOnly value={donGiaNgay > 0 ? donGiaNgay.toLocaleString('vi-VN') : ''} className={readOnlyInputCls} />}
                  />
                  <InfoField
                    editing={editing}
                    stacked
                    right
                    label="Thuế TNCN"
                    value={hoSo.thue_nop?.toLocaleString('vi-VN') ?? null}
                    input={<input readOnly value={soTienChiTra > 0 ? thueNop.toLocaleString('vi-VN') : ''} className={readOnlyInputCls} />}
                  />
                  <InfoField
                    editing={editing}
                    stacked
                    right
                    label="Tổng CTP"
                    value={hoSo.so_tien_chi_tra?.toLocaleString('vi-VN') ?? null}
                    input={<input readOnly value={soTienChiTra > 0 ? soTienChiTra.toLocaleString('vi-VN') : ''} className={readOnlyInputCls} />}
                  />
                  {/* Trạng thái: ẩn tạm trong modal chi tiết, sẽ hiện lại sau. Vẫn hiện ở cột Trạng thái trên bảng Nhân sự. */}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">File hợp đồng</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      disabled={templates.length === 0}
                      className="text-xs border border-gray-200 rounded-xl px-2.5 py-2 bg-white text-gray-700 disabled:opacity-60"
                    >
                      {templates.length === 0 ? (
                        <option value="">Chưa có biểu mẫu</option>
                      ) : (
                        templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.ten}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={exporting || !templateId}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                    >
                      {exporting && <Loader2 size={13} className="animate-spin" />}
                      Xuất hợp đồng (.docx)
                    </button>
                  </div>
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
          </form>
        </div>
      </div>
      {creatingLoai && (
        <CreateLoaiNhanSuModal
          onClose={() => setCreatingLoai(false)}
          onCreate={async (ten) => {
            const created = await loaiNhanSu.create(ten)
            if (created) setNhansu((f) => ({ ...f, loai_nhan_su_id: created.id }))
            return created
          }}
        />
      )}
    </>
  )
}

function ImagePanel({
  hoSo,
  onUploaded,
}: {
  hoSo: HoSoWithNhanSu
  onUploaded: (updated: HoSoWithNhanSu) => void
}) {
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const idx = DETAIL_IMAGE_FIELDS.findIndex((f) => hoSo[f.key])
    return idx >= 0 ? idx : 0
  })

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

  const selected = DETAIL_IMAGE_FIELDS[selectedIdx]
  const selectedUrl = hoSo[selected.key]
  const selectedUploading = uploadingField === selected.key

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ảnh hồ sơ</p>

      {selectedUrl ? (
        <InlineImageViewer url={selectedUrl} label={selected.label} />
      ) : (
        <div className="h-72 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-300">
          <FileText size={24} />
          <label className="text-xs text-brand-600 font-semibold cursor-pointer hover:underline">
            {selectedUploading ? 'Đang tải...' : `Tải ${selected.label}`}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={selectedUploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(selected.key, file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {DETAIL_IMAGE_FIELDS.map((f, i) => {
          const url = hoSo[f.key]
          const uploading = uploadingField === f.key
          return (
            <div key={f.key} className="relative group">
              <button
                type="button"
                onClick={() => setSelectedIdx(i)}
                className={`w-full aspect-square rounded-lg overflow-hidden border-2 flex items-center justify-center transition-colors ${
                  i === selectedIdx ? 'border-brand-500' : 'border-transparent hover:border-gray-300'
                } ${url ? 'bg-gray-50' : 'border-dashed border-gray-200 bg-gray-50'}`}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- thumbnail ảnh Supabase Storage (signed URL động)
                  <img src={url} alt={f.label} className="w-full h-full object-cover" />
                ) : (
                  <FileText size={16} className="text-gray-300" />
                )}
              </button>
              <label className="absolute bottom-1 right-1 flex items-center justify-center w-5 h-5 rounded-md bg-white/90 border border-gray-200 text-gray-500 hover:text-brand-600 shadow-sm transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ViewField({
  label,
  value,
  mono,
  emphasize,
  right,
}: {
  label: string
  value?: string | null
  mono?: boolean
  emphasize?: boolean
  stacked?: boolean
  right?: boolean
}) {
  return (
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${emphasize ? 'text-red-500' : 'text-gray-400'} ${right ? 'text-right' : ''}`}>{label}</p>
      <div
        className={`min-w-0 truncate text-sm border border-gray-200 rounded-xl bg-gray-50 px-3 py-2 ${right ? 'text-right' : ''} ${
          emphasize ? 'text-red-600 font-bold' : mono ? 'font-mono text-gray-900' : 'font-medium text-gray-900'
        }`}
      >
        {value || <span className="text-gray-300 font-normal">—</span>}
      </div>
    </div>
  )
}

function InfoField({
  editing,
  label,
  value,
  mono,
  emphasize,
  stacked,
  right,
  input,
}: {
  editing: boolean
  label: string
  value?: string | null
  mono?: boolean
  emphasize?: boolean
  stacked?: boolean
  right?: boolean
  input: React.ReactNode
}) {
  return editing ? (
    <Field label={label} emphasize={emphasize} right={right}>
      {input}
    </Field>
  ) : (
    <ViewField label={label} value={value} mono={mono} emphasize={emphasize} stacked={stacked} right={right} />
  )
}

const inputCls =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400'

const readOnlyInputCls = 'w-full text-sm border border-gray-200 bg-gray-50 text-gray-500 rounded-xl px-3 py-2 cursor-not-allowed'

function Field({
  label,
  children,
  emphasize,
  right,
}: {
  label: string
  children: React.ReactNode
  emphasize?: boolean
  right?: boolean
}) {
  return (
    <div>
      <label className={`block text-xs font-semibold mb-1 ${emphasize ? 'text-red-500' : 'text-gray-500'} ${right ? 'text-right' : ''}`}>
        {label}
      </label>
      <div className={right ? '[&_input]:text-right' : undefined}>{children}</div>
    </div>
  )
}
