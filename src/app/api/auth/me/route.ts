import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const { user, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const supabase = await createClient()
  const { data: isSuperAdmin } = await supabase.rpc('is_super_admin')
  return NextResponse.json({ user: { id: user.id, email: user.email, is_super_admin: isSuperAdmin ?? false } })
}
