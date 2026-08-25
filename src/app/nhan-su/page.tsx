'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { RefreshCw, Search, X, Loader2, Eye, ArrowRight, QrCode } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { TRANG_THAI_LABELS } from '@/types'
import type { LoaiNhanSu, TrangThaiHoSo } from '@/types'
import { formatDateVN } from '@/lib/format'
import DateInput from '@/components/DateInput'
import { useResizableColumns } from '@/hooks/useResizableColumns'

const TONG_HOP_COLS = [
  { key: 'nhan_su', label: 'Nhân sự', width: 220 },
  { key: 'lien_he', label: 'Liên hệ', width: 180 },
  { key: 'ngan_hang', label: 'Ngân hàng', width: 200 },
  { key: 'du_ho_so', label: 'Đủ hồ sơ/chứng từ', align: 'center' as const, width: 130 },
  { key: 'da_tra_do', label: 'Đã trả đồ đoàn', align: 'center' as const, width: 120 },
  { key: 'action', label: '', width: 50 },
]
const TOAN_BO_COLS = [
  { key: 'nhan_su', label: 'Nhân sự', width: 220 },
  { key: 'lien_he', label: 'Liên hệ', width: 180 },
  { key: 'ngan_hang', label: 'Ngân hàng', width: 200 },
  { key: 'trang_thai', label: 'Trạng thái tham gia', width: 170 },
  { key: 'action', label: '', width: 50 },
]
const PAYMENT_COLS = [
  { key: 'nhan_su', label: 'Nhân sự', width: 200 },
  { key: 'doan', label: 'Đoàn', width: 180 },
  { key: 'ngay_dv', label: 'Ngày dịch vụ', width: 120 },
  { key: 'ctp', label: 'CTP', align: 'right' as const, width: 120 },
  { key: 'trang_thai', label: 'Trạng thái', width: 130 },
  { key: 'duyet', label: 'Kế toán trưởng duyệt', align: 'center' as const, width: 150 },
  { key: 'action', label: '', width: 60 },
]

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

// Dòng phẳng ho_so (mọi đoàn, mọi nhân sự) — nguồn dữ liệu chung cho CẢ 3
// tab, MỖI DÒNG = 1 lượt 1 người tham gia 1 đoàn (cùng 1 người đi nhiều
// đoàn thì lặp lại nhiều dòng, không gom theo người) — xem GET
// /api/nhansu/ho-so-list.
type HoSoFlat = {
  id: string
  doan_id: string
  nhansu_id: string
  ngay_dich_vu: string | null
  chi_tra: number | null
  trang_thai: TrangThaiHoSo
  du_ho_so_chung_tu: boolean
  da_tra_do_doan: boolean
  ke_toan_truong_duyet: boolean
  nhansu: {
    id: string
    ho_ten: string
    so_cccd: string | null
    sdt: string | null
    email: string | null
    stk: string | null
    ten_ngan_hang: string | null
    loai_nhan_su_id: string
    loai_nhan_su: LoaiNhanSu | null
  } | null
  doan: DoanSummary | null
}

type Tab = 'tong_hop' | 'can_thanh_toan' | 'da_thanh_toan' | 'toan_bo'
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

const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

// Mã BIN NAPAS (VietQR) — CHỈ liệt kê các ngân hàng đã thực tế thấy trong
// dữ liệu nhân sự thuê ngoài (đỡ rủi ro gõ nhầm mã của ngân hàng ít gặp) +
// vài ngân hàng phổ biến khác. Ngân hàng nào không có trong danh sách này
// thì KHÔNG tạo QR (báo rõ cho kế toán, không đoán bừa mã sai).
const BANK_BIN_MAP: Record<string, string> = {
  VIETCOMBANK: '970436', VCB: '970436',
  VIETINBANK: '970415', CTG: '970415', VIETTINBANK: '970415',
  BIDV: '970418',
  TECHCOMBANK: '970407', TCB: '970407',
  MBBANK: '970422', MB: '970422', MILITARYBANK: '970422',
  VPBANK: '970432', VPB: '970432',
  ACB: '970416',
  TPBANK: '970423', TPB: '970423',
  SACOMBANK: '970403', STB: '970403',
  AGRIBANK: '970405',
  SHB: '970443',
  HDBANK: '970437', HDB: '970437',
  VIB: '970441',
  EXIMBANK: '970431', EIB: '970431',
  MSB: '970426',
}

