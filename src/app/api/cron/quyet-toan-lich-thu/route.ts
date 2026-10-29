import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notify } from '@/lib/notify'
import { formatDateVN, formatTien } from '@/lib/format'
import { tinhDoanhThuKhach, type QtKhachDieuChinh } from '@/lib/quyetToan'
import { laLoiThieuBang } from '@/lib/quyetToanServer'

// Vercel Cron gọi 1 lần/ngày kèm header "Authorization: Bearer <CRON_SECRET>" (giống cron của ihns.vn).
function isAuthorizedCron(req: NextRequest) {
  return !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

const KETOAN_URL = 'https://ketoan.ihns.vn'
const CRM_URL = 'https://crm.ihns.vn'
const BAO_LAI_SAU_NGAY = 3

type LichThu = { id: string; opportunity_id: string; dot: number; han: string; so_tien: number | null; ty_le: number | null; da_bao_at: string | null }

// Cảnh báo công nợ khách theo lịch thu từng đơn (qt_lich_thu, §10.1): đợt đã quá hạn mà Σ đã thu chưa phủ
// đủ số phải thu lũy kế tới đợt đó → báo kế toán phụ trách + sale phụ trách (assigned_to); báo lại sau 3 ngày.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const homNay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

  const { data: quaHan, error } = await admin.from('qt_lich_thu').select('id, opportunity_id, dot, han, so_tien, ty_le, da_bao_at').lt('han', homNay)
  if (error) {
    if (laLoiThieuBang(error)) return NextResponse.json({ ok: true, skipped: 'migration chưa chạy' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const oppIds = [...new Set(((quaHan ?? []) as LichThu[]).map((l) => l.opportunity_id))]
  if (!oppIds.length) return NextResponse.json({ ok: true, notified: 0 })

  const [lichAll, qts, khach, duChi, thu, opps, doans] = await Promise.all([
    admin.from('qt_lich_thu').select('id, opportunity_id, dot, han, so_tien, ty_le, da_bao_at').in('opportunity_id', oppIds),
    admin.from('qt_quyet_toan').select('opportunity_id, gia_tri_hd, vat_ra_rate, co_vat, ke_toan_id, da_khoa').in('opportunity_id', oppIds),
    admin.from('qt_khach_dieu_chinh').select('opportunity_id, loai, thanh_tien, vat_rate, trang_thai').in('opportunity_id', oppIds),
    admin.from('qt_du_chi_chot').select('opportunity_id, lan, tong_ban').in('opportunity_id', oppIds),
    admin.from('qt_thu_khach').select('opportunity_id, so_tien').in('opportunity_id', oppIds),
    admin.from('opportunities').select('id, title, assigned_to').in('id', oppIds),
    admin.from('doan').select('id, ten_doan, opportunity_id').in('opportunity_id', oppIds).is('deleted_at', null),
  ])

  const by = <T extends { opportunity_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>()
    for (const r of rows ?? []) m.set(r.opportunity_id, [...(m.get(r.opportunity_id) ?? []), r])
    return m
  }
  const lichMap = by((lichAll.data ?? []) as LichThu[])
  const qtMap = new Map(((qts.data ?? []) as { opportunity_id: string; gia_tri_hd: number | null; vat_ra_rate: number; co_vat: boolean; ke_toan_id: string | null }[]).map((q) => [q.opportunity_id, q]))
  const khMap = by((khach.data ?? []) as (QtKhachDieuChinh & { opportunity_id: string })[])
  const dcMap = by((duChi.data ?? []) as { opportunity_id: string; lan: number; tong_ban: number }[])
  const thuMap = by((thu.data ?? []) as { opportunity_id: string; so_tien: number }[])
  const oppMap = new Map(((opps.data ?? []) as { id: string; title: string | null; assigned_to: string | null }[]).map((o) => [o.id, o]))
  const doanMap = new Map(((doans.data ?? []) as { id: string; ten_doan: string; opportunity_id: string }[]).map((d) => [d.opportunity_id, d]))

  const gioiHanBao = Date.now() - BAO_LAI_SAU_NGAY * 86_400_000
  const daBao: string[] = []
  let soTin = 0

  for (const oppId of oppIds) {
    const qt = qtMap.get(oppId) ?? null
    const duChiMoi = (dcMap.get(oppId) ?? []).sort((a, b) => b.lan - a.lan)[0] ?? null
    const dt = tinhDoanhThuKhach(qt, (khMap.get(oppId) ?? []) as QtKhachDieuChinh[], duChiMoi)
    const daThu = (thuMap.get(oppId) ?? []).reduce((s, t) => s + (Number(t.so_tien) || 0), 0)
    const lich = (lichMap.get(oppId) ?? []).sort((a, b) => a.dot - b.dot || a.han.localeCompare(b.han))
    let luyKe = 0
    const canBao: { l: LichThu; thieu: number }[] = []
    for (const l of lich) {
      const phai = l.so_tien != null ? Number(l.so_tien) : Math.round((dt.tongQuyetToan * Number(l.ty_le ?? 0)) / 100)
      luyKe += phai
      if (l.han >= homNay) continue
      const thieu = luyKe - daThu
      if (thieu < 1) continue
      if (l.da_bao_at && Date.parse(l.da_bao_at) > gioiHanBao) continue
      canBao.push({ l, thieu })
    }
    if (!canBao.length) continue

    const opp = oppMap.get(oppId)
    const doan = doanMap.get(oppId)
    const ten = doan?.ten_doan ?? opp?.title ?? 'Đơn'
    const chiTiet = canBao.map(({ l, thieu }) => `Đợt ${l.dot} (hạn ${formatDateVN(l.han)}): còn thiếu ${formatTien(thieu)} đ`).join('; ')
    const title = `Quá hạn thu khách: ${ten}`
    const nguoiNhan: { userId: string; link: string }[] = []
    if (qt?.ke_toan_id) nguoiNhan.push({ userId: qt.ke_toan_id, link: doan ? `${KETOAN_URL}/doan/${doan.id}?tab=quyet-toan` : `${KETOAN_URL}/quyet-toan` })
    if (opp?.assigned_to && opp.assigned_to !== qt?.ke_toan_id) nguoiNhan.push({ userId: opp.assigned_to, link: `${CRM_URL}/don-hang/${oppId}` })
    for (const n of nguoiNhan) {
      const { error: e1 } = await admin.from('notifications').insert({ user_id: n.userId, type: 'quyet_toan', title, body: chiTiet, link: n.link })
      if (e1) await admin.from('notifications').insert({ user_id: n.userId, title, body: chiTiet, link: n.link })
      soTin++
    }
    // Chuông chung của app kế toán (khi đơn chưa gán kế toán phụ trách vẫn có người thấy)
    if (!qt?.ke_toan_id) {
      await notify(admin, { title, body: chiTiet, link: doan ? `/doan/${doan.id}?tab=quyet-toan` : '/quyet-toan' })
      soTin++
    }
    daBao.push(...canBao.map((c) => c.l.id))
  }

  if (daBao.length) await admin.from('qt_lich_thu').update({ da_bao_at: new Date().toISOString() }).in('id', daBao)
  return NextResponse.json({ ok: true, notified: soTin, dot: daBao.length })
}
