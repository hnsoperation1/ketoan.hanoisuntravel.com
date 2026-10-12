// Phân quyền theo MÀN (quyết định 2026-10-11): Super Admin tick từng màn cho
// từng người ở ihns.vn → Quản trị → Phân quyền theo app, lưu ở bảng
// public.screen_access(user_id, screen_id, enabled). File này dùng CHUNG cho
// client (Sidebar, AppShell, trang hub) và server (requireScreen trong
// lib/auth.ts) — không import gì riêng của server/client vào đây.
//
// Quy tắc trong app (vào app vẫn cần ke_toan_allowlist như cũ):
//   - is_super_admin → được mọi màn
//   - screens = null (đọc screen_access lỗi, vd chưa chạy migration) → theo
//     luật CŨ y hệt trước đây (legacyScreenAllowed), không bao giờ khoá ai vì lỗi đọc
//   - còn lại → chỉ màn có dòng enabled = true. Vai trò (kể cả boss) KHÔNG còn
//     tự cấp màn nào nữa.
// screen_id khớp đúng id mục trong bản đồ tính năng ihns.vn (src/lib/ihnsNav.ts).

export const SCREEN_IDS = [
  'kt-doan',
  'kt-nhan-su',
  'kt-vmb',
  'kt-cn-kh',
  'kt-th-cn-ncc',
  'kt-cn-ncc',
  'kt-xuat-ve',
  'kt-sao-ke-tc',
  'kt-kh-vmb',
  'kt-dm-kh',
  'kt-sao-ke',
  'kt-nhat-ky',
] as const

export type ScreenId = (typeof SCREEN_IDS)[number]

// Bảng DUY NHẤT đường dẫn → màn (AppShell chặn trang theo bảng này).
// exact = chỉ đúng đường dẫn đó (trang hub /ve-may-bay); còn lại khớp cả
// trang con (vd /doan/[id]). Khớp theo tiền tố DÀI NHẤT. Các trang KHÔNG có
// trong bảng thì không kiểm tra màn: /, /docs, /cai-dat (cài đặt cá nhân),
// /ve-may-bay/nhom và /ve-may-bay/tkt (2 trang này vẫn chỉ Super Admin, tự
// chặn trong trang), và các trang SUPER_ADMIN_ROUTES bên dưới.
const SCREEN_ROUTES: { path: string; screen: ScreenId; exact?: boolean }[] = [
  { path: '/doan', screen: 'kt-doan' },
  { path: '/nhan-su', screen: 'kt-nhan-su' },
  { path: '/ve-may-bay', screen: 'kt-vmb', exact: true },
  { path: '/ve-may-bay/cong-no-khach-hang', screen: 'kt-cn-kh' },
  { path: '/ve-may-bay/tong-hop-cong-no-ncc', screen: 'kt-th-cn-ncc' },
  // v2/v3 là biến thể của cùng 1 màn "Đầu vào công nợ NCC"
  { path: '/ve-may-bay/cong-no-ncc', screen: 'kt-cn-ncc' },
  { path: '/ve-may-bay/cong-no-ncc-v2', screen: 'kt-cn-ncc' },
  { path: '/ve-may-bay/cong-no-ncc-v3', screen: 'kt-cn-ncc' },
  { path: '/ve-may-bay/thong-tin-xuat-ve', screen: 'kt-xuat-ve' },
  { path: '/ve-may-bay/sao-ke-tk', screen: 'kt-sao-ke-tc' },
  { path: '/ve-may-bay/khach-hang-vmb', screen: 'kt-kh-vmb' },
  { path: '/ve-may-bay/danh-muc-khach-hang', screen: 'kt-dm-kh' },
  { path: '/ve-may-bay/sao-ke', screen: 'kt-sao-ke' },
  { path: '/ve-may-bay/parse-logs', screen: 'kt-nhat-ky' },
]

// Trang thuộc nhóm "Cài đặt" cuối Sidebar (quyết định 2026-10-11): CHỈ Super
// Admin, ở cả chế độ mới lẫn luật cũ — KHÔNG phải màn tick được (trước là
// kt-bieu-mau-hd). AppShell chặn theo danh sách này. (Kho quà tặng + Cài đặt
// kho đã gỡ khỏi app Kế toán 2026-10-12 — kho chỉ còn ở ihns.vn/kho.)
const SUPER_ADMIN_ROUTES = ['/cai-dat/bieu-mau-hop-dong']

/** Trang chỉ Super Admin (gồm cả trang con). */
export function isSuperAdminPath(pathname: string): boolean {
  return SUPER_ADMIN_ROUTES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/** Màn ứng với đường dẫn đang mở, null = trang không kiểm tra màn. */
export function screenForPath(pathname: string): ScreenId | null {
  if (isSuperAdminPath(pathname)) return null
  let best: { screen: ScreenId; len: number } | null = null
  for (const r of SCREEN_ROUTES) {
    const hit = r.exact ? pathname === r.path : pathname === r.path || pathname.startsWith(r.path + '/')
    if (hit && (!best || r.path.length > best.len)) best = { screen: r.screen, len: r.path.length }
  }
  return best?.screen ?? null
}

/** Luật CŨ (trước khi có screen_access) — chỉ dùng khi đọc screen_access lỗi. */
export function legacyScreenAllowed(id: ScreenId, isSuperAdmin: boolean, isBoss: boolean): boolean {
  if (isSuperAdmin) return true
  if (id === 'kt-sao-ke') return isBoss
  if (id === 'kt-nhat-ky') return false
  return true
}

type ScreenUser = { is_super_admin: boolean; is_boss: boolean; screens?: string[] | null }

/** Người này có được dùng màn `id` không (client: Sidebar, AppShell, trang hub). */
export function canScreen(user: ScreenUser | null | undefined, id: ScreenId): boolean {
  if (!user) return false
  if (user.is_super_admin) return true
  // undefined = cache cũ chưa có trường screens → coi như legacy, refresh /api/auth/me sẽ sửa lại
  if (user.screens == null) return legacyScreenAllowed(id, false, user.is_boss)
  return user.screens.includes(id)
}
