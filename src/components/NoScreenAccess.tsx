'use client'

import { ShieldAlert } from 'lucide-react'

// Màn hình chặn khi tài khoản chưa được Super Admin tick màn đang mở
// (phân quyền theo màn, xem lib/screens.ts) — AppShell hiện thay cho nội
// dung trang, vẫn giữ Sidebar/Topbar để chuyển sang màn khác được cấp.
export function NoScreenAccess() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center px-6">
      <div className="text-center max-w-md">
        <ShieldAlert size={48} className="mx-auto text-gray-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-500 mb-2">Không có quyền truy cập</h2>
        <p className="text-gray-400 text-sm mb-5">
          Tài khoản của bạn chưa được cấp quyền dùng màn hình này. Vui lòng liên hệ Super Admin.
        </p>
        <a
          href="https://ihns.vn/dashboard"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
        >
          Về Dashboard iHNS
        </a>
      </div>
    </div>
  )
}
