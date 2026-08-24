'use client'

import { useState, useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
import type { MatchSlideOverTarget } from './MatchSlideOver'
import { OverlayScrollArea } from '@/components/OverlayScrollArea'

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
// Panel này CHỈ còn giữ danh sách tin nhắn — danh sách hành khách của tin
// nhắn đang chọn đã chuyển ra bảng riêng bên phải (xem SelectedMessagePaxTable
// ở page.tsx) để dễ đọc hơn dạng bảng rộng thay vì card hẹp; mục tìm tay
// trong danh mục khách hàng đã bỏ hẳn (2026-08-20) — chọn mã khách giờ chỉ
// còn qua bảng bên phải. `onSelectMessage` báo lên page.tsx mỗi khi tin
// nhắn được chọn đổi (kể cả lúc tự chọn tin đầu tiên sau khi tải xong, hoặc
// bị xoá về null khi đóng panel) để page.tsx biết vẽ bảng đó với dữ liệu nào.
export function RawMatchPanel({ target, candidatesUrl, preloaded, onClose, onSelectMessage }: {
  target: MatchSlideOverTarget | null
  candidatesUrl: string | null
  // Kết quả đã tải sẵn từ candidates-bulk (chạy nền lúc mở/đổi tab, xem
  // RawBatchesView) — CÓ giá trị (kể cả rỗng) thì dùng luôn, không gọi API
  // nữa. undefined = bulk cache chưa tải xong/không áp dụng → rơi về gọi
  // candidatesUrl như cũ (đúng dữ liệu, chỉ chậm hơn vì phải chờ request).
  preloaded?: { messages: RawCandidateMessage[]; khachInfo: RawKhachInfo } | null
  onClose: () => void
  onSelectMessage: (info: { message: RawCandidateMessage; khachInfo: RawKhachInfo } | null) => void
}) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [messages, setMessages] = useState<RawCandidateMessage[]>([])
  const [khachInfo, setKhachInfo] = useState<RawKhachInfo>({})
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null)

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
      if (preloaded !== undefined) {
        const msgs = preloaded?.messages ?? []
        const info = preloaded?.khachInfo ?? {}
        setMessages(msgs)
        setKhachInfo(info)
        setSelectedMsgId(msgs[0]?.parse_log_id ?? null)
        setLoading(false)
        setLoadError(false)
        onSelectMessage(msgs[0] ? { message: msgs[0], khachInfo: info } : null)
        return
      }
      setLoading(true)
      setLoadError(false)
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
  }, [candidatesUrl, preloaded])

  function selectMessage(m: RawCandidateMessage) {
    setSelectedMsgId(m.parse_log_id)
    onSelectMessage({ message: m, khachInfo })
  }

  if (!target) {
    return (
      <div className="h-full bg-white border border-gray-100 shadow-sm p-6 text-sm text-gray-400 text-center flex items-center justify-center">
        Bấm vào mã vé/PNR trong bảng để xem tin nhắn Telegram khớp ở đây.
      </div>
    )
  }

  return (
    // h-full (thay vì max-h theo viewport) — panel này đứng cạnh cả khối
    // bảng hành khách + bảng lô công nợ bên phải (2 khối xếp chồng), luôn
    // cao bằng ĐÚNG tổng chiều cao của khối đó dù có 1 hay nhiều tin nhắn,
    // không co lại theo nội dung. Cha ở page.tsx đã set h-full xuyên suốt
    // (items-stretch trên hàng flex ngoài cùng) nên chỉ cần h-full ở đây.
    <div key={target.id} className="h-full bg-white border border-gray-100 shadow-sm flex flex-col">
      {/* Tách khỏi vùng overflow-y-auto bên dưới — trước đây tiêu đề nằm
          CHUNG trong khối cuộn nên cuộn danh sách tin nhắn xuống là tiêu đề
          + nút đóng trôi mất luôn, khỏi màn hình. Giờ luôn đứng yên ở đỉnh
          panel, chỉ phần danh sách bên dưới cuộn. */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-100 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Tin nhắn Telegram khớp mã vé</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <X size={14} />
        </button>
      </div>
      <OverlayScrollArea className="flex-1 min-h-0" contentClassName="p-3 space-y-4">
        <div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
              <Loader2 size={16} className="animate-spin" /> Đang tải...
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-500 py-2 px-1">Không tải được dữ liệu, thử bấm lại mã vé.</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-400 py-2 px-1">Không tìm thấy tin nhắn Telegram nào khớp mã vé/PNR này.</p>
          ) : (
            // Mỗi tin nhắn 1 "bubble" riêng (nền + viền + bo góc của chính
            // nó) thay vì 1 khối chung ngăn bằng viền mảnh — nhìn 1 phát
            // biết ranh giới từng tin ngay cả khi nội dung dài nhiều dòng
            // như trên. Vẫn giữ khoảng cách nhỏ (space-y-1.5) chứ không to
            // như bản card gốc trước đây, để không lãng phí diện tích panel.
            <div className="space-y-1.5">
              {messages.map(m => {
                const selected = m.parse_log_id === selectedMsgId
                return (
                  <button key={m.parse_log_id} type="button" onClick={() => selectMessage(m)}
                    className={`w-full text-left rounded-xl border px-2.5 py-2 transition-colors ${selected ? 'bg-brand-50 border-brand-300 shadow-sm' : 'bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-200'}`}>
                    {m.group_title && (
                      <div className="text-[11px] text-gray-400 truncate">Nhóm: {m.group_title}</div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-emerald-600 truncate">{m.from_user_name ?? 'Không rõ người gửi'}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{m.pax.length} khách</span>
                    </div>
                    {m.raw_message && (
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">{m.raw_message}</p>
                    )}
                    <div className="text-[10px] text-gray-400 text-right">{formatDateTime(m.created_at)}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayScrollArea>
    </div>
  )
}
