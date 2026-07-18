import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string; fileId: string }> }

/** Proxy tải file hợp đồng qua chính domain của app — bắt buộc phải làm vậy vì
 *  Content-Disposition (tên file đẹp có dấu) không áp dụng được với link
 *  cross-origin thẳng tới Supabase Storage (trình duyệt bỏ qua thuộc tính
 *  download với URL khác origin). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { fileId } = await ctx.params

  const supabase = await createClient()
  const { data: fileRow, error } = await supabase
    .from('ho_so_hop_dong_files')
    .select('*')
    .eq('id', fileId)
    .single()
  if (error || !fileRow) return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 })

  const fileRes = await fetch(fileRow.file_url)
  if (!fileRes.ok) return NextResponse.json({ error: 'Không tải được file' }, { status: 502 })

  const fileName = fileRow.file_name ?? 'hop-dong.docx'
  return new NextResponse(fileRes.body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
