'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth'

// Hook dùng chung cho MỌI cài đặt cá nhân hoá UI cần nhớ theo tài khoản
// (khác localStorage — theo user, không theo máy) — đọc/ghi qua
// /api/user-preferences (bảng key-value user_preferences), cùng cơ chế
// contexts/theme.tsx đang dùng cho "ui.theme". `key` nên đặt theo quy ước
// "<scope>.<setting>" (vd "column_visibility.raw_table_FCVN").
//
// Optimistic update: set() cập nhật state ngay, ghi DB nền — không chặn
// thao tác của người dùng, lỡ request lỗi cũng không mất trải nghiệm (chỉ
// lần sau tải lại có thể chưa lưu được, chấp nhận được cho loại cài đặt UI
// không quan trọng bằng dữ liệu nghiệp vụ).
export function useUserPreference<T>(key: string, defaultValue: T) {
  const { user } = useAuth()
  const [value, setValue] = useState<T>(defaultValue)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async (k: string) => {
    try {
      const res = await fetch(`/api/user-preferences?key=${encodeURIComponent(k)}`)
      if (res.ok) {
        const { value: v } = await res.json()
        if (v != null) setValue(v as T)
      }
    } catch { /* im lặng — chỉ mất cài đặt đã lưu, dùng defaultValue */ }
    finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key])

  const set = useCallback((next: T) => {
    setValue(next)
    fetch('/api/user-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: next }),
    }).catch(() => {})
  }, [key])

  return { value, set, loaded }
}
