import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

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
