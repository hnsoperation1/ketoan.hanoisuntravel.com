import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { tinhThueVaChiTra } from '@/lib/tax'

/**
 * Cập nhật hồ sơ: body có thể chứa `ho_so` (field bảng ho_so) và/hoặc `nhansu`
 * (field bảng nhansu, vd STK/ngân hàng/email do kế toán bổ sung tay sau khi
 * bot chỉ trích xuất được phần CCCD/thẻ). Nếu `ho_so.so_tien_chi_tra` được gửi,
 * tự tính lại thue_nop/chi_tra (10%/90%) — không nhận thue_nop/chi_tra trực tiếp từ client.
 */
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const body = await req.json()
  const supabase = await createClient()

  if (body.nhansu) {
    const { data: hoSoRow, error: hoSoErr } = await supabase
      .from('ho_so')
      .select('nhansu_id')
      .eq('id', id)
      .single()
    if (hoSoErr) return NextResponse.json({ error: hoSoErr.message }, { status: 404 })

    const { error: nsErr } = await supabase.from('nhansu').update(body.nhansu).eq('id', hoSoRow.nhansu_id)
    if (nsErr) return NextResponse.json({ error: nsErr.message }, { status: 500 })
  }

  if (body.ho_so) {
    const update = { ...body.ho_so }
    if (typeof update.so_tien_chi_tra === 'number') {
      const { thueNop, chiTra } = tinhThueVaChiTra(update.so_tien_chi_tra)
      update.thue_nop = thueNop
      update.chi_tra = chiTra
    }
    const { error } = await supabase.from('ho_so').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('ho_so')
    .select('*, nhansu:nhansu_id(*, loai_nhan_su:loai_nhan_su_id(*))')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ho_so: data })
}

/** Xóa hồ sơ của người này khỏi đoàn — chỉ xóa dòng ho_so (kèm cascade file hợp
 *  đồng đã xuất nếu có), KHÔNG đụng tới nhansu vì người đó có thể còn ở đoàn khác. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const supabase = await createClient()
  const { error } = await supabase.from('ho_so').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
