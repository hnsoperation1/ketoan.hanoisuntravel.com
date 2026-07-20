import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { createHoSo } from '@/lib/ho-so'
import { getErrorMessage } from '@/lib/errors'

/** Thêm 1 người vào đoàn thủ công từ dashboard (không qua bot) — cần nhansu_id đã tồn tại. */
export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const { doan_id, nhansu_id } = body
  if (!doan_id || !nhansu_id) {
    return NextResponse.json({ error: 'Thiếu doan_id hoặc nhansu_id' }, { status: 400 })
  }

  const supabase = await createClient()
  try {
    const hoSo = await createHoSo(supabase, { doan_id, nhansu_id, trang_thai: 'da_xac_nhan' })
    return NextResponse.json({ ho_so: hoSo }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
