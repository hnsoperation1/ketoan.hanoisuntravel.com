import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiExtractedFields, NhanSu } from '@/types'
import { deriveTinhTp } from '@/lib/format'

/**
 * Upsert nhansu theo so_cccd (nếu trùng CCCD với người đã có từ đoàn khác thì
 * cập nhật lại thông tin mới nhất thay vì tạo trùng). Dùng chung cho cả API
 * dashboard và Telegram webhook — nhận `supabase` làm tham số để mỗi nơi gọi
 * với client phù hợp (server session hoặc admin/service-role).
 *
 * `loaiNhanSuId` bỏ trống thì không đụng tới field này khi update người đã có sẵn
 * (giữ nguyên phân loại cũ), còn khi tạo mới thì để cột `nhansu.loai_nhan_su_id`
 * tự áp default (loại "HDV") ở DB.
 */
export async function upsertNhanSuFromExtract(
  supabase: SupabaseClient,
  fields: AiExtractedFields,
  loaiNhanSuId?: string,
): Promise<NhanSu> {
  const insertPayload: Record<string, unknown> = {
    ho_ten: fields.ho_ten ?? '',
    so_cccd: fields.so_cccd ?? null,
    ngay_sinh: fields.ngay_sinh ?? null,
    ngay_cap: fields.ngay_cap ?? null,
    noi_cap: fields.noi_cap ?? null,
    dia_chi: fields.dia_chi ?? null,
    tinh_tp: fields.tinh_tp || deriveTinhTp(fields.dia_chi) || null,
    so_the_hdv: fields.so_the_hdv ?? null,
    loai_the_hdv: fields.loai_the_hdv ?? null,
    han_the_hdv: fields.han_the_hdv ?? null,
    sdt: fields.sdt ?? null,
    ma_so_thue_tncn: fields.ma_so_thue_tncn ?? null,
    stk: fields.stk ?? null,
    ten_ngan_hang: fields.ten_ngan_hang ?? null,
    email: fields.email ?? null,
  }
  if (loaiNhanSuId) insertPayload.loai_nhan_su_id = loaiNhanSuId

  if (insertPayload.so_cccd) {
    const { data: existing } = await supabase
      .from('nhansu')
      .select('id')
      .eq('so_cccd', insertPayload.so_cccd)
      .maybeSingle()

    if (existing) {
      // Chỉ ghi đè field nào lần này AI/kế toán thực sự có giá trị mới — tránh
      // trường hợp bộ ảnh lần này thiếu (vd không có ảnh xác nhận) làm mất STK/SĐT đã lưu trước đó.
      const updatePayload = Object.fromEntries(
        Object.entries(insertPayload).filter(([, v]) => v != null && v !== ''),
      )
      const { data, error } = await supabase
        .from('nhansu')
        .update(updatePayload)
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) throw error
      return data as NhanSu
    }
  }

  const { data, error } = await supabase.from('nhansu').insert(insertPayload).select('*').single()
  if (error) throw error
  return data as NhanSu
}

export interface NewHoSoInput {
  doan_id: string
  nhansu_id: string
  trang_thai: string
  anh_cccd_truoc_url?: string | null
  anh_cccd_sau_url?: string | null
  anh_the_hdv_url?: string | null
  anh_xac_nhan_url?: string | null
}

export async function createHoSo(supabase: SupabaseClient, input: NewHoSoInput) {
  const { data, error } = await supabase
    .from('ho_so')
    .insert(input)
    .select('*, nhansu:nhansu_id(*, loai_nhan_su:loai_nhan_su_id(*))')
    .single()
  if (error) throw error
  return data
}
