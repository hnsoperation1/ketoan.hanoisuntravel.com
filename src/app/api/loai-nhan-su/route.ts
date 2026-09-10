import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

const SELECT_WITH_TEMPLATES = '*, mau_hop_dong_links:loai_nhan_su_mau_hop_dong(mau_hop_dong:hop_dong_templates(id, ten))'

type RawRow = {
  mau_hop_dong_links?: { mau_hop_dong: { id: string; ten: string } | null }[] | null
  [key: string]: unknown
}

/** PostgREST trả nhiều-nhiều lồng 1 tầng qua bảng nối
 *  (mau_hop_dong_links: [{ mau_hop_dong: {...} }]) — làm phẳng lại thành
 *  mau_hop_dong_list: [{...}] cho gọn phía client dùng. */
function flatten(row: RawRow) {
  const { mau_hop_dong_links, ...rest } = row
  return { ...rest, mau_hop_dong_list: (mau_hop_dong_links ?? []).map((x) => x.mau_hop_dong).filter((t): t is { id: string; ten: string } => !!t) }
}

async function setMauHopDongLinks(supabase: SupabaseClient, loaiNhanSuId: string, mauHopDongIds: string[]) {
  await supabase.from('loai_nhan_su_mau_hop_dong').delete().eq('loai_nhan_su_id', loaiNhanSuId)
  if (mauHopDongIds.length === 0) return
  await supabase.from('loai_nhan_su_mau_hop_dong').insert(mauHopDongIds.map((id) => ({ loai_nhan_su_id: loaiNhanSuId, mau_hop_dong_id: id })))
}

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase.from('loai_nhan_su').select(SELECT_WITH_TEMPLATES).order('ten', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ loai_nhan_su: (data ?? []).map((r) => flatten(r as RawRow)) })
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const ten = (body as { ten?: string })?.ten?.trim()
  const ma = (body as { ma?: string })?.ma?.trim().toUpperCase()
  const mauHopDongIds = Array.isArray((body as { mau_hop_dong_ids?: string[] })?.mau_hop_dong_ids)
    ? (body as { mau_hop_dong_ids: string[] }).mau_hop_dong_ids
    : []
  if (!ten) return NextResponse.json({ error: 'Thiếu tên loại nhân sự' }, { status: 400 })
  if (!ma) return NextResponse.json({ error: 'Thiếu mã ngắn' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase.from('loai_nhan_su').insert({ ten, ma }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await setMauHopDongLinks(supabase, data.id, mauHopDongIds)

  const { data: full, error: reErr } = await supabase.from('loai_nhan_su').select(SELECT_WITH_TEMPLATES).eq('id', data.id).single()
  if (reErr) return NextResponse.json({ error: reErr.message }, { status: 500 })
  return NextResponse.json({ loai_nhan_su: flatten(full as RawRow) }, { status: 201 })
}
