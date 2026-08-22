import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// PATCH — đổi tên hiển thị của 1 lô (tab "sheet" ở trang cong-no-ncc).
// Chỉ ghi display_name, KHÔNG đụng source_file (tên file gốc lúc upload,
// giữ nguyên để truy vết) — đổi được vô số lần, gửi null để xoá tên tuỳ
// chỉnh (quay lại hiển thị theo source_file).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body || !('display_name' in body)) {
    return NextResponse.json({ error: 'Thiếu display_name' }, { status: 400 })
  }
  const displayName = body.display_name == null ? null : String(body.display_name).trim() || null

  const admin = createAdminClient()
  const { error } = await admin.from('ve_debt_records_raw').update({ display_name: displayName }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE — xoá 1 lô upload nhầm.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const admin = createAdminClient()
  const { error } = await admin.from('ve_debt_records_raw').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
