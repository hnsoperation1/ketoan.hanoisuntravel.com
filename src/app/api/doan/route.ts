import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const nam = req.nextUrl.searchParams.get('nam') // vd "2026"

  let query = supabase.from('doan').select('*').is('deleted_at', null).order('ngay_di', { ascending: false })
  if (nam) {
    query = query.gte('ngay_di', `${nam}-01-01`).lte('ngay_di', `${nam}-12-31`)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ doan: data })
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const { ten_doan, hanh_trinh, ngay_di, ngay_ve, sl_khach } = body
  if (!ten_doan || !ngay_di) {
    return NextResponse.json({ error: 'Thiếu tên đoàn hoặc ngày đi' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('doan')
    .insert({ ten_doan, hanh_trinh: hanh_trinh ?? null, ngay_di, ngay_ve: ngay_ve ?? null, sl_khach: sl_khach ?? null })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ doan: data }, { status: 201 })
}
