import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuthEvent } from '@/lib/auditAuth'

function safePath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const nextPath = safePath(request.nextUrl.searchParams.get('next'))
  if (!tokenHash) return NextResponse.redirect('https://ihns.vn/login?client=ketoan&error=sso_failed')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (error || !data.user) return NextResponse.redirect('https://ihns.vn/login?client=ketoan&error=sso_failed')

  const { data: isKeToan } = await supabase.rpc('is_ke_toan')
  if (!isKeToan) {
    await logAuthEvent(supabase, 'login_failed', { email: data.user.email, method: 'Không có quyền kế toán' })
    await supabase.auth.signOut({ scope: 'local' })
    return NextResponse.redirect('https://ihns.vn/login?client=ketoan&error=forbidden')
  }

  await logAuthEvent(supabase, 'login', { method: 'SSO' })
  return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin))
}
