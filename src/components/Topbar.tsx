'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, LogOut, Menu, RotateCw, UserCog } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { useAuth } from '@/contexts/auth'
import { UserAvatar } from '@/components/UserAvatar'
import NotificationBell from '@/components/NotificationBell'

export default function Topbar({ onMobileSidebarToggle }: { onMobileSidebarToggle?: () => void }) {
  const { breadcrumb, onRefresh } = useTopbar()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  function handleRefresh() {
    if (onRefresh) onRefresh()
    else window.location.reload()
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header
      className="h-12 md:h-10 flex-shrink-0 bg-white flex items-center px-4 gap-3"
      style={{ borderBottom: '1px solid #9dd5ec' }}
    >
      <button
        onClick={onMobileSidebarToggle}
        className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600 flex-shrink-0"
      >
        <Menu size={22} />
      </button>
      <div className="whitespace-nowrap overflow-hidden">
        {breadcrumb ?? <span className="text-sm font-semibold text-gray-700 truncate block">Tổng quan</span>}
      </div>

      <div className="flex-1" />

      <button
        onClick={handleRefresh}
        title="Làm mới"
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
      >
        <RotateCw size={15} />
      </button>
      <NotificationBell />

      {user && (
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <UserAvatar email={user.email} className="w-6 h-6 text-[10px]" />
            <div className="text-left hidden sm:block">
              <div className="text-sm font-semibold text-gray-800 leading-tight">{user.email}</div>
              <div className="text-[11px] text-gray-400 leading-tight">Kế toán</div>
            </div>
            <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              <Link
                href="/cai-dat"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <UserCog size={14} />
                Cài đặt
              </Link>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => {
                  setOpen(false)
                  logout()
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-red-500 transition-colors"
              >
                <LogOut size={14} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
