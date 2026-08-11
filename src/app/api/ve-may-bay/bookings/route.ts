import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser, requireSuperAdminUser } from '@/lib/auth'

// GET — trả toàn bộ ve_bookings (kèm tên TKT), sắp mới nhất trước. Lọc
// theo TKT/hãng/ngày làm ở client (giống pattern /kiem-tra-ram) vì
// issued_date/dep_date đang lưu dạng text DD/MM/YYYY (khớp nguyên format
// gốc từ hns-ticket-parser), không phải cột DATE thật nên lọc theo
// khoảng ngày ở SQL dễ sai — để UI tự lọc chuỗi đã parse.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_bookings')
    .select('*, ve_tkt(tkt_code, ten_nhan_vien), ve_parse_logs(raw_message, parsed_bookings)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}

// DELETE { ids: string[] } — xoá hàng loạt, chỉ Super Admin (dữ liệu tài
// chính, xoá xong không có "thùng rác" để khôi phục). Kèm dọn luôn
// ve_parse_logs "mồ côi" — 1 parse_log có thể sinh ra NHIỀU ve_bookings
// (1 tin nhắn nhiều hành khách), nên chỉ xoá log nếu SAU KHI xoá không còn
// ve_bookings nào khác tham chiếu tới nó nữa; log vẫn còn dòng khác thì
// giữ nguyên (không xoá nhầm log của dòng KHÔNG nằm trong lượt xoá này).
export async function DELETE(req: NextRequest) {
  const { unauthorized } = await requireSuperAdminUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : []
  if (ids.length === 0) return NextResponse.json({ error: 'Thiếu danh sách id' }, { status: 400 })

  const admin = createAdminClient()

  const { data: toDelete, error: fetchErr } = await admin
    .from('ve_bookings')
    .select('id, parse_log_id')
    .in('id', ids)
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 })

  const parseLogIds = Array.from(new Set((toDelete ?? []).map(r => r.parse_log_id).filter((x): x is string => !!x)))

  const { error: delErr } = await admin.from('ve_bookings').delete().in('id', ids)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

  for (const logId of parseLogIds) {
    const { count } = await admin.from('ve_bookings').select('id', { count: 'exact', head: true }).eq('parse_log_id', logId)
    if (!count) {
      await admin.from('ve_parse_logs').delete().eq('id', logId)
    }
  }

  return NextResponse.json({ ok: true, deleted: ids.length })
}
