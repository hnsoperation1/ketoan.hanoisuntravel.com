'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return node => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(node)
      else (ref as React.RefObject<T | null>).current = node
    }
  }
}

// Thanh cuộn dọc TỰ VẼ, đè lên nội dung thay vì chiếm chỗ layout (giống
// Telegram desktop) — thanh cuộn NGUYÊN BẢN của trình duyệt luôn chiếm 1
// dải bề rộng cố định dù mảnh cỡ nào (Chrome/Windows không còn hỗ trợ
// "overflow: overlay" từ bản 121), nên chỉ có cách ẩn hẳn thanh cuộn thật
// (.overlay-scroll-hide-native, xem globals.css) rồi tự vẽ 1 "thumb" absolute
// đặt chồng lên rìa phải, tính vị trí/chiều cao theo scrollTop/scrollHeight.
//
// `className`/`style` áp cho khối NGOÀI (quyết định kích thước theo layout
// cha — vd className="flex-1 min-h-0" trong 1 cột flex, HOẶC style={{maxHeight}}
// khi muốn co theo nội dung nhưng chặn trần). Khối NGOÀI tự là flex-col +
// khối cuộn bên trong flex-1 min-h-0 (thay vì h-full) — bắt buộc phải vậy
// mới đúng khi khối ngoài chỉ có max-height (không có height tường minh):
// height:100% (h-full) trên phần tử block thường KHÔNG tự tính được theo
// max-height của cha (CSS chỉ resolve % theo height tường minh), còn flex-1
// thì luôn ăn đúng phần còn lại đã resolve, dù cha cao theo max-height hay
// theo flex cha xa hơn.
//
// `contentClassName` áp cho khối cuộn THẬT bên trong (padding/space-y của
// nội dung, xem RawMatchPanel.tsx). `scrollRef` + các props DOM khác
// (tabIndex, onKeyDown...) được gắn thẳng lên khối cuộn bên trong — dùng
// khi khối đó cần thêm hành vi ngoài cuộn (vd wrapProps của useCellSelection
// ở RawTableCard, cần ref/tabIndex/onKeyDown riêng để giữ tính năng
// kéo-chọn-vùng + Ctrl+C + di chuyển bằng mũi tên).
export function OverlayScrollArea({ className, style, contentClassName, children, scrollRef: externalRef, ...rest }: {
  className?: string
  style?: React.CSSProperties
  contentClassName?: string
  children: React.ReactNode
  scrollRef?: React.Ref<HTMLDivElement>
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'style' | 'children' | 'onScroll'>) {
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
    <div className={`relative flex flex-col ${className ?? ''}`} style={style}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}>
      {/* overflow-x-auto giữ nguyên cuộn ngang (native, đã làm mảnh sẵn qua
          rule `*` trong globals.css) — component này chỉ tự vẽ lại cuộn
          DỌC, cuộn ngang không cần kiểu overlay vì hiếm khi xảy ra đồng
          thời với cuộn dọc trong các bảng đang dùng component này. */}
      <div ref={mergeRefs(innerRef, externalRef)} onScroll={onScroll} {...rest}
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-auto overlay-scroll-hide-native ${contentClassName ?? ''}`}>
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
