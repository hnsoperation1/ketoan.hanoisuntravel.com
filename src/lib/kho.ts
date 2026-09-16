import type { SupabaseClient } from '@supabase/supabase-js'

// So khớp tên không phân biệt hoa/thường, dấu, khoảng trắng thừa — để LLM
// gõ "kho hà nội" hay "Kho Hà Nội " đều khớp cùng 1 kho.
function normalizeVN(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export interface KhoRow {
  id: string
  ten_kho: string
}

export interface VatPhamRow {
  id: string
  ten: string
  don_vi: string
}

export async function listKhoNames(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('kho').select('ten_kho').order('ten_kho')
  return (data ?? []).map((k) => k.ten_kho)
}

export async function listVatPhamNames(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('vat_pham').select('ten').order('ten')
  return (data ?? []).map((v) => v.ten)
}

/** Không tự tạo kho mới — chỉ có 3 kho cố định, kế toán khai báo trước qua dashboard. */
export async function resolveKho(supabase: SupabaseClient, ten: string): Promise<KhoRow | null> {
  const target = normalizeVN(ten)
  const { data } = await supabase.from('kho').select('id, ten_kho')
  return (data ?? []).find((k) => normalizeVN(k.ten_kho) === target) ?? null
}

/** Vật phẩm thì ngược lại — cho tạo mới tự do, danh mục "bàn sau" theo đúng yêu cầu, không chặn thủ kho khi gặp món mới. */
export async function resolveOrCreateVatPham(supabase: SupabaseClient, ten: string): Promise<VatPhamRow> {
  const target = normalizeVN(ten)
  const { data: existing } = await supabase.from('vat_pham').select('id, ten, don_vi')
  const found = (existing ?? []).find((v) => normalizeVN(v.ten) === target)
  if (found) return found

  const { data: created, error } = await supabase.from('vat_pham').insert({ ten }).select('id, ten, don_vi').single()
  if (error) throw error
  return created
}
