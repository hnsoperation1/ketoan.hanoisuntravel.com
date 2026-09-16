import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const [{ data: phieu, error: e1 }, { data: kho, error: e2 }] = await Promise.all([
    supabase
      .from('phieu_kho')
      .select('*, chi_tiet:phieu_kho_chi_tiet(*, vat_pham:vat_pham_id(ten, don_vi))')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('kho').select('id, ten_kho'),
  ])
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ phieu, kho })
}
