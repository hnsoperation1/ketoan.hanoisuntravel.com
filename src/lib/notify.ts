import type { SupabaseClient } from '@supabase/supabase-js'

/** Tạo 1 thông báo cho kế toán (hiện chuông trên topbar). Chỉ gọi bằng admin client
 *  (service role) — bảng notifications không cấp quyền ghi cho authenticated. */
export async function notify(
  supabase: SupabaseClient,
  input: { title: string; body?: string; link?: string },
) {
  await supabase.from('notifications').insert({
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  })
}
