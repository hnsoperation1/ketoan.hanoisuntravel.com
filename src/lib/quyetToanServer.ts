// Phần máy chủ của Quyết toán (chỉ import trong route handler). Mọi đọc/ghi qt_* và bảng CRM đi bằng
// service role SAU requireScreen('kt-quyet-toan') — kế toán không vào CRM (đặc tả §1), và trigger khoá
// ở DB chỉ để service role đi qua (quy tắc riêng của kế toán kiểm tra ở đây).

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { hiddenTestAccountIds, withoutTestAccounts } from '@/lib/testAccounts'
import {
  QT_MIGRATION_MSG,
  docCauHinhRows,
  docMoTaDon,
  type DuLieuTinh,
  type QtBundle,
  type QtCauHinh,
  type QtDoan,
  type QtQuyetToanFull,
} from '@/lib/quyetToanBundle'

export type Admin = SupabaseClient

type PgErr = { message?: string; code?: string } | null | undefined

/** Lỗi do bảng / cột chưa tồn tại (chưa chạy migration). */
export function laLoiThieuBang(err: PgErr): boolean {
  if (!err) return false
  const m = err.message ?? ''
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    /Could not find the table|relation .* does not exist|schema cache/i.test(m)
  )
}

export class QtError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/** Ném lỗi khi truy vấn lỗi; thiếu bảng → thông báo chạy migration. */
export function chk<T>(res: { data: T; error: PgErr }): T {
  if (res.error) {
    if (laLoiThieuBang(res.error)) throw new QtError(QT_MIGRATION_MSG, 409)
    throw new QtError(res.error.message ?? 'Lỗi cơ sở dữ liệu', 500)
  }
  return res.data
}

export function loiResponse(e: unknown) {
  if (e instanceof QtError) {
    return NextResponse.json(
      { error: e.message, migration_missing: e.message === QT_MIGRATION_MSG || undefined },
      { status: e.status },
    )
  }
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Lỗi không xác định'
  return NextResponse.json({ error: msg }, { status: 500 })
}

export async function docCauHinh(admin: Admin): Promise<QtCauHinh> {
  const rows = chk(await admin.from('qt_cau_hinh').select('key, value'))
  return docCauHinhRows(rows as { key: string; value: unknown }[])
}

export async function laSuperAdmin(admin: Admin, userId: string): Promise<boolean> {
  const { data } = await admin.from('users').select('is_super_admin').eq('id', userId).maybeSingle()
  return data?.is_super_admin === true
}

export async function coQuyenKhoaSo(admin: Admin, userId: string, cauHinh?: QtCauHinh): Promise<boolean> {
  if (await laSuperAdmin(admin, userId)) return true
  const ch = cauHinh ?? (await docCauHinh(admin))
  return ch.nguoi_khoa_so.includes(userId)
}

export async function ghiLichSu(
  admin: Admin,
  oppId: string,
  userId: string,
  hanhDong: string,
  lyDo?: string | null,
  meta?: Record<string, unknown> | null,
) {
  chk(
    await admin.from('qt_lich_su').insert({
      opportunity_id: oppId,
      hanh_dong: hanhDong,
      ly_do: lyDo ?? null,
      meta: meta ?? null,
      user_id: userId,
    }),
  )
}

export async function kiemTraDon(admin: Admin, oppId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(oppId)) throw new QtError('Mã đơn không hợp lệ', 400)
  const opp = chk(await admin.from('opportunities').select('id').eq('id', oppId).maybeSingle())
  if (!opp) throw new QtError('Không tìm thấy đơn CRM', 404)
}

/** Tạo dòng qt_quyet_toan nếu chưa có, trả về dòng hiện tại. */
export async function damBaoQt(admin: Admin, oppId: string): Promise<QtQuyetToanFull> {
  chk(await admin.from('qt_quyet_toan').upsert({ opportunity_id: oppId }, { onConflict: 'opportunity_id', ignoreDuplicates: true }))
  const row = chk(await admin.from('qt_quyet_toan').select('*').eq('opportunity_id', oppId).single())
  return row as QtQuyetToanFull
}

