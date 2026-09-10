import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('loai_nhan_su')
    .select('*, mau_hop_dong:hop_dong_templates(id, ten)')
    .order('ten', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ loai_nhan_su: data })
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const ten = (body as { ten?: string })?.ten?.trim()
  const ma = (body as { ma?: string })?.ma?.trim().toUpperCase()
  const mauHopDongId = (body as { mau_hop_dong_id?: string | null })?.mau_hop_dong_id || null
  if (!ten) return NextResponse.json({ error: 'Thiếu tên loại nhân sự' }, { status: 400 })
  if (!ma) return NextResponse.json({ error: 'Thiếu mã ngắn' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('loai_nhan_su')
    .insert({ ten, ma, mau_hop_dong_id: mauHopDongId })
    .select('*, mau_hop_dong:hop_dong_templates(id, ten)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ loai_nhan_su: data }, { status: 201 })
}
