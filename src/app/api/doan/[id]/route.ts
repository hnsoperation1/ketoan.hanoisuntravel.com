import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const supabase = await createClient()
  const [{ data: doan, error: doanErr }, { data: hoSo, error: hoSoErr }] = await Promise.all([
    supabase.from('doan').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase
      .from('ho_so')
      .select('*, nhansu:nhansu_id(*, loai_nhan_su:loai_nhan_su_id(*))')
      .eq('doan_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (doanErr) return NextResponse.json({ error: doanErr.message }, { status: 404 })
  if (hoSoErr) return NextResponse.json({ error: hoSoErr.message }, { status: 500 })
  return NextResponse.json({ doan, ho_so: hoSo })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const body = await req.json()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('doan')
    .update(body)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ doan: data })
}

/** Xóa mềm đoàn — chỉ đánh dấu deleted_at, không xóa dữ liệu hồ sơ/hợp đồng liên quan. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const supabase = await createClient()
  const { error } = await supabase.from('doan').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
