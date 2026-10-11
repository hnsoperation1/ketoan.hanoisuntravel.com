import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Tài khoản TEST (quyết định 2026-10-12, migration supabase/migrations/20261026_test_accounts.sql):
// Super Admin đánh dấu users.is_test = true → ẩn khỏi mọi DANH SÁCH người dùng và DROPDOWN/gợi ý
// chọn người với tất cả mọi người trừ Super Admin. CHỈ lọc ở các route trả danh sách để chọn người —
// KHÔNG lọc join hiển thị (vd creator của đoàn): dữ liệu đã gắn với tài khoản test vẫn hiện tên.
// Chỉ dùng ở route handler server-side (đọc bằng service role).

/**
 * Id các tài khoản test. Đọc lỗi / chưa chạy migration / dữ liệu không phải mảng → tập rỗng
 * (coi như không có tài khoản test), không bao giờ throw.
 */
export async function loadTestAccountIds(): Promise<Set<string>> {
  try {
    const { data, error } = await createAdminClient().rpc('test_account_ids')
    if (error || !Array.isArray(data)) return new Set()
    return new Set(data.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

/**
 * Tập id cần ẨN khỏi danh sách/dropdown chọn người với người đang gọi API: Super Admin → rỗng
 * (thấy cả tài khoản test), còn lại → id các tài khoản test. Không xác định được Super Admin
 * (lỗi đọc) thì coi như không phải Super Admin.
 */
export async function hiddenTestAccountIds(): Promise<Set<string>> {
  const [isSuperAdmin, ids] = await Promise.all([
    (async () => {
      try {
        const supabase = await createClient()
        const { data } = await supabase.rpc('is_super_admin')
        return data === true
      } catch {
        return false
      }
    })(),
    loadTestAccountIds(),
  ])
  return isSuperAdmin ? new Set() : ids
}

/** Bỏ các dòng có id (users.id) nằm trong tập cần ẩn. */
export function withoutTestAccounts<T extends { id?: string | null }>(rows: T[], hidden: Set<string>): T[] {
  if (hidden.size === 0) return rows
  return rows.filter((r) => !r.id || !hidden.has(r.id))
}
