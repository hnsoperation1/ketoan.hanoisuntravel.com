'use client'

import { useState } from 'react'
import { CheckCircle2, Download, Lock, LockOpen, Undo2, XCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { SelectMenu } from '@/components/SelectMenu'
import { UserPicker } from '@/components/UserPicker'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { formatDateTimeVN, formatDateVN, formatTien } from '@/lib/format'
import { CHI_PHI_TRANG_THAI_LABEL, KHACH_TRANG_THAI_LABEL } from '@/lib/quyetToan'
import { Badge, Card, Field, LyDoModal, Tien, btnBrand, btnDanger, btnGhost, btnPrimary, inputCls, type QtCtx } from './shared'
import { xuatQtnb } from './xuatQtnb'

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-gray-400">{label}</p>
      <p className="truncate text-sm font-medium text-gray-800">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: number | null; sub?: React.ReactNode; tone?: 'red' | 'green' }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={clsx('mt-1 text-lg font-bold tabular-nums', tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : 'text-gray-900')}>
        {value == null ? '—' : formatTien(value)}
      </p>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

const pct = (x: number | null) => (x == null ? '—' : `${(x * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`)

export default function TongQuan(ctx: QtCtx) {
  const { b, kq, khoa, call, ten } = ctx
  const qt = b.qt
  const { confirm, dialog } = useConfirmDialog()
  const [lyDo, setLyDo] = useState<null | { title: string; action: string; extra?: Record<string, unknown>; required?: boolean; danger?: boolean; label?: string }>(null)
  const [xuat, setXuat] = useState(false)
  const [soHd, setSoHd] = useState<string | null>(null)
  const [soTl, setSoTl] = useState<string | null>(null)

  const patch = (body: Record<string, unknown>) => call('PATCH', '', body)
  const hanhDong = (action: string, extra?: Record<string, unknown>) => call('POST', '/hanh-dong', { action, ...extra })

  const cpTT = qt?.chi_phi_trang_thai ?? 'dang_lam'
  const khTT = qt?.khach_trang_thai ?? 'dang_lam'
  const duocKhoa = cpTT === 'ke_toan_duyet' && khTT === 'khach_chot'
  const doan = b.doan
  const lnDuChiPct = kq.lnDuChi != null && b.du_chi[0]?.tong_ban ? kq.lnDuChi / Number(b.du_chi[0].tong_ban) : null
  const tamTinh = !khoa

  return (
    <div className="space-y-4">
      <Card title="Thông tin đoàn" actions={
        <button type="button" className={btnBrand} disabled={xuat} onClick={async () => {
          setXuat(true)
          try { await xuatQtnb(b, kq) } catch { ctx.toast('Không xuất được file', true) } finally { setXuat(false) }
        }}>
          {xuat ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Xuất QTNB (Excel)
        </button>
      }>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
          <Info label="Khách" value={b.opp.khach} />
          <Info label="Chương trình" value={doan?.ten_chuong_trinh || b.opp.title} />
          <Info label="Địa điểm" value={doan?.dia_diem_chuong_trinh || b.opp.dia_diem || doan?.hanh_trinh} />
          <Info label="Ngày" value={[formatDateVN(doan?.ngay_di ?? b.opp.tour_date), formatDateVN(doan?.ngay_ve ?? b.opp.tour_end_date)].filter(Boolean).join(' – ')} />
          <Info label="NL / TE" value={`${b.opp.nl ?? doan?.sl_khach ?? '—'} / ${b.opp.te ?? 0}${b.opp.em_be ? ` / EB ${b.opp.em_be}` : ''}`} />
          <Info label="Sale chính" value={b.opp.sale_chinh_ten} />
          <Info label="Sale phụ" value={ten(b.opp.assigned_to)} />
          <Info label="Điều hành" value={ten(b.opp.operator_id)} />
          <Info label="Bộ phận" value={b.opp.department} />
          <Info label="TKT" value={b.opp.ticketing_ids.map((t) => ten(t)).filter(Boolean).join(', ')} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Kế toán">
            <UserPicker size="sm" users={b.users} value={qt?.ke_toan_id ?? null} disabled={khoa} placeholder="Chọn kế toán" allLabel="Bỏ chọn"
              onChange={(id) => patch({ ke_toan_id: id })} />
          </Field>
          <Field label="KSNB">
            <UserPicker size="sm" users={b.users} value={qt?.ksnb_id ?? null} disabled={khoa} placeholder="Chọn KSNB" allLabel="Bỏ chọn"
              onChange={(id) => patch({ ksnb_id: id })} />
          </Field>
          <Field label="Phân loại">
            <SelectMenu size="sm" disabled={khoa} value={qt?.phan_loai_id ?? ''} placeholder="Chọn phân loại"
              options={[{ value: '', label: '— Chưa chọn —' }, ...b.phan_loai_options.map((p) => ({ value: p.id, label: p.ten }))]}
              onChange={(v) => patch({ phan_loai_id: v || null })} />
          </Field>
          <Field label="Hoá đơn VAT">
            <SelectMenu size="sm" disabled={khoa} value={(qt?.co_vat ?? true) ? '1' : '0'}
              options={[{ value: '1', label: 'Có VAT' }, { value: '0', label: 'Không VAT' }]}
              onChange={(v) => patch({ co_vat: v === '1' })} />
          </Field>
          <Field label="Số hợp đồng">
            <input className={inputCls} disabled={khoa} value={soHd ?? qt?.so_hop_dong ?? ''} onChange={(e) => setSoHd(e.target.value)}
              onBlur={() => { if (soHd !== null && soHd !== (qt?.so_hop_dong ?? '')) void patch({ so_hop_dong: soHd }); setSoHd(null) }} />
          </Field>
          <Field label="Số HĐ thanh lý">
            <input className={inputCls} disabled={khoa} value={soTl ?? qt?.so_hd_thanh_ly ?? ''} onChange={(e) => setSoTl(e.target.value)}
              onBlur={() => { if (soTl !== null && soTl !== (qt?.so_hd_thanh_ly ?? '')) void patch({ so_hd_thanh_ly: soTl }); setSoTl(null) }} />
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label={tamTinh ? 'Doanh thu (tạm tính)' : 'Doanh thu'} value={kq.doanhThu} sub="trước VAT" />
        <Kpi label="Tổng chi" value={kq.tongChi} sub={`Chi phí ${formatTien(kq.chiPhi)}`} />
        <Kpi label={tamTinh ? 'LN thực (tạm tính)' : 'LN thực'} value={kq.loiNhuan} tone={kq.loiNhuan < 0 ? 'red' : 'green'}
          sub={<>{pct(kq.tyLeLn)} DT · dự chi {kq.lnDuChi == null ? '—' : `${formatTien(kq.lnDuChi)} (${pct(lnDuChiPct)})`}</>} />
        <Kpi label="Công nợ khách" value={kq.congNoKhach} tone={kq.congNoKhach > 0 ? 'red' : undefined} sub={`Đã thu ${formatTien(kq.daThu)}`} />
        <Kpi label="Công nợ NCC" value={kq.tongCongNoNcc} tone={kq.tongCongNoNcc > 0 ? 'red' : undefined} sub={`${kq.congNoNcc.filter((r) => r.conNo > 0).length} NCC còn nợ`} />
        <Kpi label="Tạm ứng chưa hoàn" value={kq.tamUngChuaHoan} tone={kq.tamUngChuaHoan > 0 ? 'red' : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Chi phí (Điều hành ↔ Kế toán)">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Badge tone={cpTT === 'ke_toan_duyet' ? 'green' : cpTT === 'cho_ke_toan' ? 'amber' : 'gray'}>{CHI_PHI_TRANG_THAI_LABEL[cpTT]}</Badge>
              {qt?.lan_gui ? <span className="text-xs text-gray-500">Gửi lần {qt.lan_gui}</span> : null}</div>
            {qt?.gui_ke_toan_at && <p className="text-xs text-gray-500">Gửi lúc {formatDateTimeVN(qt.gui_ke_toan_at)}{qt.gui_ke_toan_by ? ` · ${ten(qt.gui_ke_toan_by)}` : ''}</p>}
            {qt?.duyet_at && cpTT === 'ke_toan_duyet' && <p className="text-xs text-gray-500">Duyệt lúc {formatDateTimeVN(qt.duyet_at)}{qt.duyet_by ? ` · ${ten(qt.duyet_by)}` : ''}</p>}
            {qt?.ly_do_tra_lai && cpTT === 'dang_lam' && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">Đã trả lại: {qt.ly_do_tra_lai}</p>}
            {qt?.chi_phi_xin_mo_lai && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">Điều hành xin mở lại: {qt.chi_phi_xin_mo_lai}</p>}
            {!khoa && (
              <div className="flex flex-wrap gap-2 pt-1">
                {cpTT === 'cho_ke_toan' && (
                  <button type="button" className={btnPrimary} onClick={async () => {
                    if (await confirm({ title: 'Duyệt quyết toán chi phí?', message: 'Điều hành sẽ không sửa được chi phí nữa (trừ khi xin mở lại).', confirmLabel: 'Duyệt', tone: 'success' })) void hanhDong('duyet')
                  }}><CheckCircle2 size={13} /> Duyệt</button>
                )}
                {(cpTT === 'cho_ke_toan' || cpTT === 'ke_toan_duyet') && (
                  <button type="button" className={btnDanger} onClick={() => setLyDo({ title: 'Trả lại quyết toán chi phí', action: 'tra_lai', danger: true })}><Undo2 size={13} /> Trả lại</button>
                )}
                {qt?.chi_phi_xin_mo_lai && <>
                  <button type="button" className={btnBrand} onClick={() => hanhDong('dong_y_mo_lai', { phan: 'chi_phi' })}><LockOpen size={13} /> Đồng ý mở lại</button>
                  <button type="button" className={btnGhost} onClick={() => setLyDo({ title: 'Từ chối mở lại chi phí', action: 'tu_choi_mo_lai', extra: { phan: 'chi_phi' }, required: false })}><XCircle size={13} /> Từ chối</button>
                </>}
              </div>
            )}
          </div>
        </Card>

        <Card title="Quyết toán với khách">
          <div className="space-y-2 text-sm">
            <Badge tone={khTT === 'khach_chot' ? 'green' : khTT === 'gui_khach' ? 'amber' : 'gray'}>{KHACH_TRANG_THAI_LABEL[khTT]}</Badge>
            {qt?.khach_chot_at && khTT === 'khach_chot' && <p className="text-xs text-gray-500">Khách chốt lúc {formatDateTimeVN(qt.khach_chot_at)}</p>}
            <p className="text-xs text-gray-500">Tổng quyết toán: <b className="text-gray-800">{formatTien(kq.tongQuyetToan)}</b> (gồm VAT)</p>
            {qt?.khach_xin_mo_lai && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">Xin mở lại: {qt.khach_xin_mo_lai}</p>}
            {!khoa && qt?.khach_xin_mo_lai && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" className={btnBrand} onClick={() => hanhDong('dong_y_mo_lai', { phan: 'khach' })}><LockOpen size={13} /> Đồng ý mở lại</button>
                <button type="button" className={btnGhost} onClick={() => setLyDo({ title: 'Từ chối mở lại quyết toán với khách', action: 'tu_choi_mo_lai', extra: { phan: 'khach' }, required: false })}><XCircle size={13} /> Từ chối</button>
              </div>
            )}
          </div>
        </Card>

        <Card title="Khoá sổ">
          <div className="space-y-2 text-sm">
            {khoa ? (
              <>
                <Badge tone="violet"><Lock size={11} className="mr-1" /> Đã khoá sổ</Badge>
                {qt?.khoa_at && <p className="text-xs text-gray-500">{formatDateTimeVN(qt.khoa_at)}{qt.khoa_by ? ` · ${ten(qt.khoa_by)}` : ''}</p>}
                <p className="text-xs text-gray-500">Số liệu lợi nhuận, hoa hồng, thuế đã chốt. Thu khách và thanh toán NCC vẫn nhập tiếp được.</p>
                {b.quyen.khoa_so && (
                  <button type="button" className={btnDanger} onClick={() => setLyDo({ title: 'Mở khoá sổ', action: 'mo_khoa', danger: true, label: 'Lý do mở khoá' })}><LockOpen size={13} /> Mở khoá</button>
                )}
              </>
            ) : (
              <>
                <Badge>Chưa khoá</Badge>
                <ul className="space-y-0.5 text-xs text-gray-500">
                  <li className={cpTT === 'ke_toan_duyet' ? 'text-emerald-600' : ''}>{cpTT === 'ke_toan_duyet' ? '✓' : '○'} Kế toán đã duyệt chi phí</li>
                  <li className={khTT === 'khach_chot' ? 'text-emerald-600' : ''}>{khTT === 'khach_chot' ? '✓' : '○'} Khách đã chốt quyết toán</li>
                </ul>
                {b.quyen.khoa_so ? (
                  <button type="button" className={btnPrimary} disabled={!duocKhoa} onClick={async () => {
                    if (await confirm({ title: 'Khoá sổ quyết toán?', message: <>Chốt số: LN <b>{formatTien(kq.loiNhuan)}</b>, hoa hồng theo tỷ lệ hiện tại. Sau khi khoá, mọi phần trừ thu khách / thanh toán NCC chỉ còn xem.</>, confirmLabel: 'Khoá sổ' })) void hanhDong('khoa_so')
                  }}><Lock size={13} /> Khoá sổ</button>
                ) : (
                  <p className="text-xs text-gray-400">Chỉ Super Admin hoặc người được giao trong Cài đặt mới khoá sổ được.</p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      <Card title="Số liệu chính">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <Info label="Giá trị HĐ (trước VAT)" value={<Tien v={kq.giaTriHd} />} />
          <Info label="PS tăng / giảm (khách đồng ý)" value={<><Tien v={kq.tang} /> / <Tien v={kq.giam} /></>} />
          <Info label="VAT ra" value={<Tien v={kq.vatRa} />} />
          <Info label="Tổng quyết toán" value={<Tien v={kq.tongQuyetToan} />} />
          <Info label="Chi phí dự chi (net)" value={<Tien v={kq.cpDuChi} />} />
          <Info label="Tăng / giảm LN so dự chi" value={<Tien v={kq.tangGiamLn} />} />
          <Info label="GTGT phải nộp" value={<Tien v={kq.gtgt} />} />
          <Info label="Hoa hồng (4 vai trò)" value={<Tien v={kq.hhSaleChinh + kq.hhSalePhu + kq.hhDieuHanh + kq.hhKeToan} />} />
        </div>
      </Card>

      {lyDo && (
        <LyDoModal title={lyDo.title} danger={lyDo.danger} required={lyDo.required ?? true} label={lyDo.label}
          onClose={() => setLyDo(null)}
          onSubmit={(v) => hanhDong(lyDo.action, { ...lyDo.extra, ly_do: v })} />
      )}
      {dialog}
    </div>
  )
}
