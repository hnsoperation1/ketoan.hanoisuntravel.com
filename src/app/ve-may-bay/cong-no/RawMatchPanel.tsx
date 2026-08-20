'use client'

import { useState, useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
import { filterKhachOptions, type KhachOpt } from '@/lib/ve-may-bay/khach-opt'
import { MatchStatusBadge } from '@/lib/ve-may-bay/match-status'
import type { MatchSlideOverTarget } from './MatchSlideOver'

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

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN')
  } catch {
    return iso
  }
}

// Panel khớp mã khách hiển thị TRÀN LUỒNG bên trái bảng công nợ NCC raw (cột
// cố định, không phải overlay/portal) — tạm thời (2026-08-20) thay thế cách
// hiển thị của MatchSlideOver CHỈ CHO 4 tab NCC raw, theo yêu cầu bấm mã
// vé/PNR sẽ "trượt" nội dung khớp vào khoảng trống bên trái thay vì mở modal
// che hết bảng. Dữ liệu/logic chọn giữ y hệt MatchSlideOver (cùng
// candidatesUrl, cùng onSaved) — chỉ khác layout dọc 1 cột thay vì 3 cột
// ngang do bề rộng panel hẹp hơn nhiều. MatchSlideOver.tsx giữ nguyên không
// đổi (vẫn dùng cho tab "Tổng hợp"), file này là bản dựng riêng, có thể xoá
// bỏ để quay lại modal cũ bất cứ lúc nào mà không đụng gì tới file kia.
export function RawMatchPanel({ target, candidatesUrl, khSuggestions, onSaved, onClose }: {
  target: MatchSlideOverTarget | null
  candidatesUrl: string | null
  khSuggestions: KhachOpt[]
  onSaved: (maKhach: string, matchedBookingId: string | null, giaMua?: number | null, giaBan?: number | null) => void
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [khachInfo, setKhachInfo] = useState<KhachInfo>({})
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null)
  const [manualQuery, setManualQuery] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadCandidates() {
      if (!candidatesUrl) {
        setMessages([])
        setKhachInfo({})
        setSelectedMsgId(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError(false)
      setManualQuery('')
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

  function choosePax(p: Pax) {
    if (!p.ma_khach) return
    onSaved(p.ma_khach, p.id, p.gia_mua, p.gia_ban)
  }

  function chooseManual(maKhach: string) {
    onSaved(maKhach, null)
    setManualQuery('')
  }

  if (!target) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-400 text-center">
        Bấm vào mã vé/PNR trong bảng để xem tin nhắn Telegram khớp ở đây.
      </div>
    )
  }

  const manualFiltered = filterKhachOptions(khSuggestions, manualQuery)
  const selectedMessage = messages.find(m => m.parse_log_id === selectedMsgId) ?? null

  return (
    <div key={target.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col max-h-[calc(100vh-140px)]">
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Khớp mã khách theo mã vé</p>
          <p className="font-bold text-gray-900 text-sm truncate">{target.ticketLabel}</p>
          <p className="text-xs text-gray-400 truncate">{target.contextLabel}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MatchStatusBadge status={target.matchStatus ?? 'unmatched'} onClick={() => {}} />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto p-3 space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">Tin nhắn Telegram khớp mã vé</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
              <Loader2 size={16} className="animate-spin" /> Đang tải...
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-500 py-2 px-1">Không tải được dữ liệu, thử bấm lại mã vé.</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-400 py-2 px-1">Không tìm thấy tin nhắn Telegram nào khớp mã vé/PNR này.</p>
          ) : (
            <div className="space-y-2">
              {messages.map(m => {
                const selected = m.parse_log_id === selectedMsgId
                return (
                  <button key={m.parse_log_id} type="button" onClick={() => setSelectedMsgId(m.parse_log_id)}
                    className={`w-full text-left rounded-xl border p-2.5 transition-colors ${selected ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    {m.group_title && (
                      <div className="text-[11px] text-gray-400 mb-1 truncate">Nhóm: {m.group_title}</div>
                    )}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-emerald-600 truncate">{m.from_user_name ?? 'Không rõ người gửi'}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{m.pax.length} khách</span>
                    </div>
                    {m.raw_message && (
                      <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">{m.raw_message}</p>
                    )}
                    <div className="text-[10px] text-gray-400 text-right mt-1">{formatDateTime(m.created_at)}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selectedMessage && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">Hành khách trong tin nhắn ({selectedMessage.pax.length})</h3>
            <div className="space-y-2">
              {selectedMessage.pax.map(p => {
                const info = p.ma_khach ? khachInfo[p.ma_khach] : undefined
                const invalid = p.ma_khach && !info
                const inactive = info && !info.active
                return (
                  <div key={p.id} className="border border-gray-200 rounded-xl p-2.5">
                    <div className="text-xs font-semibold text-gray-800 truncate">{p.full_name || p.ten_khach_hang || 'Không rõ tên khách'}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Mã vé: {p.ticket_no ?? '—'} · TKT {p.ve_tkt?.tkt_code ?? '—'}</div>
                    <div className="text-xs mt-1.5 flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        Mã khách: <span className="font-semibold text-gray-800">{p.ma_khach ?? '—'}</span>
                        {info?.ten_khach && <span className="text-gray-400"> · {info.ten_khach}</span>}
                        {(invalid || inactive) && (
                          <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                            {invalid ? 'Không có trong danh mục' : 'Đã ngừng hoạt động'}
                          </span>
                        )}
                      </span>
                      <button type="button" onClick={() => choosePax(p)} disabled={!p.ma_khach}
                        className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        Chọn
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">Hoặc tự tìm trong danh mục khách hàng</h3>
          <input value={manualQuery} onChange={e => setManualQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && manualQuery.trim()) chooseManual(manualQuery.trim()) }}
            placeholder="Tìm mã khách hoặc tên khách..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 mb-2" />
          <div className="border border-gray-100 rounded-xl overflow-y-auto max-h-52 divide-y divide-gray-50">
            {manualFiltered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                Không tìm thấy trong danh mục.
                {manualQuery.trim() && (
                  <button onClick={() => chooseManual(manualQuery.trim())}
                    className="block mx-auto mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700">
                    Dùng nguyên văn &quot;{manualQuery.trim()}&quot;
                  </button>
                )}
              </div>
            ) : (
              manualFiltered.map(o => (
                <button key={o.ma_khach} type="button" onClick={() => chooseManual(o.ma_khach)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors">
                  <span className="text-xs font-semibold text-gray-800">{o.ma_khach}</span>
                  {o.ten_khach && <span className="text-[11px] text-gray-400 ml-2">{o.ten_khach}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
