import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

// Lưu sở thích giao diện theo từng user trong bảng dùng chung
// `user_preferences` (key-value, xem migration_user_preferences.sql) —
// key cố định 'ui.theme' cho tính năng thử nghiệm giao diện thứ 2.
const THEME_KEY = 'ui.theme'
type ThemeValue = 'default' | 'dense'

export async function GET() {
  const { user, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_preferences')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', THEME_KEY)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const theme = (data?.value as { theme?: ThemeValue } | null)?.theme
  return NextResponse.json({ theme: theme === 'dense' ? 'dense' : 'default' })
}

export async function PATCH(req: NextRequest) {
  const { user, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const theme = body?.theme
  if (theme !== 'default' && theme !== 'dense') {
    return NextResponse.json({ error: 'theme phải là "default" hoặc "dense"' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, key: THEME_KEY, value: { theme }, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, theme })
}
