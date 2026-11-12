'use client'

import { useRef, useState } from 'react'

// Danh sách kéo thả theo CHIỀU DỌC (chuột + cảm ứng, không cần thư viện): giữ tay nắm (`handleProps`)
// rồi kéo lên/xuống, các mục khác dồn chỗ ngay khi con trỏ vượt quá nửa mục bên cạnh. Thả tay → onReorder.
// Theo dõi con trỏ trên window (không dùng pointer capture) vì mục đang kéo bị React di chuyển trong DOM
// khi đổi chỗ — di chuyển node làm mất capture và trình duyệt không báo lúc thả tay.
type HandleProps = { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties }

export function SortableList<T>({ items, getKey, onReorder, render, className }: {
  items: T[]
  getKey: (item: T) => string
  onReorder: (keys: string[]) => void
  render: (item: T, handle: HandleProps, dragging: boolean) => React.ReactNode
  className?: string
}) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)   // thứ tự tạm trong lúc kéo
  const nodes = useRef(new Map<string, HTMLElement>())
  const orderRef = useRef<string[] | null>(null)
  const baseKeys = items.map(getKey)
  const baseRef = useRef(baseKeys)
  baseRef.current = baseKeys
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const box = useRef<HTMLDivElement>(null)

  const keys = order ?? baseKeys
  const byKey = new Map(items.map((item) => [getKey(item), item]))

  function start(key: string, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    orderRef.current = baseRef.current
    setDragKey(key)
    setOrder(baseRef.current)

    let lastY = e.clientY
    const reorderAt = (y: number) => {
      const cur = orderRef.current
      if (!cur) return
      const others = cur.filter((k) => k !== key)
      // Vị trí mới = số mục khác có điểm giữa nằm phía trên con trỏ
      const index = others.filter((k) => {
        const r = nodes.current.get(k)?.getBoundingClientRect()
        return r ? r.top + r.height / 2 < y : false
      }).length
      const next = [...others.slice(0, index), key, ...others.slice(index)]
      if (next.join('|') !== cur.join('|')) {
        orderRef.current = next
        setOrder(next)
      }
    }
    // Tự cuộn khung chứa khi giữ mục gần mép trên / dưới (danh sách dài trong modal) — chạy mỗi khung hình
    const scroller = scrollParentOf(box.current)
    let raf = 0
    const autoScroll = () => {
      if (scroller) {
        const isPage = scroller === document.scrollingElement
        const top = isPage ? 0 : scroller.getBoundingClientRect().top
        const bottom = isPage ? window.innerHeight : scroller.getBoundingClientRect().bottom
        const step = lastY < top + EDGE ? -Math.min(18, (top + EDGE - lastY) / 3) : lastY > bottom - EDGE ? Math.min(18, (lastY - bottom + EDGE) / 3) : 0
        if (step) {
          const before = scroller.scrollTop
          scroller.scrollTop += step
          if (scroller.scrollTop !== before) reorderAt(lastY)
        }
      }
      raf = requestAnimationFrame(autoScroll)
    }
    raf = requestAnimationFrame(autoScroll)

    const onMove = (ev: PointerEvent) => {
      lastY = ev.clientY
      reorderAt(ev.clientY)
    }
    const onUp = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const final = orderRef.current
      orderRef.current = null
      setDragKey(null)
      setOrder(null)
      if (final && final.join('|') !== baseRef.current.join('|')) onReorderRef.current(final)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div ref={box} className={className}>
      {keys.map((key) => {
        const item = byKey.get(key)
        if (!item) return null
        const handle: HandleProps = {
          onPointerDown: (e) => start(key, e),
          style: { touchAction: 'none', cursor: dragKey === key ? 'grabbing' : 'grab' },
        }
        return (
          <div key={key} ref={(el) => { if (el) nodes.current.set(key, el); else nodes.current.delete(key) }}>
            {render(item, handle, dragKey === key)}
          </div>
        )
      })}
    </div>
  )
}

const EDGE = 48

function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return (document.scrollingElement as HTMLElement | null) ?? null
}
