'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { RefreshCw, Search, ChevronRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTopbar } from '@/contexts/topbar'
import { useCellSelection } from '@/hooks/useCellSelection'
import { useResizableColumns } from '@/hooks/useResizableColumns'

const PARSE_LOG_COLS = [
  { key: 'expand', label: '', width: 40 },
  { key: 'time', label: 'Thời gian', width: 140 },
  { key: 'tkt', label: 'TKT', width: 120 },
  { key: 'nhom', label: 'Nhóm', width: 180 },
  { key: 'nguoi_gui', label: 'Người gửi', width: 150 },
  { key: 'trang_thai', label: 'Trạng thái', width: 120 },
  { key: 'noi_dung', label: 'Nội dung gốc', width: 320 },
]

type ParsedBooking = { full_name?: string; routing?: string; ticket_no?: string; [k: string]: unknown }

type LogRow = {
  id: string
  raw_message: string | null
  parsed_bookings: ParsedBooking[] | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'error'
  error_message: string | null
  from_user_name: string | null
  created_at: string
  ve_tkt: { tkt_code: string; ten_nhan_vien: string | null } | null
  ve_telegram_groups: { telegram_chat_title: string | null } | null
}

// Bot trung tâm (webhook-central trong hns-ticket-parser) chạy hoàn toàn
// im lặng, không trả lời gì vào Telegram dù đọc được hay lỗi — đây là màn
// DUY NHẤT để tra vì sao 1 tin nhắn không thành ve_bookings. status='error'
// với error_message="No bookings extracted" xảy ra cho MỌI tin nhắn chat
// bình thường không phải vé (rất nhiều, không phải lỗi thật) — tách badge
// riêng "Không phải vé" để không lẫn với lỗi parse/ghi DB thật sự.
const KHONG_PHAI_VE_MSG = 'No bookings extracted'

// dinh_dang lên đầu để dễ phân biệt tin nhắn được AI đọc theo định dạng
// nào (A-H, xem SYSTEM_PROMPT_V2 ở hns-ticket-parser) ngay khi liếc qua.
// cost_center/employee_code chỉ có giá trị với khách Honda, phần lớn booking
// khác để trống — đẩy 2 field này xuống cuối khi hiện JSON debug cho dễ nhìn,
// đỡ chen giữa các field luôn có giá trị.
function reorderBookingJsonFields(bookings: ParsedBooking[]): ParsedBooking[] {
  return bookings.map(b => {
    const { dinh_dang, cost_center, employee_code, ...rest } = b
    return { dinh_dang, ...rest, cost_center, employee_code }
  })
}

type Tab = 'tat_ca' | 'confirmed' | 'loi_that' | 'khong_phai_ve'

const TABS: { key: Tab; label: string }[] = [
  { key: 'tat_ca', label: 'Tất cả' },
  { key: 'confirmed', label: 'Đã lưu' },
  { key: 'loi_that', label: 'Lỗi đọc/ghi' },
  { key: 'khong_phai_ve', label: 'Không phải vé' },
]

function classify(r: LogRow): Tab {
  if (r.status === 'confirmed') return 'confirmed'
  if (r.status === 'error' && r.error_message === KHONG_PHAI_VE_MSG) return 'khong_phai_ve'
  if (r.status === 'error' || r.status === 'pending') return 'loi_that'
  return 'tat_ca'
}

