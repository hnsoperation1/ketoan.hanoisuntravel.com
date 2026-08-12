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
  // Có cache (đã từng chọn trước đó) → dùng ngay để tránh nháy giao diện
  // mặc định trước khi fetch xong; vẫn gọi API ngầm để xác nhận/đồng bộ.
  // Mặc định 'dense' (giao diện mới) khi chưa có gì trong cache — khớp
  // fallback ở GET /api/user-preferences.
  const [theme, setThemeState] = useState<UiTheme>(() => readCache() ?? 'dense')
  const [loading, setLoading] = useState(() => readCache() === null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user-preferences')
      if (res.ok) {
        const { theme } = await res.json()
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
      body: JSON.stringify({ theme: next }),
    }).catch(() => {})
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme, loading }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme phải dùng trong ThemeProvider')
  return ctx
}
