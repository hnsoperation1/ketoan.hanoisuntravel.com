'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { formatDateTimeVN, formatTien } from '@/lib/format'
import type { HhTyLe } from '@/lib/quyetToan'
import { tyLeCuaDon } from '@/lib/quyetToanBundle'
import { Badge, Card, MoneyInput, Tien, btnGhost, inputCls, tblCls, tdCls, tdNum, thCls, type QtCtx } from './shared'

function Dong({ label, v, cach, dam, am }: { label: string; v: number | null; cach?: string; dam?: boolean; am?: boolean }) {
  return (
    <tr className={dam ? 'bg-[#f8f9fa] font-bold' : ''}>
      <td className={tdCls}>{label}</td>
      <td className={tdNum}>{am && v ? '− ' : ''}<Tien v={v} /></td>
      <td className={`${tdCls} text-xs text-gray-500`}>{cach}</td>
    </tr>
  )
}

export default function ThueLoiNhuan({ b, kq, khoa, call, ten }: QtCtx) {
  const qt = b.qt
  const [lyDo, setLyDo] = useState<string | null>(null)
  const tamTinh = !khoa
  // Tỷ lệ đang áp: đã khoá → tỷ lệ chốt; chưa khoá → cài đặt chung + ghi đè của đơn
  const tyLe: HhTyLe = khoa && b.chot?.ty_le ? { ...tyLeCuaDon(b.cau_hinh, null), ...b.chot.ty_le } : tyLeCuaDon(b.cau_hinh, qt)
  const ghiDe = qt?.hh_ty_le ?? {}
  const datTyLe = (k: keyof HhTyLe, v: number | null) => {
    const next: Record<string, number> = {}
    for (const [kk, vv] of Object.entries(ghiDe)) if (vv != null) next[kk] = Number(vv)
    if (v == null || v === b.cau_hinh.hh_ty_le[k]) delete next[k]
    else next[k] = v
    void call('PATCH', '', { hh_ty_le: Object.keys(next).length ? next : null })
  }

  const vaiTro: { k: keyof HhTyLe; label: string; nguoi: string; tien: number }[] = [
    { k: 'sale_chinh', label: 'Sale chính', nguoi: b.opp.sale_chinh_ten ?? '', tien: kq.hhSaleChinh },
    { k: 'sale_phu', label: 'Sale phụ', nguoi: ten(b.opp.assigned_to), tien: kq.hhSalePhu },
    { k: 'dieu_hanh', label: 'Điều hành', nguoi: ten(b.opp.operator_id), tien: kq.hhDieuHanh },
    { k: 'ke_toan', label: 'Kế toán', nguoi: ten(qt?.ke_toan_id), tien: kq.hhKeToan },
  ]

  return (
    <div className="space-y-4">
      <Card title={<span className="flex items-center gap-2">Thuế & lợi nhuận {tamTinh ? <Badge tone="amber">Tạm tính</Badge> : <Badge tone="violet">Đã chốt {b.chot?.chot_at ? formatDateTimeVN(b.chot.chot_at) : ''}</Badge>}</span>}>
        <div className="-m-4 overflow-x-auto">
          <table className={tblCls} style={{ minWidth: 700 }}>
            <thead><tr><th className={thCls}>Khoản</th><th className={`${thCls} text-right`}>Số tiền</th><th className={thCls}>Cách tính</th></tr></thead>
            <tbody>
              <Dong label="Doanh thu trước VAT" v={kq.doanhThu} cach="Giá trị HĐ + PS tăng − PS giảm, dòng khách đồng ý" dam />
              <Dong label="VAT ra" v={kq.vatRa} cach={qt?.co_vat === false ? 'Đơn không xuất VAT' : `Giá trị HĐ × ${qt?.vat_ra_rate ?? 8}% + VAT của phát sinh`} />
              <Dong label="Chi phí trước VAT" v={kq.chiPhi} cach={`Σ thành tiền chi phí thực tế${kq.comKhach ? ` + COM khách ${formatTien(kq.comKhach)}` : ''}`} />
              <Dong label="VAT trên chi phí" v={kq.vatChiPhi} cach="Σ tiền VAT các dòng chi phí" />
              <Dong label="VAT vào được khấu trừ" v={kq.vatVao} cach="Σ tiền VAT hoá đơn đầu vào đã nhận" />
              <Dong label="VAT không được khấu trừ" v={kq.vatKhongKhauTru} cach="max(0, VAT trên chi phí − VAT vào), tính vào chi" />
              <Dong label="GTGT phải nộp" v={kq.gtgt} cach="VAT ra − VAT vào" />
              <Dong label="TNCN" v={kq.tncn} cach="Σ thuế nộp ở tab Nhân sự của đoàn" />
              <tr>
                <td className={tdCls}>TNDN</td>
                <td className={tdNum}>
                  {khoa ? <Tien v={kq.tndn} /> : (
                    <MoneyInput className="ml-auto max-w-[160px]" value={qt?.tndn_nhap_tay ?? null} placeholder="0"
                      onChange={(v) => { if (v !== (qt?.tndn_nhap_tay ?? null)) void call('PATCH', '', { tndn_nhap_tay: v }) }} />
                  )}
                </td>
                <td className={`${tdCls} text-xs text-gray-500`}>Kế toán nhập tay số tạm tính</td>
              </tr>
              <Dong label="Tổng chi" v={kq.tongChi} cach="Chi phí + VAT không khấu trừ + TNCN + TNDN" dam />
              <Dong label="LN trước TNDN" v={kq.loiNhuan + kq.tndn} cach="Doanh thu − Tổng chi, chưa trừ TNDN" />
              <tr className="bg-brand-50/50 font-bold">
                <td className={tdCls}>Lợi nhuận</td>
                <td className={tdNum}><Tien v={kq.loiNhuan} /></td>
                <td className={`${tdCls} text-xs font-normal text-gray-500`}>Doanh thu − Tổng chi{kq.tyLeLn != null ? ` · ${(kq.tyLeLn * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% doanh thu` : ''}</td>
              </tr>
              <Dong label="LN dự chi" v={kq.lnDuChi} cach="Tổng báo khách − tổng net của lần gửi dự chi gần nhất" />
              <Dong label="Tăng / giảm LN" v={kq.tangGiamLn} cach="LN − LN dự chi" />
            </tbody>
          </table>
        </div>
        <div className="mt-6">
          <p className="mb-1 text-[11px] font-semibold text-gray-500">Lý do tăng / giảm LN</p>
          <textarea rows={2} className={inputCls} value={lyDo ?? qt?.ly_do_tang_giam_ln ?? ''} onChange={(e) => setLyDo(e.target.value)}
            onBlur={() => { if (lyDo !== null && lyDo !== (qt?.ly_do_tang_giam_ln ?? '')) void call('PATCH', '', { ly_do_tang_giam_ln: lyDo }); setLyDo(null) }} />
        </div>
      </Card>

      <Card title={<span className="flex items-center gap-2">Hoa hồng {tamTinh && <Badge tone="amber">Tạm tính</Badge>}</span>} actions={!khoa && qt?.hh_ty_le && Object.keys(qt.hh_ty_le).length > 0 && (
        <button type="button" className={btnGhost} onClick={() => call('PATCH', '', { hh_ty_le: null })}><RotateCcw size={13} /> Về tỷ lệ mặc định</button>
      )}>
        <div className="-m-4 overflow-x-auto">
          <table className={tblCls} style={{ minWidth: 700 }}>
            <thead><tr><th className={thCls}>Khoản</th><th className={thCls}>Người nhận</th><th className={`${thCls} text-right`}>Tỷ lệ %</th><th className={`${thCls} text-right`}>Số tiền</th></tr></thead>
            <tbody>
              <tr>
                <td className={tdCls}>Lợi nhuận</td><td className={tdCls} /><td className={tdNum} />
                <td className={`${tdNum} font-semibold`}><Tien v={kq.loiNhuan} /></td>
              </tr>
              <TyLeRow label="CF CSKH" nguoi="" k="cskh" tyLe={tyLe} ghiDe={ghiDe} khoa={khoa} tien={kq.cskh} onChange={datTyLe} macDinh={b.cau_hinh.hh_ty_le.cskh} />
              <tr className="bg-[#f8f9fa] font-bold"><td className={tdCls}>LN tính hoa hồng</td><td className={tdCls} /><td className={tdNum} /><td className={tdNum}><Tien v={kq.lnTinhHh} /></td></tr>
              {vaiTro.map((r) => (
                <TyLeRow key={r.k} label={`HH ${r.label}`} nguoi={r.nguoi} k={r.k} tyLe={tyLe} ghiDe={ghiDe} khoa={khoa} tien={r.tien} onChange={datTyLe} macDinh={b.cau_hinh.hh_ty_le[r.k]} />
              ))}
              <tr className="bg-brand-50/50 font-bold"><td className={tdCls}>LN còn lại</td><td className={tdCls} /><td className={tdNum} /><td className={tdNum}><Tien v={kq.lnConLai} /></td></tr>
            </tbody>
          </table>
        </div>
        {kq.loiNhuan < 0 && <p className="mt-6 text-xs text-gray-500">LN âm: {b.cau_hinh.hh_khi_ln_am === 've_0' ? 'hoa hồng về 0' : 'giữ số âm'} theo Cài đặt.</p>}
      </Card>
    </div>
  )
}

function TyLeRow({ label, nguoi, k, tyLe, ghiDe, khoa, tien, onChange, macDinh }: {
  label: string; nguoi: string; k: keyof HhTyLe; tyLe: HhTyLe; ghiDe: Partial<HhTyLe>; khoa: boolean; tien: number
  onChange: (k: keyof HhTyLe, v: number | null) => void; macDinh: number
}) {
  const coGhiDe = ghiDe[k] != null
  return (
    <tr>
      <td className={tdCls}>{label}</td>
      <td className={tdCls}>{k === 'cskh' ? '' : nguoi || <span className="text-gray-300">Trống</span>}</td>
      <td className={tdNum}>
        {khoa ? `${tyLe[k]}%` : (
          <div className="ml-auto flex max-w-[140px] items-center gap-1">
            <MoneyInput thapPhan value={tyLe[k]} onChange={(v) => onChange(k, v)} className={coGhiDe ? 'border-amber-300 bg-amber-50' : ''} />
            <span className="text-xs text-gray-400">%</span>
          </div>
        )}
        {coGhiDe && !khoa && <div className="text-[10px] text-amber-700">mặc định {macDinh}%</div>}
      </td>
      <td className={tdNum}><Tien v={tien} /></td>
    </tr>
  )
}
