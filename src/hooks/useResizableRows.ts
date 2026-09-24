'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useResizableRows(key: string, defaultHeight = 32) {
  const [heights, setHeights] = useState<Record<string, number>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`row-h:${key}`)
      if (saved) setHeights(JSON.parse(saved))
    } catch {}
  }, [key])

  const ref = useRef(heights)
  useEffect(() => { ref.current = heights }, [heights])

  const startResize = useCallback((row: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const y0 = event.clientY
    const h0 = ref.current[row] ?? defaultHeight

    function onMove(moveEvent: MouseEvent) {
      const height = Math.max(24, h0 + moveEvent.clientY - y0)
      setHeights(previous => {
        const next = { ...previous, [row]: height }
        ref.current = next
        return next
      })
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try { localStorage.setItem(`row-h:${key}`, JSON.stringify(ref.current)) } catch {}
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [defaultHeight, key])

  return { heights, startResize }
}
