'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Thanh cuộn dọc TỰ VẼ, đè lên nội dung thay vì chiếm chỗ layout (giống
// Telegram desktop) — thanh cuộn NGUYÊN BẢN của trình duyệt luôn chiếm 1
// dải bề rộng cố định dù mảnh cỡ nào (Chrome/Windows không còn hỗ trợ
// "overflow: overlay" từ bản 121), nên chỉ có cách ẩn hẳn thanh cuộn thật
// (.overlay-scroll-hide-native, xem globals.css) rồi tự vẽ 1 "thumb" absolute
// đặt chồng lên rìa phải, tính vị trí/chiều cao theo scrollTop/scrollHeight.
// Hiện chỉ dùng cho khung tin nhắn Telegram (RawMatchPanel.tsx) — KHÔNG áp
// cho các bảng khác, những chỗ đó vẫn giữ nguyên thanh cuộn thật kiểu mặc
// định (mảnh, xem rule `*` trong globals.css).
//
// `className` áp cho khối NGOÀI (relative, quyết định kích thước theo layout
// cha — vd flex-1 min-h-0). Khối NGOÀI tự là flex-col + khối cuộn bên trong
// flex-1 min-h-0 (thay vì h-full) để luôn ăn đúng phần còn lại dù cha cao
// theo cách nào. `contentClassName` áp cho khối cuộn THẬT bên trong
// (padding/space-y của nội dung).
export function OverlayScrollArea({ className, contentClassName, children }: {
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null)
  const [hovering, setHovering] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recompute = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight <= clientHeight + 1) { setThumb(null); return }
    const height = Math.max(24, (clientHeight / scrollHeight) * clientHeight)
    const maxTop = clientHeight - height
    const top = maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop
    setThumb({ top, height })
  }, [])

  // Theo dõi CẢ chiều cao khung (ResizeObserver) LẪN nội dung con đổi (vd
  // chọn tin nhắn khác dài/ngắn hơn hẳn) — chỉ ResizeObserver trên chính
  // khung cuộn không bắt được trường hợp khung giữ nguyên cỡ nhưng nội dung
  // bên trong đổi chiều cao (scrollHeight đổi mà clientHeight không đổi).
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    const mo = new MutationObserver(recompute)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [recompute])

  useEffect(() => {
    return () => { if (scrollTimer.current) clearTimeout(scrollTimer.current) }
  }, [])

  function onScroll() {
    recompute()
    setScrolling(true)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => setScrolling(false), 800)
  }

  // Kéo trực tiếp thanh thumb — quy đổi khoảng cách kéo theo tỉ lệ track
  // (clientHeight trừ chiều cao thumb) sang scrollTop thật, giống hệt cách
  // Windows/macOS tính khi kéo thanh cuộn nguyên bản.
  function startDragThumb(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const el = innerRef.current
    if (!el || !thumb) return
    const startY = e.clientY
    const startScrollTop = el.scrollTop
    const maxScroll = el.scrollHeight - el.clientHeight
    const trackHeight = el.clientHeight - thumb.height
    function onMove(ev: MouseEvent) {
      // el chắc chắn khác null (đã return sớm ở trên) — TS không giữ được
      // narrowing qua closure lồng trong function declaration nên phải ép
      // kiểu tay ở đây.
      const ratio = trackHeight > 0 ? (ev.clientY - startY) / trackHeight : 0
      el!.scrollTop = Math.min(maxScroll, Math.max(0, startScrollTop + ratio * maxScroll))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const visible = hovering || scrolling

  return (
    <div className={`relative flex flex-col ${className ?? ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}>
      <div ref={innerRef} onScroll={onScroll}
        className={`flex-1 min-h-0 overflow-y-auto overlay-scroll-hide-native ${contentClassName ?? ''}`}>
        {children}
      </div>
      {thumb && (
        <div onMouseDown={startDragThumb}
          className={`absolute right-0.5 w-1.5 rounded-full bg-gray-400/60 hover:bg-gray-500/80 transition-opacity duration-300 cursor-pointer ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          style={{ top: thumb.top, height: thumb.height }} />
      )}
    </div>
  )
}
