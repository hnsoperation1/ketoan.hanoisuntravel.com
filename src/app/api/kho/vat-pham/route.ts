import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase.from('vat_pham').select('*').order('ten')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vatPham: data })
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const ten = (body.ten as string | undefined)?.trim()
  if (!ten) return NextResponse.json({ error: 'Thiếu tên vật phẩm' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vat_pham')
    .insert({ ten, don_vi: (body.don_vi as string | undefined)?.trim() || 'cái' })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vatPham: data }, { status: 201 })
}
