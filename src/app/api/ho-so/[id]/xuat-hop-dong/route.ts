import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { buildMergeData, mergeDocxTemplate, buildContractFileName } from '@/lib/docx-merge'
import { uploadGeneratedContract } from '@/lib/storage'
import { getErrorMessage } from '@/lib/errors'
import type { Doan, HoSoWithNhanSu, HopDongTemplate } from '@/types'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const supabase = await createClient()

  const body = await req.json().catch(() => ({}))
  const templateId = (body as { template_id?: string })?.template_id

  const { data: hoSo, error: hoSoErr } = await supabase
    .from('ho_so')
    .select('*, nhansu:nhansu_id(*)')
    .eq('id', id)
    .single()
  if (hoSoErr || !hoSo) return NextResponse.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 })

  const { data: doan, error: doanErr } = await supabase.from('doan').select('*').eq('id', hoSo.doan_id).single()
  if (doanErr || !doan) return NextResponse.json({ error: 'Không tìm thấy đoàn' }, { status: 404 })

  const { data: templates } = await supabase
    .from('hop_dong_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const templateList = (templates ?? []) as HopDongTemplate[]
  const prefix = (hoSo as HoSoWithNhanSu).nhansu.prefix
  const template =
    (templateId ? templateList.find((t) => t.id === templateId) : undefined) ??
    templateList.find((t) => t.loai?.toLowerCase() === prefix.toLowerCase()) ??
    templateList[0]

  if (!template) {
    return NextResponse.json(
      { error: 'Chưa có biểu mẫu hợp đồng nào — vào "Biểu mẫu hợp đồng" để tải lên trước.' },
      { status: 400 },
    )
  }

  try {
    const templateRes = await fetch(template.file_url)
    if (!templateRes.ok) throw new Error('Không tải được file biểu mẫu')
    const templateBytes = Buffer.from(await templateRes.arrayBuffer())

    const mergeData = buildMergeData(doan as Doan, hoSo as HoSoWithNhanSu)
    const outputBytes = mergeDocxTemplate(templateBytes, mergeData)

    const fileUrl = await uploadGeneratedContract(
      `${id}-${Date.now()}.docx`,
      outputBytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )

    const { data: updated, error: updateErr } = await supabase
      .from('ho_so')
      .update({ file_hop_dong_url: fileUrl })
      .eq('id', id)
      .select('*, nhansu:nhansu_id(*)')
      .single()
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const fileName = buildContractFileName(doan as Doan, hoSo as HoSoWithNhanSu)
    await supabase.from('ho_so_hop_dong_files').insert({ ho_so_id: id, file_url: fileUrl, file_name: fileName })

    return NextResponse.json({ ho_so: updated })
  } catch (e) {
    return NextResponse.json({ error: `Lỗi khi tạo hợp đồng: ${getErrorMessage(e)}` }, { status: 500 })
  }
}
