// Cấu hình CRUD các bảng kế toán nhập của Quyết toán (API /api/quyet-toan/don/[oppId]/[bang]/…).
// Chỉ dùng trong route handler. Quy tắc khoá (đặc tả §3.6): đã khoá sổ → chỉ thu khách / thanh toán NCC /
// lịch thu còn ghi được (công nợ chạy tiếp); qt_chi_phi: kế toán chỉ thêm/sửa/xoá dòng nguon='ke_toan',
// các dòng khác chỉ sửa được phần chứng từ (co_hd_ncc, hd_ncc_url, hoa_don_id).

import { NextResponse } from 'next/server'
import {
  QtError,
  chk,
  damBaoQt,
  ghiLichSu,
  lamSach,
  lamSachTheoMau,
  type Admin,
  type KieuTruong,
} from '@/lib/quyetToanServer'

export type BangCfg = {
  table: string
  key: string // tên trong lịch sử: them_<key>, sua_<key>, xoa_<key>
  mau: Record<string, KieuTruong>
  batBuoc?: string[]
  khoaKhiKhoaSo: boolean
  coCreatedBy: boolean
}

export const BANG: Record<string, BangCfg> = {
  'hoa-don': {
    table: 'qt_hoa_don_ncc',
    key: 'hoa_don',
    mau: {
      nha_cung_cap_id: 'uuid_null', ncc_ten: 'text', so_hoa_don: 'text', ngay_hoa_don: 'date_null',
      gia_tri: 'num', vat_rate: 'num', tien_vat: 'num_null', file_url: 'text', ghi_chu: 'text',
    },
    batBuoc: ['gia_tri'],
    khoaKhiKhoaSo: true,
    coCreatedBy: true,
  },
  'thanh-toan': {
    table: 'qt_thanh_toan_ncc',
    key: 'thanh_toan',
    mau: {
      nha_cung_cap_id: 'uuid_null', ncc_ten: 'text', service_id: 'uuid_null', chi_phi_id: 'uuid_null',
      event_advance_id: 'uuid_null', loai: 'text', ngay: 'date', so_tien: 'num', tai_khoan: 'text',
      sao_ke_id: 'uuid_null', ghi_chu: 'text',
    },
    batBuoc: ['ngay', 'so_tien'],
    khoaKhiKhoaSo: false,
    coCreatedBy: true,
  },
  'thu-khach': {
    table: 'qt_thu_khach',
    key: 'thu_khach',
    mau: { lan: 'int_null', ngay: 'date', so_tien: 'num', tai_khoan: 'text', sao_ke_id: 'uuid_null', ghi_chu: 'text' },
    batBuoc: ['ngay', 'so_tien'],
    khoaKhiKhoaSo: false,
    coCreatedBy: true,
  },
  'lich-thu': {
    table: 'qt_lich_thu',
    key: 'lich_thu',
    mau: { dot: 'int_null', han: 'date', so_tien: 'num_null', ty_le: 'num_null', ghi_chu: 'text' },
    batBuoc: ['han'],
    khoaKhiKhoaSo: false,
    coCreatedBy: false,
  },
  'chi-phi': {
    table: 'qt_chi_phi',
    key: 'chi_phi',
    mau: {
      nhom: 'text', ngay: 'int_null', ten: 'text', dvt: 'text', so_luong: 'num', so_lan: 'num', don_gia: 'num',
      gia_gom_vat: 'bool', vat_rate: 'num', nguoi_chi: 'text', nha_cung_cap_id: 'uuid_null', ncc_ten: 'text',
      ncc_lien_he: 'text', ncc_sdt: 'text', ghi_chu: 'text', co_hd_ncc: 'bool', hd_ncc_url: 'text', hoa_don_id: 'uuid_null',
    },
    batBuoc: ['ten'],
    khoaKhiKhoaSo: true,
    coCreatedBy: true,
  },
}

const TRUONG_CHUNG_TU = ['co_hd_ncc', 'hd_ncc_url', 'hoa_don_id']

