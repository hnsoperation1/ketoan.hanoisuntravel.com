/** Rút message người đọc được từ lỗi bắt trong catch — không chỉ Error thật mà cả
 *  lỗi Supabase (PostgrestError là object thường có .message, không phải Error
 *  instance, nên `String(e)` sẽ ra "[object Object]" thay vì nội dung lỗi thật). */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return String(e)
}
