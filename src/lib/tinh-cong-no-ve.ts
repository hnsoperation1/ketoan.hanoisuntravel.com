// Tái hiện đúng chuỗi công thức Excel kế toán đang dùng ở sheet "Tổng -
// File cuối" (đối chiếu 2026-08-02 từ file mẫu thật user gửi:
// "FILE VÉ GỬI QUỐC.xlsx"). Chỉ nhận các cột INPUT thô (đã lưu trong
// ve_debt_records), tính ra toàn bộ cột công thức — KHÔNG lưu kết quả vào
// DB, tính lại mỗi lần hiển thị để không bị stale khi sửa số gốc.
//
// LƯU Ý: cột "Hoa Hồng KT2" trong file gốc ghi nhãn "2%" nhưng công thức
// thật đang chạy là W*0.015 (1,5%) — đã hỏi lại user, code theo ĐÚNG công
// thức thật (1,5%) vì đó là số thực tế đang ra kết quả trong file, không
// theo nhãn cột (nghi ngờ nhãn bị để cũ chưa cập nhật).
const NGUONG_MIEN_THUE = 300_000
const THUE_SUAT_THAP = 0.10   // LN tính thuế trong khoảng (1, 700_000)
const THUE_SUAT_CAO = 0.20    // LN tính thuế >= 700_000
const NGUONG_THUE_CAO = 700_000
const TY_LE_GTGT = 0.08
const TY_LE_QUY_CSKH = 0.05
const TY_LE_HH_TKT = 0.10
const TY_LE_HH_KT1 = 0.03
const TY_LE_HH_KT2 = 0.015     // xem lưu ý ở trên — 1,5% theo công thức thật, không phải 2% theo nhãn cột
const TY_LE_HH_SALE_CHINH = 0.25

export type CongNoInput = {
  gia_mua: number | null
  cktm: number | null
  gia_ban: number | null
  com_khach: number | null
}

export type CongNoDerived = {
  tong_mua: number
  loi_nhuan: number
  ln_truoc_com: number
  ln_tinh_thue: number
  ty_le_thue_tndn: number
  thue_tndn: number
  thue_gtgt: number
  quy_cskh: number
  ln_con_lai_hoa_hong: number
  hoa_hong_tkt: number
  hoa_hong_kt1: number
  hoa_hong_kt2: number
  hoa_hong_sale_chinh: number
  ln_cty_con_lai: number
}

export function tinhCongNo(input: CongNoInput): CongNoDerived {
  const gia_mua = input.gia_mua ?? 0
  const cktm = input.cktm ?? 0
  const gia_ban = input.gia_ban ?? 0
  const com_khach = input.com_khach ?? 0

  const tong_mua = gia_mua - cktm
  const loi_nhuan = gia_ban - tong_mua - com_khach
  const ln_truoc_com = loi_nhuan + com_khach

  const ln_tinh_thue = ln_truoc_com > NGUONG_MIEN_THUE ? Math.max(0, ln_truoc_com - NGUONG_MIEN_THUE) : 0

  let ty_le_thue_tndn = 0
  if (ln_tinh_thue > 1 && ln_tinh_thue < NGUONG_THUE_CAO) ty_le_thue_tndn = THUE_SUAT_THAP
  else if (ln_tinh_thue >= NGUONG_THUE_CAO) ty_le_thue_tndn = THUE_SUAT_CAO

  const thue_tndn = ln_tinh_thue * ty_le_thue_tndn
  const thue_gtgt = ln_truoc_com * TY_LE_GTGT
  const quy_cskh = ln_truoc_com * TY_LE_QUY_CSKH

  const ln_con_lai_hoa_hong = loi_nhuan - thue_tndn - thue_gtgt - quy_cskh

  const hoa_hong_tkt = ln_con_lai_hoa_hong * TY_LE_HH_TKT
  const hoa_hong_kt1 = ln_con_lai_hoa_hong * TY_LE_HH_KT1
  const hoa_hong_kt2 = ln_con_lai_hoa_hong * TY_LE_HH_KT2
  const hoa_hong_sale_chinh = ln_con_lai_hoa_hong * TY_LE_HH_SALE_CHINH

  const ln_cty_con_lai = ln_con_lai_hoa_hong - hoa_hong_tkt - hoa_hong_kt1 - hoa_hong_kt2 - hoa_hong_sale_chinh

  return {
    tong_mua, loi_nhuan, ln_truoc_com, ln_tinh_thue, ty_le_thue_tndn, thue_tndn,
    thue_gtgt, quy_cskh, ln_con_lai_hoa_hong, hoa_hong_tkt, hoa_hong_kt1,
    hoa_hong_kt2, hoa_hong_sale_chinh, ln_cty_con_lai,
  }
}
