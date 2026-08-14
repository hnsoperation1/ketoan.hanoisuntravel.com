import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Thiếu email hoặc mật khẩu' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return NextResponse.json({ error: 'Sai email hoặc mật khẩu' }, { status: 401 })
  }

  // Đúng mật khẩu Supabase Auth (dùng chung với hns-crm) không có nghĩa là được
  // vào app này — chỉ email trong ke_toan_allowlist mới hợp lệ. Không cho tạo
  // session "lơ lửng" nếu không đúng quyền.
  const { data: isKeToan } = await supabase.rpc('is_ke_toan')
  if (!isKeToan) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Tài khoản này không có quyền truy cập hệ thống kế toán' }, { status: 403 })
  }
  const [{ data: isSuperAdmin }, { data: profile }] = await Promise.all([
    supabase.rpc('is_super_admin'),
    supabase.from('users').select('role, full_name').eq('id', data.user.id).single(),
  ])

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name ?? data.user.email,
      is_super_admin: isSuperAdmin ?? false,
      is_boss: profile?.role === 'boss',
    },
  })
}
