import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { buildMergeData, mergeDocxTemplate, buildContractFileName } from '@/lib/docx-merge'
import { uploadGeneratedContract } from '@/lib/storage'
import { getErrorMessage } from '@/lib/errors'
import type { Doan, HoSoWithNhanSu, HopDongTemplate } from '@/types'

type Ctx = { params: Promise<{ id: string }> }

// loai_nhan_su <-> hop_dong_templates giờ là nhiều-nhiều (1 loại nhân sự có
// thể gán nhiều mẫu HĐ, vd theo mức lương) — select riêng id qua bảng nối ở
// đây (không cần flatten đủ như GET /api/loai-nhan-su vì chỉ dùng để so
// khớp id, không hiển thị tên).
const HO_SO_SELECT = '*, nhansu:nhansu_id(*, loai_nhan_su:loai_nhan_su_id(*, mau_hop_dong_links:loai_nhan_su_mau_hop_dong(mau_hop_dong_id)))'

export async function POST(req: NextRequest, ctx: Ctx) {
  const { unauthorized } = await requireUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const supabase = await createClient()

  const body = await req.json().catch(() => ({}))
  const templateId = (body as { template_id?: string })?.template_id

  const { data: hoSo, error: hoSoErr } = await supabase
    .from('ho_so')
    .select(HO_SO_SELECT)
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
  const loaiNhanSu = (hoSo as HoSoWithNhanSu).nhansu.loai_nhan_su as
    | (HoSoWithNhanSu['nhansu']['loai_nhan_su'] & { mau_hop_dong_links?: { mau_hop_dong_id: string }[] })
    | undefined
  const ma = loaiNhanSu?.ma ?? ''
  const linkedIds = (loaiNhanSu?.mau_hop_dong_links ?? []).map((x) => x.mau_hop_dong_id)
  const template =
    (templateId ? templateList.find((t) => t.id === templateId) : undefined) ??
    // Chỉ tự áp khi loại nhân sự này gán ĐÚNG 1 mẫu — gán nhiều mẫu (vd theo
    // mức lương/mùa) thì không đoán được mẫu nào đúng, để kế toán tự chọn
    // qua picker "template_id" khi xuất (ưu tiên ở dòng trên). Rơi về cách
    // khớp CHUỖI cũ (hop_dong_templates.loai so với ma) khi không gán mẫu
    // nào trực tiếp hoặc gán từ 2 mẫu trở lên.
    (linkedIds.length === 1 ? templateList.find((t) => t.id === linkedIds[0]) : undefined) ??
    templateList.find((t) => t.loai?.toLowerCase() === ma.toLowerCase()) ??
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
      .select(HO_SO_SELECT)
      .single()
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const fileName = buildContractFileName(doan as Doan, hoSo as HoSoWithNhanSu)
    const { error: fileErr } = await supabase
      .from('ho_so_hop_dong_files')
      .insert({ ho_so_id: id, file_url: fileUrl, file_name: fileName })
    if (fileErr) return NextResponse.json({ error: fileErr.message }, { status: 500 })

    return NextResponse.json({ ho_so: updated })
  } catch (e) {
    return NextResponse.json({ error: `Lỗi khi tạo hợp đồng: ${getErrorMessage(e)}` }, { status: 500 })
  }
}