// Chuẩn hoá "ten_ngan_hang" (text tự do, hay kèm chi nhánh vd "Vietcombank
// - CN Gò Vấp") về đúng key trong BANK_BIN_MAP — cắt bỏ phần sau dấu "-"
// (chi nhánh), bỏ dấu/khoảng trắng, viết hoa.
function resolveBankBin(tenNganHang: string | null | undefined): string | null {
  if (!tenNganHang) return null
  const key = tenNganHang
    .split('-')[0]
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return BANK_BIN_MAP[key] ?? null
}

function buildVietQrUrl(bin: string, stk: string, amount: number | null, content: string): string {
  const params = new URLSearchParams()
  if (amount) params.set('amount', String(Math.round(amount)))
  params.set('addInfo', content)
  return `https://img.vietqr.io/image/${bin}-${stk}-compact2.png?${params.toString()}`
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

// Modal QR chuyển khoản công tác phí (VietQR/NAPAS) — quét bằng app ngân
// hàng bất kỳ là điền sẵn STK/số tiền/nội dung, khỏi gõ tay. Chỉ tạo được
// khi ngân hàng nằm trong BANK_BIN_MAP và có đủ STK — thiếu 1 trong 2 thì
// báo rõ thay vì hiện QR hỏng.
function QrThanhToanModal({ h, onClose }: { h: HoSoFlat; onClose: () => void }) {
  const bin = resolveBankBin(h.nhansu?.ten_ngan_hang)
  const content = `CTP ${h.nhansu?.ho_ten ?? ''} ${h.doan?.ten_doan ?? ''}`.trim()
  const qrUrl = bin && h.nhansu?.stk ? buildVietQrUrl(bin, h.nhansu.stk, h.chi_tra, content) : null

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">QR thanh toán CTP</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        {!qrUrl ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            Chưa hỗ trợ tạo QR cho ngân hàng &quot;{h.nhansu?.ten_ngan_hang ?? '—'}&quot; hoặc thiếu số tài khoản — chuyển khoản thủ công giúp em ạ.
          </p>
        ) : (
          <>
            <img src={qrUrl} alt="QR chuyển khoản" className="w-full rounded-xl border border-gray-100" />
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-gray-900"><span className="text-gray-400">STK:</span> {h.nhansu?.stk} - {h.nhansu?.ten_ngan_hang}</p>
              <p className="text-gray-900"><span className="text-gray-400">Số tiền:</span> {formatTien(h.chi_tra)}</p>
              <p className="text-gray-900"><span className="text-gray-400">Nội dung:</span> {content}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const SELECT = 'px-3 py-2 rounded-xl text-sm font-semibold bg-white text-gray-600 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400'
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

export default function NhanSuPage() {
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [tab, setTab] = useState<Tab>('tong_hop')
  const [hoSoList, setHoSoList] = useState<HoSoFlat[]>([])
  const [nhansuList, setNhansuList] = useState<NhanSuRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLoaiId, setFilterLoaiId] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [qrFor, setQrFor] = useState<HoSoFlat | null>(null)
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
      const res = await fetch('/api/nhansu/ho-so-list')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setHoSoList(Array.isArray(data.ho_so) ? data.ho_so : [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Toàn bộ nhân sự đã đăng ký (không giới hạn theo đoàn) — nguồn riêng cho
  // tab "Toàn bộ nhân sự", dùng GET /api/nhansu vốn đã có sẵn nhưng chưa
  // được trang nào gọi tới (xem comment trong route đó).
  const loadNhansuList = useCallback(async () => {
    try {
      const res = await fetch('/api/nhansu')
      if (!res.ok) return
      const data = await res.json()
      setNhansuList(Array.isArray(data.nhansu) ? data.nhansu : [])
    } catch { /* im lặng — chỉ ảnh hưởng tab Toàn bộ nhân sự, không chặn trang */ }
  }, [])

  const loadAll = useCallback(() => {
    loadData()
    loadNhansuList()
  }, [loadData, loadNhansuList])

  // Tick 1 trong 2 checkbox duyệt tay ("Đã đủ hồ sơ/chứng từ"/"Đã trả đồ
  // đoàn") — cập nhật lạc quan ngay trên UI rồi mới gọi API, cùng route
  // PATCH /api/ho-so/[id] đã dùng ở trang chi tiết đoàn.
  async function toggleHoSoField(hoSoId: string, field: 'du_ho_so_chung_tu' | 'da_tra_do_doan' | 'ke_toan_truong_duyet', value: boolean) {
    setHoSoList(prev => prev.map(h => (h.id === hoSoId ? { ...h, [field]: value } : h)))
    const res = await fetch(`/api/ho-so/${hoSoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ho_so: { [field]: value } }),
    })
    if (!res.ok) {
      setHoSoList(prev => prev.map(h => (h.id === hoSoId ? { ...h, [field]: !value } : h)))
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách khi mount, pattern chuẩn cho fetch-on-mount
    loadAll()
  }, [loadAll])

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Nhân sự thuê ngoài</span>)
    setOnRefresh(loadAll)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadAll])

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

  // Đếm theo loại nhân sự — đếm LƯỢT (dòng ho_so), không đếm người, vì 1
  // người đi nhiều đoàn giờ hiện nhiều dòng riêng (quyết định 2026-08-13).
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const h of hoSoInRange) {
      const loaiId = h.nhansu?.loai_nhan_su_id
      if (!loaiId) continue
      c[loaiId] = (c[loaiId] ?? 0) + 1
    }
    return c
  }, [hoSoInRange])

  // Phân theo đoàn (đoàn mới đi trước), trong từng đoàn sắp theo tên nhân
  // sự — thay cho cột "Đoàn" lặp lại từng dòng (quyết định 2026-08-13).
  const tongHopRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return hoSoInRange
      .filter(h => {
        if (filterLoaiId && h.nhansu?.loai_nhan_su_id !== filterLoaiId) return false
        if (q) {
          const hay = `${h.nhansu?.ho_ten ?? ''} ${h.nhansu?.so_cccd ?? ''} ${h.nhansu?.sdt ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        const doanA = a.doan?.ngay_di ?? ''
        const doanB = b.doan?.ngay_di ?? ''
        if (doanA !== doanB) return doanB.localeCompare(doanA)
        if (a.doan_id !== b.doan_id) return (a.doan?.ten_doan ?? '').localeCompare(b.doan?.ten_doan ?? '')
        return normalizeName(a.nhansu?.ho_ten ?? '').localeCompare(normalizeName(b.nhansu?.ho_ten ?? ''))
      })
  }, [hoSoInRange, filterLoaiId, search])

  // Ai đã từng có ít nhất 1 lượt tham gia đoàn — dùng TOÀN BỘ hoSoList
  // (không lọc theo khoảng ngày, vì tab "Toàn bộ nhân sự" không có bộ lọc
  // ngày, chỉ cần biết đã-từng-tham-gia-hay-chưa).
  const participatedSet = useMemo(() => {
    const s = new Set<string>()
    for (const h of hoSoList) if (h.nhansu_id) s.add(h.nhansu_id)
    return s
  }, [hoSoList])

  // Đếm NGƯỜI theo loại nhân sự (khác `counts` ở trên vốn đếm LƯỢT) — nguồn
  // riêng cho chip lọc khi đang ở tab "Toàn bộ nhân sự".
  const toanBoCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of nhansuList) {
      c[n.loai_nhan_su_id] = (c[n.loai_nhan_su_id] ?? 0) + 1
    }
    return c
  }, [nhansuList])

  const toanBoRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return nhansuList
      .filter(n => {
        if (filterLoaiId && n.loai_nhan_su_id !== filterLoaiId) return false
        if (q) {
          const hay = `${n.ho_ten} ${n.so_cccd ?? ''} ${n.sdt ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => normalizeName(a.ho_ten).localeCompare(normalizeName(b.ho_ten)))
  }, [nhansuList, filterLoaiId, search])

  const paymentRows = useMemo(() => {
    if (tab === 'tong_hop') return []
    const set = tab === 'can_thanh_toan' ? CAN_THANH_TOAN_SET : DA_THANH_TOAN_SET
    const q = search.trim().toLowerCase()
    return hoSoList
      .filter(h => set.has(h.trang_thai))
      // "Cần thanh toán" chỉ hiện khi ĐÃ tick đủ cả 2 checkbox duyệt tay ở
      // tab Tổng hợp (đủ hồ sơ/chứng từ + đã trả đồ đoàn) — chưa đủ 2 cái
      // thì coi như chưa sẵn sàng xử lý thanh toán, chỉ thấy ở Tổng hợp.
      .filter(h => tab !== 'can_thanh_toan' || (h.du_ho_so_chung_tu && h.da_tra_do_doan))
      .filter(h => {
        if (!q) return true
        const hay = `${h.nhansu?.ho_ten ?? ''} ${h.doan?.ten_doan ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => (effectiveDate(b) ?? '').localeCompare(effectiveDate(a) ?? ''))
  }, [hoSoList, tab, search])

  const { widths: thWidths, startResize: startThResize } = useResizableColumns('nhan-su-tong-hop', Object.fromEntries(TONG_HOP_COLS.map(c => [c.key, c.width])))
  const thTotalWidth = TONG_HOP_COLS.reduce((sum, c) => sum + (thWidths[c.key] ?? c.width), 0)
  const { widths: tbWidths, startResize: startTbResize } = useResizableColumns('nhan-su-toan-bo', Object.fromEntries(TOAN_BO_COLS.map(c => [c.key, c.width])))
  const tbTotalWidth = TOAN_BO_COLS.reduce((sum, c) => sum + (tbWidths[c.key] ?? c.width), 0)
  const { widths: payWidths, startResize: startPayResize } = useResizableColumns('nhan-su-payment', Object.fromEntries(PAYMENT_COLS.map(c => [c.key, c.width])))
  const payTotalWidth = PAYMENT_COLS.reduce((sum, c) => sum + (payWidths[c.key] ?? c.width), 0)

  return (
    <div className="px-5 pb-5 space-y-2">
      {/* min-h-12/md:min-h-10 + border-b, không padding-top ở div ngoài —
          cùng cách cong-no-ncc/page.tsx đang làm để hàng tab nằm sát
          Topbar (h-12 md:h-10, xem components/Topbar.tsx), 2 thanh liền
          mạch nhau thay vì có khoảng trống ở giữa. */}
      <div className="min-h-12 md:min-h-10 flex items-center justify-between flex-wrap gap-2 border-b border-gray-200">
        <div className="flex items-center gap-1 -mb-px">
          {([
            { key: 'tong_hop', label: 'Tổng hợp' },
            { key: 'can_thanh_toan', label: 'Cần thanh toán' },
            { key: 'da_thanh_toan', label: 'Đã thanh toán' },
            { key: 'toan_bo', label: 'Toàn bộ nhân sự' },
          ] as const).map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={loadAll} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
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

      {(tab === 'tong_hop' || tab === 'toan_bo') && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setFilterLoaiId('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!filterLoaiId ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            Tất cả <span className="opacity-70">{tab === 'toan_bo' ? nhansuList.length : hoSoInRange.length}</span>
          </button>
          {loaiNhanSu.map(l => (
            <button key={l.id} onClick={() => setFilterLoaiId(filterLoaiId === l.id ? '' : l.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterLoaiId === l.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {l.ten} <span className="opacity-70">{(tab === 'toan_bo' ? toanBoCounts : counts)[l.id] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'tong_hop' ? (
        <>
          <p className="text-sm text-gray-400">{tongHopRows.length.toLocaleString('vi-VN')} lượt tham gia</p>

          <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
            <div className="overflow-x-auto">
              <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: thTotalWidth }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {TONG_HOP_COLS.map(c => (
                      <th key={c.key} style={{ width: thWidths[c.key] ?? c.width }}
                        className={`relative px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none ${c.align === 'center' ? 'text-center' : 'text-left'}`}>
                        {c.label}
                        <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startThResize(c.key, e)} />
                      </th>
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
                  ) : tongHopRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-14 text-center text-gray-400">Không có lượt tham gia nào khớp bộ lọc.</td></tr>
                  ) : tongHopRows.map((h, i) => {
                    const showGroupHeader = i === 0 || tongHopRows[i - 1].doan_id !== h.doan_id
                    return (
                    <Fragment key={h.id}>
                      {showGroupHeader && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-2 text-xs font-bold text-gray-900">
                            <span className="font-normal">Đoàn: </span>
                            {h.doan ? (
                              <Link href={`/doan/${h.doan.id}`} className="hover:text-brand-600 hover:underline decoration-gray-300 transition-colors">{h.doan.ten_doan}</Link>
                            ) : '(đoàn đã xoá)'}
                            {h.doan?.hanh_trinh && (
                              <>
                                <span className="font-normal"> - Hành trình: </span>
                                {h.doan.hanh_trinh}
                              </>
                            )}
                            {h.doan?.ngay_di && (
                              <span className="font-normal">
                                {' - '}{formatDateVN(h.doan.ngay_di)}{h.doan.ngay_ve ? ` – ${formatDateVN(h.doan.ngay_ve)}` : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-2.5">
                          <button onClick={() => h.nhansu_id && setViewingId(h.nhansu_id)} className="text-left hover:text-brand-600 transition-colors">
                            <div className="whitespace-nowrap">
                              <span className="font-semibold text-gray-900">{h.nhansu?.ho_ten ?? '—'}</span>
                              <span className="text-gray-900"> · {h.nhansu?.loai_nhan_su?.ma ?? h.nhansu?.loai_nhan_su?.ten ?? '—'}</span>
                            </div>
                            <div className="text-xs text-gray-900 font-mono mt-0.5">CCCD: {h.nhansu?.so_cccd ?? '—'}</div>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-gray-900">
                          <div>{h.nhansu?.sdt ?? '—'}</div>
                          {h.nhansu?.email && <div className="text-xs text-gray-900">{h.nhansu.email}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-900">{h.nhansu?.stk ? `${h.nhansu.stk} - ${h.nhansu.ten_ngan_hang ?? ''}` : '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="checkbox" checked={h.du_ho_so_chung_tu} onChange={e => toggleHoSoField(h.id, 'du_ho_so_chung_tu', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400 cursor-pointer" />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="checkbox" checked={h.da_tra_do_doan} onChange={e => toggleHoSoField(h.id, 'da_tra_do_doan', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400 cursor-pointer" />
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button onClick={() => h.nhansu_id && setViewingId(h.nhansu_id)} title="Xem chi tiết" className="p-1 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : tab === 'toan_bo' ? (
        <>
          <p className="text-sm text-gray-400">{toanBoRows.length.toLocaleString('vi-VN')} nhân sự</p>

          <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
            <div className="overflow-x-auto">
              <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: tbTotalWidth }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {TOAN_BO_COLS.map(c => (
                      <th key={c.key} style={{ width: tbWidths[c.key] ?? c.width }}
                        className="relative px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none text-left">
                        {c.label}
                        <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startTbResize(c.key, e)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
                  ) : loadError ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center">
                      <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                      <button onClick={loadAll} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                    </td></tr>
                  ) : toanBoRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-14 text-center text-gray-400">Không có nhân sự nào khớp bộ lọc.</td></tr>
                  ) : toanBoRows.map(n => {
                    const daThamGia = participatedSet.has(n.id)
                    return (
                    <tr key={n.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-2.5">
                        <button onClick={() => setViewingId(n.id)} className="text-left hover:text-brand-600 transition-colors">
                          <div className="whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{n.ho_ten}</span>
                            <span className="text-gray-900"> · {n.loai_nhan_su?.ma ?? n.loai_nhan_su?.ten ?? '—'}</span>
                          </div>
                          <div className="text-xs text-gray-900 font-mono mt-0.5">CCCD: {n.so_cccd ?? '—'}</div>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-900">
                        <div>{n.sdt ?? '—'}</div>
                        {n.email && <div className="text-xs text-gray-900">{n.email}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-900">{n.stk ? `${n.stk} - ${n.ten_ngan_hang ?? ''}` : '—'}</td>
                      <td className="px-4 py-2.5">
                        {daThamGia ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Đã tham gia đoàn</span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Chưa tham gia đoàn nào</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => setViewingId(n.id)} title="Xem chi tiết" className="p-1 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition-colors">
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

          <div className="bg-white border border-gray-100 shadow-sm overflow-hidden list-table-container">
            <div className="overflow-x-auto">
              <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: payTotalWidth }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {PAYMENT_COLS.map(c => (
                      <th key={c.key} style={{ width: payWidths[c.key] ?? c.width }}
                        className={`relative px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}>
                        {c.label}
                        <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startPayResize(c.key, e)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-300">Đang tải...</td></tr>
                  ) : loadError ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center">
                      <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                      <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                    </td></tr>
                  ) : paymentRows.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-14 text-center text-gray-400">Không có dòng nào khớp bộ lọc.</td></tr>
                  ) : paymentRows.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button onClick={() => h.nhansu_id && setViewingId(h.nhansu_id)} className="text-left hover:text-brand-600 transition-colors">
                          <span className="font-semibold text-gray-900">{h.nhansu?.ho_ten ?? '—'}</span>
                          <span className="text-gray-900"> · {h.nhansu?.loai_nhan_su?.ma ?? h.nhansu?.loai_nhan_su?.ten ?? '—'}</span>
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
                      <td className="px-4 py-2.5 text-center">
                        <input type="checkbox" checked={h.ke_toan_truong_duyet} onChange={e => toggleHoSoField(h.id, 'ke_toan_truong_duyet', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400 cursor-pointer" />
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {tab === 'can_thanh_toan' && (
                          <button onClick={() => setQrFor(h)} title="QR thanh toán"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors ml-auto">
                            <QrCode size={14} /> QR
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewingId && <NhanSuDetailPanel id={viewingId} onClose={() => setViewingId(null)} />}
      {qrFor && <QrThanhToanModal h={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  )
}
