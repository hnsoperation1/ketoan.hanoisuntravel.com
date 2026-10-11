'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Users, Table2, FileSpreadsheet, FileStack, Plane, Receipt, UserSearch, BookUser, Landmark, ScrollText, Send, UserCog, ListFilter } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'
import { useAuth } from '@/contexts/auth'
import { canScreen, type ScreenId } from '@/lib/screens'

// Trang tổng quan riêng cho mảng "Kế toán vé máy bay" — hiện tại chỉ là
// lưới link sang các màn con (đồng bộ đúng danh sách/quyền xem ở
// Sidebar.tsx: mỗi link chỉ hiện khi được màn tương ứng, xem lib/screens.ts),
// sau này thêm số liệu tổng hợp (công nợ, doanh thu...) làm dashboard thật
// cho mảng này.
const LINKS: { href: string; label: string; icon: React.ElementType; screen: ScreenId }[] = [
  { href: '/ve-may-bay/cong-no-khach-hang', label: 'Công nợ KH', icon: Users, screen: 'kt-cn-kh' },
  { href: '/ve-may-bay/tong-hop-cong-no-ncc', label: 'Tổng hợp công nợ NCC', icon: Table2, screen: 'kt-th-cn-ncc' },
  { href: '/ve-may-bay/cong-no-ncc', label: 'Đầu vào công nợ NCC', icon: FileSpreadsheet, screen: 'kt-cn-ncc' },
  { href: '/ve-may-bay/cong-no-ncc-v2', label: 'Đầu vào công nợ NCC v2', icon: FileStack, screen: 'kt-cn-ncc' },
  { href: '/ve-may-bay/cong-no-ncc-v3', label: 'Đầu vào công nợ NCC v3', icon: ListFilter, screen: 'kt-cn-ncc' },
  { href: '/ve-may-bay/thong-tin-xuat-ve', label: 'Thông tin xuất vé', icon: Plane, screen: 'kt-xuat-ve' },
  { href: '/ve-may-bay/sao-ke-tk', label: 'Sao kê TC', icon: Receipt, screen: 'kt-sao-ke-tc' },
  { href: '/ve-may-bay/khach-hang-vmb', label: 'Khách hàng VMB', icon: UserSearch, screen: 'kt-kh-vmb' },
  { href: '/ve-may-bay/danh-muc-khach-hang', label: 'Danh mục KH', icon: BookUser, screen: 'kt-dm-kh' },
  { href: '/ve-may-bay/sao-ke', label: 'Đầu vào sao kê', icon: Landmark, screen: 'kt-sao-ke' },
  { href: '/ve-may-bay/parse-logs', label: 'Nhật ký bot vé', icon: ScrollText, screen: 'kt-nhat-ky' },
]

// Không thuộc phân quyền theo màn — vẫn chỉ Super Admin như cũ
const ADMIN_LINKS = [
  { href: '/ve-may-bay/nhom', label: 'Nhóm Telegram', icon: Send },
  { href: '/ve-may-bay/tkt', label: 'TKT', icon: UserCog },
] as const

export default function VeMayBayDashboardPage() {
  const { setBreadcrumb } = useTopbar()
  const { user } = useAuth()

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Kế toán vé máy bay</span>)
    return () => setBreadcrumb(null)
  }, [setBreadcrumb])

  const links = [
    ...LINKS.filter(l => canScreen(user, l.screen)),
    ...(user?.is_super_admin ? ADMIN_LINKS : []),
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Kế toán vé máy bay</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-brand-300 transition-colors group">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <l.icon size={20} className="text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900">{l.label}</div>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
