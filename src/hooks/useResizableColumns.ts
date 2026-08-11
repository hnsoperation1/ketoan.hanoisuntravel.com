'use client'
import { useState, useRef, useCallback } from 'react'

export function useResizableColumns(key: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return defaults
    try {
      const s = localStorage.getItem(`col-w:${key}`)
      if (s) return { ...defaults, ...JSON.parse(s) }
    } catch {}
    return defaults
  })

  const ref = useRef(widths)
  ref.current = widths

  const startResize = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX
    const w0 = ref.current[col] ?? 120

    function onMove(ev: MouseEvent) {
      const w = Math.max(60, w0 + ev.clientX - x0)
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
  }, [key])

  return { widths, startResize }
}
