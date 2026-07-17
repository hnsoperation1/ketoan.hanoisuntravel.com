'use client'

import Link from 'next/link'
import { Menu, RotateCw, Settings } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import NotificationBell from '@/components/NotificationBell'

export default function Topbar({ onMobileSidebarToggle }: { onMobileSidebarToggle?: () => void }) {
  const { breadcrumb, onRefresh } = useTopbar()

  function handleRefresh() {
    if (onRefresh) onRefresh()
    else window.location.reload()
  }

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
        {breadcrumb ?? <span className="text-sm font-semibold text-gray-700 truncate block">Quyết toán tour</span>}
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
      <Link
        href="/cai-dat"
        title="Cài đặt"
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
      >
        <Settings size={15} />
      </Link>
    </header>
  )
}