async function tenNcc(admin: Admin, id: string): Promise<string | null> {
  const r = await admin.from('dm_nha_cung_cap').select('name').eq('id', id).maybeSingle()
  return (r.data as { name: string } | null)?.name ?? null
}

/** Chuẩn hoá + kiểm tra giá trị riêng từng bảng. `cu` = dòng cũ khi sửa. */
async function chuanHoa(admin: Admin, oppId: string, bang: string, v: Record<string, unknown>, cu: Record<string, unknown> | null) {
  const cuoi = (k: string) => (k in v ? v[k] : cu?.[k])
  if ('nha_cung_cap_id' in v && v.nha_cung_cap_id) {
    const ten = await tenNcc(admin, v.nha_cung_cap_id as string)
    if (!ten) throw new QtError('NCC không có trong danh mục')
    v.ncc_ten = ten
  }
  if (bang === 'hoa-don') {
    const gt = Number(cuoi('gia_tri') ?? 0)
    const rate = Number(cuoi('vat_rate') ?? 8)
    if (v.tien_vat == null && ('gia_tri' in v || 'vat_rate' in v || !cu)) v.tien_vat = Math.round((gt * rate) / 100)
    if (!cuoi('nha_cung_cap_id') && !cuoi('ncc_ten')) throw new QtError('Chọn NCC hoặc nhập tên NCC')
  }
  if (bang === 'thanh-toan') {
    const loai = cuoi('loai') ?? 'thanh_toan'
    if (!['coc', 'tam_ung', 'thanh_toan', 'hoan_coc'].includes(String(loai))) throw new QtError('Loại thanh toán không hợp lệ')
    if (!cu && !('loai' in v)) v.loai = 'thanh_toan'
    const tien = Number(cuoi('so_tien') ?? 0)
    if (loai === 'hoan_coc' && tien > 0) v.so_tien = -tien // hoàn cọc mang số âm
    if (!cuoi('nha_cung_cap_id') && !cuoi('ncc_ten') && !cuoi('event_advance_id')) throw new QtError('Chọn NCC hoặc nhập tên NCC')
    if (v.event_advance_id) {
      const ea = chk(await admin.from('event_advances').select('id, supplier_name, nha_cung_cap_id').eq('id', v.event_advance_id as string).eq('opportunity_id', oppId).maybeSingle()) as
        { supplier_name: string; nha_cung_cap_id: string | null } | null
      if (!ea) throw new QtError('Đề nghị tạm ứng NCC không thuộc đơn này')
      if (!cuoi('nha_cung_cap_id') && ea.nha_cung_cap_id) v.nha_cung_cap_id = ea.nha_cung_cap_id
      if (!cuoi('ncc_ten')) v.ncc_ten = ea.supplier_name
      if (!('loai' in v) && !cu) v.loai = 'tam_ung'
    }
    if (v.chi_phi_id) {
      const cp = chk(await admin.from('qt_chi_phi').select('id').eq('id', v.chi_phi_id as string).eq('opportunity_id', oppId).maybeSingle())
      if (!cp) throw new QtError('Dòng chi phí không thuộc đơn này')
    }
  }
  if (bang === 'lich-thu') {
    if (cuoi('so_tien') == null && cuoi('ty_le') == null) throw new QtError('Nhập số tiền hoặc % của đợt thu')
    if (!cu && v.dot == null) {
      const rows = chk(await admin.from('qt_lich_thu').select('dot').eq('opportunity_id', oppId)) as { dot: number }[]
      v.dot = rows.reduce((m, r) => Math.max(m, r.dot), 0) + 1
    }
  }
  if (bang === 'chi-phi') {
    const nc = cuoi('nguoi_chi') ?? 'ncc'
    if (!['ncc', 'hns', 'com'].includes(String(nc))) throw new QtError('Người chi không hợp lệ')
    if ('ten' in v && !v.ten) throw new QtError('Nhập tên dịch vụ')
  }
  if (v.hoa_don_id) {
    const hd = chk(await admin.from('qt_hoa_don_ncc').select('id').eq('id', v.hoa_don_id as string).eq('opportunity_id', oppId).maybeSingle())
    if (!hd) throw new QtError('Hoá đơn không thuộc đơn này')
  }
}

