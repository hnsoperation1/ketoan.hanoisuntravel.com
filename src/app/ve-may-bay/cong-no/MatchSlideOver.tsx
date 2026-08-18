'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { filterKhachOptions, type KhachOpt } from '@/lib/ve-may-bay/khach-opt'
import { MatchStatusBadge, type MatchStatus } from '@/lib/ve-may-bay/match-status'

type Pax = {
  id: string
  ticket_no: string | null
  ma_khach: string | null
  ten_khach_hang: string | null
  full_name: string | null
  routing: string | null
  gia_mua: number | null
  gia_ban: number | null
  ve_tkt: { tkt_code: string | null; ten_nhan_vien: string | null } | null
}

type Message = {
  parse_log_id: string
  raw_message: string | null
  created_at: string
  from_user_name: string | null
  group_title: string | null
  pax: Pax[]
}

type KhachInfo = Record<string, { ten_khach: string | null; active: boolean }>

export type MatchSlideOverTarget = {
  id: string
  ticketLabel: string
  contextLabel: string
  matchStatus: MatchStatus | null
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN')
  } catch {
    return iso
  }
}

// Slide-over bên phải, mở khi bấm badge trạng thái khớp mã khách (dùng
// chung cho cả tab "Tổng hợp" — ve_debt_records — lẫn 4 tab NCC raw —
// ve_debt_records_raw, xem cong-no/page.tsx). 3 cột: trái = danh sách TIN
// NHẮN Telegram khớp mã vé/PNR (gọn, không nhồi nguyên văn), giữa = nguyên
// văn + toàn bộ PAX bot đã tách ra từ tin nhắn đang chọn (1 tin nhắn
// thường gộp nhiều pax/nhiều PNR, không chỉ riêng pax khớp đúng mã vé ban
// đầu — xem buildCandidateMessages), phải = tìm tay trong danh mục KH.
// Không biết gì về nguồn dữ liệu cụ thể (DebtRow hay dòng raw) — chỉ nhận
// `target` (nhãn hiển thị + trạng thái) và `candidatesUrl` (nơi gọi API),
// nơi gọi tự ráp 2 thứ đó theo đúng luồng của mình, tránh phải viết 2
// slide-over gần giống hệt nhau. Khung animation/portal copy từ
// KhachDetailSlideOver (cong-no-khach-hang/page.tsx) — pattern slide-over
// duy nhất hiện có trong app.
export function MatchSlideOver({ target, candidatesUrl, khSuggestions, onSaved, onClose }: {
  target: MatchSlideOverTarget
  candidatesUrl: string
  khSuggestions: KhachOpt[]
  onSaved: (maKhach: string, matchedBookingId: string | null, giaMua?: number | null, giaBan?: number | null) => void
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [khachInfo, setKhachInfo] = useState<KhachInfo>({})
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null)
  const [manualQuery, setManualQuery] = useState('')

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCandidates() {
      setLoading(true)
      setLoadError(false)
      try {
        const res = await fetch(candidatesUrl)
        if (!res.ok) throw new Error('load failed')
        const { data } = await res.json()
        if (cancelled) return
        const msgs: Message[] = Array.isArray(data?.messages) ? data.messages : []
        setMessages(msgs)
        setKhachInfo(data?.khachInfo ?? {})
        setSelectedMsgId(msgs[0]?.parse_log_id ?? null)
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCandidates()
    return () => { cancelled = true }
  }, [candidatesUrl])

  function close() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  function choosePax(p: Pax) {
    if (!p.ma_khach) return
    onSaved(p.ma_khach, p.id, p.gia_mua, p.gia_ban)
    close()
  }

  function chooseManual(maKhach: string) {
    onSaved(maKhach, null)
    close()
  }

  const manualFiltered = filterKhachOptions(khSuggestions, manualQuery)
  const selectedMessage = messages.find(m => m.parse_log_id === selectedMsgId) ?? null

  return createPortal(
    <>
      <div className={`fixed inset-0 bg-black/30 z-150 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={close} />
      <div className={`fixed inset-y-0 right-0 z-160 w-full max-w-6xl bg-white shadow-2xl flex flex-col transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Khớp mã khách theo mã vé</p>
            <p className="font-bold text-gray-900 text-lg truncate">{target.ticketLabel}</p>
            <p className="text-xs text-gray-400 truncate">{target.contextLabel}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <MatchStatusBadge status={target.matchStatus ?? 'unmatched'} onClick={() => {}} />
            <button onClick={close} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_1fr_300px]">
          <div className="overflow-y-auto p-4 border-b md:border-b-0 md:border-r border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-2">Tin nhắn Telegram khớp mã vé</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
                <Loader2 size={16} className="animate-spin" /> Đang tải...
              </div>
            ) : loadError ? (
              <p className="text-sm text-red-500 py-4 px-2">Không tải được dữ liệu, thử đóng và mở lại.</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 px-2">Không tìm thấy tin nhắn Telegram nào khớp mã vé/PNR này.</p>
            ) : (
              <div className="space-y-3">
                {messages.map(m => {
                  const selected = m.parse_log_id === selectedMsgId
                  return (
                    <button key={m.parse_log_id} type="button" onClick={() => setSelectedMsgId(m.parse_log_id)}
                      className={`w-full text-left rounded-2xl border p-3 transition-colors ${selected ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      {m.group_title && (
                        <div className="text-[11px] text-gray-400 mb-1 truncate">Nhóm Telegram: {m.group_title}</div>
                      )}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-emerald-600 truncate">{m.from_user_name ?? 'Không rõ người gửi'}</span>
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{m.pax.length} khách</span>
                      </div>
                      {m.raw_message && (
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{m.raw_message}</p>
                      )}
                      <div className="text-[11px] text-gray-400 text-right mt-1">{formatDateTime(m.created_at)}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="overflow-y-auto p-6 border-b md:border-b-0 md:border-r border-gray-100">
            {!selectedMessage ? (
              <p className="text-sm text-gray-400 py-4">Chọn 1 tin nhắn bên trái để xem danh sách khách.</p>
            ) : (
              <>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Hành khách trong tin nhắn ({selectedMessage.pax.length})</h3>
                <div className="space-y-2">
                  {selectedMessage.pax.map(p => {
                    const info = p.ma_khach ? khachInfo[p.ma_khach] : undefined
                    const invalid = p.ma_khach && !info
                    const inactive = info && !info.active
                    return (
                      <div key={p.id} className="border border-gray-200 rounded-xl p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">{p.full_name || p.ten_khach_hang || 'Không rõ tên khách'}</div>
                            <div className="text-xs text-gray-400 mt-0.5">Mã vé: {p.ticket_no ?? '—'} · TKT {p.ve_tkt?.tkt_code ?? '—'} ({p.ve_tkt?.ten_nhan_vien ?? '—'})</div>
                            <div className="text-sm mt-1.5">
                              Mã khách: <span className="font-semibold text-gray-800">{p.ma_khach ?? '—'}</span>
                              {info?.ten_khach && <span className="text-gray-400"> · {info.ten_khach}</span>}
                              {(invalid || inactive) && (
                                <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                  {invalid ? 'Không có trong danh mục' : 'Đã ngừng hoạt động'}
                                </span>
                              )}
                            </div>
                          </div>
                          <button type="button" onClick={() => choosePax(p)} disabled={!p.ma_khach}
                            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            Chọn mã KH này
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <div className="overflow-y-auto p-6 flex flex-col min-h-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Hoặc tự tìm trong danh mục khách hàng</h3>
            <input autoFocus={messages.length === 0} value={manualQuery} onChange={e => setManualQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && manualQuery.trim()) chooseManual(manualQuery.trim()) }}
              placeholder="Tìm mã khách hoặc tên khách..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 mb-2" />
            <div className="border border-gray-100 rounded-xl overflow-y-auto divide-y divide-gray-50">
              {manualFiltered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  Không tìm thấy trong danh mục.
                  {manualQuery.trim() && (
                    <button onClick={() => chooseManual(manualQuery.trim())}
                      className="block mx-auto mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Dùng nguyên văn &quot;{manualQuery.trim()}&quot;
                    </button>
                  )}
                </div>
              ) : (
                manualFiltered.slice(0, 50).map(o => (
                  <button key={o.ma_khach} type="button" onClick={() => chooseManual(o.ma_khach)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-semibold text-gray-800">{o.ma_khach}</span>
                    {o.ten_khach && <span className="text-xs text-gray-400 ml-2">{o.ten_khach}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
