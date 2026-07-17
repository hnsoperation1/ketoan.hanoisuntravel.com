import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Xác thực session kế toán cho route handler. Trả về user nếu hợp lệ,
 * hoặc 1 NextResponse 401 sẵn sàng return thẳng nếu chưa đăng nhập.
 */
export async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { user: null, unauthorized: NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 }) }
  }
  return { user: data.user, unauthorized: null }
}
