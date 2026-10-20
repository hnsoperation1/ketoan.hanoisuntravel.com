'use client'

// Đọc DANH MỤC CHUNG (bảng danh_muc, quản trị ở ihns.vn/quan-tri/danh-muc — chỉ Super Admin, app này chỉ đọc).
// Đọc qua /api/danh-muc, nhớ đệm theo loại trong phiên (mọi màn dùng chung 1 lần tải). Bảng chưa có / đọc lỗi /
// chưa có mục nào → dùng danh sách dự phòng viết sẵn bên dưới (giống hệt danh sách cứng trước đây).

import { useEffect, useMemo, useSyncExternalStore } from 'react'

export type LoaiDanhMuc = 'ngan_hang' | 'nhom_khach_ve'

export type DanhMucItem = {
  id: string
  ma: string | null
  ten: string
  thu_tu: number
  dang_dung: boolean
  meta: Record<string, unknown> | null
}

// null = không dùng được danh mục → dùng dự phòng
const cache = new Map<LoaiDanhMuc, DanhMucItem[] | null>()
const dangTai = new Set<LoaiDanhMuc>()
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function taiDanhMuc(loai: LoaiDanhMuc) {
  if (cache.has(loai) || dangTai.has(loai)) return
  dangTai.add(loai)
  fetch(`/api/danh-muc?loai=${loai}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
    .then((j: { items?: DanhMucItem[] }) => { cache.set(loai, Array.isArray(j.items) && j.items.length > 0 ? j.items : null) })
    .catch(() => { cache.set(loai, null) })
    .finally(() => {
      dangTai.delete(loai)
      listeners.forEach((l) => l())
    })
}

/** Mục danh mục của 1 loại (cả mục đã ẩn — để hiện đúng tên cho dữ liệu cũ); null khi chưa tải xong / không dùng được. */
export function useDanhMuc(loai: LoaiDanhMuc): DanhMucItem[] | null {
  useEffect(() => { taiDanhMuc(loai) }, [loai])
  return useSyncExternalStore(subscribe, () => cache.get(loai) ?? null, () => null)
}

function metaText(it: DanhMucItem, key: string): string {
  const v = it.meta?.[key]
  return typeof v === 'string' ? v.trim() : ''
}

// ── Ngân hàng (loai 'ngan_hang', meta: bin = mã BIN NAPAS/VietQR, ten_khac = tên gọi khác cách nhau dấu phẩy) ──

// Dự phòng — CHỈ các ngân hàng đã thực tế thấy trong dữ liệu nhân sự thuê ngoài + vài ngân hàng phổ biến
// (đỡ rủi ro gõ nhầm mã ngân hàng ít gặp). Khớp seed migration 20261120_danh_muc_ketoan.sql.
const NGAN_HANG_DU_PHONG: { ma: string; ten: string; bin: string; ten_khac: string }[] = [
  { ma: 'VCB', ten: 'Vietcombank', bin: '970436', ten_khac: '' },
  { ma: 'CTG', ten: 'VietinBank', bin: '970415', ten_khac: 'Viettinbank' },
  { ma: 'BIDV', ten: 'BIDV', bin: '970418', ten_khac: '' },
  { ma: 'TCB', ten: 'Techcombank', bin: '970407', ten_khac: '' },
  { ma: 'MB', ten: 'MB Bank', bin: '970422', ten_khac: 'Military Bank' },
  { ma: 'VPB', ten: 'VPBank', bin: '970432', ten_khac: '' },
  { ma: 'ACB', ten: 'ACB', bin: '970416', ten_khac: '' },
  { ma: 'TPB', ten: 'TPBank', bin: '970423', ten_khac: '' },
  { ma: 'STB', ten: 'Sacombank', bin: '970403', ten_khac: '' },
  { ma: 'AGRIBANK', ten: 'Agribank', bin: '970405', ten_khac: '' },
  { ma: 'SHB', ten: 'SHB', bin: '970443', ten_khac: '' },
  { ma: 'HDB', ten: 'HDBank', bin: '970437', ten_khac: '' },
  { ma: 'VIB', ten: 'VIB', bin: '970441', ten_khac: '' },
  { ma: 'EIB', ten: 'Eximbank', bin: '970431', ten_khac: '' },
  { ma: 'MSB', ten: 'MSB', bin: '970426', ten_khac: '' },
]

const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

/** Bỏ dấu, bỏ khoảng trắng/ký tự lạ, viết hoa — "Vietcombank" / "vietcom bank" / "VIETCOMBANK" về cùng 1 khoá. */
export function khoaNganHang(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS_RE, '').replace(/đ/gi, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

type NganHang = { ten: string; bin: string; ten_goi: string[]; dang_dung: boolean }

function dsNganHang(items: DanhMucItem[] | null): NganHang[] {
  if (!items) return NGAN_HANG_DU_PHONG.map((b) => ({ ten: b.ten, bin: b.bin, ten_goi: [b.ma, b.ten, ...b.ten_khac.split(',')], dang_dung: true }))
  return items.map((it) => ({
    ten: it.ten,
    bin: metaText(it, 'bin'),
    ten_goi: [it.ma ?? '', it.ten, ...metaText(it, 'ten_khac').split(',')],
    dang_dung: it.dang_dung,
  }))
}

export function useNganHang() {
  const items = useDanhMuc('ngan_hang')
  return useMemo(() => {
    const ds = dsNganHang(items)
    const binTheoKhoa = new Map<string, string>()
    for (const b of ds) {
      if (!b.bin) continue
      for (const n of b.ten_goi) { const k = khoaNganHang(n); if (k && !binTheoKhoa.has(k)) binTheoKhoa.set(k, b.bin) }
    }
    return {
      /** Tên ngân hàng đang dùng — gợi ý khi gõ ô Ngân hàng */
      tenGoiY: ds.filter((b) => b.dang_dung).map((b) => b.ten),
      /** "ten_ngan_hang" (chữ tự do, hay kèm chi nhánh vd "Vietcombank - CN Gò Vấp") → mã BIN; cắt phần sau dấu "-"
       *  rồi khớp mã / tên / tên gọi khác. Không khớp → null (không tạo QR, không đoán bừa). */
      resolveBin: (tenNganHang: string | null | undefined): string | null => {
        if (!tenNganHang) return null
        const k = khoaNganHang(tenNganHang.split('-')[0])
        return k ? (binTheoKhoa.get(k) ?? null) : null
      },
    }
  }, [items])
}

// ── Nhóm khách vé máy bay (loai 'nhom_khach_ve', có mã: vmb_khach_hang.nhom lưu `ma`; meta.ma_ngan = mã viết tắt) ──

// Dự phòng — mã ngắn 4 nhóm dai_ly/doanh_nghiep/ag_series/khach_le lấy đúng file gốc "Link nhập _ Phòng vé HNS
// (Năm 2026).xlsx" sheet "MÃ KHÁCH VÉ" cột A (DLY/DN/AG/KLE); 4 nhóm còn lại file để trống nên tự đặt.
const NHOM_KHACH_VE_DU_PHONG: { ma: string; ten: string; ma_ngan: string }[] = [
  { ma: 'nhan_su', ten: 'Nhân sự HNS', ma_ngan: 'NS' },
  { ma: 'dai_ly', ten: 'Đại lý', ma_ngan: 'DLY' },
  { ma: 'doanh_nghiep', ten: 'Khách hàng DN', ma_ngan: 'DN' },
  { ma: 'ag_series', ten: 'AG - mua vé series', ma_ngan: 'AG' },
  { ma: 'khach_le', ten: 'Khách lẻ', ma_ngan: 'KLE' },
  { ma: 'doan_tour', ten: 'Đoàn đi tour', ma_ngan: 'ĐOÀN' },
  { ma: 'series_vj', ten: 'Vé Seri Vietjet', ma_ngan: 'SERI VJ' },
  { ma: 'series_sao_do', ten: 'Vé Seri Sao Đỏ', ma_ngan: 'SERI SĐ' },
]

export function useNhomKhachVe() {
  const items = useDanhMuc('nhom_khach_ve')
  return useMemo(() => {
    // Thứ tự khoá labels = thứ tự danh mục (màn công nợ dựng nút lọc theo Object.keys) → mục danh mục trước, dự phòng sau
    const labels: Record<string, string> = {}
    const shortLabels: Record<string, string> = {}
    const duPhong = new Map(NHOM_KHACH_VE_DU_PHONG.map((d) => [d.ma, d]))
    let options = NHOM_KHACH_VE_DU_PHONG.map((d) => d.ma)
    if (items) {
      const coMa = items.filter((it): it is DanhMucItem & { ma: string } => !!it.ma)
      options = coMa.filter((it) => it.dang_dung).map((it) => it.ma)
      for (const it of coMa) {
        labels[it.ma] = it.ten
        shortLabels[it.ma] = metaText(it, 'ma_ngan') || duPhong.get(it.ma)?.ma_ngan || it.ten
      }
    }
    for (const d of NHOM_KHACH_VE_DU_PHONG) {
      if (!(d.ma in labels)) { labels[d.ma] = d.ten; shortLabels[d.ma] = d.ma_ngan }
    }
    return { labels, shortLabels, options }
  }, [items])
}
