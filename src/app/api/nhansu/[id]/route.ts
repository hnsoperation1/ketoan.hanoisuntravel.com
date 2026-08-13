import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// GET — chi tiết 1 nhân sự + lịch sử TOÀN BỘ đoàn đã tham gia (ho_so kèm
// join sang doan) — dùng cho slide over "Chi tiết nhân sự" ở trang
// /nhan-su, khác tab "Nhân sự" trong đoàn (đó chỉ thấy 1 đoàn tại 1 lúc).
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const supabase = await createClient()
  const [{ data: nhansu, error: nhansuErr }, { data: hoSo, error: hoSoErr }] = await Promise.all([
    supabase.from('nhansu').select('*, loai_nhan_su:loai_nhan_su_id(*)').eq('id', id).single(),
    supabase
      .from('ho_so')
      .select('*, doan:doan_id(id, ten_doan, ngay_di, ngay_ve, hanh_trinh)')
      .eq('nhansu_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (nhansuErr) return NextResponse.json({ error: nhansuErr.message }, { status: 404 })
  if (hoSoErr) return NextResponse.json({ error: hoSoErr.message }, { status: 500 })
  return NextResponse.json({ nhansu, ho_so: hoSo })
}
