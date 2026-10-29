import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdminKeToan } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { hiddenTestAccountIds, withoutTestAccounts } from '@/lib/testAccounts'
import { QT_MIGRATION_MSG } from '@/lib/quyetToanBundle'
import { QtError, adminClient, chk, docBody, docCauHinh, loiResponse } from '@/lib/quyetToanServer'

// GET / PUT cấu hình Quyết toán (qt_cau_hinh) — chỉ Super Admin (ketoan → Cài đặt).
export async function GET() {
  const { unauthorized } = await requireSuperAdminKeToan()
  if (unauthorized) return unauthorized
  const admin = adminClient()
  try {
    const [cauHinh, users, hidden] = await Promise.all([
      docCauHinh(admin),
      fetchAllRows<{ id: string; full_name: string }>((from, to) =>
        admin.from('users').select('id, full_name').eq('is_active', true).order('full_name').order('id').range(from, to),
      ),
      hiddenTestAccountIds(),
    ])
    return NextResponse.json({ cau_hinh: cauHinh, users: withoutTestAccounts(users, hidden) })
  } catch (e) {
    if (e instanceof QtError && e.message === QT_MIGRATION_MSG) return NextResponse.json({ migration_missing: true, message: QT_MIGRATION_MSG })
    return loiResponse(e)
  }
}

const VAI_TRO = ['cskh', 'sale_chinh', 'sale_phu', 'dieu_hanh', 'ke_toan'] as const

export async function PUT(req: NextRequest) {
  const { user, unauthorized } = await requireSuperAdminKeToan()
  if (unauthorized) return unauthorized
  const admin = adminClient()
  try {
    const body = await docBody(req)
    const rows: { key: string; value: unknown; updated_by: string; updated_at: string }[] = []
    const now = new Date().toISOString()
    if ('hh_ty_le' in body) {
      const src = (body.hh_ty_le ?? {}) as Record<string, unknown>
      const out: Record<string, number> = {}
      for (const k of VAI_TRO) {
        const x = Number(src[k])
        if (src[k] === '' || src[k] == null || !Number.isFinite(x) || x < 0 || x > 100) throw new QtError('Tỷ lệ hoa hồng phải từ 0 đến 100')
        out[k] = x
      }
      rows.push({ key: 'hh_ty_le', value: out, updated_by: user!.id, updated_at: now })
    }
    if ('hh_khi_ln_am' in body) {
      if (body.hh_khi_ln_am !== 'giu_am' && body.hh_khi_ln_am !== 've_0') throw new QtError('Giá trị không hợp lệ')
      rows.push({ key: 'hh_khi_ln_am', value: body.hh_khi_ln_am, updated_by: user!.id, updated_at: now })
    }
    if ('nguoi_khoa_so' in body) {
      const arr = Array.isArray(body.nguoi_khoa_so) ? body.nguoi_khoa_so : []
      const ids = [...new Set(arr.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))]
      rows.push({ key: 'nguoi_khoa_so', value: ids, updated_by: user!.id, updated_at: now })
    }
    if (!rows.length) throw new QtError('Không có gì để lưu')
    chk(await admin.from('qt_cau_hinh').upsert(rows, { onConflict: 'key' }))
    return NextResponse.json({ cau_hinh: await docCauHinh(admin) })
  } catch (e) {
    return loiResponse(e)
  }
}
