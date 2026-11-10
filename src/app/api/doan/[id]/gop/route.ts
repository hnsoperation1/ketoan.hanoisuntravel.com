import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireScreen } from '@/lib/auth'

// Gộp 1 đoàn kế toán TẠO TAY vào đoàn TỪ CRM của cùng nhóm khách (trigger CRM tự sinh đoàn khi đơn chốt,
// không biết kế toán đã tạo tay trước → 2 dòng trùng). Giữ đoàn CRM (gắn đơn hàng / quyết toán), chuyển
// hết hồ sơ nhân sự của đoàn tạo tay sang, ô thông tin nào kế toán chọn giữ bản tạo tay thì chép sang,
// rồi xoá mềm đoàn tạo tay.

type Ctx = { params: Promise<{ id: string }> }

// Khớp TRUONG ở doan/[id]/GopDoanModal.tsx
const TRUONG_GOP = [
  'ten_doan', 'hanh_trinh', 'ngay_di', 'ngay_ve', 'sl_khach', 'loai_doan', 'ten_chuong_trinh',
  'thoi_gian_chuong_trinh', 'dia_diem_chuong_trinh', 'diem_don_tra', 'dieu_hanh_phu_trach', 'dieu_hanh_dien_thoai',
] as const

/** GET — các đoàn từ CRM có thể gộp vào (kèm số hồ sơ), gần ngày đi của đoàn tạo tay nhất lên đầu. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireScreen('kt-doan')
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const admin = createAdminClient()

  const { data: nguon, error } = await admin.from('doan').select('id, ngay_di, opportunity_id').eq('id', id).is('deleted_at', null).single()
  if (error || !nguon) return NextResponse.json({ error: 'Không tìm thấy đoàn' }, { status: 404 })
  if (nguon.opportunity_id) return NextResponse.json({ error: 'Đoàn này đã là đoàn từ CRM' }, { status: 400 })

  const { data, error: e2 } = await admin
    .from('doan')
    .select(`id, ${TRUONG_GOP.join(', ')}, ho_so(count)`)
    .not('opportunity_id', 'is', null)
    .is('deleted_at', null)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  const lech = (d: string | null) => (d ? Math.abs(new Date(d).getTime() - new Date(nguon.ngay_di).getTime()) : Infinity)
  const ds = ((data ?? []) as unknown as (Record<string, unknown> & { ngay_di: string; ho_so: { count: number }[] })[])
    .map(({ ho_so, ...d }) => ({ ...d, so_ho_so: ho_so?.[0]?.count ?? 0 }))
    .sort((a, b) => lech(a.ngay_di) - lech(b.ngay_di))
  return NextResponse.json({ doan: ds })
}

/** POST { vao_doan_id, giu_tay: string[] } — gộp đoàn tạo tay (id) vào đoàn CRM vao_doan_id. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireScreen('kt-doan')
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { vao_doan_id?: string; giu_tay?: string[] } | null
  const vaoId = body?.vao_doan_id
  if (!vaoId || vaoId === id) return NextResponse.json({ error: 'Chưa chọn đoàn CRM để gộp vào' }, { status: 400 })
  const admin = createAdminClient()

  const [nguonRes, dichRes] = await Promise.all([
    admin.from('doan').select('*').eq('id', id).is('deleted_at', null).single(),
    admin.from('doan').select('*').eq('id', vaoId).is('deleted_at', null).single(),
  ])
  const nguon = nguonRes.data, dich = dichRes.data
  if (!nguon || !dich) return NextResponse.json({ error: 'Không tìm thấy đoàn' }, { status: 404 })
  if (nguon.opportunity_id) return NextResponse.json({ error: 'Chỉ gộp được đoàn tạo tay' }, { status: 400 })
  if (!dich.opportunity_id) return NextResponse.json({ error: 'Chỉ gộp vào đoàn từ CRM' }, { status: 400 })

  // Cùng 1 người ở cả 2 đoàn → gộp sẽ thành 2 hồ sơ trùng trong 1 đoàn: bắt kế toán xoá bớt 1 bản trước
  const [hsNguon, hsDich] = await Promise.all([
    admin.from('ho_so').select('id, nhansu_id, nhansu:nhansu_id(ho_ten)').eq('doan_id', id),
    admin.from('ho_so').select('nhansu_id').eq('doan_id', vaoId),
  ])
  if (hsNguon.error || hsDich.error) return NextResponse.json({ error: (hsNguon.error ?? hsDich.error)!.message }, { status: 500 })
  const coSan = new Set((hsDich.data ?? []).map((h) => h.nhansu_id))
  const trung = ((hsNguon.data ?? []) as unknown as { nhansu_id: string; nhansu: { ho_ten: string } | null }[])
    .filter((h) => coSan.has(h.nhansu_id))
    .map((h) => h.nhansu?.ho_ten ?? '?')
  if (trung.length) {
    return NextResponse.json(
      { error: `${trung.join(', ')} đã có ở cả 2 đoàn — xoá bớt 1 hồ sơ rồi gộp lại`, trung },
      { status: 409 },
    )
  }

  const patch: Record<string, unknown> = {}
  for (const k of body?.giu_tay ?? []) {
    if ((TRUONG_GOP as readonly string[]).includes(k) && nguon[k] != null && nguon[k] !== '') patch[k] = nguon[k]
  }

  const { error: e1 } = await admin.from('ho_so').update({ doan_id: vaoId }).eq('doan_id', id)
  if (e1) return NextResponse.json({ error: `Chuyển hồ sơ: ${e1.message}` }, { status: 500 })
  const { error: e2 } = await admin.from('bot_session').update({ current_doan_id: vaoId }).eq('current_doan_id', id)
  if (e2) return NextResponse.json({ error: `Cập nhật bot Telegram: ${e2.message}` }, { status: 500 })
  if (Object.keys(patch).length) {
    const { error: e3 } = await admin.from('doan').update(patch).eq('id', vaoId)
    if (e3) return NextResponse.json({ error: `Cập nhật thông tin đoàn CRM: ${e3.message}` }, { status: 500 })
  }
  const { error: e4 } = await admin.from('doan').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (e4) return NextResponse.json({ error: `Xoá đoàn tạo tay: ${e4.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, vao_doan_id: vaoId, so_ho_so: hsNguon.data?.length ?? 0 })
}
