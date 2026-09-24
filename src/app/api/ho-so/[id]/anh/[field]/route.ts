import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createHoSoImageViewUrl } from '@/lib/storage'
import { getErrorMessage } from '@/lib/errors'

const IMAGE_FIELDS = [
  'anh_cccd_truoc_url',
  'anh_cccd_sau_url',
  'anh_the_hdv_url',
  'anh_xac_nhan_url',
] as const

type ImageField = (typeof IMAGE_FIELDS)[number]
type Ctx = { params: Promise<{ id: string; field: string }> }

/**
 * Ký lại URL ảnh private mỗi lần trình duyệt cần xem. DB cũ lưu signed URL
 * chỉ sống 7 ngày; route này lấy path ra từ cả URL đã hết hạn rồi tạo URL mới.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { id, field } = await ctx.params
  if (!IMAGE_FIELDS.includes(field as ImageField)) {
    return NextResponse.json({ error: 'Loại ảnh không hợp lệ' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ho_so')
    .select(field)
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 })
  }

  const storedValue = (data as unknown as Record<string, string | null>)[field]
  if (!storedValue) {
    return NextResponse.json({ error: 'Hồ sơ chưa có ảnh này' }, { status: 404 })
  }

  try {
    const signedUrl = await createHoSoImageViewUrl(storedValue)
    return NextResponse.redirect(signedUrl, {
      status: 307,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
