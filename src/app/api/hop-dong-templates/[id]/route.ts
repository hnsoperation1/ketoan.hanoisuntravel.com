import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { uploadTemplateFile } from '@/lib/storage'
import { slugifyFileName } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const supabase = await createClient()
  const { error } = await supabase.from('hop_dong_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Chưa chọn file biểu mẫu' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Chỉ nhận file .docx' }, { status: 400 })
    }

    try {
      const bytes = Buffer.from(await file.arrayBuffer())
      const path = `${Date.now()}-${slugifyFileName(file.name)}`
      const fileUrl = await uploadTemplateFile(
        path,
        bytes,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('hop_dong_templates')
        .update({ file_url: fileUrl, file_name: file.name })
        .eq('id', id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ template: data })
    } catch (error) {
      return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
    }
  }

  const body = await req.json()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hop_dong_templates')
    .update(body)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}
