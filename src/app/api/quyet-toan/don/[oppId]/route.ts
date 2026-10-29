import { NextRequest, NextResponse } from 'next/server'
import { requireScreen } from '@/lib/auth'
import {
  QtError,
  adminClient,
  chk,
  damBaoQt,
  docBody,
  ghiLichSu,
  kiemTraDon,
  lamSach,
  lamSachTheoMau,
  loiResponse,
  taiBundle,
  type KieuTruong,
} from '@/lib/quyetToanServer'
import { QT_MIGRATION_MSG } from '@/lib/quyetToanBundle'

type Ctx = { params: Promise<{ oppId: string }> }

// GET — bộ hồ sơ quyết toán của 1 đơn. `?theo=doan` → [oppId] là id đoàn bên ketoan.
export async function GET(req: NextRequest, ctx: Ctx) {
  const { user, unauthorized } = await requireScreen('kt-quyet-toan')
  if (unauthorized) return unauthorized
  const { oppId: raw } = await ctx.params
  const admin = adminClient()
  try {
    let oppId = raw
    if (req.nextUrl.searchParams.get('theo') === 'doan') {
      const d = chk(await admin.from('doan').select('opportunity_id').eq('id', raw).is('deleted_at', null).maybeSingle()) as { opportunity_id: string | null } | null
      if (!d) throw new QtError('Không tìm thấy đoàn', 404)
      if (!d.opportunity_id) return NextResponse.json({ error: 'Đoàn chưa nối với đơn CRM', chua_noi_don: true }, { status: 404 })
      oppId = d.opportunity_id
    }
    await kiemTraDon(admin, oppId)
    const bundle = await taiBundle(admin, oppId, user!.id)
    return NextResponse.json(bundle)
  } catch (e) {
    if (e instanceof QtError && e.message === QT_MIGRATION_MSG) {
      return NextResponse.json({ migration_missing: true, message: QT_MIGRATION_MSG })
    }
    return loiResponse(e)
  }
}

const MAU_QT: Record<string, KieuTruong> = {
  phan_loai_id: 'uuid_null',
  co_vat: 'bool',
  gia_tri_hd: 'num_null',
  vat_ra_rate: 'num',
  so_hop_dong: 'text',
  so_hd_thanh_ly: 'text',
  com_khach: 'num',
  tndn_nhap_tay: 'num_null',
  ke_toan_id: 'uuid_null',
  ksnb_id: 'uuid_null',
  ly_do_tang_giam_ln: 'text',
}
const VAI_TRO_HH = ['cskh', 'sale_chinh', 'sale_phu', 'dieu_hanh', 'ke_toan'] as const

// PATCH — kế toán sửa thông tin phiếu quyết toán (tạo dòng nếu chưa có). Đã khoá sổ → chỉ sửa được lý do tăng/giảm LN.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { user, unauthorized } = await requireScreen('kt-quyet-toan')
  if (unauthorized) return unauthorized
  const { oppId } = await ctx.params
  const admin = adminClient()
  try {
    await kiemTraDon(admin, oppId)
    const body = await docBody(req)
    const patch = lamSachTheoMau(body, MAU_QT)
    if ('hh_ty_le' in body) {
      const src = body.hh_ty_le
      if (src == null) patch.hh_ty_le = null
      else if (typeof src === 'object') {
        const out: Record<string, number> = {}
        for (const k of VAI_TRO_HH) {
          const v = (src as Record<string, unknown>)[k]
          const x = lamSach(v, 'num_null')
          if (x != null) {
            if ((x as number) < 0 || (x as number) > 100) throw new QtError('Tỷ lệ hoa hồng phải từ 0 đến 100')
            out[k] = x as number
          }
        }
        patch.hh_ty_le = Object.keys(out).length ? out : null
      }
    }
    if (patch.vat_ra_rate != null && ((patch.vat_ra_rate as number) < 0 || (patch.vat_ra_rate as number) > 100)) throw new QtError('VAT không hợp lệ')
    if (Object.keys(patch).length === 0) throw new QtError('Không có trường nào để cập nhật')

    const qt = await damBaoQt(admin, oppId)
    if (qt.da_khoa && Object.keys(patch).some((k) => k !== 'ly_do_tang_giam_ln')) {
      throw new QtError('Quyết toán đã khoá sổ, không sửa được')
    }
    const data = chk(await admin.from('qt_quyet_toan').update(patch).eq('opportunity_id', oppId).select('*').single())
    const cu: Record<string, unknown> = {}
    for (const k of Object.keys(patch)) cu[k] = (qt as unknown as Record<string, unknown>)[k] ?? null
    await ghiLichSu(admin, oppId, user!.id, 'sua_thong_tin', null, { truoc: cu, sau: patch })
    return NextResponse.json({ qt: data })
  } catch (e) {
    return loiResponse(e)
  }
}
