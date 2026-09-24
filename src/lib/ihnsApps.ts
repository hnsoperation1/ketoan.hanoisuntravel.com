import { Calculator, Contact, Fingerprint, Users2, type LucideIcon } from 'lucide-react'
export type IhnsAppId = 'crm' | 'ketoan' | 'chamcong' | 'hrm'
export type IhnsApp = { id: IhnsAppId; label: string; description: string; href: string; Icon: LucideIcon; gradient: string }
export const IHNS_APPS: IhnsApp[] = [
  { id: 'crm', label: 'CRM', description: 'Quản lý khách hàng, đơn hàng, chiến dịch', href: 'https://crm.hanoisuntravel.com', Icon: Contact, gradient: 'from-emerald-400 to-teal-600' },
  { id: 'ketoan', label: 'Kế toán', description: 'Kế toán vé máy bay, công nợ, sao kê', href: 'https://ketoan.hanoisuntravel.com', Icon: Calculator, gradient: 'from-violet-500 to-purple-700' },
  { id: 'chamcong', label: 'Chấm công', description: 'Bảng công, bảng lương và đơn từ cá nhân', href: 'https://ihns.vn/cham-cong', Icon: Fingerprint, gradient: 'from-orange-400 to-orange-600' },
  { id: 'hrm', label: 'HRM', description: 'Sổ quản lý lao động và quản trị chấm công', href: 'https://hrm.ihns.vn', Icon: Users2, gradient: 'from-sky-500 to-blue-600' },
]