const BADGE: Record<string, { text: string; cls: string }> = {
  confirmed: { text: 'Đã lưu', cls: 'bg-emerald-50 text-emerald-700' },
  loi_that: { text: 'Lỗi', cls: 'bg-red-50 text-red-600' },
  khong_phai_ve: { text: 'Không phải vé', cls: 'bg-gray-100 text-gray-500' },
  tat_ca: { text: '—', cls: 'bg-gray-100 text-gray-500' },
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ParseLogsPage() {
  const { user } = useAuth()
  const { setBreadcrumb, setOnRefresh } = useTopbar()
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<Tab>('tat_ca')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/ve-may-bay/parse-logs')
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

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Nhật ký bot vé</span>)
    setOnRefresh(loadData)
    return () => {
      setBreadcrumb(null)
      setOnRefresh(null)
    }
  }, [setBreadcrumb, setOnRefresh, loadData])

  const counts = useMemo(() => {
    const c = { confirmed: 0, loi_that: 0, khong_phai_ve: 0 }
    for (const r of rows) {
      const k = classify(r)
      if (k !== 'tat_ca') c[k]++
    }
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (tab !== 'tat_ca' && classify(r) !== tab) return false
      if (q) {
        const hay = [r.raw_message, r.ve_tkt?.tkt_code, r.ve_telegram_groups?.telegram_chat_title, r.from_user_name].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, tab, search])

  // Gom theo ngày (created_at), mới nhất lên đầu — cùng cách nhóm đang dùng
  // ở trang "Thông tin xuất vé", cho thống nhất.
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; rows: LogRow[] }>()
    for (const r of filtered) {
      const key = r.created_at.slice(0, 10)
      if (!map.has(key)) map.set(key, { label: formatDateOnly(r.created_at), rows: [] })
      map.get(key)!.rows.push(r)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, g]) => g)
  }, [filtered])

  // filtered đã sắp theo created_at giảm dần nên grouped (gom theo ngày)
  // giữ nguyên đúng thứ tự render — dùng map id→index này để có (hàng, cột)
  // ổn định cho vùng chọn kiểu Excel, không phụ thuộc cấu trúc group.
  const rowIndexById = useMemo(() => new Map(filtered.map((r, i) => [r.id, i])), [filtered])
  const { cellProps, cellClassName, wrapProps, menu } = useCellSelection((r, c) => {
    const row = filtered[r]
    if (!row) return ''
    switch (c) {
      case 0: return formatTime(row.created_at)
      case 1: return row.ve_tkt?.tkt_code ?? ''
      case 2: return row.ve_telegram_groups?.telegram_chat_title ?? ''
      case 3: return row.from_user_name ?? ''
      case 4: return BADGE[classify(row)].text
      case 5: return row.raw_message ?? ''
      default: return ''
    }
  })
  const { widths: plWidths, startResize: startPlResize } = useResizableColumns('parse-logs', Object.fromEntries(PARSE_LOG_COLS.map(c => [c.key, c.width])))
  const plTotalWidth = PARSE_LOG_COLS.reduce((sum, c) => sum + (plWidths[c.key] ?? c.width), 0)

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Trang lộ nguyên văn tin nhắn Telegram + JSON AI đọc được của MỌI TKT —
  // chỉ Super Admin, cùng mức siết như /ve-may-bay/nhom và /ve-may-bay/tkt.
  if (!user?.is_super_admin) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 40px)' }}>
        <div className="text-center">
          <ShieldCheck size={48} className="mx-auto text-gray-200 mb-4" />
          <h2 className="text-xl font-bold text-gray-500 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-400 text-sm">Chỉ Super Admin mới xem được Nhật ký bot vé.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {t.label}
            {t.key !== 'tat_ca' && <span className="ml-1.5 opacity-70">{counts[t.key]}</span>}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm TKT, nhóm, người gửi, nội dung..."
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-72" />
        </div>
      </div>

      <p className="text-sm text-gray-400">{filtered.length.toLocaleString('vi-VN')} dòng</p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden list-table-container">
        <div {...wrapProps} className="overflow-x-auto select-none outline-none">
          <table className="text-sm list-table fixed-cols-table border-collapse" style={{ tableLayout: 'fixed', width: plTotalWidth }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {PARSE_LOG_COLS.map(c => (
                  <th key={c.key} style={{ width: plWidths[c.key] ?? c.width }}
                    className="relative text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap overflow-hidden select-none">
                    {c.label}
                    <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60 z-10" onMouseDown={e => startPlResize(c.key, e)} />
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
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-14 text-center text-gray-400">Không có dòng nào khớp bộ lọc.</td></tr>
              ) : grouped.map(g => (
                <Fragment key={g.label}>
                  <tr>
                    <td colSpan={7} className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-700">
                      {g.label} <span className="text-gray-400 font-normal">({g.rows.length} dòng)</span>
                    </td>
                  </tr>
                  {g.rows.map(r => {
                    const kind = classify(r)
                    const isOpen = expanded.has(r.id)
                    const ri = rowIndexById.get(r.id) ?? 0
                    return (
                      <Fragment key={r.id}>
                        <tr className="hover:bg-gray-50/70 transition-colors cursor-pointer" onClick={() => toggle(r.id)}>
                          <td className="px-2 py-2 text-gray-300">
                            <ChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </td>
                          <td {...cellProps(ri, 0)} className={cellClassName(ri, 0, 'px-4 py-2 text-gray-600 whitespace-nowrap cursor-cell')}>{formatTime(r.created_at)}</td>
                          <td {...cellProps(ri, 1)} className={cellClassName(ri, 1, 'px-4 py-2 text-gray-700 whitespace-nowrap cursor-cell')}>{r.ve_tkt?.tkt_code ?? '—'}</td>
                          <td {...cellProps(ri, 2)} className={cellClassName(ri, 2, 'px-4 py-2 text-gray-500 max-w-[160px] truncate cursor-cell')} title={r.ve_telegram_groups?.telegram_chat_title ?? ''}>{r.ve_telegram_groups?.telegram_chat_title ?? '—'}</td>
                          <td {...cellProps(ri, 3)} className={cellClassName(ri, 3, 'px-4 py-2 text-gray-500 whitespace-nowrap cursor-cell')}>{r.from_user_name ?? '—'}</td>
                          <td {...cellProps(ri, 4)} className={cellClassName(ri, 4, 'px-4 py-2 whitespace-nowrap cursor-cell')}>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE[kind].cls}`}>{BADGE[kind].text}</span>
                          </td>
                          <td {...cellProps(ri, 5)} className={cellClassName(ri, 5, 'px-4 py-2 text-gray-600 max-w-[360px] truncate cursor-cell')} title={r.raw_message ?? ''}>{r.raw_message ?? '—'}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50/60">
                            <td></td>
                            <td colSpan={6} className="px-4 py-3 space-y-2">
                              {kind === 'loi_that' && (
                                <div>
                                  <div className="text-[10px] font-semibold text-red-400 uppercase mb-1">Lỗi</div>
                                  <div className="text-xs text-red-600 bg-white border border-red-100 rounded-lg p-2.5">{r.error_message ?? '(không có mô tả lỗi)'}</div>
                                </div>
                              )}
                              <div className={`grid gap-2 ${r.parsed_bookings && r.parsed_bookings.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                <div>
                                  <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Nội dung gốc</div>
                                  <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-2.5">{r.raw_message ?? '—'}</pre>
                                </div>
                                {r.parsed_bookings && r.parsed_bookings.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">AI đọc được ({r.parsed_bookings.length})</div>
                                    <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-2.5 overflow-x-auto">{JSON.stringify(reorderBookingJsonFields(r.parsed_bookings), null, 2)}</pre>
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
      {menu}
    </div>
  )
}
