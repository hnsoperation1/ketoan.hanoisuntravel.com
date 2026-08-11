import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// GET — toàn bộ dòng công nợ đã nhập (từ mọi lần upload)
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ve_debt_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}

type ImportRow = {
  ticket_no?: string
  pax_name?: string
  issued_date?: string
  payment_date?: string
  departure_date?: string
  return_date?: string
  routing?: string
  gia_mua?: number | null
  cktm?: number | null
  gia_ban?: number | null
  com_khach?: number | null
}

// POST — { ncc, source_file, rows: ImportRow[] } — nhập hàng loạt 1 lô từ
// file Excel/CSV đã parse + map cột phía client.
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const rows = body?.rows as ImportRow[] | undefined
  if (!body || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Không có dòng dữ liệu nào để nhập' }, { status: 400 })
  }

  const ncc = body.ncc ? String(body.ncc).trim() : null
  const sourceFile = body.source_file ? String(body.source_file).trim() : null

  const payload = rows.map(r => ({
    ncc,
    ticket_no: r.ticket_no?.trim() || null,
    pax_name: r.pax_name?.trim() || null,
    issued_date: r.issued_date?.trim() || null,
    payment_date: r.payment_date?.trim() || null,
    departure_date: r.departure_date?.trim() || null,
    return_date: r.return_date?.trim() || null,
    routing: r.routing?.trim() || null,
    gia_mua: typeof r.gia_mua === 'number' ? r.gia_mua : null,
    cktm: typeof r.cktm === 'number' ? r.cktm : null,
    gia_ban: typeof r.gia_ban === 'number' ? r.gia_ban : null,
    com_khach: typeof r.com_khach === 'number' ? r.com_khach : null,
    source_file: sourceFile,
  }))

  const admin = createAdminClient()
  const { data, error } = await admin.from('ve_debt_records').insert(payload).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, inserted: data?.length ?? 0 })
}
