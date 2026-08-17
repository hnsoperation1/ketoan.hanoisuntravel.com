import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { runMatchMaKhach } from '@/lib/ve-may-bay/match-ma-khach'

// POST { ids?: string[] } — chạy lại thuật toán khớp mã khách. Không truyền
// ids (hoặc mảng rỗng) → chạy trên TOÀN BỘ dòng đang 'unmatched' (dùng cho
// nút "Khớp lại mã khách" ở toolbar — vừa backfill dữ liệu cũ, vừa khớp lại
// những dòng trước đó chưa có booking mà giờ bot Telegram đã parse ra rồi).
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const ids: string[] | undefined = Array.isArray(body.ids) && body.ids.length > 0
    ? body.ids.filter((x: unknown): x is string => typeof x === 'string')
    : undefined

  const admin = createAdminClient()
  const result = await runMatchMaKhach(admin, { ids })
  return NextResponse.json({ ok: true, ...result })
}
