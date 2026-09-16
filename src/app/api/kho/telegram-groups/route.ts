import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase.from('kho_telegram_groups').select('*').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ groups: data })
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const chatId = Number(body.chat_id)
  const label = (body.label as string | undefined)?.trim()
  if (!Number.isFinite(chatId) || !label) {
    return NextResponse.json({ error: 'Thiếu chat ID / tên nhóm' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('kho_telegram_groups').insert({ chat_id: chatId, label }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ group: data }, { status: 201 })
}
