'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import { useTopbar } from '@/contexts/topbar'

const THEME_OPTIONS: { key: 'default' | 'dense'; label: string; desc: string }[] = [
  { key: 'default', label: 'Mặc định', desc: 'Giao diện đang dùng hiện tại' },
  { key: 'dense', label: 'Dày đặc (thử nghiệm)', desc: 'Bảng kẻ ô, gọn hàng — thử nghiệm theo kiểu Translead CRM' },
]

export default function CaiDatPage() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { setBreadcrumb } = useTopbar()

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Cài đặt</span>)
    return () => setBreadcrumb(null)
  }, [setBreadcrumb])

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Cài đặt</h1>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Tài khoản đăng nhập</p>
          <p className="text-sm text-gray-800">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
        >
          Đăng xuất
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3 mt-4">
        <p className="text-xs font-semibold text-gray-500">Giao diện</p>
        <div className="flex flex-col sm:flex-row gap-2">
          {THEME_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setTheme(o.key)}
              className={`flex-1 text-left px-4 py-3 rounded-xl border transition-colors ${
                theme === o.key ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className={`text-sm font-semibold ${theme === o.key ? 'text-brand-700' : 'text-gray-800'}`}>{o.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{o.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