export async function layQt(admin: Admin, oppId: string): Promise<QtQuyetToanFull | null> {
  return chk(await admin.from('qt_quyet_toan').select('*').eq('opportunity_id', oppId).maybeSingle()) as QtQuyetToanFull | null
}

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0)

/** Dữ liệu tính toán của 1 đơn (đọc mới từ DB) — dùng khi khoá sổ. */
export async function taiDuLieuTinh(admin: Admin, oppId: string): Promise<{ data: DuLieuTinh; saleChinhId: string | null; salePhuId: string | null; dieuHanhId: string | null }> {
  const [opp, qt, duChi, chiPhi, khach, hoaDon, thanhToan, thuKhach, tamUng, cauHinh, doanRows] = await Promise.all([
    admin.from('opportunities').select('id, assigned_to, operator_id, sale_chinh_id').eq('id', oppId).maybeSingle().then(chk),
    admin.from('qt_quyet_toan').select('*').eq('opportunity_id', oppId).maybeSingle().then(chk),
    admin.from('qt_du_chi_chot').select('*').eq('opportunity_id', oppId).order('lan', { ascending: false }).limit(1).then(chk),
    admin.from('qt_chi_phi').select('*').eq('opportunity_id', oppId).order('sort_order').then(chk),
    admin.from('qt_khach_dieu_chinh').select('*').eq('opportunity_id', oppId).then(chk),
    admin.from('qt_hoa_don_ncc').select('*').eq('opportunity_id', oppId).then(chk),
    admin.from('qt_thanh_toan_ncc').select('*').eq('opportunity_id', oppId).then(chk),
    admin.from('qt_thu_khach').select('*').eq('opportunity_id', oppId).then(chk),
    admin.from('qt_tam_ung').select('*').eq('opportunity_id', oppId).then(chk),
    docCauHinh(admin),
    admin.from('doan').select('id').eq('opportunity_id', oppId).is('deleted_at', null).then(chk),
  ])
  if (!opp) throw new QtError('Không tìm thấy đơn CRM', 404)
  const doanIds = ((doanRows ?? []) as { id: string }[]).map((d) => d.id)
  let tncn = 0
  if (doanIds.length) {
    const hs = chk(await admin.from('ho_so').select('thue_nop').in('doan_id', doanIds)) as { thue_nop: number | null }[]
    tncn = hs.reduce((s, r) => s + num(r.thue_nop), 0)
  }
  const o = opp as { assigned_to: string | null; operator_id: string | null; sale_chinh_id: string | null }
  const q = qt as QtQuyetToanFull | null
  return {
    data: {
      qt: q,
      duChiMoiNhat: ((duChi ?? []) as DuLieuTinh['duChiMoiNhat'][])[0] ?? null,
      chiPhi: (chiPhi ?? []) as DuLieuTinh['chiPhi'],
      khach: (khach ?? []) as DuLieuTinh['khach'],
      hoaDon: (hoaDon ?? []) as DuLieuTinh['hoaDon'],
      thanhToan: (thanhToan ?? []) as DuLieuTinh['thanhToan'],
      thuKhach: (thuKhach ?? []) as DuLieuTinh['thuKhach'],
      tamUng: (tamUng ?? []) as DuLieuTinh['tamUng'],
      tncn,
      cauHinh,
      vaiTro: { saleChinhId: o.sale_chinh_id, salePhuId: o.assigned_to, dieuHanhId: o.operator_id, keToanId: q?.ke_toan_id ?? null },
    },
    saleChinhId: o.sale_chinh_id,
    salePhuId: o.assigned_to,
    dieuHanhId: o.operator_id,
  }
}

