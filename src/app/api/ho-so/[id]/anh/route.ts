import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { uploadHoSoImage } from '@/lib/storage'
import { getErrorMessage } from '@/lib/errors'

type Ctx = { params: Promise<{ id: string }> }

const ALLOWED_FIELDS = ['anh_cccd_truoc_url', 'anh_cccd_sau_url', 'anh_the_hdv_url', 'anh_xac_nhan_url'] as const
type AllowedField = (typeof ALLOWED_FIELDS)[number]

export async function POST(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const field = formData.get('field') as string | null

  if (!file || !field || !ALLOWED_FIELDS.includes(field as AllowedField)) {
    return NextResponse.json({ error: 'Thiếu file hoặc loại ảnh không hợp lệ' }, { status: 400 })
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const path = `manual/${id}-${field}-${Date.now()}.${ext}`
    const url = await uploadHoSoImage(path, bytes, contentType)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ho_so')
      .update({ [field]: url })
      .eq('id', id)
      .select('*, nhansu:nhansu_id(*)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ho_so: data })
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
