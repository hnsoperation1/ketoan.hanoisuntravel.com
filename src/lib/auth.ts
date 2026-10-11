import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { legacyScreenAllowed, type ScreenId } from '@/lib/screens'

/**
 * Xác thực session kế toán cho route handler. Trả về user nếu hợp lệ,
 * hoặc 1 NextResponse 401/403 sẵn sàng return thẳng nếu chưa đăng nhập
 * hoặc không có trong ke_toan_allowlist.
 *
 * Bắt buộc phải check is_ke_toan() ở đây (không chỉ dựa vào RLS) vì project
 * Supabase này dùng chung với hns-crm — bất kỳ nhân viên CRM nào (sale, mkt...)
 * cũng có session hợp lệ, nếu chỉ check "đã đăng nhập" thì họ vẫn lọt vào được
 * giao diện app (dù RLS sẽ chặn dữ liệu thật).
 */
export async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { user: null, unauthorized: NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 }) }
  }
  const { data: isKeToan } = await supabase.rpc('is_ke_toan')
  if (!isKeToan) {
    return {
      user: null,
      unauthorized: NextResponse.json({ error: 'Tài khoản không có quyền truy cập hệ thống kế toán' }, { status: 403 }),
    }
  }
  return { user: data.user, unauthorized: null }
}

/**
 * Như requireUser() nhưng bắt buộc thêm is_super_admin — dùng cho Nhóm
 * Telegram/TKT (cấu hình hệ thống, không thuộc phân quyền theo màn) và các
 * thao tác chỉ-Super-Admin TRONG màn (xoá công nợ, xoá hàng loạt vé, xoá file
 * hợp đồng...). Nhật ký bot vé đã chuyển sang requireScreen('kt-nhat-ky').
 */
export async function requireSuperAdminUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { user: null, unauthorized: NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 }) }
  }
  const { data: isSuperAdmin } = await supabase.rpc('is_super_admin')
  if (!isSuperAdmin) {
    return {
      user: null,
      unauthorized: NextResponse.json({ error: 'Chỉ Super Admin mới có quyền truy cập' }, { status: 403 }),
    }
  }
  return { user: data.user, unauthorized: null }
}

/**
 * Như requireUser() (vẫn bắt buộc ke_toan_allowlist) + bắt buộc is_super_admin
 * — dùng cho các màn nhóm "Cài đặt" cuối Sidebar (Biểu mẫu hợp đồng, Cài đặt
 * kho: quyết định 2026-10-11 CHỈ Super Admin, không còn là màn tick được).
 * Khác requireSuperAdminUser() ở chỗ vẫn bắt buộc allowlist y như
 * requireScreen() mà các API này dùng trước đây.
 */
export async function requireSuperAdminKeToan() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { user: null, unauthorized: NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 }) }
  }
  const [{ data: isKeToan }, { data: isSuperAdmin }] = await Promise.all([
    supabase.rpc('is_ke_toan'),
    supabase.rpc('is_super_admin'),
  ])
  if (!isKeToan) {
    return {
      user: null,
      unauthorized: NextResponse.json({ error: 'Tài khoản không có quyền truy cập hệ thống kế toán' }, { status: 403 }),
    }
  }
  if (!isSuperAdmin) {
    return {
      user: null,
      unauthorized: NextResponse.json({ error: 'Chỉ Super Admin mới có quyền truy cập' }, { status: 403 }),
    }
  }
  return { user: data.user, unauthorized: null }
}

/**
 * Các màn Super Admin đã tick cho người này (screen_access.enabled = true).
 * null = đọc lỗi (vd chưa chạy migration 20261025_screen_access.sql) → nơi
 * gọi phải quay về luật CŨ, không bao giờ khoá người dùng vì lỗi đọc. Đọc
 * bằng service role lọc theo user_id (không phụ thuộc policy RLS "chỉ dòng
 * của mình" — nếu policy lỗi thì RLS trả rỗng chứ không báo lỗi, sẽ khoá oan).
 */
export async function loadUserScreens(userId: string): Promise<string[] | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('screen_access')
      .select('screen_id')
      .eq('user_id', userId)
      .eq('enabled', true)
    if (error) return null
    return (data ?? []).map((r) => r.screen_id as string)
  } catch {
    return null
  }
}

/**
 * Như requireUser() (vẫn bắt buộc ke_toan_allowlist) + quyền theo MÀN
 * (quyết định 2026-10-11, xem lib/screens.ts): được qua nếu is_super_admin,
 * hoặc được tick ÍT NHẤT 1 trong các màn truyền vào (endpoint dùng chung cho
 * nhiều màn thì truyền đủ các màn đó). Đọc screen_access lỗi → luật cũ y hệt
 * trước đây (sao-ke = Super Admin hoặc Boss, parse-logs = Super Admin, còn
 * lại chỉ cần allowlist). Các nút chỉ-Super-Admin TRONG màn (xoá, xoá hàng
 * loạt...) vẫn giữ requireSuperAdminUser() riêng như cũ.
 */
export async function requireScreen(...screenIds: ScreenId[]) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { user: null, unauthorized: NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 }) }
  }
  const user = data.user
  const [{ data: isKeToan }, { data: isSuperAdmin }, screens] = await Promise.all([
    supabase.rpc('is_ke_toan'),
    supabase.rpc('is_super_admin'),
    loadUserScreens(user.id),
  ])
  if (!isKeToan) {
    return {
      user: null,
      unauthorized: NextResponse.json({ error: 'Tài khoản không có quyền truy cập hệ thống kế toán' }, { status: 403 }),
    }
  }
  if (isSuperAdmin) return { user, unauthorized: null }

  if (screens !== null) {
    if (screenIds.some((id) => screens.includes(id))) return { user, unauthorized: null }
    return {
      user: null,
      unauthorized: NextResponse.json(
        { error: 'Tài khoản chưa được cấp quyền dùng màn hình này, liên hệ Super Admin' },
        { status: 403 },
      ),
    }
  }

  // Luật cũ — chỉ đọc role khi thật sự cần (màn sao-ke mở cho boss)
  if (screenIds.some((id) => legacyScreenAllowed(id, false, false))) return { user, unauthorized: null }
  if (screenIds.includes('kt-sao-ke')) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role === 'boss') return { user, unauthorized: null }
  }
  return {
    user: null,
    unauthorized: NextResponse.json(
      {
        error: screenIds.includes('kt-sao-ke')
          ? 'Chỉ Super Admin hoặc Boss mới có quyền truy cập'
          : 'Chỉ Super Admin mới có quyền truy cập',
      },
      { status: 403 },
    ),
  }
}
