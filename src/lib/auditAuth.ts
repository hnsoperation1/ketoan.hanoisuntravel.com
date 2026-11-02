import { APP_ID } from '@/lib/supabase/appId'

// Ghi đăng nhập / đăng xuất / đăng nhập sai vào nhật ký hoạt động (rpc log_auth_event, migration 20261148). Gọi với client Supabase
// đang có phiên (login: ngay sau khi đăng nhập; logout: TRƯỚC khi signOut); login_failed gọi khi chưa có phiên, kèm email.
// Không bao giờ ném lỗi — chưa chạy migration / lỗi mạng thì bỏ qua, không ảnh hưởng đăng nhập.
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<unknown> }

export async function logAuthEvent(
  supabase: RpcClient,
  action: 'login' | 'logout' | 'login_failed',
  opts: { email?: string | null; method?: string | null } = {},
): Promise<void> {
  try {
    await supabase.rpc('log_auth_event', {
      p_app: APP_ID,
      p_action: action,
      p_email: opts.email ?? null,
      p_method: opts.method ?? null,
    })
  } catch {
    /* bỏ qua */
  }
}
