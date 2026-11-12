import {
  BookUser, Calculator, Contact, FileSpreadsheet, FileStack, KeyRound, Landmark, LayoutDashboard, ListFilter, Plane, Receipt, ScrollText,
  Send, Table2, UserCog, Users, UserSearch,
} from 'lucide-react'
import { canScreen, type ScreenUser } from '@/lib/screens'
import type { NavSection } from '@/lib/navOrder'

// Menu sidebar Kế toán ở dạng dữ liệu (2026-11-12) — Sidebar.tsx và trang Tuỳ chỉnh sidebar (/tuy-chinh-sidebar) cùng đọc.
// Mỗi mục gắn với 1 màn (lib/screens.ts) — chỉ hiện khi canScreen. Nhóm Telegram / TKT và cả nhóm "Cài đặt" không thuộc
// phân quyền theo màn, chỉ Super Admin. id nhóm / id mục là khoá lưu thứ tự kéo thả (user_preferences ketoan_nav_order).
export function buildKetoanNav(user: (ScreenUser & { is_super_admin?: boolean }) | null | undefined): NavSection[] {
  const isSA = !!user?.is_super_admin
  const can = (s: Parameters<typeof canScreen>[1]) => canScreen(user, s)
  return [
    {
      id: 'tong-quan', title: null, pin: 'top', items: [
        { id: 'tong-quan', href: '/', label: 'Tổng quan', icon: LayoutDashboard, exact: true, show: true },
      ],
    },
    {
      id: 'ke-toan-tour', title: 'Kế toán tour', items: [
        { id: 'doan', href: '/doan', label: 'Danh sách đoàn', icon: FileSpreadsheet, show: can('kt-doan') },
        { id: 'quyet-toan', href: '/quyet-toan', label: 'Quyết toán', icon: Calculator, show: can('kt-quyet-toan') },
        { id: 'nhan-su', href: '/nhan-su', label: 'Nhân sự thuê ngoài', icon: Contact, show: can('kt-nhan-su') },
      ],
    },
    {
      // Tiêu đề nhóm cũng là link sang trang hub /ve-may-bay (nếu được màn kt-vmb)
      id: 've-may-bay', title: 'Kế toán vé máy bay', hub: { href: '/ve-may-bay', show: can('kt-vmb') }, items: [
        { id: 'cn-kh', href: '/ve-may-bay/cong-no-khach-hang', label: 'Công nợ KH', icon: Users, show: can('kt-cn-kh') },
        { id: 'th-cn-ncc', href: '/ve-may-bay/tong-hop-cong-no-ncc', label: 'Tổng hợp công nợ NCC', icon: Table2, show: can('kt-th-cn-ncc') },
        { id: 'cn-ncc', href: '/ve-may-bay/cong-no-ncc', label: 'Đầu vào công nợ NCC', icon: FileSpreadsheet, show: can('kt-cn-ncc') },
        { id: 'cn-ncc-v2', href: '/ve-may-bay/cong-no-ncc-v2', label: 'Đầu vào công nợ NCC v2', icon: FileStack, show: can('kt-cn-ncc') },
        { id: 'cn-ncc-v3', href: '/ve-may-bay/cong-no-ncc-v3', label: 'Đầu vào công nợ NCC v3', icon: ListFilter, show: can('kt-cn-ncc') },
        { id: 'xuat-ve', href: '/ve-may-bay/thong-tin-xuat-ve', label: 'Thông tin xuất vé', icon: Plane, show: can('kt-xuat-ve') },
        { id: 'sao-ke-tc', href: '/ve-may-bay/sao-ke-tk', label: 'Sao kê TC', icon: Receipt, show: can('kt-sao-ke-tc') },
        { id: 'kh-vmb', href: '/ve-may-bay/khach-hang-vmb', label: 'Khách hàng VMB', icon: UserSearch, show: can('kt-kh-vmb') },
        { id: 'dm-kh', href: '/ve-may-bay/danh-muc-khach-hang', label: 'Danh mục KH', icon: BookUser, show: can('kt-dm-kh') },
        { id: 'sao-ke', href: '/ve-may-bay/sao-ke', label: 'Đầu vào sao kê', icon: Landmark, show: can('kt-sao-ke') },
        { id: 'nhat-ky', href: '/ve-may-bay/parse-logs', label: 'Nhật ký bot vé', icon: ScrollText, show: can('kt-nhat-ky') },
        { id: 'nhom-tg', href: '/ve-may-bay/nhom', label: 'Nhóm Telegram', icon: Send, show: isSA, sa: true },
        { id: 'tkt', href: '/ve-may-bay/tkt', label: 'TKT', icon: UserCog, show: isSA, sa: true },
      ],
    },
    // Nhóm Cài đặt (luôn cuối menu) — CHỈ Super Admin ở mọi chế độ, không cấu hình theo màn (quyết định 2026-10-11)
    {
      id: 'cai-dat', title: 'Cài đặt', sa: true, pin: 'bottom', items: [
        { id: 'bieu-mau-hd', href: '/cai-dat/bieu-mau-hop-dong', label: 'Biểu mẫu hợp đồng', icon: FileStack, show: isSA },
        { id: 'phan-quyen', href: 'https://ihns.vn/cai-dat/ketoan', label: 'Phân quyền app', icon: KeyRound, external: true, show: isSA },
      ],
    },
  ]
}
