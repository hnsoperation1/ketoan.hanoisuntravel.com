'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth'

export type UiTheme = 'default' | 'dense'

interface ThemeContextValue {
  theme: UiTheme
  setTheme: (theme: UiTheme) => void
  loading: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const CACHE_KEY = 'ketoan_theme_v1'

function readCache(): UiTheme | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw === 'default' || raw === 'dense' ? raw : null
  } catch {
    return null
  }
}

function writeCache(theme: UiTheme) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CACHE_KEY, theme)
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // Luôn khởi tạo 'dense'/true (giống hệt server) — đọc cache ngay trong
  // useState như trước đây khiến `data-ui-theme` ở AppShell lệch giữa
  // server/client, gây hydration mismatch (cùng nguyên nhân đã sửa ở
  // auth.tsx/useResizableColumns.ts). Cache được áp NGAY trong effect đầu
  // tiên bên dưới nên vẫn giữ đúng cảm giác "vào là thấy luôn" cho user đã
  // từng chọn theme trước đó, chỉ khác là không đọc cache lúc hydrate nữa.
  const [theme, setThemeState] = useState<UiTheme>('dense')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const cached = readCache()
      if (cached) {
        setThemeState(cached)
        setLoading(false)
      }
    }
    init()
  }, [])

  // CSS chọn theme qua [data-ui-theme="dense"] (xem globals.css) — AppShell
  // đặt attribute này trên 1 div bọc layout, NHƯNG các slide-over/modal
  // dùng createPortal(..., document.body) thoát HẲN ra khỏi cây DOM của div
  // đó nên CSS selector không khớp (dù React tree vẫn "trong" component).
  // Đặt THÊM attribute này lên <html> — luôn là tổ tiên của MỌI node kể cả
  // portal — để bảng trong slide-over cũng lên đúng viền/kiểu dense.
  useEffect(() => {
    document.documentElement.dataset.uiTheme = theme
  }, [theme])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user-preferences?key=ui.theme')
      if (res.ok) {
        const { value } = await res.json()
        const theme = (value as { theme?: UiTheme } | null)?.theme
        const resolved: UiTheme = theme === 'default' ? 'default' : 'dense'
        setThemeState(resolved)
        writeCache(resolved)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user, refresh])

  const setTheme = useCallback((next: UiTheme) => {
    // Optimistic: cập nhật UI ngay, ghi DB nền — không chặn thao tác bấm
    // nút vì đổi giao diện không có rủi ro mất dữ liệu nếu request lỗi.
    setThemeState(next)
    writeCache(next)
    fetch('/api/user-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ui.theme', value: { theme: next } }),
    }).catch(() => {})
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme, loading }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme phải dùng trong ThemeProvider')
  return ctx
}
