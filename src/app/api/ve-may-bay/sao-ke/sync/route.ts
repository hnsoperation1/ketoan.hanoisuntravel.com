import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getGoogleAuth } from '@/lib/google'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireScreen } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { docSheet, doiTienNgay, khopDong, type SaoKeDong, type SaoKeDongCu } from '@/lib/saoKeDongBo'
import { formatTien } from '@/lib/format'

// Đồng bộ thủ công (bấm nút trên UI) từ Google Sheet "SAO KÊ CÁ NHÂN" vào sao_ke_giao_dich — chỉ dữ liệu
// sao kê, các tài khoản lấy từ danh mục sao_ke_tai_khoan (dong_bo = true), mỗi tài khoản = 1 sheet.
// Cách ghép dòng sheet ↔ dòng cũ: xem lib/saoKeDongBo.ts. Dòng biến mất khỏi sheet chỉ đánh dấu xoa_luc
// (không xoá thật — khoản thu/chi quyết toán có thể đang gắn sao_ke_id). Dòng đã gắn quyết toán mà bị
// sửa tiền/ngày hoặc bị xoá → ghi canh_bao để kế toán xem lại.
//
// Mở cho người được màn Sao kê TC hoặc Đầu vào sao kê (cả 2 trang đều có nút đồng bộ) — response chỉ trả
// SỐ LƯỢNG theo tài khoản + danh sách dòng cảnh báo (người xem được màn Đầu vào sao kê mới thấy nội dung).
const SPREADSHEET_ID = '1icCvAF9tqR4pxh_kkgMIz28BZ_e2C1M5WWmVU2D_QFI'
const LO = 500
// Một lần đồng bộ mà mất quá nửa số dòng của 1 tài khoản thì gần như chắc sheet bị đổi cấu trúc/đọc lỗi —
// bỏ qua tài khoản đó thay vì đánh dấu xoá hàng loạt.
const NGUONG_XOA = 0.5

type TaiKhoan = { ma: string; ten: string; lech_cot: number }
type TomTat = { tai_khoan: string; ten: string; tren_sheet: number; them: number; sua: number; xoa: number; giu_nguyen: number; loi?: string }
type CanhBao = { id: string; tai_khoan: string; ngay: string | null; dien_giai: string | null; canh_bao: string }

function moTa(d: SaoKeDong): string {
  const tien = d.thu ? `thu ${formatTien(d.thu)}` : d.chi ? `chi ${formatTien(d.chi)}` : d.vay ? `vay ${formatTien(d.vay)}` : '0'
  return `${d.ngay ?? 'không ngày'} · ${tien}`
}

