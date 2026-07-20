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
