import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

type Ctx = { params: Promise<{ id: string }> }

const SELECT_WITH_TEMPLATES = '*, mau_hop_dong_links:loai_nhan_su_mau_hop_dong(mau_hop_dong:hop_dong_templates(id, ten))'

type RawRow = {
  mau_hop_dong_links?: { mau_hop_dong: { id: string; ten: string } | null }[] | null
  [key: string]: unknown
}

function flatten(row: RawRow) {
  const { mau_hop_dong_links, ...rest } = row
  return { ...rest, mau_hop_dong_list: (mau_hop_dong_links ?? []).map((x) => x.mau_hop_dong).filter((t): t is { id: string; ten: string } => !!t) }
}

async function setMauHopDongLinks(supabase: SupabaseClient, loaiNhanSuId: string, mauHopDongIds: string[]) {
  await supabase.from('loai_nhan_su_mau_hop_dong').delete().eq('loai_nhan_su_id', loaiNhanSuId)
  if (mauHopDongIds.length === 0) return
  await supabase.from('loai_nhan_su_mau_hop_dong').insert(mauHopDongIds.map((id) => ({ loai_nhan_su_id: loaiNhanSuId, mau_hop_dong_id: id })))
}

// Sửa 1 loại nhân sự đã có — trước đây chỉ tạo mới được, không sửa được tên/mã
// hay gán mẫu hợp đồng cho loại đã tồn tại (xem modal "Danh sách loại nhân sự"
// trong doan/[id]/page.tsx). mau_hop_dong_ids khi có mặt trong body sẽ THAY
// THẾ TOÀN BỘ danh sách mẫu HĐ đang gán (không phải thêm/bớt từng cái).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const payload: Record<string, string> = {}

  if ('ten' in body) {
    const ten = (body as { ten?: string }).ten?.trim()
    if (!ten) return NextResponse.json({ error: 'Thiếu tên loại nhân sự' }, { status: 400 })
    payload.ten = ten
  }
  if ('ma' in body) {
    const ma = (body as { ma?: string }).ma?.trim().toUpperCase()
    if (!ma) return NextResponse.json({ error: 'Thiếu mã ngắn' }, { status: 400 })
    payload.ma = ma
  }

  const supabase = await createClient()
  if (Object.keys(payload).length > 0) {
    const { error } = await supabase.from('loai_nhan_su').update(payload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray((body as { mau_hop_dong_ids?: string[] })?.mau_hop_dong_ids)) {
    await setMauHopDongLinks(supabase, id, (body as { mau_hop_dong_ids: string[] }).mau_hop_dong_ids)
  }

  const { data, error } = await supabase.from('loai_nhan_su').select(SELECT_WITH_TEMPLATES).eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ loai_nhan_su: flatten(data as RawRow) })
}
