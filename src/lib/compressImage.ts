// Nén ảnh NGAY TRÊN TRÌNH DUYỆT trước khi gửi lên API (2026-10-20): Vercel chỉ nhận body tối đa ~4,5MB/lần gọi — ảnh chụp
// điện thoại gửi nguyên bản bị chặn FUNCTION_PAYLOAD_TOO_LARGE (413). Thu cạnh dài về tối đa `maxSide` px, xuất JPEG; vẫn
// đủ nét để AI đọc CCCD / thẻ HDV. Ảnh vốn đã nhỏ thì giữ nguyên.
export async function compressImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 600 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file // trình duyệt không đọc được định dạng (vd HEIC) → gửi nguyên
  }
}

// Giới hạn tổng dung lượng 1 lần gửi (chừa phần cho dữ liệu form)
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
