import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

// API dùng CHUNG cho mọi cài đặt cá nhân hoá UI (không riêng theme nữa) —
// đọc/ghi thẳng bảng key-value `user_preferences` (xem
// migration_user_preferences.sql): 1 dòng = 1 (user_id, key) → value JSONB
// bất kỳ. Quy ước key: "<scope>.<setting>" (vd "ui.theme",
// "column_visibility.raw_table_FCVN"). Không ép schema cho value — mỗi
// tính năng tự định nghĩa hình dạng JSON của riêng nó (xem
// contexts/theme.tsx và hooks/useUserPreference.ts).

// GET /api/user-preferences?key=<key>
export async function GET(req: NextRequest) {
  const { user, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Thiếu key' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_preferences')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ value: data?.value ?? null })
}

// PATCH /api/user-preferences — body { key, value }
export async function PATCH(req: NextRequest) {
  const { user, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const key = body?.key
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Thiếu key' }, { status: 400 })
  }
  const value = body?.value ?? {}

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, value })
}
