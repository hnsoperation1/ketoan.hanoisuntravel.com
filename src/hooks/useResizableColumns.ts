'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

// axis 'y' — dùng cho thanh kéo giãn CHIỀU CAO (vd chia đôi 2 khối xếp
// chồng dọc), tính theo clientY thay vì clientX. Mặc định 'x' để không đổi
// hành vi của mọi chỗ đang gọi hook này cho độ RỘNG cột (đa số).
export function useResizableColumns(key: string, defaults: Record<string, number>, axis: 'x' | 'y' = 'x') {
  // Luôn khởi tạo bằng `defaults` (giống hệt server) — KHÔNG đọc
  // localStorage ngay trong useState nữa, vì server không có window nên sẽ
  // render ra HTML khác client, gây hydration mismatch (React phải vứt bỏ
  // và dựng lại cả cây DOM đó, làm gãy các listener đã gắn — chính là lý do
  // nút kéo giãn cột không phản hồi). Đọc localStorage ở effect dưới đây
  // (chỉ chạy ở client, SAU khi hydrate xong) rồi mới áp width đã lưu.
  const [widths, setWidths] = useState<Record<string, number>>(defaults)

  useEffect(() => {
    async function restore() {
      try {
        const s = localStorage.getItem(`col-w:${key}`)
        if (s) setWidths(prev => ({ ...prev, ...JSON.parse(s) }))
      } catch {}
    }
    restore()
  }, [key])

  const ref = useRef(widths)
  useEffect(() => { ref.current = widths }, [widths])

  const startResize = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const pos0 = axis === 'y' ? e.clientY : e.clientX
    const w0 = ref.current[col] ?? 120

    function onMove(ev: MouseEvent) {
      const pos = axis === 'y' ? ev.clientY : ev.clientX
      const w = Math.max(60, w0 + pos - pos0)
      setWidths(prev => {
        const next = { ...prev, [col]: w }
        ref.current = next
        return next
      })
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try { localStorage.setItem(`col-w:${key}`, JSON.stringify(ref.current)) } catch {}
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [key, axis])

  return { widths, startResize }
}
