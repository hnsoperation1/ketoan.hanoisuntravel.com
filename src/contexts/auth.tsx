'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface AuthUser {
  id: string
  email: string
  full_name: string
  is_super_admin: boolean
  is_boss: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const CACHE_KEY = 'ketoan_user_v1'

function readCache(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function writeCache(user: AuthUser | null) {
  if (typeof window === 'undefined') return
  if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user))
  else sessionStorage.removeItem(CACHE_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Luôn khởi tạo null/true (giống hệt server, không có sessionStorage) —
  // đọc cache ngay trong useState như trước đây khiến server render ra
  // màn loading còn client hydrate thẳng ra đã-đăng-nhập, lệch hoàn toàn 2
  // cây DOM → hydration mismatch trên MỌI trang (cùng nguyên nhân đã sửa ở
  // useResizableColumns.ts, nhưng nặng hơn nhiều vì AuthProvider bọc cả
  // app). Cache được áp NGAY trong effect đầu tiên bên dưới (chạy ngay sau
  // khi hydrate xong, trước khi refresh() kịp trả API) nên vẫn giữ được
  // đúng cảm giác "vào là thấy luôn" cho user đã đăng nhập từ trước.
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const { user } = await res.json()
        setUser(user)
        writeCache(user)
      } else {
        setUser(null)
        writeCache(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const cached = readCache()
      if (cached) {
        setUser(cached)
        setLoading(false)
      }
      await refresh()
    }
    init()
  }, [refresh])

  async function login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return data.error ?? 'Đăng nhập thất bại'
    setUser(data.user)
    writeCache(data.user)
    return null
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    writeCache(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng trong AuthProvider')
  return ctx
}
