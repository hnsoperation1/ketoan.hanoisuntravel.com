import { Calculator, ClipboardList, Contact, Fingerprint, FolderKanban, PackageSearch, Users2, type LucideIcon } from 'lucide-react'
export type IhnsAppId = 'crm' | 'operation' | 'ketoan' | 'chamcong' | 'hrm' | 'congviec' | 'khoquatang'
export type IhnsApp = { id: IhnsAppId; label: string; description: string; href: string; Icon: LucideIcon; gradient: string }
export const IHNS_APPS: IhnsApp[] = [
  { id: 'crm', label: 'CRM', description: 'Quản lý khách hàng, đơn hàng, chiến dịch', href: 'https://crm.ihns.vn', Icon: Contact, gradient: 'from-emerald-400 to-teal-600' },
  { id: 'operation', label: 'Vận hành', description: 'Phối hợp nhân sự, nhà cung cấp và tiến độ dự án', href: 'https://operation.ihns.vn', Icon: FolderKanban, gradient: 'from-cyan-500 to-blue-700' },
  { id: 'ketoan', label: 'Kế toán', description: 'Kế toán vé máy bay, công nợ, sao kê', href: 'https://ketoan.ihns.vn', Icon: Calculator, gradient: 'from-violet-500 to-purple-700' },
  { id: 'chamcong', label: 'Chấm công', description: 'Bảng công, bảng lương và đơn từ cá nhân', href: 'https://chamcong.ihns.vn', Icon: Fingerprint, gradient: 'from-orange-400 to-orange-600' },
  { id: 'hrm', label: 'HRM', description: 'Sổ quản lý lao động và quản trị chấm công', href: 'https://hrm.ihns.vn', Icon: Users2, gradient: 'from-sky-500 to-blue-600' },
  { id: 'congviec', label: 'Công việc', description: 'Quản lý công việc', href: 'https://ihns.vn/cong-viec', Icon: ClipboardList, gradient: 'from-rose-400 to-red-600' },
  { id: 'khoquatang', label: 'Kho quà tặng', description: 'Quản lý kho, nhập xuất chuyển', href: 'https://ihns.vn/kho-qua-tang', Icon: PackageSearch, gradient: 'from-orange-500 to-amber-600' },
]
