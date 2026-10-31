// Đồng bộ sao kê từ Google Sheet "SAO KÊ CÁ NHÂN" vào sao_ke_giao_dich — phần THUẦN (không gọi DB),
// route /api/ve-may-bay/sao-ke/sync dùng. Tách riêng để chạy thử được với dữ liệu thật ngoài Next.
//
// Nhận diện dòng theo NỘI DUNG chứ không theo vị trí: kế toán hay chèn/xoá dòng giữa sheet, vị trí dòng
// lệch đi, trước đây (upsert theo tai_khoan + row_index) làm dòng đã gắn quyết toán (sao_ke_id) bị ghi đè
// thành giao dịch khác. Ghép dòng sheet ↔ dòng cũ qua các lượt, mỗi lượt ưu tiên dòng cũ gần vị trí đoán nhất:
//   1. trùng ngày + thu/chi/vay + diễn giải + đơn vị  (không đổi, hoặc chỉ đổi mã/tag/dự án/vị trí) —
//      ghép trước các dòng duy nhất làm mốc, rồi mới tới dòng trùng nội dung
//   2. trùng ngày + thu/chi/vay                        (sửa chữ: diễn giải/đơn vị)
//   3. trùng diễn giải + đơn vị, DUY NHẤT ở cả 2 phía  (sửa tiền/ngày)
// Còn lại: dòng sheet → thêm mới; dòng cũ → đánh dấu đã xoá (không xoá thật, giữ id cho quyết toán).

export type SaoKeDong = {
  tai_khoan: string
  stt: number
  ngay: string | null
  ma: string | null
  tag: string | null
  don_vi: string | null
  dien_giai: string | null
  thu: number | null
  chi: number | null
  vay: number | null
  so_du_cuoi_ky: number | null
  ten_du_an: string | null
  ma_tk: string | null
  ma_1: string | null
  ma_2: string | null
  ma_3: string | null
  row_index: number
}

export type SaoKeDongCu = SaoKeDong & { id: string; xoa_luc: string | null }

const TRUONG: (keyof SaoKeDong)[] = [
  'stt', 'ngay', 'ma', 'tag', 'don_vi', 'dien_giai', 'thu', 'chi', 'vay', 'so_du_cuoi_ky',
  'ten_du_an', 'ma_tk', 'ma_1', 'ma_2', 'ma_3', 'row_index',
]

export function parseNum(v: unknown): number | null {
  const s = String(v ?? '').trim()
  if (s === '' || s === '-') return null
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-')
  const cleaned = s.replace(/[()]/g, '').replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (Number.isNaN(n)) return null
  return negative ? -n : n
}

function str(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

/** "5/1/2026" → "05/01/2026" (lọc theo tháng bằng hậu tố "/MM/YYYY" cần đủ 2 chữ số). Không phải ngày thì giữ nguyên. */
export function chuanNgay(v: string | null): string | null {
  if (!v) return null
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v.trim())
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : v.trim()
}

/**
 * Đọc 1 sheet (mảng giá trị từ Sheets API, mỗi phần tử 1 dòng). Dòng giao dịch = ô STT là số; bỏ dòng
 * kế toán điền sẵn STT + công thức số dư nhưng chưa có giao dịch (không ngày, không diễn giải, không tiền).
 * Cột theo VỊ TRÍ (tiêu đề lệch nhau giữa các sheet), `lechCot` = số cột trống trước cột STT.
 */
export function docSheet(rows: unknown[][], taiKhoan: string, lechCot = 0): SaoKeDong[] {
  const out: SaoKeDong[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = (rows[i] ?? []).slice(lechCot)
    const sttRaw = String(r[0] ?? '').trim()
    if (!/^\d+$/.test(sttRaw)) continue
    const d: SaoKeDong = {
      tai_khoan: taiKhoan,
      stt: parseInt(sttRaw, 10),
      ngay: chuanNgay(str(r[1])),
      ma: str(r[3]),
      tag: str(r[4]),
      don_vi: str(r[5]),
      dien_giai: str(r[6]),
      thu: parseNum(r[7]),
      chi: parseNum(r[8]),
      vay: parseNum(r[9]),
      so_du_cuoi_ky: parseNum(r[10]),
      ten_du_an: str(r[11]),
      ma_tk: str(r[12]),
      ma_1: str(r[13]),
      ma_2: str(r[14]),
      ma_3: str(r[15]),
      row_index: i,
    }
    if (!d.ngay && !d.dien_giai && !d.thu && !d.chi && !d.vay) continue
    out.push(d)
  }
  return out
}

