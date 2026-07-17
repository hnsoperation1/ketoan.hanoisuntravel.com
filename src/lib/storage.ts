import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'ho-so-hdv'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 ngày

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
