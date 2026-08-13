import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'

// POST { name, phone?, email?, company?, tax_code?, dia_chi?, note? } — tạo
// 1 liên hệ CRM mới (bảng contacts, cùng Supabase project) để gán làm
// "Người phụ trách" cho 1 mã khách VMB — đủ để nhập luôn cả khối "Xuất hóa
// đơn VAT" (MST/tên cty/địa chỉ/email) hay gặp trong tin TKT Telegram, khỏi
// phải gõ 2 lần.
//
// Trước khi tạo, dò trùng theo SĐT (so khớp sau khi trim) — nếu đã có sẵn
// liên hệ dùng đúng SĐT đó thì KHÔNG tạo thêm bản ghi mới (các field gõ vào
// lần này SẼ BỊ BỎ QUA, không ghi đè lên liên hệ có sẵn), trả về luôn liên
// hệ có sẵn kèm duplicate:true để UI báo cho kế toán biết.
//
// dia_chi KHÔNG lưu ở route này — vmb_khach_hang.dia_chi được ghi trực tiếp
// ở route /api/ve-may-bay/vmb-khach-hang (đọc nhanh, không join, theo yêu
// cầu 2026-08-13). Route NÀY chỉ lo phần "cập nhật 2 nơi": nếu có company,
// tự tìm-hoặc-tạo 1 organizations bên CRM (tìm theo tax_code, hết tax_code
// mới tìm theo tên) rồi ghi luôn dia_chi vào organizations.address, để dữ
// liệu CRM không bị lệch với ketoan — giống hệt cách hns-crm/lien-he tự làm
// khi tạo liên hệ mới.
export async function POST(req: NextRequest) {
  const { user, unauthorized } = await requireUser()
  if (unauthorized) return unauthorized

  const { name, phone, email, company, tax_code, dia_chi, note } = await req.json().catch(() => ({}))
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Thiếu họ tên' }, { status: 400 })
  }
  const phoneTrimmed = phone ? String(phone).trim() : ''
  const companyTrimmed = company ? String(company).trim() : ''
  const taxCodeTrimmed = tax_code ? String(tax_code).trim() : ''
  const diaChiTrimmed = dia_chi ? String(dia_chi).trim() : ''

  const admin = createAdminClient()

  if (phoneTrimmed) {
    const { data: existing } = await admin
      .from('contacts')
      .select('id, name, phone, email, company, tax_code, source, note')
      .eq('phone', phoneTrimmed)
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ contact: existing, duplicate: true })
    }
  }

  let orgId: string | null = null
  if (companyTrimmed) {
    const orgQuery = taxCodeTrimmed
      ? admin.from('organizations').select('id, contact_ids, primary_contact_id, address').eq('tax_code', taxCodeTrimmed).limit(1)
      : admin.from('organizations').select('id, contact_ids, primary_contact_id, address').ilike('name', companyTrimmed).limit(1)
    const { data: foundOrgs } = await orgQuery
    const foundOrg = foundOrgs?.[0] as { id: string; contact_ids: string[]; primary_contact_id: string | null; address: string | null } | undefined
    if (foundOrg) {
      orgId = foundOrg.id
      if (diaChiTrimmed && diaChiTrimmed !== foundOrg.address) {
        await admin.from('organizations').update({ address: diaChiTrimmed }).eq('id', orgId)
      }
    } else {
      const { data: newOrg } = await admin
        .from('organizations')
        .insert({
          name: companyTrimmed,
          tax_code: taxCodeTrimmed || null,
          type: 'company',
          address: diaChiTrimmed || null,
          contact_ids: [],
          created_by: user.id,
        })
        .select('id')
        .single()
      orgId = newOrg?.id ?? null
    }
  }

  const { data: created, error } = await admin
    .from('contacts')
    .insert({
      name: String(name).trim(),
      phone: phoneTrimmed || null,
      email: email ? String(email).trim() : null,
      company: companyTrimmed || null,
      tax_code: taxCodeTrimmed || null,
      note: note ? String(note).trim() : null,
      source: 'sale',
      organization_ids: orgId ? [orgId] : [],
      created_by: user.id,
    })
    .select('id, name, phone, email, company, tax_code, source, note')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (orgId) {
    const { data: org } = await admin.from('organizations').select('contact_ids, primary_contact_id').eq('id', orgId).single()
    if (org) {
      await admin
        .from('organizations')
        .update({
          contact_ids: [...(org.contact_ids ?? []), created.id],
          ...(org.primary_contact_id ? {} : { primary_contact_id: created.id }),
        })
        .eq('id', orgId)
    }
  }

  return NextResponse.json({ contact: created, duplicate: false })
}
