import { cookies, headers } from 'next/headers'
import { APP_ID } from './appId'

// NHẬT KÝ HOẠT ĐỘNG (migration 20261148): mọi request từ SERVER tới Supabase kèm
// - x-app: app nào;
// - x-actor-id: ai đang thao tác (đọc từ cookie đăng nhập / Bearer của request) — để trigger audit_log_trigger biết người làm khi
//   server ghi bằng service role thay người dùng (DB chỉ tin header này với service role, người dùng thường không giả được);
// - x-client-ip / x-client-ua: IP, thiết bị thật của người dùng thay vì của máy chủ.
// Ngoài request (cron không cookie đăng nhập, script) thì không có người làm → DB không ghi nhật ký.
// Bản sao ở ihns.vn / crm / ketoan / chamcong / operation (src/lib/supabase/audit.ts) — chỉ khác APP_ID + tên cookie.
// ketoan dùng tên cookie mặc định của @supabase/ssr: sb-<mã project>-auth-token
const AUTH_COOKIE = (() => {
  try {
    return `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0]}-auth-token`
  } catch {
    return 'sb-auth-token'
  }
})()

function jwtSub(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sub?: unknown }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

async function actorId(h: Headers): Promise<string | null> {
  const bearer = h.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (bearer) return jwtSub(bearer)
  // Cookie phiên @supabase/ssr: "base64-" + JSON phiên (access_token), quá dài thì chia <tên>.0, <tên>.1…
  const all = (await cookies()).getAll()
  const chunks = all
    .filter((c) => c.name.startsWith(`${AUTH_COOKIE}.`))
    .sort((a, b) => Number(a.name.slice(AUTH_COOKIE.length + 1)) - Number(b.name.slice(AUTH_COOKIE.length + 1)))
  let raw = chunks.length ? chunks.map((c) => c.value).join('') : (all.find((c) => c.name === AUTH_COOKIE)?.value ?? '')
  if (!raw) return null
  try {
    raw = raw.startsWith('base64-') ? Buffer.from(raw.slice(7), 'base64url').toString('utf8') : decodeURIComponent(raw)
    const session = JSON.parse(raw) as { access_token?: string } | string[]
    const token = Array.isArray(session) ? session[0] : session.access_token
    return token ? jwtSub(token) : null
  } catch {
    return null
  }
}

export async function auditFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const extra: Record<string, string> = { 'x-app': APP_ID }
  try {
    const h = await headers()
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || ''
    if (ip) extra['x-client-ip'] = ip
    const ua = h.get('user-agent')
    if (ua) extra['x-client-ua'] = ua.slice(0, 300)
    const actor = await actorId(h)
    if (actor) extra['x-actor-id'] = actor
  } catch {
    /* ngoài request (script / build) — chỉ gửi x-app */
  }
  const merged = new Headers(init?.headers)
  for (const [k, v] of Object.entries(extra)) {
    try {
      if (!merged.has(k)) merged.set(k, v)
    } catch {
      /* giá trị header không hợp lệ → bỏ */
    }
  }
  return fetch(input, { ...init, headers: merged })
}
