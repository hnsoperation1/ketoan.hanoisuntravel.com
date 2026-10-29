import { NextRequest, NextResponse } from 'next/server'
import { requireScreen } from '@/lib/auth'
import {
  QtError,
  adminClient,
  chk,
  coQuyenKhoaSo,
  damBaoQt,
  docBody,
  ghiLichSu,
  kiemTraDon,
  loiResponse,
  taiDuLieuTinh,
} from '@/lib/quyetToanServer'
import { soChotTuKetQua, tinhTuDuLieu, tyLeCuaDon } from '@/lib/quyetToanBundle'

type Ctx = { params: Promise<{ oppId: string }> }

// POST { action, ... } — các nút trạng thái của kế toán (đặc tả §6):
//   nhan_du_chi {du_chi_id} | tra_lai_du_chi {du_chi_id, ly_do}
//   duyet | tra_lai {ly_do}
//   dong_y_mo_lai {phan: 'chi_phi'|'khach'} | tu_choi_mo_lai {phan, ly_do?}
//   khoa_so | mo_khoa {ly_do}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { user, unauthorized } = await requireScreen('kt-quyet-toan')
  if (unauthorized) return unauthorized
  const uid = user!.id
  const { oppId } = await ctx.params
  const admin = adminClient()
  try {
    await kiemTraDon(admin, oppId)
    const body = await docBody(req)
    const action = String(body.action ?? '')
    const lyDo = typeof body.ly_do === 'string' ? body.ly_do.trim() : ''
    const now = new Date().toISOString()

    if (action === 'nhan_du_chi' || action === 'tra_lai_du_chi') {
      const id = String(body.du_chi_id ?? '')
      const dc = chk(await admin.from('qt_du_chi_chot').select('id, lan').eq('id', id).eq('opportunity_id', oppId).maybeSingle()) as { id: string; lan: number } | null
      if (!dc) throw new QtError('Không tìm thấy lần gửi dự chi', 404)
      if (action === 'tra_lai_du_chi' && !lyDo) throw new QtError('Cần nhập lý do trả lại')
      const patch = action === 'nhan_du_chi'
        ? { ke_toan_nhan_at: now, ke_toan_nhan_by: uid, ly_do_tra_lai: null }
        : { ke_toan_nhan_at: null, ke_toan_nhan_by: null, ly_do_tra_lai: lyDo }
      chk(await admin.from('qt_du_chi_chot').update(patch).eq('id', id))
      await ghiLichSu(admin, oppId, uid, action, lyDo || null, { lan: dc.lan })
      return NextResponse.json({ ok: true })
    }

    const qt = await damBaoQt(admin, oppId)

    if (action === 'duyet') {
      if (qt.da_khoa) throw new QtError('Quyết toán đã khoá sổ')
      const rows = chk(await admin.from('qt_quyet_toan')
        .update({ chi_phi_trang_thai: 'ke_toan_duyet', duyet_at: now, duyet_by: uid, ly_do_tra_lai: null })
        .eq('opportunity_id', oppId).eq('chi_phi_trang_thai', 'cho_ke_toan').eq('da_khoa', false).select('opportunity_id')) as unknown[]
      if (!rows.length) throw new QtError('Chỉ duyệt được khi điều hành đã gửi quyết toán (Chờ kế toán)')
      await ghiLichSu(admin, oppId, uid, 'duyet', null, { lan: qt.lan_gui })
      return NextResponse.json({ ok: true })
    }

    if (action === 'tra_lai') {
      if (!lyDo) throw new QtError('Cần nhập lý do trả lại')
      if (qt.da_khoa) throw new QtError('Quyết toán đã khoá sổ, mở khoá trước')
      const rows = chk(await admin.from('qt_quyet_toan')
        .update({ chi_phi_trang_thai: 'dang_lam', ly_do_tra_lai: lyDo, duyet_at: null, duyet_by: null, chi_phi_xin_mo_lai: null })
        .eq('opportunity_id', oppId).in('chi_phi_trang_thai', ['cho_ke_toan', 'ke_toan_duyet']).eq('da_khoa', false).select('opportunity_id')) as unknown[]
      if (!rows.length) throw new QtError('Quyết toán chưa gửi kế toán')
      await ghiLichSu(admin, oppId, uid, 'tra_lai', lyDo, { lan: qt.lan_gui })
      return NextResponse.json({ ok: true })
    }

    if (action === 'dong_y_mo_lai' || action === 'tu_choi_mo_lai') {
      const phan = body.phan === 'khach' ? 'khach' : body.phan === 'chi_phi' ? 'chi_phi' : null
      if (!phan) throw new QtError('Phần không hợp lệ')
      if (qt.da_khoa) throw new QtError('Quyết toán đã khoá sổ, mở khoá trước')
      const yeuCau = phan === 'chi_phi' ? qt.chi_phi_xin_mo_lai : qt.khach_xin_mo_lai
      if (!yeuCau) throw new QtError('Không có yêu cầu mở lại')
      let patch: Record<string, unknown>
      if (action === 'tu_choi_mo_lai') patch = phan === 'chi_phi' ? { chi_phi_xin_mo_lai: null } : { khach_xin_mo_lai: null }
      else if (phan === 'chi_phi') patch = { chi_phi_trang_thai: 'dang_lam', chi_phi_xin_mo_lai: null, duyet_at: null, duyet_by: null }
      else patch = { khach_trang_thai: 'dang_lam', khach_xin_mo_lai: null, khach_chot_at: null }
      chk(await admin.from('qt_quyet_toan').update(patch).eq('opportunity_id', oppId))
      await ghiLichSu(admin, oppId, uid, `${action}_${phan}`, lyDo || null, { yeu_cau: yeuCau })
      return NextResponse.json({ ok: true })
    }

    if (action === 'khoa_so') {
      if (!(await coQuyenKhoaSo(admin, uid))) throw new QtError('Chỉ Super Admin hoặc người được giao trong Cài đặt mới khoá sổ được', 403)
      if (qt.da_khoa) throw new QtError('Quyết toán đã khoá sổ')
      if (qt.chi_phi_trang_thai !== 'ke_toan_duyet' || qt.khach_trang_thai !== 'khach_chot') {
        throw new QtError('Chỉ khoá sổ khi kế toán đã duyệt chi phí VÀ khách đã chốt quyết toán')
      }
      const { data, saleChinhId, salePhuId, dieuHanhId } = await taiDuLieuTinh(admin, oppId)
      const kq = tinhTuDuLieu(data)
      const tyLe = tyLeCuaDon(data.cauHinh, data.qt)
      chk(await admin.from('qt_chot').upsert({
        opportunity_id: oppId,
        ...soChotTuKetQua(kq),
        sale_chinh_id: saleChinhId,
        sale_phu_id: salePhuId,
        dieu_hanh_id: dieuHanhId,
        ke_toan_id: qt.ke_toan_id,
        ty_le: tyLe,
        chi_tiet: {
          gia_tri_hd: kq.giaTriHd, tang: kq.tang, giam: kq.giam, tong_quyet_toan: kq.tongQuyetToan,
          chi_phi_truoc_vat: kq.chiPhi, com_khach: kq.comKhach, vat_chi_phi: kq.vatChiPhi,
          vat_khong_khau_tru: kq.vatKhongKhauTru, da_thu: kq.daThu, cong_no_khach: kq.congNoKhach,
          cong_no_ncc: kq.tongCongNoNcc, tam_ung_chua_hoan: kq.tamUngChuaHoan, cp_du_chi: kq.cpDuChi,
          khi_ln_am: data.cauHinh.hh_khi_ln_am,
        },
        chot_at: now,
        chot_by: uid,
      }, { onConflict: 'opportunity_id' }))
      const rows = chk(await admin.from('qt_quyet_toan').update({ da_khoa: true, khoa_at: now, khoa_by: uid })
        .eq('opportunity_id', oppId).eq('da_khoa', false).select('opportunity_id')) as unknown[]
      if (!rows.length) throw new QtError('Quyết toán vừa được khoá bởi người khác')
      await ghiLichSu(admin, oppId, uid, 'khoa_so', null, { loi_nhuan: kq.loiNhuan, doanh_thu: kq.doanhThu })
      return NextResponse.json({ ok: true })
    }

    if (action === 'mo_khoa') {
      if (!(await coQuyenKhoaSo(admin, uid))) throw new QtError('Chỉ Super Admin hoặc người được giao trong Cài đặt mới mở khoá được', 403)
      if (!lyDo) throw new QtError('Cần nhập lý do mở khoá')
      if (!qt.da_khoa) throw new QtError('Quyết toán chưa khoá sổ')
      chk(await admin.from('qt_chot').delete().eq('opportunity_id', oppId))
      chk(await admin.from('qt_quyet_toan').update({ da_khoa: false, khoa_at: null, khoa_by: null }).eq('opportunity_id', oppId))
      await ghiLichSu(admin, oppId, uid, 'mo_khoa', lyDo)
      return NextResponse.json({ ok: true })
    }

    throw new QtError('Thao tác không hợp lệ')
  } catch (e) {
    return loiResponse(e)
  }
}
