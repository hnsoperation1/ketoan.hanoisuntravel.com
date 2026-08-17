import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { runMatchMaKhachRaw } from '@/lib/ve-may-bay/match-ma-khach-raw'

// POST { batchIds?: string[] } — chạy lại thuật toán khớp mã khách cho các
// lô công nợ NCC nguyên xi. Không truyền batchIds → chạy trên toàn bộ lô
// (dùng cho nút "Khớp lại mã khách").
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const batchIds: string[] | undefined = Array.isArray(body.batchIds) && body.batchIds.length > 0
    ? body.batchIds.filter((x: unknown): x is string => typeof x === 'string')
    : undefined

  const admin = createAdminClient()
  const result = await runMatchMaKhachRaw(admin, { batchIds })
  return NextResponse.json({ ok: true, ...result })
}
