import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// GET — danh sách nhân viên đang active, chỉ dùng làm gợi ý autocomplete
// "sale chính" ở trang /ve-may-bay/cong-no. Không có tương đương bên
// hns-crm (trang đó gọi thẳng supabase.from('users') từ client — vi phạm
// quy tắc tách UI/API của app này, xem PROJECT_HANDOFF.md mục 2) nên tách
// riêng route này khi port sang.
export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data, error } = await admin.from('users').select('full_name').eq('is_active', true).order('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}
