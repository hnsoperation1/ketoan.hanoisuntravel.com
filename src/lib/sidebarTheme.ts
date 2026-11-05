// ─── THEME SIDEBAR (2026-11-05) ─── chọn ở ihns.vn → Tuỳ chỉnh sidebar, lưu user_preferences key 'ihns_sidebar_theme'
// ({ id }) → áp cho sidebar mọi app iHNS (ihns.vn, CRM, Kế toán, Vận hành). Chưa chọn = Tối. Chỉ đổi màu nền, chữ,
// nút; ô icon màu của từng app giữ nguyên. Phần này là BẢN SAO Y HỆT ở src/lib/sidebarTheme.ts của ihns.vn, crm.ihns.vn,
// ketoan.ihns.vn, operation.ihns.vn — sửa 1 chỗ thì sửa cả 4.
export type SidebarThemeId = 'sang' | 'toi'

export type SidebarTheme = {
  id: SidebarThemeId
  label: string
  logo: string // logo đầu sidebar (Tối: chữ TRAVEL tô trắng + viền trắng quanh HANOI SUN; file gốc chữ là lỗ trong suốt)
  aside: string // nền sidebar
  headerBorder: string // viền dưới phần logo
  headerBtn: string // nút bánh răng / thu sidebar / đóng
  headerBtnOn: string // nút bánh răng khi đang ở trang Tuỳ chỉnh sidebar
  row: string // chữ + hover của mục thường
  active: string // mục đang mở
  hubActive: string // tiêu đề nhóm kiêm link khi đang mở (Kế toán: "Kế toán vé máy bay")
  divider: string // viền ngăn nhóm (dùng kèm border-t / border-b)
  groupLabel: string // tiêu đề nhóm (CHẤM CÔNG, HR CORE…)
  chevron: string
  userName: string // tên người dùng ở chân sidebar
  muted: string // chữ phụ (vai trò)
  footerBtn: string // nút Đăng xuất
  faint: string // mục mờ (Thùng rác)
  swatch: { bg: string; text: string; active: string } // màu ô xem trước ở trang tuỳ chỉnh
}

export const SIDEBAR_THEME_KEY = 'ihns_sidebar_theme'
export const DEFAULT_SIDEBAR_THEME: SidebarThemeId = 'toi'

export const SIDEBAR_THEMES: SidebarTheme[] = [
  {
    id: 'sang',
    label: 'Sáng',
    logo: '/hanoisuntravel_logo_transparent.png',
    aside: 'bg-[#f0f9ff]',
    headerBorder: 'border-[#9dd5ec]',
    headerBtn: 'text-[#003d5c] hover:bg-black/5',
    headerBtnOn: 'bg-white',
    row: 'text-[#003d5c] hover:bg-white/50',
    active: 'bg-[#ef5e2f] text-white',
    hubActive: 'bg-[#127faf] text-white',
    divider: 'border-[#003d5c]/10',
    groupLabel: 'text-[#0069a0]',
    chevron: 'text-[#0069a0]',
    userName: 'text-[#003d5c]',
    muted: 'text-[#0069a0]',
    footerBtn: 'text-[#003d5c] hover:bg-[#0094cc]/10',
    faint: 'text-[#003d5c]/40 hover:bg-[#0094cc]/10',
    swatch: { bg: '#f0f9ff', text: '#003d5c', active: '#ef5e2f' },
  },
  {
    // Theo mẫu sidebar tối anh gửi: nền xanh than, chữ trắng xám, mục đang mở xanh lá, nút viền mờ
    id: 'toi',
    label: 'Tối',
    logo: '/hanoisuntravel_logo_dark.png',
    aside: 'bg-[#1f2633] [color-scheme:dark]',
    headerBorder: 'border-white/10',
    headerBtn: 'border border-white/15 bg-white/5 text-gray-200 hover:bg-white/10',
    headerBtnOn: '!bg-white/20',
    row: 'text-gray-200 hover:bg-white/5',
    active: 'bg-[#22a35a] text-white',
    hubActive: 'bg-white/15 text-white',
    divider: 'border-white/10',
    groupLabel: 'text-gray-400',
    chevron: 'text-gray-400',
    userName: 'text-gray-100',
    muted: 'text-gray-400',
    footerBtn: 'text-gray-200 hover:bg-white/10',
    faint: 'text-gray-500 hover:bg-white/10',
    swatch: { bg: '#1f2633', text: '#e5e7eb', active: '#22a35a' },
  },
]

export const isSidebarThemeId = (v: unknown): v is SidebarThemeId => SIDEBAR_THEMES.some((t) => t.id === v)
export function sidebarThemeOf(id: unknown): SidebarTheme {
  return SIDEBAR_THEMES.find((t) => t.id === (isSidebarThemeId(id) ? id : DEFAULT_SIDEBAR_THEME)) ?? SIDEBAR_THEMES[0]
}
// ─── hết phần bản sao ───
