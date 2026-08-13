import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
 * Như requireUser() nhưng bắt buộc thêm is_super_admin — dùng cho các route
 * "Vé máy bay" nhạy cảm hơn (Nhật ký bot vé lộ nguyên văn tin Telegram +
 * JSON AI đọc được của MỌI TKT, Nhóm Telegram/TKT là cấu hình hệ thống),
 * khớp đúng mức siết đang áp dụng ở hns-crm cho cùng 3 trang này.
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
 * Dùng riêng cho GET /api/ve-may-bay/sao-ke (đọc TOÀN BỘ sổ quỹ/ngân hàng
 * tổng công ty, không riêng vé máy bay) — mở cho boss theo yêu cầu
 * 2026-08-13, khớp đúng route tương ứng bên hns-crm
 * (requireSuperAdminOrBoss() trong lib/require-ke-toan.ts). role đọc thẳng
 * từ bảng users (không qua RPC như is_super_admin) — cùng bảng users dùng
 * chung Supabase project với hns-crm, cùng cách đọc.
 */
export async function requireSuperAdminOrBossUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { user: null, unauthorized: NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 }) }
  }
  const { data: isSuperAdmin } = await supabase.rpc('is_super_admin')
  if (isSuperAdmin) return { user: data.user, unauthorized: null }
  const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).single()
  if (profile?.role !== 'boss') {
    return {
      user: null,
      unauthorized: NextResponse.json({ error: 'Chỉ Super Admin hoặc Boss mới có quyền truy cập' }, { status: 403 }),
    }
  }
  return { user: data.user, unauthorized: null }
}
