import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const [{ data: kho, error: e1 }, { data: vatPham, error: e2 }, { data: tonKho, error: e3 }] = await Promise.all([
    supabase.from('kho').select('*').order('ten_kho'),
    supabase.from('vat_pham').select('*').order('ten'),
    supabase.from('ton_kho').select('kho_id, vat_pham_id, so_luong'),
  ])
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
  return NextResponse.json({ kho, vatPham, tonKho })
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const ten_kho = (body.ten_kho as string | undefined)?.trim()
  if (!ten_kho) return NextResponse.json({ error: 'Thiếu tên kho' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('kho')
    .insert({ ten_kho, dia_chi: (body.dia_chi as string | undefined)?.trim() || null })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ kho: data }, { status: 201 })
}
