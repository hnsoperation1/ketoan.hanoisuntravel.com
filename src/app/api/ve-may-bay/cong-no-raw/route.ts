import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { runMatchMaKhachRaw } from '@/lib/ve-may-bay/match-ma-khach-raw'

// GET — toàn bộ lô công nợ NCC đã upload nguyên xi (chưa chuẩn hoá), kèm
// theo trạng thái khớp mã khách per-dòng (ve_debt_records_raw_match) để
// client dựng badge/cột "Mã khách" mà không cần gọi thêm request nào khác.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_debt_records_raw')
    .select('*, ve_debt_records_raw_match(row_index, ma_khach, match_status, matched_booking_id, gia_mua, gia_ban, gia_source)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}

// POST — { ncc, source_file, headers: string[], rows: string[][] } — lưu
// nguyên xi 1 lần upload, không map/chuẩn hoá cột.
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const headers = body?.headers as string[] | undefined
  const rows = body?.rows as string[][] | undefined
  const ncc = body?.ncc ? String(body.ncc).trim() : ''
  if (!body || !ncc || !Array.isArray(headers) || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Thiếu NCC hoặc không có dòng dữ liệu nào để nhập' }, { status: 400 })
  }

  const sourceFile = body.source_file ? String(body.source_file).trim() : null

  const admin = createAdminClient()
  const { data, error } = await admin.from('ve_debt_records_raw').insert({
    ncc,
    source_file: sourceFile,
    headers,
    rows,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let matched = 0
  try {
    const result = await runMatchMaKhachRaw(admin, { batchIds: [data.id] })
    matched = result.matched
  } catch {
    // Không fail cả lượt upload vì lỗi khớp — dữ liệu đã insert thành công,
    // khớp lại được bất kỳ lúc nào qua nút "Khớp lại mã khách".
  }

  return NextResponse.json({ ok: true, inserted: rows.length, matched })
}
