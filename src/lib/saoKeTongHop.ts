// Tính số dư đầu kỳ / cuối kỳ theo tài khoản và tổng hợp thu/chi theo tài khoản kế toán đối ứng (cột Mã)
// từ các dòng sao kê đã đồng bộ. File thuần — màn Đầu vào sao kê dùng (client), chạy thử được ngoài Next.
//
// Số dư theo đúng cách sheet tính: theo THỨ TỰ DÒNG trên sheet (row_index), dư = dư dòng trước + thu − chi + vay,
// khởi đầu từ dòng "Số dư đầu kỳ" (sheet nào không có dòng này thì suy từ dòng đầu tiên). Dòng thuộc kỳ nào
// thì theo NGÀY của dòng (kế toán có khi nhập muộn, ngày không tăng dần theo dòng).

export type DongSaoKe = {
  tai_khoan: string
  ngay: string | null
  ma: string | null
  dien_giai: string | null
  thu: number | null
  chi: number | null
  vay: number | null
  so_du_cuoi_ky: number | null
  row_index: number
  xoa_luc: string | null
}

export type SoDuTaiKhoan = {
  tai_khoan: string
  dau_ky: number
  thu: number
  chi: number
  vay: number
  cuoi_ky: number
  /** Số dư kế toán ghi ở dòng cuối cùng của sheet (null = sheet không ghi) */
  cuoi_ky_sheet: number | null
  /** Số dư cộng dồn tới dòng cuối cùng của sheet — khớp cuoi_ky_sheet thì cột dư trên sheet đúng */
  cuoi_sheet_tinh: number
  so_dong: number
  /** Các dòng mà số dư sheet bắt đầu lệch so với cộng dồn (tối đa 5 chỗ, trên cả sheet) */
  cho_lech: { ngay: string | null; dien_giai: string | null; chenh: number }[]
}

const DAU_KY = /s[ốo] d[ưu] đ[ầa]u k[ỳy]/i

export function isoNgay(v: string | null): string | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(v ?? '')
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

const n = (v: number | null) => v ?? 0
const laDauKy = (r: DongSaoKe) => DAU_KY.test(r.dien_giai ?? '') && !r.thu && !r.chi && !r.vay

/** Mã tài khoản tiền (111x tiền mặt, 112x ngân hàng) = chuyển tiền giữa các quỹ/tài khoản của chính mình. */
export function laChuyenNoiBo(ma: string | null): boolean {
  return /^11[12]/.test((ma ?? '').trim())
}

/** Số dư từng tài khoản cho kỳ [tu, den] (yyyy-mm-dd). */
export function tinhSoDu(rows: DongSaoKe[], tu: string, den: string): Map<string, SoDuTaiKhoan> {
  const theoTk = new Map<string, DongSaoKe[]>()
  for (const r of rows) {
    if (r.xoa_luc) continue
    theoTk.set(r.tai_khoan, [...(theoTk.get(r.tai_khoan) ?? []), r])
  }
  const kq = new Map<string, SoDuTaiKhoan>()
  for (const [tk, ds] of theoTk) {
    ds.sort((a, b) => a.row_index - b.row_index)
    const moDau = ds.find(laDauKy)
    const dau = ds[0]
    const so_du_mo = moDau ? n(moDau.so_du_cuoi_ky) : n(dau.so_du_cuoi_ky) - n(dau.thu) + n(dau.chi) - n(dau.vay)
    const t: SoDuTaiKhoan = { tai_khoan: tk, dau_ky: so_du_mo, thu: 0, chi: 0, vay: 0, cuoi_ky: 0, cuoi_ky_sheet: null, cuoi_sheet_tinh: 0, so_dong: 0, cho_lech: [] }
    let chay = so_du_mo
    let lechTruoc = 0
    let ngayTruoc: string | null = null
    for (const r of ds) {
      if (r === moDau) continue
      // Dòng không ghi ngày tính theo ngày của dòng phía trên
      const ngay: string | null = isoNgay(r.ngay) ?? ngayTruoc
      ngayTruoc = ngay
      const ps = n(r.thu) - n(r.chi) + n(r.vay)
      chay += ps
      if (!ngay || ngay < tu) t.dau_ky += ps
      else if (ngay <= den) {
        t.thu += n(r.thu); t.chi += n(r.chi); t.vay += n(r.vay); t.so_dong++
      }
      // Kiểm tra cột dư của sheet theo thứ tự dòng trên CẢ sheet (không cắt theo kỳ: dòng ngày sau kỳ
      // vẫn nằm xen giữa và vẫn vào số dư sheet) — đây là kiểm tra công thức/gõ số trên sheet
      if (r.so_du_cuoi_ky != null) {
        t.cuoi_ky_sheet = r.so_du_cuoi_ky
        const lech = Math.round((r.so_du_cuoi_ky - chay) * 100) / 100
        if (Math.abs(lech - lechTruoc) >= 1 && t.cho_lech.length < 5) t.cho_lech.push({ ngay: r.ngay, dien_giai: r.dien_giai, chenh: lech - lechTruoc })
        lechTruoc = lech
      }
    }
    t.cuoi_ky = t.dau_ky + t.thu - t.chi + t.vay
    t.cuoi_sheet_tinh = chay
    kq.set(tk, t)
  }
  return kq
}

export type DongTheoMa = { ma: string; thu: number; chi: number; so_dong: number }

/** Tổng thu/chi theo cột Mã (tài khoản đối ứng) cho kỳ [tu, den]; dòng không có mã gom vào ma = ''. */
export function tongHopTheoMa(rows: DongSaoKe[], tu: string, den: string): DongTheoMa[] {
  const m = new Map<string, DongTheoMa>()
  for (const r of rows) {
    if (r.xoa_luc || laDauKy(r)) continue
    const ngay = isoNgay(r.ngay)
    if (!ngay || ngay < tu || ngay > den) continue
    if (!r.thu && !r.chi) continue
    const ma = (r.ma ?? '').trim()
    const d = m.get(ma) ?? { ma, thu: 0, chi: 0, so_dong: 0 }
    d.thu += n(r.thu); d.chi += n(r.chi); d.so_dong++
    m.set(ma, d)
  }
  return [...m.values()].sort((a, b) => a.ma.localeCompare(b.ma))
}
