import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireScreen } from '@/lib/auth'

// PATCH — kế toán đã xem cảnh báo của 1 dòng sao kê (sheet đổi tiền/ngày hoặc xoá dòng đang gắn quyết toán) → bỏ cảnh báo.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireScreen('kt-sao-ke')
  if (unauthorized) return unauthorized
  const { id } = await params
  const { error } = await createAdminClient().from('sao_ke_giao_dich').update({ canh_bao: null }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
