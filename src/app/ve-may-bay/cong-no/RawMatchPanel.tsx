'use client'

import { useState, useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
import { filterKhachOptions, type KhachOpt } from '@/lib/ve-may-bay/khach-opt'
import { MatchStatusBadge } from '@/lib/ve-may-bay/match-status'
import type { MatchSlideOverTarget } from './MatchSlideOver'

export type RawCandidatePax = {
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

export type RawCandidateMessage = {
  parse_log_id: string
  raw_message: string | null
  created_at: string
  from_user_name: string | null
  group_title: string | null
  pax: RawCandidatePax[]
}

export type RawKhachInfo = Record<string, { ten_khach: string | null; active: boolean }>

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
// che hết bảng. MatchSlideOver.tsx giữ nguyên không đổi (vẫn dùng cho tab
// "Tổng hợp"), file này là bản dựng riêng, có thể xoá bỏ để quay lại modal
// cũ bất cứ lúc nào mà không đụng gì tới file kia.
//
// Panel này CHỈ còn giữ danh sách tin nhắn + tìm tay trong danh mục — danh
// sách hành khách của tin nhắn đang chọn đã chuyển ra bảng riêng bên phải
// (xem SelectedMessagePaxTable ở page.tsx) để dễ đọc hơn dạng bảng rộng
// thay vì card hẹp. `onSelectMessage` báo lên page.tsx mỗi khi tin nhắn
// được chọn đổi (kể cả lúc tự chọn tin đầu tiên sau khi tải xong, hoặc bị
// xoá về null khi đóng panel) để page.tsx biết vẽ bảng đó với dữ liệu nào.
export function RawMatchPanel({ target, candidatesUrl, khSuggestions, onSaved, onClose, onSelectMessage }: {
  target: MatchSlideOverTarget | null
  candidatesUrl: string | null
  khSuggestions: KhachOpt[]
  onSaved: (maKhach: string, matchedBookingId: string | null, giaMua?: number | null, giaBan?: number | null) => void
  onClose: () => void
  onSelectMessage: (info: { message: RawCandidateMessage; khachInfo: RawKhachInfo } | null) => void
}) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [messages, setMessages] = useState<RawCandidateMessage[]>([])
  const [khachInfo, setKhachInfo] = useState<RawKhachInfo>({})
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
        onSelectMessage(null)
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
        const msgs: RawCandidateMessage[] = Array.isArray(data?.messages) ? data.messages : []
        const info: RawKhachInfo = data?.khachInfo ?? {}
        setMessages(msgs)
        setKhachInfo(info)
        setSelectedMsgId(msgs[0]?.parse_log_id ?? null)
        onSelectMessage(msgs[0] ? { message: msgs[0], khachInfo: info } : null)
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCandidates()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesUrl])

  function chooseManual(maKhach: string) {
    onSaved(maKhach, null)
    setManualQuery('')
  }

  function selectMessage(m: RawCandidateMessage) {
    setSelectedMsgId(m.parse_log_id)
    onSelectMessage({ message: m, khachInfo })
  }

  if (!target) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-400 text-center">
        Bấm vào mã vé/PNR trong bảng để xem tin nhắn Telegram khớp ở đây.
      </div>
    )
  }

  const manualFiltered = filterKhachOptions(khSuggestions, manualQuery)

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
                  <button key={m.parse_log_id} type="button" onClick={() => selectMessage(m)}
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
