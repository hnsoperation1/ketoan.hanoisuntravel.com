import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// GET ?q=... — tìm liên hệ bên CRM (bảng contacts, cùng Supabase project)
// theo tên/công ty/SĐT, dùng cho ô chọn "Người làm việc" ở Danh mục khách
// hàng VMB. Chỉ đọc, không đụng gì tới dữ liệu CRM.
export async function GET(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contacts')
    .select('id, name, phone, email, company, tax_code, source, note')
    .or(`name.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}
