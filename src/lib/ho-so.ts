import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiExtractedFields, NhanSu, Prefix } from '@/types'

/**
 * Upsert nhansu theo so_cccd (nếu trùng CCCD với người đã có từ đoàn khác thì
 * cập nhật lại thông tin mới nhất thay vì tạo trùng). Dùng chung cho cả API
 * dashboard và Telegram webhook — nhận `supabase` làm tham số để mỗi nơi gọi
 * với client phù hợp (server session hoặc admin/service-role).
 */
export async function upsertNhanSuFromExtract(
  supabase: SupabaseClient,
  fields: AiExtractedFields,
  prefix: Prefix,
): Promise<NhanSu> {
  const payload = {
    prefix,
    ho_ten: fields.ho_ten ?? '',
    so_cccd: fields.so_cccd ?? null,
    ngay_sinh: fields.ngay_sinh ?? null,
    ngay_cap: fields.ngay_cap ?? null,
    noi_cap: fields.noi_cap ?? null,
    dia_chi: fields.dia_chi ?? null,
    so_the_hdv: fields.so_the_hdv ?? null,
    loai_the_hdv: fields.loai_the_hdv ?? null,
    han_the_hdv: fields.han_the_hdv ?? null,
  }

  if (payload.so_cccd) {
    const { data: existing } = await supabase
      .from('nhansu')
      .select('id')
      .eq('so_cccd', payload.so_cccd)
      .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('nhansu')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) throw error
      return data as NhanSu
    }
  }

  const { data, error } = await supabase.from('nhansu').insert(payload).select('*').single()
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
  const { data, error } = await supabase.from('ho_so').insert(input).select('*, nhansu:nhansu_id(*)').single()
  if (error) throw error
  return data
}
