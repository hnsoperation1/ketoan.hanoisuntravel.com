import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase.from('kho_thu_kho').select('*').order('ho_ten')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ thuKho: data })
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const telegramUserId = Number(body.telegram_user_id)
  const hoTen = (body.ho_ten as string | undefined)?.trim()
  const khoId = body.kho_id as string | undefined
  if (!Number.isFinite(telegramUserId) || !hoTen || !khoId) {
    return NextResponse.json({ error: 'Thiếu ID Telegram / họ tên / kho phụ trách' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('kho_thu_kho')
    .upsert({ telegram_user_id: telegramUserId, ho_ten: hoTen, kho_id: khoId })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ thuKho: data }, { status: 201 })
}
