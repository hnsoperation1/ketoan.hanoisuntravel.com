import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { uploadTemplateFile } from '@/lib/storage'
import { slugifyFileName } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hop_dong_templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data })
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const ten = (formData.get('ten') as string | null)?.trim()
  const loai = (formData.get('loai') as string | null)?.trim() || null

  if (!file || !ten) {
    return NextResponse.json({ error: 'Thiếu tên biểu mẫu hoặc file' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return NextResponse.json({ error: 'Chỉ nhận file .docx' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const path = `${Date.now()}-${slugifyFileName(file.name)}`

  try {
    const fileUrl = await uploadTemplateFile(
      path,
      bytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('hop_dong_templates')
      .insert({ ten, loai, file_url: fileUrl, file_name: file.name })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ template: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
