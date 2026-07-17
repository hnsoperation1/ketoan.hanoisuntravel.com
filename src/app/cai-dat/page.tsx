'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth'
import { useTopbar } from '@/contexts/topbar'

export default function CaiDatPage() {
  const { user, logout } = useAuth()
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
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Tài khoản dùng chung Supabase project với hns-crm — thêm/bớt kế toán được phép
            truy cập app này qua bảng <code className="text-[11px] bg-gray-50 px-1 py-0.5 rounded">ke_toan_allowlist</code>.
          </p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  )
}
