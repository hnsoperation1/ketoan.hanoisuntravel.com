'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { Search, RefreshCw, ChevronRight, ChevronDown, Check, X, Trash2, Loader2 } from 'lucide-react'
import DateInput from '@/components/DateInput'
import { RoutingText } from '@/components/RoutingText'
import FilterPicker from '@/components/FilterPicker'
import { useAuth } from '@/contexts/auth'

type MaKhachSource = 'chuan' | 'doi_chieu' | 'da_dung'
type KhachOpt = { ma_khach: string; ten_khach: string | null; source: MaKhachSource }

const CELL_INPUT = 'w-full bg-transparent text-xs px-1 py-0.5 rounded focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white'

const MA_KHACH_SOURCE_LABEL: Record<MaKhachSource, string> = {
  chuan: 'Danh mục chuẩn',
  doi_chieu: 'Đã dùng ở công nợ / sao kê',
  da_dung: 'Đã dùng trong bảng này',
}
const MA_KHACH_SOURCE_ORDER: MaKhachSource[] = ['chuan', 'doi_chieu', 'da_dung']

// Cùng pattern picker "mã khách" như MaKhachCell ở /ve-may-bay/cong-no —
// nhân bản page-local ở đây thay vì tách shared component, theo đúng cách
// mỗi trang trong module này tự giữ các mảnh UI riêng (xem cong-no/page.tsx).
// Options hợp từ 3 nguồn (xem maKhachOptions ở component cha) — nhóm theo
// nguồn khi hiện kết quả để kế toán biết mã đang chọn có phải danh mục
// chuẩn hay chỉ mới thấy dùng ở công nợ/sao kê/bảng này, tự quyết định có
// nên dùng hay đi thêm vào danh mục chuẩn trước.
function MaKhachCell({ value, onSave, options }: { value: string | null; onSave: (v: string) => void; options: KhachOpt[] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function openModal() {
    setQ('')
    setOpen(true)
  }

  function choose(ma: string) {
    setOpen(false)
    if (ma !== (value ?? '')) onSave(ma)
  }

  const qLower = q.trim().toLowerCase()
  const filtered = qLower
    ? options.filter(o => o.ma_khach.toLowerCase().includes(qLower) || (o.ten_khach ?? '').toLowerCase().includes(qLower))
    : options
  const groups = MA_KHACH_SOURCE_ORDER
    .map(source => ({ source, items: filtered.filter(o => o.source === source) }))
    .filter(g => g.items.length > 0)

  return (
    <>
      <button type="button" onClick={openModal}
        className={`${CELL_INPUT} text-left truncate ${value ? '' : 'text-gray-300'}`}>
        {value || 'Tìm mã khách...'}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && q.trim()) choose(q.trim()) }}
                placeholder="Tìm mã khách hoặc tên khách..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  Không tìm thấy trong danh mục.
                  {q.trim() && (
                    <button onClick={() => choose(q.trim())}
                      className="block mx-auto mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Dùng nguyên văn &quot;{q.trim()}&quot;
                    </button>
                  )}
                </div>
              ) : (
                groups.map(g => (
                  <div key={g.source}>
                    <div className="sticky top-0 px-5 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                      {MA_KHACH_SOURCE_LABEL[g.source]} <span className="font-normal normal-case text-gray-300">({g.items.length})</span>
                    </div>
                    {g.items.map(o => {
                      const isSelected = o.ma_khach === value
                      return (
                        <div key={o.ma_khach} onClick={() => choose(o.ma_khach)}
                          className={`w-full px-5 py-3 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between gap-2 cursor-pointer ${isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                          <div>
                            <div className={`text-sm font-semibold ${isSelected ? 'text-brand-700' : 'text-gray-800'}`}>{o.ma_khach}</div>
                            {o.ten_khach && <div className="text-xs text-gray-400 mt-0.5">{o.ten_khach}</div>}
                          </div>
                          {isSelected ? (
                            <button type="button" title="Bỏ chọn" onClick={e => { e.stopPropagation(); choose('') }}
                              className="flex-shrink-0 p-1.5 rounded-lg text-brand-600 hover:bg-red-50 hover:text-red-500 transition-colors">
                              <X size={16} />
                            </button>
                          ) : (
                            <Check size={16} className="text-transparent flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// Chip dropdown cho "Tháng" — cùng khung UI với FilterPicker (nút chip +
// panel pill xổ xuống) nhưng KHÔNG dùng thẳng FilterPicker được vì semantic
// khác: FilterPicker coi value='' là "Tất cả" (bỏ lọc), còn ở đây luôn phải
// có đúng 1 tháng được chọn (value='' chỉ xảy ra khi user tự chỉnh khoảng
// ngày qua 2 ô DateInput không khớp preset nào — không có nút xoá để "bỏ
// chọn tháng" vì luôn phải có 1 khoảng ngày hiệu lực).
function MonthPicker({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
          selected ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`}>
        {selected?.label ?? 'Chọn tháng'}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl p-3 left-0 w-[260px]">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-0.5">Tháng</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map(o => {
              const sel = value === o.value
              return (
                <button key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    sel ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Modal to nằm giữa màn hình + search, cùng khung với MaKhachCell nhưng
// dùng để LỌC bảng (không sửa dữ liệu) — chọn xong thu hẹp filtered, không
// gọi onSave/PATCH nào. Options truyền vào đã được thu hẹp theo tầng lọc
// hiện tại (chỉ mã thực sự xuất hiện trong byTkt, xem khachHangFilterOptions
// ở component cha) — giữ đúng kiểu "autofilter Excel" đã áp dụng cho các
// dropdown khác trên trang, không hiện mã không liên quan tới phạm vi đang xem.
function KhachHangFilterButton({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: KhachOpt[] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function choose(ma: string) {
    setOpen(false)
    onChange(ma)
  }

  const qLower = q.trim().toLowerCase()
  const filtered = qLower
    ? options.filter(o => o.ma_khach.toLowerCase().includes(qLower) || (o.ten_khach ?? '').toLowerCase().includes(qLower))
    : options
  const groups = MA_KHACH_SOURCE_ORDER
    .map(source => ({ source, items: filtered.filter(o => o.source === source) }))
    .filter(g => g.items.length > 0)

  return (
    <>
      <button type="button" onClick={() => { setQ(''); setOpen(true) }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
          value ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`}>
        {value || 'Tất cả khách hàng'}
        {value ? (
          <span role="button" onClick={e => { e.stopPropagation(); onChange('') }} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity">
            <X size={10} />
          </span>
        ) : (
          <ChevronDown size={10} />
        )}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Tìm mã khách hoặc tên khách..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <div onClick={() => choose('')}
                className={`w-full px-5 py-3 transition-colors border-b border-gray-50 flex items-center justify-between gap-2 cursor-pointer ${!value ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                <div className={`text-sm font-semibold ${!value ? 'text-brand-700' : 'text-gray-800'}`}>Tất cả khách hàng</div>
                {!value && <Check size={16} className="text-brand-600 flex-shrink-0" />}
              </div>
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">Không tìm thấy.</div>
              ) : (
                groups.map(g => (
                  <div key={g.source}>
                    <div className="sticky top-0 px-5 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                      {MA_KHACH_SOURCE_LABEL[g.source]} <span className="font-normal normal-case text-gray-300">({g.items.length})</span>
                    </div>
                    {g.items.map(o => {
                      const isSelected = o.ma_khach === value
                      return (
                        <div key={o.ma_khach} onClick={() => choose(o.ma_khach)}
                          className={`w-full px-5 py-3 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between gap-2 cursor-pointer ${isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                          <div>
                            <div className={`text-sm font-semibold ${isSelected ? 'text-brand-700' : 'text-gray-800'}`}>{o.ma_khach}</div>
                            {o.ten_khach && <div className="text-xs text-gray-400 mt-0.5">{o.ten_khach}</div>}
                          </div>
                          {isSelected && <Check size={16} className="text-brand-600 flex-shrink-0" />}
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// Giá vé hiện đủ số (x.xxx.xxx) thay vì rút gọn "1 triệu" như formatVND
// dùng chỗ khác trong CRM — kế toán cần thấy chính xác từng đồng.
function formatGiaVe(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('vi-VN')
}

// dinh_dang lên đầu để dễ phân biệt tin nhắn được AI đọc theo định dạng
// nào (A-H, xem SYSTEM_PROMPT_V2 ở hns-ticket-parser) ngay khi liếc qua.
// cost_center/employee_code chỉ có giá trị với khách Honda, phần lớn booking
// khác để trống — đẩy 2 field này xuống cuối khi hiện JSON debug cho dễ nhìn,
// đỡ chen giữa các field luôn có giá trị.
function reorderBookingJsonFields(bookings: Record<string, unknown>[]): Record<string, unknown>[] {
  return bookings.map(b => {
    const { dinh_dang, cost_center, employee_code, ...rest } = b
    return { dinh_dang, ...rest, cost_center, employee_code }
  })
}

// issued_date lưu dạng text "DD/MM/YYYY" (nguyên văn AI đọc từ tin nhắn
// Telegram, không phải cột DATE thật) — đổi sang "YYYY-MM-DD" để so sánh
// được với giá trị ISO của DateInput.
function toIsoDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  if (!d || !m || !y) return null
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  return {
    from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

// month: 1-12, năm mặc định lấy theo năm hiện tại (đủ dùng vì trang chỉ
// xem dữ liệu quanh năm nay, chưa cần chọn năm khác).
function monthRange(month: number): { from: string; to: string } {
  const year = new Date().getFullYear()
  return {
    from: ymd(new Date(year, month - 1, 1)),
    to: ymd(new Date(year, month, 0)),
  }
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

type Booking = {
  id: string
  issued_date: string | null
  employee_code: string | null
  full_name: string | null
  cost_center: string | null
  extra_info: { employee_code?: string | null; cost_center?: string | null } | null
  dep_date: string | null
  arr_date: string | null
  routing: string | null
  airlines: string | null
  ticket_no: string | null
  gia_mua: number | null
  gia_ban: number | null
  loi_nhuan: number | null
  note: string | null
  ma_khach: string | null
  created_at: string
  ve_tkt: { tkt_code: string; ten_nhan_vien: string | null } | null
  ve_parse_logs: { raw_message: string | null; parsed_bookings: unknown[] | null } | null
}

export default function VeMayBayPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [{ from: fromDate, to: toDate }, setDateRange] = useState(currentMonthRange)
  const [tktFilter, setTktFilter] = useState('')
  const [maKhachFilter, setMaKhachFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dirMaKhach, setDirMaKhach] = useState<KhachOpt[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/ve-may-bay/bookings')
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

  // Danh mục để chọn mã khách — hợp NHIỀU nguồn thay vì chỉ danh mục chuẩn
  // vmb_khach_hang (nhiều mã đã dùng thật ở công nợ/sao kê nhưng chưa kịp
  // thêm vào danh mục chuẩn thì picker trống trơn, không chọn lại được):
  //   - vmb_khach_hang: danh mục chuẩn, có tên đầy đủ (ten_khach)
  //   - /api/ve-may-bay/khach-hang-vmb: mã đã dùng ở ve_debt_records (công
  //     nợ) và sao_ke_giao_dich (sao kê) — không có tên, chỉ có mã
  // Mã đã gắn sẵn trong chính bảng ve_bookings (rows) được hợp thêm ở
  // maKhachOptions bên dưới (sau khi rows load xong).
  useEffect(() => {
    Promise.all([
      fetch('/api/ve-may-bay/vmb-khach-hang').then(res => res.json()).catch(() => ({ data: [] })),
      fetch('/api/ve-may-bay/khach-hang-vmb').then(res => res.json()).catch(() => ({ data: [] })),
    ]).then(([vmbRes, doiChieuRes]) => {
      const map = new Map<string, KhachOpt>()
      if (Array.isArray(vmbRes.data)) {
        for (const d of vmbRes.data as { ma_khach: string; ten_khach: string | null }[]) {
          if (d.ma_khach) map.set(d.ma_khach.toUpperCase(), { ma_khach: d.ma_khach, ten_khach: d.ten_khach, source: 'chuan' })
        }
      }
      if (Array.isArray(doiChieuRes.data)) {
        for (const d of doiChieuRes.data as { ma_khach: string }[]) {
          const key = d.ma_khach.toUpperCase()
          if (!map.has(key)) map.set(key, { ma_khach: d.ma_khach, ten_khach: null, source: 'doi_chieu' })
        }
      }
      setDirMaKhach(Array.from(map.values()).sort((a, b) => a.ma_khach.localeCompare(b.ma_khach)))
    })
  }, [])

  async function saveMaKhach(id: string, ma: string) {
    const trimmed = ma.trim()
    setRows(prev => prev.map(r => r.id === id ? { ...r, ma_khach: trimmed || null } : r))
    try {
      const res = await fetch(`/api/ve-may-bay/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ma_khach: trimmed || null }),
      })
      if (!res.ok) throw new Error('save failed')
    } catch {
      loadData()
    }
  }

  // Xoá hàng loạt — chỉ Super Admin (nút chỉ hiện khi user?.is_super_admin,
  // API cũng tự chặn lại bằng requireSuperAdmin()). Dữ liệu tài chính,
  // không có thùng rác khôi phục nên bắt confirm trước khi xoá thật.
  async function bulkDelete() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Xoá ${selectedIds.size} vé đã chọn? Không thể khôi phục.`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/ve-may-bay/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error('delete failed')
      setRows(prev => prev.filter(r => !selectedIds.has(r.id)))
      setSelectedIds(new Set())
    } catch {
      window.alert('Xoá thất bại, thử lại sau.')
    } finally {
      setDeleting(false)
    }
  }

  // Lọc kiểu tầng (giống autofilter Excel) — mỗi bước lọc tiếp thu hẹp
  // danh sách cho các dropdown bên dưới, thay vì tính riêng lẻ từ toàn bộ rows.
  const byRange = rows.filter(r => {
    const iso = toIsoDate(r.issued_date)
    if (!iso) return false
    if (fromDate && iso < fromDate) return false
    if (toDate && iso > toDate) return false
    return true
  })

  const tkts = Array.from(new Set(byRange.map(r => r.ve_tkt?.tkt_code).filter(Boolean))) as string[]
  const byTkt = byRange.filter(r => !tktFilter || r.ve_tkt?.tkt_code === tktFilter)

  // Lọc theo "khách hàng" (đối tượng CRM riêng, có thể là công ty/tổ chức
  // đứng sau nhiều pax khác nhau) — dùng cột ma_khach, KHÔNG dùng full_name
  // (đó là tên hành khách/pax đọc trực tiếp từ vé, khác hẳn khái niệm
  // khách hàng). AI tự trích xuất ma_khach khi đọc được, còn thiếu thì kế
  // toán gắn tay qua MaKhachCell ở cột "Mã khách" trong bảng.
  const maKhachList = Array.from(new Set(byTkt.map(r => r.ma_khach).filter(Boolean))) as string[]
  const byMaKhach = byTkt.filter(r => !maKhachFilter || r.ma_khach === maKhachFilter)

  // Options cho picker "Mã khách" — hợp thêm mã đã gắn sẵn trong chính bảng
  // này (rows, không chỉ byTkt đã lọc) vào 2 nguồn đã fetch ở dirMaKhach,
  // phòng mã đã gắn tay từ trước không nằm trong danh mục chuẩn lẫn 2 nguồn
  // đối chiếu (vd tài khoản khác gắn tay tự do trước khi có picker này).
  const maKhachOptions: KhachOpt[] = (() => {
    const map = new Map<string, KhachOpt>()
    for (const d of dirMaKhach) map.set(d.ma_khach.toUpperCase(), d)
    for (const r of rows) {
      if (r.ma_khach && !map.has(r.ma_khach.toUpperCase())) map.set(r.ma_khach.toUpperCase(), { ma_khach: r.ma_khach, ten_khach: null, source: 'da_dung' })
    }
    return Array.from(map.values()).sort((a, b) => a.ma_khach.localeCompare(b.ma_khach))
  })()

  // Options cho modal lọc "Khách hàng" — thu hẹp theo maKhachList (chỉ mã
  // thực sự có trong byTkt, giữ đúng kiểu autofilter tầng), enrich thêm
  // tên/nguồn từ maKhachOptions để modal group được theo nguồn giống MaKhachCell.
  const khachHangFilterOptions: KhachOpt[] = maKhachList.map(code => {
    const found = maKhachOptions.find(o => o.ma_khach.toUpperCase() === code.toUpperCase())
    return found ?? { ma_khach: code, ten_khach: null, source: 'da_dung' as const }
  })

  const filtered = byMaKhach.filter(r => {
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const hay = [r.full_name, r.ticket_no, r.routing, r.ve_tkt?.tkt_code, r.ve_tkt?.ten_nhan_vien, r.ve_parse_logs?.raw_message]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const tongLoiNhuan = filtered.reduce((s, r) => s + (r.loi_nhuan ?? 0), 0)

  // Gom theo ngày xuất (issued_date, text "DD/MM/YYYY"), mới nhất lên đầu.
  // Sort theo ISO chứ không sort chuỗi gốc vì "DD/MM/YYYY" so sánh string
  // sai thứ tự (vd "09/08/2026" > "10/07/2026" theo string nhưng sai theo
  // ngày thực).
  const groupedByDate = (() => {
    const map = new Map<string, { label: string; rows: typeof filtered }>()
    for (const r of filtered) {
      const iso = toIsoDate(r.issued_date) ?? '0000-00-00'
      if (!map.has(iso)) map.set(iso, { label: r.issued_date ?? 'Chưa rõ ngày', rows: [] })
      map.get(iso)!.rows.push(r)
    }
    // Sắp theo ticket_no (mã PNR) trong từng ngày — API /bookings chỉ
    // order theo created_at, mà nhiều pax cùng 1 PNR insert 1 lượt hay bị
    // trùng created_at tới mili-giây, Postgres không đảm bảo giữ đúng thứ
    // tự ban đầu khi tie-break → cùng 1 PNR bị tách rải rác không liền
    // nhau trên bảng. Sort lại ở đây cho chắc, không sửa order phía API vì
    // nơi khác có thể đang cần thứ tự created_at gốc.
    Array.from(map.values()).forEach(g => {
      g.rows.sort((a, b) => (a.ticket_no ?? '').localeCompare(b.ticket_no ?? ''))
    })
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, g]) => g)
  })()

  const colCount = user?.is_super_admin ? 12 : 11
  const filteredIds = filtered.map(r => r.id)
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))
  const toggleSelectAll = () => setSelectedIds(allFilteredSelected ? new Set() : new Set(filteredIds))

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Thông tin xuất vé</h1>
        </div>
        <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên pax, số vé, TKT..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>

        <div className="flex items-center gap-1.5">
          <DateInput value={fromDate} onChange={v => setDateRange(r => ({ ...r, from: v }))} className="w-32" />
          <span className="text-xs text-gray-400">→</span>
          <DateInput value={toDate} onChange={v => setDateRange(r => ({ ...r, to: v }))} className="w-32" />
          <MonthPicker
            value={
              JSON.stringify({ from: fromDate, to: toDate }) === JSON.stringify(currentMonthRange())
                ? 'current'
                : MONTHS.find(m => JSON.stringify(monthRange(m)) === JSON.stringify({ from: fromDate, to: toDate }))?.toString() ?? ''
            }
            options={[{ value: 'current', label: 'Tháng này' }, ...MONTHS.map(m => ({ value: String(m), label: `Tháng ${m}` }))]}
            onChange={v => {
              if (v === 'current') setDateRange(currentMonthRange())
              else if (v) setDateRange(monthRange(Number(v)))
            }}
          />
        </div>

        <FilterPicker label="TKT" value={tktFilter}
          onChange={v => { setTktFilter(v); setMaKhachFilter('') }}
          options={tkts.map(t => ({ value: t, label: t }))} />

        <KhachHangFilterButton value={maKhachFilter} onChange={setMaKhachFilter} options={khachHangFilterOptions} />

        {user?.is_super_admin && selectedIds.size > 0 && (
          <button onClick={bulkDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Xoá {selectedIds.size} đã chọn
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} vé · lợi nhuận {formatGiaVe(tongLoiNhuan)}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                {user?.is_super_admin && (
                  <th className="w-8 pl-3">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-400" />
                  </th>
                )}
                <th className="w-8" />
                {['TKT', 'Pax', 'Mã khách', 'Mã code/Số vé', 'Hành trình', 'Ngày xuất', 'Giá mua', 'Giá bán', 'Lợi nhuận', 'Ghi chú'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse divide-x divide-gray-100">
                    {Array.from({ length: colCount }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded" style={{ width: `${40 + (i + j) % 4 * 10}%` }} /></td>
                    ))}
                  </tr>
                ))
              ) : loadError ? (
                <tr><td colSpan={colCount} className="px-5 py-14 text-center">
                  <p className="text-gray-400 mb-2">Không tải được dữ liệu, có thể do lỗi mạng.</p>
                  <button onClick={loadData} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">Thử lại</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={colCount} className="px-5 py-14 text-center text-gray-400">Chưa có vé nào.</td></tr>
              ) : groupedByDate.map(g => (
                <Fragment key={g.label}>
                <tr>
                  <td colSpan={colCount} className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-700">
                    Ngày xuất: {g.label} <span className="text-gray-400 font-normal">({g.rows.length} vé)</span>
                  </td>
                </tr>
                {g.rows.map(r => {
                  const isOpen = expanded.has(r.id)
                  const rawMessage = r.ve_parse_logs?.raw_message
                  const parsedBookings = r.ve_parse_logs?.parsed_bookings
                  return (
                  <Fragment key={r.id}>
                  <tr className="hover:bg-gray-50/70 transition-colors divide-x divide-gray-100">
                    {user?.is_super_admin && (
                      <td className="pl-3">
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-400" />
                      </td>
                    )}
                    <td className="pl-3">
                      {rawMessage && (
                        <button onClick={() => toggleExpand(r.id)}
                          className="p-1 text-gray-300 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors">
                          <ChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="font-semibold text-gray-800">{r.ve_tkt?.tkt_code ?? '—'}</div>
                      <div className="text-xs text-gray-400">{r.ve_tkt?.ten_nhan_vien}</div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="text-gray-800">{r.full_name ?? '—'}</div>
                      {(() => {
                        // extra_info: bản ghi mới (sau migration_ve_bookings_extra_info).
                        // employee_code/cost_center cột thật: bản ghi cũ trước đó, giữ
                        // nguyên không migrate — đọc cả 2 nơi cho tương thích ngược.
                        const empCode = r.extra_info?.employee_code ?? r.employee_code
                        const costCenter = r.extra_info?.cost_center ?? r.cost_center
                        return <div className="text-xs text-gray-400">{empCode}{costCenter ? ` · ${costCenter}` : ''}</div>
                      })()}
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap min-w-[140px]">
                      <MaKhachCell value={r.ma_khach} onSave={v => saveMaKhach(r.id, v)} options={maKhachOptions} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{r.ticket_no ?? '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                      <div><RoutingText value={r.routing} /></div>
                      <div className="text-xs text-gray-400">{r.dep_date}{r.arr_date && r.arr_date !== r.dep_date ? ` → ${r.arr_date}` : ''}</div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{r.issued_date ?? '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatGiaVe(r.gia_mua)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatGiaVe(r.gia_ban)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-emerald-600">{formatGiaVe(r.loi_nhuan)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{r.note || '—'}</td>
                  </tr>
                  {isOpen && rawMessage && (
                    <tr>
                      <td colSpan={colCount} className="px-4 py-3 bg-gray-50/70">
                        <div className={`grid gap-3 ${parsedBookings && parsedBookings.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          <div>
                            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tin nhắn từ telegram</div>
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-white border border-gray-200 rounded-xl p-3">{rawMessage}</pre>
                          </div>
                          {parsedBookings && parsedBookings.length > 0 && (
                            <div>
                              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">AI đọc được ({parsedBookings.length})</div>
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-white border border-gray-200 rounded-xl p-3 overflow-x-auto">{JSON.stringify(reorderBookingJsonFields(parsedBookings as Record<string, unknown>[]), null, 2)}</pre>
                            </div>
                          )}
                        </div>
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
    </div>
  )
}
