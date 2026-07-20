import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { upsertNhanSuFromExtract, createHoSo } from '@/lib/ho-so'
import { getErrorMessage } from '@/lib/errors'
import type { AiExtractedFields, Prefix } from '@/types'

type Ctx = { params: Promise<{ id: string }> }

interface Body {
  prefix: Prefix
  fields: AiExtractedFields
  anh_cccd_truoc_url?: string | null
  anh_cccd_sau_url?: string | null
  anh_the_hdv_url?: string | null
  anh_xac_nhan_url?: string | null
}

/**
 * Bước 2 của luồng "Thêm nhân sự": kế toán đã soát/sửa field ở bước extract xong,
 * bấm Lưu thì tạo/khớp nhansu theo CCCD (upsertNhanSuFromExtract — dùng chung với
 * bot Telegram) rồi tạo dòng ho_so gắn vào đoàn hiện tại, kèm URL ảnh đã upload sẵn
 * ở bước extract (không upload lại).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const body = (await req.json()) as Body

  if (!body.fields?.ho_ten) {
    return NextResponse.json({ error: 'Thiếu họ tên' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const nhansu = await upsertNhanSuFromExtract(supabase, body.fields, body.prefix)

    // Không check trùng CCCD trong toàn bảng nhansu (1 người có thể làm nhiều đoàn),
    // nhưng chặn thêm trùng 2 lần cùng 1 người vào CÙNG 1 đoàn này.
    const { data: existingHoSo } = await supabase
      .from('ho_so')
      .select('id')
      .eq('doan_id', id)
      .eq('nhansu_id', nhansu.id)
      .maybeSingle()
    if (existingHoSo) {
      return NextResponse.json(
        { error: `${nhansu.ho_ten} đã có trong đoàn này rồi, không thêm trùng.` },
        { status: 409 },
      )
    }

    const hoSo = await createHoSo(supabase, {
      doan_id: id,
      nhansu_id: nhansu.id,
      trang_thai: 'da_xac_nhan',
      anh_cccd_truoc_url: body.anh_cccd_truoc_url ?? null,
      anh_cccd_sau_url: body.anh_cccd_sau_url ?? null,
      anh_the_hdv_url: body.anh_the_hdv_url ?? null,
      anh_xac_nhan_url: body.anh_xac_nhan_url ?? null,
    })
    return NextResponse.json({ ho_so: hoSo })
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
