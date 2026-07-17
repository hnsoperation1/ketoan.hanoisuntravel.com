'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppNotification } from '@/types'

const LAST_SEEN_KEY = 'hns-ketoan-notifications-last-seen'
const POLL_INTERVAL_MS = 60_000

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  // Lazy initializer (chạy 1 lần lúc mount) thay vì set trong effect — component này
  // chỉ mount sau khi AppShell qua khỏi màn loading (client-only), nên đọc localStorage
  // ở đây an toàn, không có rủi ro lệch giữa SSR/hydration.
  const [lastSeen, setLastSeen] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(LAST_SEEN_KEY) ?? '') : '',
  )

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const { notifications } = await res.json()
      setNotifications(notifications)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải thông báo khi mount, pattern chuẩn cho fetch-on-mount
    void load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [load])

  const unreadCount = notifications.filter((n) => n.created_at > lastSeen).length

  function markAllSeen() {
    const now = new Date().toISOString()
    localStorage.setItem(LAST_SEEN_KEY, now)
    setLastSeen(now)
  }

  return { notifications, unreadCount, markAllSeen, reload: load }
}