/** Tên khách của đơn: tổ chức → công ty của liên hệ → tên liên hệ. */
export async function tenKhachTheoDon(
  admin: Admin,
  opps: { id: string; contact_id: string | null; organization_id: string | null }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const orgIds = [...new Set(opps.map((o) => o.organization_id).filter((x): x is string => !!x))]
  const contactIds = [...new Set(opps.map((o) => o.contact_id).filter((x): x is string => !!x))]
  const orgs = new Map<string, string>()
  const contacts = new Map<string, { name: string | null; company: string | null }>()
  for (const part of chunk(orgIds, 150)) {
    const rows = (await admin.from('organizations').select('id, name').in('id', part)).data ?? []
    for (const r of rows as { id: string; name: string | null }[]) if (r.name) orgs.set(r.id, r.name)
  }
  for (const part of chunk(contactIds, 150)) {
    const rows = (await admin.from('contacts').select('id, name, company').in('id', part)).data ?? []
    for (const r of rows as { id: string; name: string | null; company: string | null }[]) contacts.set(r.id, r)
  }
  for (const o of opps) {
    const c = o.contact_id ? contacts.get(o.contact_id) : undefined
    const ten = (o.organization_id && orgs.get(o.organization_id)) || c?.company || c?.name || null
    if (ten) out.set(o.id, ten)
  }
  return out
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Tên người dùng theo id (gồm cả tài khoản đã nghỉ / test — chỉ để hiện tên). */
export async function tenNguoiDung(admin: Admin, ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))]
  const out: Record<string, string> = {}
  for (const part of chunk(uniq, 150)) {
    const rows = (await admin.from('users').select('id, full_name').in('id', part)).data ?? []
    for (const r of rows as { id: string; full_name: string | null }[]) out[r.id] = r.full_name ?? ''
  }
  return out
}