export async function taoDong(admin: Admin, oppId: string, uid: string, bang: string, body: Record<string, unknown>) {
  const cfg = BANG[bang]
  if (!cfg) throw new QtError('Bảng không hợp lệ', 404)
  if (bang === 'tam-ung') throw new QtError('Đề nghị tạm ứng do điều hành tạo ở CRM')
  const qt = await damBaoQt(admin, oppId)
  if (cfg.khoaKhiKhoaSo && qt.da_khoa) throw new QtError('Quyết toán đã khoá sổ, không thêm được')
  const v = lamSachTheoMau(body, cfg.mau)
  for (const k of cfg.batBuoc ?? []) if (v[k] == null || v[k] === '') throw new QtError('Thiếu thông tin bắt buộc')
  await chuanHoa(admin, oppId, bang, v, null)
  if (bang === 'chi-phi') {
    v.nguon = 'ke_toan'
    const max = chk(await admin.from('qt_chi_phi').select('sort_order').eq('opportunity_id', oppId).order('sort_order', { ascending: false }).limit(1)) as { sort_order: number }[]
    v.sort_order = (max[0]?.sort_order ?? 0) + 1
  }
  const row = chk(await admin.from(cfg.table).insert({ ...v, opportunity_id: oppId, ...(cfg.coCreatedBy ? { created_by: uid } : {}) }).select('*').single())
  await ghiLichSu(admin, oppId, uid, `them_${cfg.key}`, null, { id: (row as { id: string }).id, ...v })
  return NextResponse.json({ row })
}

export async function suaDong(admin: Admin, oppId: string, uid: string, bang: string, rowId: string, body: Record<string, unknown>) {
  if (bang === 'tam-ung') return xuLyTamUng(admin, oppId, uid, rowId, body)
  const cfg = BANG[bang]
  if (!cfg) throw new QtError('Bảng không hợp lệ', 404)
  const cu = chk(await admin.from(cfg.table).select('*').eq('id', lamSach(rowId, 'uuid_null') as string).eq('opportunity_id', oppId).maybeSingle()) as Record<string, unknown> | null
  if (!cu) throw new QtError('Không tìm thấy dòng', 404)
  const qt = await damBaoQt(admin, oppId)
  if (cfg.khoaKhiKhoaSo && qt.da_khoa) throw new QtError('Quyết toán đã khoá sổ, không sửa được')
  let v = lamSachTheoMau(body, cfg.mau)
  if (bang === 'chi-phi' && cu.nguon !== 'ke_toan') {
    const ngoai = Object.keys(v).filter((k) => !TRUONG_CHUNG_TU.includes(k))
    if (ngoai.length) throw new QtError('Dòng do điều hành nhập: kế toán chỉ sửa phần chứng từ')
    v = Object.fromEntries(Object.entries(v).filter(([k]) => TRUONG_CHUNG_TU.includes(k)))
  }
  if (Object.keys(v).length === 0) throw new QtError('Không có trường nào để cập nhật')
  await chuanHoa(admin, oppId, bang, v, cu)
  const row = chk(await admin.from(cfg.table).update(v).eq('id', cu.id as string).select('*').single())
  await ghiLichSu(admin, oppId, uid, `sua_${cfg.key}`, null, { id: cu.id, sau: v })
  return NextResponse.json({ row })
}

export async function xoaDong(admin: Admin, oppId: string, uid: string, bang: string, rowId: string) {
  const cfg = BANG[bang]
  if (!cfg) throw new QtError('Bảng không hợp lệ', 404)
  const cu = chk(await admin.from(cfg.table).select('*').eq('id', lamSach(rowId, 'uuid_null') as string).eq('opportunity_id', oppId).maybeSingle()) as Record<string, unknown> | null
  if (!cu) throw new QtError('Không tìm thấy dòng', 404)
  const qt = await damBaoQt(admin, oppId)
  if (cfg.khoaKhiKhoaSo && qt.da_khoa) throw new QtError('Quyết toán đã khoá sổ, không xoá được')
  if (bang === 'chi-phi' && cu.nguon !== 'ke_toan') throw new QtError('Chỉ xoá được dòng kế toán thêm')
  chk(await admin.from(cfg.table).delete().eq('id', cu.id as string))
  await ghiLichSu(admin, oppId, uid, `xoa_${cfg.key}`, null, { dong: cu })
  return NextResponse.json({ ok: true })
}

