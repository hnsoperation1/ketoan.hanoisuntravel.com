import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'ho-so-hdv'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 ngày
const VIEW_SIGNED_URL_TTL_SECONDS = 60 * 10 // URL xem được ký mới theo từng lần mở hồ sơ

/**
 * Các bản ghi cũ đã lưu nguyên signed URL 7 ngày vào DB. Dù token đã hết hạn,
 * phần path nằm trước query string vẫn dùng được để ký lại URL mới mà không
 * cần upload lại ảnh.
 */
export function getHoSoImagePath(storedValue: string): string | null {
  const marker = `/object/sign/${BUCKET}/`
  const markerIndex = storedValue.indexOf(marker)
  if (markerIndex >= 0) {
    return decodeURIComponent(storedValue.slice(markerIndex + marker.length).split('?')[0])
  }

  // Chấp nhận path trần cho dữ liệu mới nếu sau này DB ngừng lưu signed URL.
  if (!storedValue.includes('://') && !storedValue.startsWith('/')) return storedValue
  return null
}

export async function createHoSoImageViewUrl(storedValue: string): Promise<string> {
  const path = getHoSoImagePath(storedValue)
  if (!path) throw new Error('Không xác định được đường dẫn ảnh hồ sơ')

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, VIEW_SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  return data.signedUrl
}

/**
 * Upload ảnh CCCD/thẻ HDV vào bucket private, trả về signed URL có hạn.
 * Bucket private có chủ đích (khác hns-crm dùng bucket public) vì CCCD là dữ liệu nhạy cảm.
 */
export async function uploadHoSoImage(
  path: string,
  bytes: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  })
  if (error) throw error

  const { data, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signError) throw signError
  return data.signedUrl
}

const TEMPLATE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 // 1 năm — biểu mẫu ít đổi, không cần refresh liên tục như ảnh CCCD

/** Upload file biểu mẫu hợp đồng (.docx) vào cùng bucket, dưới tiền tố templates/. */
export async function uploadTemplateFile(
  path: string,
  bytes: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).upload(`templates/${path}`, bytes, {
    contentType,
    upsert: true,
  })
  if (error) throw error

  const { data, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(`templates/${path}`, TEMPLATE_SIGNED_URL_TTL_SECONDS)
  if (signError) throw signError
  return data.signedUrl
}

/** Upload hợp đồng .docx đã merge dữ liệu, dưới tiền tố hop-dong/. */
export async function uploadGeneratedContract(
  path: string,
  bytes: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(BUCKET).upload(`hop-dong/${path}`, bytes, {
    contentType,
    upsert: true,
  })
  if (error) throw error

  const { data, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(`hop-dong/${path}`, TEMPLATE_SIGNED_URL_TTL_SECONDS)
  if (signError) throw signError
  return data.signedUrl
}

/**
 * Xoá 1 file hợp đồng đã tạo khỏi storage — nhận thẳng signed URL đã lưu ở
 * ho_so_hop_dong_files.file_url, tự tách lại path (`hop-dong/...`) từ URL vì
 * không lưu path trần riêng ở đâu khác.
 */
export async function deleteGeneratedContract(fileUrl: string): Promise<void> {
  const marker = `/object/sign/${BUCKET}/`
  const i = fileUrl.indexOf(marker)
  if (i === -1) return
  const path = decodeURIComponent(fileUrl.slice(i + marker.length).split('?')[0])
  const admin = createAdminClient()
  await admin.storage.from(BUCKET).remove([path])
}
