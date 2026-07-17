export type Prefix = 'HDV' | 'MC' | 'NS'

export type TrangThaiHoSo =
  | 'cho_xac_nhan_ai'
  | 'da_xac_nhan'
  | 'da_thanh_toan'
  // Giai đoạn 2 (AMIS WeSign) — chưa dùng ở v1:
  | 'da_xuat_hd'
  | 'da_gui_ky_amis'
  | 'da_ky_xong'

export const TRANG_THAI_LABELS: Record<TrangThaiHoSo, string> = {
  cho_xac_nhan_ai: 'Chờ xác nhận AI',
  da_xac_nhan: 'Đã xác nhận',
  da_thanh_toan: 'Đã thanh toán',
  da_xuat_hd: 'Đã xuất HĐ',
  da_gui_ky_amis: 'Đã gửi ký AMIS',
  da_ky_xong: 'Đã ký xong',
}

export interface NhanSu {
  id: string
  prefix: Prefix
  ho_ten: string
  dia_chi: string | null
  so_cccd: string | null
  ngay_sinh: string | null
  ngay_cap: string | null
  noi_cap: string | null
  ma_so_thue_tncn: string | null
  sdt: string | null
  so_the_hdv: string | null
  loai_the_hdv: string | null
  han_the_hdv: string | null
  stk: string | null
  ten_ngan_hang: string | null
  email: string | null
  created_at: string
}

export interface Doan {
  id: string
  ten_doan: string
  hanh_trinh: string | null
  ngay_di: string
  ngay_ve: string | null
  sl_khach: number | null
  created_at: string
}

export interface HoSo {
  id: string
  doan_id: string
  nhansu_id: string
  ngay_dich_vu: string | null
  so_ngay_cong_tac: number | null
  don_gia_ngay: number | null
  so_tien_chi_tra: number | null
  thue_nop: number | null
  chi_tra: number | null
  loai_hop_dong: string | null
  tinh_trang_thanh_toan: string | null
  trang_thai: TrangThaiHoSo
  ngay_duyet: string | null
  nhap_misa: boolean
  anh_cccd_truoc_url: string | null
  anh_cccd_sau_url: string | null
  anh_the_hdv_url: string | null
  anh_xac_nhan_url: string | null
  so_hop_dong: string | null
  file_hop_dong_url: string | null
  amis_document_id: string | null
  ngay_ky: string | null
  created_at: string
}

/** ho_so kèm nhansu đã join — hình dạng trả về từ GET /api/doan/[id] */
export interface HoSoWithNhanSu extends HoSo {
  nhansu: NhanSu
}

/** Trường AI trích xuất được từ ảnh CCCD/thẻ HDV — chờ kế toán xác nhận qua bot */
export interface AiExtractedFields {
  ho_ten?: string
  so_cccd?: string
  ngay_sinh?: string
  ngay_cap?: string
  noi_cap?: string
  dia_chi?: string
  so_the_hdv?: string
  loai_the_hdv?: string
  han_the_hdv?: string
}