/** Bộ hồ sơ đầy đủ cho tab Quyết toán của 1 đơn. */
export async function taiBundle(admin: Admin, oppId: string, userId: string): Promise<QtBundle> {
  const oppRow = chk(
    await admin
      .from('opportunities')
      .select('id, title, description, stage, tour_date, tour_end_date, department_id, assigned_to, operator_id, sale_chinh_id, ticketing_ids, contact_id, organization_id')
      .eq('id', oppId)
      .maybeSingle(),
  ) as null | {
    id: string; title: string | null; description: string | null; stage: string | null; tour_date: string | null; tour_end_date: string | null
    department_id: string | null; assigned_to: string | null; operator_id: string | null; sale_chinh_id: string | null
    ticketing_ids: string[] | null; contact_id: string | null; organization_id: string | null
  }
  if (!oppRow) throw new QtError('Không tìm thấy đơn CRM', 404)

  // Bảng qt_* trước — thiếu bảng thì dừng sớm với thông báo migration
  const qt = chk(await admin.from('qt_quyet_toan').select('*').eq('opportunity_id', oppId).maybeSingle()) as QtQuyetToanFull | null

  const byOpp = (t: string, order: string, asc = true) =>
    admin.from(t).select('*').eq('opportunity_id', oppId).order(order, { ascending: asc }).then(chk)

  const [
    duChi, chiPhi, khach, hoaDon, thanhToan, thuKhach, lichThu, tamUng, guiBanChup, lichSu, cauHinh, chot,
    eventAdvances, doanRows, ncc, phanLoai, users, hidden, saleChinh, dept, isSa,
  ] = await Promise.all([
    byOpp('qt_du_chi_chot', 'lan', false),
    byOpp('qt_chi_phi', 'sort_order'),
    byOpp('qt_khach_dieu_chinh', 'sort_order'),
    byOpp('qt_hoa_don_ncc', 'created_at'),
    byOpp('qt_thanh_toan_ncc', 'ngay'),
    byOpp('qt_thu_khach', 'ngay'),
    byOpp('qt_lich_thu', 'dot'),
    byOpp('qt_tam_ung', 'created_at'),
    byOpp('qt_gui_ban_chup', 'lan', false),
    admin.from('qt_lich_su').select('*').eq('opportunity_id', oppId).order('created_at', { ascending: false }).limit(300).then(chk),
    docCauHinh(admin),
    admin.from('qt_chot').select('*').eq('opportunity_id', oppId).maybeSingle().then(chk),
    admin.from('event_advances').select('id, supplier_name, nha_cung_cap_id, vat_rate, advance_rate, advance_amount, paid_amount, paid_at, status, notes, created_at')
      .eq('opportunity_id', oppId).order('created_at').then((r) => (r.error ? [] : r.data ?? [])),
    admin.from('doan').select('id, ten_doan, hanh_trinh, ngay_di, ngay_ve, sl_khach, loai_doan, ten_chuong_trinh, thoi_gian_chuong_trinh, dia_diem_chuong_trinh')
      .eq('opportunity_id', oppId).is('deleted_at', null).order('created_at').then(chk),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      admin.from('dm_nha_cung_cap').select('id, name').order('name').order('id').range(from, to),
    ).catch(() => [] as { id: string; name: string }[]),
    admin.from('danh_muc').select('id, ten, dang_dung, thu_tu').eq('loai', 'phan_loai_doan').order('thu_tu').then((r) => (r.error ? [] : r.data ?? [])),
    fetchAllRows<{ id: string; full_name: string }>((from, to) =>
      admin.from('users').select('id, full_name').eq('is_active', true).order('full_name').order('id').range(from, to),
    ).catch(() => [] as { id: string; full_name: string }[]),
    hiddenTestAccountIds(),
    oppRow.sale_chinh_id
      ? admin.from('sale_chinh').select('name').eq('id', oppRow.sale_chinh_id).maybeSingle().then((r) => r.data as { name: string } | null)
      : Promise.resolve(null),
    oppRow.department_id
      ? admin.from('departments').select('name').eq('id', oppRow.department_id).maybeSingle().then((r) => r.data as { name: string } | null)
      : Promise.resolve(null),
    laSuperAdmin(admin, userId),
  ])

  const doanList = (doanRows ?? []) as QtDoan[]
  let tncn = 0
  if (doanList.length) {
    const hs = (await admin.from('ho_so').select('thue_nop').in('doan_id', doanList.map((d) => d.id))).data ?? []
    tncn = (hs as { thue_nop: number | null }[]).reduce((s, r) => s + num(r.thue_nop), 0)
  }

  const [khachTen] = await Promise.all([tenKhachTheoDon(admin, [oppRow])])
  const tamUngRows = (tamUng ?? []) as QtBundle['tam_ung']
  const lichSuRows = (lichSu ?? []) as QtBundle['lich_su']
  const duChiRows = (duChi ?? []) as QtBundle['du_chi']
  const banChup = (guiBanChup ?? []) as QtBundle['gui_ban_chup']
  const names = await tenNguoiDung(admin, [
    oppRow.assigned_to, oppRow.operator_id, ...(oppRow.ticketing_ids ?? []),
    qt?.ke_toan_id, qt?.ksnb_id, qt?.gui_ke_toan_by, qt?.duyet_by, qt?.khoa_by,
    ...tamUngRows.map((t) => t.nguoi_ung), ...lichSuRows.map((l) => l.user_id),
    ...duChiRows.flatMap((d) => [d.chot_by, d.ke_toan_nhan_by]), ...banChup.map((b) => b.created_by),
    ...cauHinh.nguoi_khoa_so,
  ])

  const mo = docMoTaDon(oppRow.description)
  const quyenKhoa = isSa || cauHinh.nguoi_khoa_so.includes(userId)

  return {
    opportunity_id: oppId,
    doan: doanList[0] ?? null,
    opp: {
      id: oppRow.id,
      title: oppRow.title ?? '',
      stage: oppRow.stage,
      tour_date: oppRow.tour_date,
      tour_end_date: oppRow.tour_end_date,
      khach: khachTen.get(oppRow.id) ?? null,
      dia_diem: mo.dia_diem,
      nl: mo.nl,
      te: mo.te,
      em_be: mo.em_be,
      department: dept?.name ?? null,
      assigned_to: oppRow.assigned_to,
      operator_id: oppRow.operator_id,
      sale_chinh_id: oppRow.sale_chinh_id,
      sale_chinh_ten: saleChinh?.name ?? null,
      ticketing_ids: oppRow.ticketing_ids ?? [],
    },
    qt,
    du_chi: duChiRows,
    chi_phi: (chiPhi ?? []) as QtBundle['chi_phi'],
    khach: (khach ?? []) as QtBundle['khach'],
    hoa_don: (hoaDon ?? []) as QtBundle['hoa_don'],
    thanh_toan: (thanhToan ?? []) as QtBundle['thanh_toan'],
    thu_khach: (thuKhach ?? []) as QtBundle['thu_khach'],
    lich_thu: (lichThu ?? []) as QtBundle['lich_thu'],
    tam_ung: tamUngRows,
    event_advances: eventAdvances as QtBundle['event_advances'],
    gui_ban_chup: banChup,
    lich_su: lichSuRows,
    chot: chot as QtBundle['chot'],
    tncn,
    cau_hinh: cauHinh,
    ncc_options: ncc,
    phan_loai_options: (phanLoai as { id: string; ten: string; dang_dung: boolean }[])
      .filter((p) => p.dang_dung || p.id === qt?.phan_loai_id)
      .map((p) => ({ id: p.id, ten: p.ten })),
    users: withoutTestAccounts(users, hidden),
    names,
    quyen: { khoa_so: quyenKhoa, super_admin: isSa },
  }
}

