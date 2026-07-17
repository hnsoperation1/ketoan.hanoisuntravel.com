'use client'

import { Menu } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'

export default function Topbar({ onMobileSidebarToggle }: { onMobileSidebarToggle?: () => void }) {
  const { breadcrumb } = useTopbar()

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
    </header>
  )
}
