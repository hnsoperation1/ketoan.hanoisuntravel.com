import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireScreen } from '@/lib/auth'
import { hiddenTestAccountIds, withoutTestAccounts } from '@/lib/testAccounts'

// GET — danh sách nhân viên đang active, chỉ dùng cho modal "Chọn sale chính"
// (UserPickerModal) ở trang /ve-may-bay/tong-hop-cong-no-ncc. Không có tương đương bên
// hns-crm (trang đó gọi thẳng supabase.from('users') từ client — vi phạm
// quy tắc tách UI/API của app này, xem PROJECT_HANDOFF.md mục 2) nên tách
// riêng route này khi port sang.
// Tài khoản test (users.is_test) bị ẩn khỏi danh sách gợi ý này, trừ khi
// người gọi là Super Admin (xem lib/testAccounts.ts).
export async function GET() {
  const { unauthorized } = await requireScreen('kt-th-cn-ncc')
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const [{ data, error }, hidden] = await Promise.all([
    admin.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
    hiddenTestAccountIds(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: withoutTestAccounts(data ?? [], hidden) })
}