/** Đọc body JSON an toàn. */
export async function docBody(req: Request): Promise<Record<string, unknown>> {
  const b = await req.json().catch(() => null)
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {}
}

// ── Làm sạch giá trị nhập ───────────────────────────────────────────────────────────────────────────
export type KieuTruong = 'text' | 'num' | 'num_null' | 'int_null' | 'bool' | 'date' | 'date_null' | 'uuid_null' | 'json'

export function lamSach(v: unknown, kieu: KieuTruong): unknown {
  switch (kieu) {
    case 'text': {
      const s = v == null ? '' : String(v).trim()
      return s ? s : null
    }
    case 'num': {
      const x = Number(v)
      if (v === '' || v == null || !Number.isFinite(x)) throw new QtError('Số không hợp lệ')
      return x
    }
    case 'num_null': {
      if (v === '' || v == null) return null
      const x = Number(v)
      if (!Number.isFinite(x)) throw new QtError('Số không hợp lệ')
      return x
    }
    case 'int_null': {
      if (v === '' || v == null) return null
      const x = Number(v)
      if (!Number.isInteger(x)) throw new QtError('Số nguyên không hợp lệ')
      return x
    }
    case 'bool':
      return v === true || v === 'true'
    case 'date':
    case 'date_null': {
      if ((v === '' || v == null) && kieu === 'date_null') return null
      const s = String(v ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new QtError('Ngày không hợp lệ')
      return s
    }
    case 'uuid_null': {
      if (v === '' || v == null) return null
      const s = String(v)
      if (!/^[0-9a-f-]{36}$/i.test(s)) throw new QtError('Mã không hợp lệ')
      return s
    }
    case 'json':
      return v ?? null
  }
}

export function lamSachTheoMau(body: Record<string, unknown>, mau: Record<string, KieuTruong>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, kieu] of Object.entries(mau)) if (k in body) out[k] = lamSach(body[k], kieu)
  return out
}

export function adminClient() {
  return createAdminClient()
}