export async function POST() {
  const { user, unauthorized } = await requireScreen('kt-sao-ke-tc', 'kt-sao-ke')
  if (unauthorized) return unauthorized

  const admin = createAdminClient()
  const { data: dsTk, error: tkErr } = await admin
    .from('sao_ke_tai_khoan').select('ma, ten, lech_cot').eq('dong_bo', true).order('thu_tu')
  if (tkErr) {
    return NextResponse.json(
      { error: `Chưa đọc được danh mục tài khoản sao kê (cần chạy migration 20261145_sao_ke_dong_bo.sql): ${tkErr.message}` },
      { status: 500 },
    )
  }
  const taiKhoans = (dsTk ?? []) as TaiKhoan[]

  const sheets = google.sheets({ version: 'v4', auth: getGoogleAuth() })
  let batch
  try {
    batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: taiKhoans.map((t) => `'${t.ma}'!A:T`),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Không đọc được Google Sheet'
    return NextResponse.json(
      { error: `${msg}. Kiểm tra file đã được share (Viewer) cho ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} chưa, và tên sheet trong danh mục còn đúng không.` },
      { status: 502 },
    )
  }

  let cuAll: SaoKeDongCu[]
  try {
    cuAll = await fetchAllRows<SaoKeDongCu>((from, to) =>
      admin.from('sao_ke_giao_dich')
        .select('id, tai_khoan, stt, ngay, ma, tag, don_vi, dien_giai, thu, chi, vay, so_du_cuoi_ky, ten_du_an, ma_tk, ma_1, ma_2, ma_3, row_index, xoa_luc')
        .order('id').range(from, to))
  } catch (err) {
    return NextResponse.json({ error: `Lỗi đọc dữ liệu cũ: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
  }

  const tomTat: TomTat[] = []
  const them: SaoKeDong[] = []
  const sua: { cu: SaoKeDongCu; moi: SaoKeDong }[] = []
  const xoa: SaoKeDongCu[] = []

  taiKhoans.forEach((tk, i) => {
    const rows = (batch.data.valueRanges?.[i]?.values ?? []) as unknown[][]
    const moi = docSheet(rows, tk.ma, tk.lech_cot)
    const cu = cuAll.filter((c) => c.tai_khoan === tk.ma)
    const base = { tai_khoan: tk.ma, ten: tk.ten, tren_sheet: moi.length, them: 0, sua: 0, xoa: 0, giu_nguyen: 0 }
    if (!moi.length && cu.some((c) => !c.xoa_luc)) {
      tomTat.push({ ...base, loi: 'Không đọc được dòng giao dịch nào trên sheet — bỏ qua, giữ nguyên dữ liệu cũ' })
      return
    }
    const kq = khopDong(moi, cu)
    const dangHien = cu.filter((c) => !c.xoa_luc).length
    if (dangHien >= 20 && kq.xoa.length > dangHien * NGUONG_XOA) {
      tomTat.push({ ...base, loi: `Sheet mất ${kq.xoa.length}/${dangHien} dòng so với lần trước — nghi sheet bị đổi cấu trúc, bỏ qua tài khoản này` })
      return
    }
    them.push(...kq.them)
    sua.push(...kq.sua)
    xoa.push(...kq.xoa)
    tomTat.push({ ...base, them: kq.them.length, sua: kq.sua.length, xoa: kq.xoa.length, giu_nguyen: kq.giuNguyen })
  })

  // Dòng đang gắn khoản thu khách / thanh toán NCC của quyết toán (bảng chưa có thì coi như không gắn)
  const canXet = [...sua.filter((s) => doiTienNgay(s.cu, s.moi)).map((s) => s.cu.id), ...xoa.map((c) => c.id)]
  const daGan = new Set<string>()
  for (const bang of ['qt_thu_khach', 'qt_thanh_toan_ncc']) {
    for (let c = 0; c < canXet.length; c += LO) {
      const { data } = await admin.from(bang).select('sao_ke_id').in('sao_ke_id', canXet.slice(c, c + LO))
      for (const r of (data ?? []) as { sao_ke_id: string }[]) daGan.add(r.sao_ke_id)
    }
  }

  const now = new Date().toISOString()
  const canhBao: CanhBao[] = []
  for (const { cu, moi } of sua) {
    if (daGan.has(cu.id) && doiTienNgay(cu, moi)) {
      canhBao.push({ id: cu.id, tai_khoan: moi.tai_khoan, ngay: moi.ngay, dien_giai: moi.dien_giai,
        canh_bao: `Sheet đổi ngày/số tiền sau khi đã gắn quyết toán (trước: ${moTa(cu)}, nay: ${moTa(moi)})` })
    }
  }
  for (const cu of xoa) {
    if (daGan.has(cu.id)) {
      canhBao.push({ id: cu.id, tai_khoan: cu.tai_khoan, ngay: cu.ngay, dien_giai: cu.dien_giai,
        canh_bao: `Dòng đã bị xoá khỏi sheet nhưng đang gắn quyết toán (${moTa(cu)})` })
    }
  }

  // Upsert nhiều dòng thì mọi dòng phải CÙNG bộ cột (supabase-js lấy hợp các cột, dòng thiếu cột bị ghi
  // NULL) — nên dòng sửa luôn đủ cột, đánh dấu xoá và cảnh báo ghi bằng lệnh update riêng.
  try {
    const capNhat = sua.map(({ cu, moi }) => ({ id: cu.id, ...moi, xoa_luc: null, cap_nhat_luc: now }))
    for (let c = 0; c < capNhat.length; c += LO) {
      const { error } = await admin.from('sao_ke_giao_dich').upsert(capNhat.slice(c, c + LO), { onConflict: 'id' })
      if (error) throw new Error(`cập nhật lô ${c}-${c + LO}: ${error.message}`)
    }
    const idXoa = xoa.map((c) => c.id)
    for (let c = 0; c < idXoa.length; c += LO) {
      const { error } = await admin.from('sao_ke_giao_dich').update({ xoa_luc: now, cap_nhat_luc: now }).in('id', idXoa.slice(c, c + LO))
      if (error) throw new Error(`đánh dấu xoá lô ${c}-${c + LO}: ${error.message}`)
    }
    for (const cb of canhBao) {
      const { error } = await admin.from('sao_ke_giao_dich').update({ canh_bao: cb.canh_bao }).eq('id', cb.id)
      if (error) throw new Error(`ghi cảnh báo: ${error.message}`)
    }
    for (let c = 0; c < them.length; c += LO) {
      const { error } = await admin.from('sao_ke_giao_dich').insert(them.slice(c, c + LO))
      if (error) throw new Error(`thêm lô ${c}-${c + LO}: ${error.message}`)
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Lỗi ghi DB (${err instanceof Error ? err.message : String(err)}) — bấm đồng bộ lại để ghi nốt`, tom_tat: tomTat },
      { status: 500 },
    )
  }

  const { error: logErr } = await admin.from('sao_ke_dong_bo').insert({ user_id: user?.id ?? null, tom_tat: { tai_khoan: tomTat, canh_bao: canhBao } })
  if (logErr) console.error('sao_ke_dong_bo log', logErr.message)

  return NextResponse.json({
    tom_tat: tomTat,
    canh_bao: canhBao,
    // Giữ cho màn Sao kê TC (toast cũ đọc breakdown)
    breakdown: tomTat.map((t) => ({ tai_khoan: t.tai_khoan, parsed: t.tren_sheet })),
  })
}
