import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireScreen } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

const PATCHABLE_COLUMNS = [
  'ten_doan',
  'hanh_trinh',
  'ngay_di',
  'ngay_ve',
  'sl_khach',
  'loai_doan',
  'ten_chuong_trinh',
  'thoi_gian_chuong_trinh',
  'dia_diem_chuong_trinh',
  'diem_don_tra',
  'dieu_hanh_phu_trach',
  'dieu_hanh_dien_thoai',
] as const

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireScreen('kt-doan')
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
  const { unauthorized } = await requireScreen('kt-doan')
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })

  // Chỉ ghi các cột kế toán được sửa ở tab Thông tin đoàn — không ghi thẳng body
  // (chặn đổi opportunity_id / deleted_at / created_by… qua API này).
  const patch: Record<string, unknown> = {}
  for (const k of PATCHABLE_COLUMNS) if (k in body) patch[k] = body[k]
  if ('loai_doan' in patch) patch.loai_doan = patch.loai_doan === 'su_kien' ? 'su_kien' : 'tour'
  if ('ten_doan' in patch && !String(patch.ten_doan ?? '').trim()) {
    return NextResponse.json({ error: 'Thiếu tên đoàn' }, { status: 400 })
  }
  if ('ngay_di' in patch && !patch.ngay_di) return NextResponse.json({ error: 'Thiếu ngày đi' }, { status: 400 })
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('doan')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ doan: data })
}

/** Xóa mềm đoàn — chỉ đánh dấu deleted_at, không xóa dữ liệu hồ sơ/hợp đồng liên quan. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireScreen('kt-doan')
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const supabase = await createClient()
  const { error } = await supabase.from('doan').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
