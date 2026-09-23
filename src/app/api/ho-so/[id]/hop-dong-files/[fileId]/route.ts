import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminUser } from '@/lib/auth'
import { deleteGeneratedContract } from '@/lib/storage'

type Ctx = { params: Promise<{ id: string; fileId: string }> }

// Chỉ super admin mới xoá được — khớp với việc chỉ super admin mới thấy được
// lịch sử file hợp đồng (kế toán thường chỉ xem file mới nhất, không có gì
// để xoá) ở doan/[id]/page.tsx.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireSuperAdminUser()
  if (unauthorized) return unauthorized
  const { fileId } = await ctx.params

  const supabase = await createClient()
  const { data: fileRow, error: fetchErr } = await supabase
    .from('ho_so_hop_dong_files')
    .select('*')
    .eq('id', fileId)
    .single()
  if (fetchErr || !fileRow) return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 })

  const { error: deleteErr } = await supabase.from('ho_so_hop_dong_files').delete().eq('id', fileId)
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  await deleteGeneratedContract(fileRow.file_url)

  return NextResponse.json({ ok: true })
}
