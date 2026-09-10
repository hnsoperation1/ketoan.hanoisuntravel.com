import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// Sửa 1 loại nhân sự đã có — trước đây chỉ tạo mới được, không sửa được tên/mã
// hay gán mẫu hợp đồng cho loại đã tồn tại (xem modal "Danh sách loại nhân sự"
// trong doan/[id]/page.tsx).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const payload: Record<string, string | null> = {}

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
  if ('mau_hop_dong_id' in body) {
    payload.mau_hop_dong_id = (body as { mau_hop_dong_id?: string | null }).mau_hop_dong_id || null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('loai_nhan_su')
    .update(payload)
    .eq('id', id)
    .select('*, mau_hop_dong:hop_dong_templates(id, ten)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ loai_nhan_su: data })
}
