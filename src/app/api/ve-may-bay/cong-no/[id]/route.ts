import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

const TEXT_FIELDS = ['tkt_tag', 'ma_khach', 'sale_chinh', 'ghi_chu'] as const
const NUMBER_FIELDS = ['gia_mua', 'cktm', 'gia_ban', 'com_khach'] as const

// PATCH — sửa tay 1 dòng công nợ: gắn TKT/mã khách/sale chính sau khi đối
// chiếu, hoặc sửa lại số gốc (giá mua/CKTM/giá bán/COM khách) nếu nhập
// nhầm lúc import.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const payload: Record<string, string | number | null> = {}
  for (const f of TEXT_FIELDS) {
    if (f in body) payload[f] = body[f] ? String(body[f]).trim() : null
  }
  for (const f of NUMBER_FIELDS) {
    if (f in body) payload[f] = typeof body[f] === 'number' ? body[f] : (body[f] ? Number(body[f]) : null)
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('ve_debt_records').update(payload).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

// DELETE — xoá 1 dòng nhập nhầm.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const admin = createAdminClient()
  const { error } = await admin.from('ve_debt_records').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