const chu = (s: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const so = (n: number | null) => String(Math.round((n ?? 0) * 100))
const khoaTien = (d: SaoKeDong) => [chuanNgay(d.ngay) ?? '', so(d.thu), so(d.chi), so(d.vay)].join('|')
const khoaChu = (d: SaoKeDong) => [chu(d.dien_giai), chu(d.don_vi)].join('|')

/** Đổi ngày hoặc số tiền — dòng đã gắn quyết toán đổi những thứ này thì phải báo kế toán. */
export function doiTienNgay(cu: SaoKeDong, moi: SaoKeDong): boolean {
  return khoaTien(cu) !== khoaTien(moi)
}

function giongHet(cu: SaoKeDongCu, moi: SaoKeDong): boolean {
  return TRUONG.every((k) => (k === 'ngay' ? chuanNgay(cu.ngay) === moi.ngay : (cu[k] ?? null) === (moi[k] ?? null)))
}

export type KetQuaKhop = {
  them: SaoKeDong[]
  sua: { cu: SaoKeDongCu; moi: SaoKeDong }[]
  giuNguyen: number
  xoa: SaoKeDongCu[]
}

/** Ghép dòng trên sheet (`moi`) với dòng đã có của CÙNG 1 tài khoản (`cu`, gồm cả dòng đã đánh dấu xoá). */
export function khopDong(moi: SaoKeDong[], cu: SaoKeDongCu[]): KetQuaKhop {
  const conCu = new Set(cu)
  const ghep = new Map<SaoKeDong, SaoKeDongCu>()

  // Mốc = cặp ghép chắc chắn (khoá đầy đủ duy nhất ở cả 2 phía). Dòng trùng nội dung (vd 2 lần chuyển cùng
  // số tiền cùng diễn giải cùng ngày) thì đoán vị trí cũ = vị trí mới − độ lệch của mốc gần nhất phía trên,
  // để chèn/xoá dòng phía trên không làm 2 dòng trùng tráo id cho nhau.
  const moc: { moi: number; cu: number }[] = []
  const viTriDoan = (m: SaoKeDong) => {
    let lo = 0, hi = moc.length - 1, best = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (moc[mid].moi <= m.row_index) { best = mid; lo = mid + 1 } else hi = mid - 1
    }
    return best < 0 ? m.row_index : m.row_index - (moc[best].moi - moc[best].cu)
  }

  const luot = (khoa: (d: SaoKeDong) => string | null, chiKhiDuyNhat = false) => {
    const nhom = new Map<string, SaoKeDongCu[]>()
    for (const c of conCu) {
      const k = khoa(c)
      if (k == null) continue
      nhom.set(k, [...(nhom.get(k) ?? []), c])
    }
    let demMoi: Map<string, number> | null = null
    if (chiKhiDuyNhat) {
      demMoi = new Map()
      for (const m of moi) {
        if (ghep.has(m)) continue
        const k = khoa(m)
        if (k != null) demMoi.set(k, (demMoi.get(k) ?? 0) + 1)
      }
    }
    for (const m of moi) {
      if (ghep.has(m)) continue
      const k = khoa(m)
      if (k == null) continue
      const ds = nhom.get(k)
      if (!ds?.length) continue
      if (demMoi && (ds.length !== 1 || demMoi.get(k) !== 1)) continue
      // Ưu tiên dòng cũ còn hiện (chưa đánh dấu xoá), rồi gần vị trí đoán nhất
      const doan = viTriDoan(m)
      let best = 0
      for (let i = 1; i < ds.length; i++) {
        const a = ds[i], b = ds[best]
        if ((!a.xoa_luc && b.xoa_luc) || (!a.xoa_luc === !b.xoa_luc && Math.abs(a.row_index - doan) < Math.abs(b.row_index - doan))) best = i
      }
      const c = ds.splice(best, 1)[0]
      conCu.delete(c)
      ghep.set(m, c)
    }
  }

  const khoaDu = (d: SaoKeDong) => `${khoaTien(d)}#${khoaChu(d)}`
  luot(khoaDu, true)
  for (const [m, c] of ghep) if (!c.xoa_luc) moc.push({ moi: m.row_index, cu: c.row_index })
  moc.sort((a, b) => a.moi - b.moi)
  luot(khoaDu)
  luot(khoaTien)
  luot((d) => (d.dien_giai ? khoaChu(d) : null), true)

  const kq: KetQuaKhop = { them: [], sua: [], giuNguyen: 0, xoa: [] }
  for (const m of moi) {
    const c = ghep.get(m)
    if (!c) kq.them.push(m)
    else if (c.xoa_luc || !giongHet(c, m)) kq.sua.push({ cu: c, moi: m })
    else kq.giuNguyen++
  }
  for (const c of conCu) if (!c.xoa_luc) kq.xoa.push(c)
  return kq
}
