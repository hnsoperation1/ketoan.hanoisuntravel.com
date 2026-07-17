'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAllSeen } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleToggle() {
    setOpen((o) => {
      if (!o) markAllSeen()
      return !o
    })
  }

  function handleClickItem(link: string | null) {
    setOpen(false)
    if (link) router.push(link)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        title="Thông báo"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Thông báo</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={28} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n.link)}
                  className="w-full flex gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 hover:bg-gray-50"
                >
                  <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-brand-600 bg-brand-50">
                    <Bell size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug font-semibold text-gray-900">{n.title}</p>
                    {n.body && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{relativeTime(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
