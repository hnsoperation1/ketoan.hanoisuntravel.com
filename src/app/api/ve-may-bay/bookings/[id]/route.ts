import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// PATCH — hiện chỉ dùng để gắn tay "mã khách" (cách tự động gán sẽ làm
// sau, xem BRIEF.md/CLAUDE_MEMORY.md).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  if (!('ma_khach' in body)) {
    return NextResponse.json({ error: 'Thiếu trường ma_khach' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_bookings')
    .update({ ma_khach: body.ma_khach ? String(body.ma_khach).trim() : null })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