/** Tạm ứng điều hành: body.action = chi {ngay_chi, so_tien_chi, tai_khoan} | tu_choi {ly_do} | quyet_toan {so_tien_da_dung}. */
async function xuLyTamUng(admin: Admin, oppId: string, uid: string, rowId: string, body: Record<string, unknown>) {
  const tu = chk(await admin.from('qt_tam_ung').select('*').eq('id', lamSach(rowId, 'uuid_null') as string).eq('opportunity_id', oppId).maybeSingle()) as
    { id: string; trang_thai: string; so_tien_de_nghi: number; so_tien_chi: number | null } | null
  if (!tu) throw new QtError('Không tìm thấy đề nghị tạm ứng', 404)
  const qt = await damBaoQt(admin, oppId)
  if (qt.da_khoa) throw new QtError('Quyết toán đã khoá sổ')
  const action = String(body.action ?? '')
  const ghiChu = lamSach(body.ghi_chu_ke_toan, 'text')
  let patch: Record<string, unknown>
  let lyDo: string | null = null
  if (action === 'chi') {
    if (!['de_nghi', 'da_chi'].includes(tu.trang_thai)) throw new QtError('Đề nghị này không chi được nữa')
    const soTien = lamSach(body.so_tien_chi, 'num') as number
    if (soTien <= 0) throw new QtError('Số tiền chi phải lớn hơn 0')
    patch = { trang_thai: 'da_chi', ngay_chi: lamSach(body.ngay_chi, 'date'), so_tien_chi: soTien, tai_khoan: lamSach(body.tai_khoan, 'text') }
  } else if (action === 'tu_choi') {
    if (tu.trang_thai !== 'de_nghi') throw new QtError('Chỉ từ chối được đề nghị chưa chi')
    lyDo = (lamSach(body.ly_do, 'text') as string | null) ?? null
    if (!lyDo) throw new QtError('Cần nhập lý do từ chối')
    patch = { trang_thai: 'tu_choi' }
  } else if (action === 'quyet_toan') {
    if (!['da_chi', 'da_quyet_toan'].includes(tu.trang_thai)) throw new QtError('Chỉ quyết toán được khoản đã chi')
    const daDung = lamSach(body.so_tien_da_dung, 'num') as number
    if (daDung < 0) throw new QtError('Số tiền đã dùng không hợp lệ')
    patch = { trang_thai: 'da_quyet_toan', so_tien_da_dung: daDung, so_tien_hoan: Number(tu.so_tien_chi ?? 0) - daDung }
  } else if (action === 'huy_quyet_toan') {
    if (tu.trang_thai !== 'da_quyet_toan') throw new QtError('Khoản này chưa quyết toán')
    patch = { trang_thai: 'da_chi', so_tien_da_dung: null, so_tien_hoan: null }
  } else {
    throw new QtError('Thao tác không hợp lệ')
  }
  if (ghiChu !== undefined && 'ghi_chu_ke_toan' in body) patch.ghi_chu_ke_toan = ghiChu ?? lyDo
  else if (lyDo) patch.ghi_chu_ke_toan = lyDo
  const row = chk(await admin.from('qt_tam_ung').update(patch).eq('id', tu.id).select('*').single())
  const tenHd = action === 'huy_quyet_toan' ? 'sua_tam_ung' : action === 'tu_choi' ? 'tu_choi_tam_ung' : `${action}_tam_ung`
  await ghiLichSu(admin, oppId, uid, tenHd, lyDo, { id: tu.id, ...patch })
  return NextResponse.json({ row })
}
