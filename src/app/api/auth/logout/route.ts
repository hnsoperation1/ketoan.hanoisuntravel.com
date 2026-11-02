import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuthEvent } from '@/lib/auditAuth'

export async function POST() {
  const supabase = await createClient()
  await logAuthEvent(supabase, 'logout')
  await supabase.auth.signOut({ scope: 'local' })
  return NextResponse.json({ ok: true })
}
