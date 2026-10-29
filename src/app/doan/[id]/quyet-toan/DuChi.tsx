'use client'

import { Fragment, useState } from 'react'
import { CheckCircle2, Undo2 } from 'lucide-react'
import { SelectMenu } from '@/components/SelectMenu'
import { formatDateTimeVN } from '@/lib/format'
import type { DuChiLine } from '@/lib/quyetToan'
import { Badge, Card, EmptyRow, LyDoModal, Tien, btnDanger, btnPrimary, tblCls, tdCls, tdNum, thCls, type QtCtx } from './shared'

const n = (v: unknown) => Number(v ?? 0) || 0

export default function DuChi({ b, call, ten }: QtCtx) {
  const [lanId, setLanId] = useState<string>(b.du_chi[0]?.id ?? '')
  const [traLai, setTraLai] = useState(false)
  const dc = b.du_chi.find((d) => d.id === lanId) ?? b.du_chi[0] ?? null

  if (!dc) {
    return <Card title="Dự chi"><p className="text-sm text-gray-500">Sale / Điều hành chưa gửi dự chi cho kế toán.</p></Card>
  }
  const moiNhat = dc.id === b.du_chi[0]?.id
  const lines: DuChiLine[] = Array.isArray(dc.lines) ? dc.lines : []
  const nhomList: string[] = []
  for (const l of lines) if (!nhomList.includes(l.nhom ?? '')) nhomList.push(l.nhom ?? '')
  const ban = (l: DuChiLine) => (l.include_in_quote ? n(l.quote_thanh_tien) : 0)
  const tongVat = lines.reduce((s, l) => s + Math.round((n(l.thanh_tien) * n(l.vat_rate)) / 100), 0)

  return (
    <div className="space-y-4">
      <Card title={<span className="flex items-center gap-2">Dự chi lần {dc.lan} {moiNhat && <Badge tone="brand">Mới nhất</Badge>}</span>} actions={
        <>
          {b.du_chi.length > 1 && (
            <SelectMenu size="sm" className="w-56" value={dc.id} onChange={setLanId}
              options={b.du_chi.map((d) => ({ value: d.id, label: `Lần ${d.lan} · ${formatDateTimeVN(d.chot_at)}` }))} />
          )}
          {!dc.ke_toan_nhan_at && (
            <button type="button" className={btnPrimary} onClick={() => call('POST', '/hanh-dong', { action: 'nhan_du_chi', du_chi_id: dc.id })}><CheckCircle2 size={13} /> Đã nhận</button>
          )}
          {!dc.ly_do_tra_lai && <button type="button" className={btnDanger} onClick={() => setTraLai(true)}><Undo2 size={13} /> Trả lại</button>}
        </>
      }>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <span>Gửi lúc {formatDateTimeVN(dc.chot_at)}{dc.chot_by ? ` · ${ten(dc.chot_by)}` : ''}</span>
          {dc.so_khach != null && <span>Số khách: {dc.so_khach}</span>}
          {dc.ke_toan_nhan_at && <span className="text-emerald-600">Kế toán đã nhận {formatDateTimeVN(dc.ke_toan_nhan_at)}{dc.ke_toan_nhan_by ? ` · ${ten(dc.ke_toan_nhan_by)}` : ''}</span>}
          {dc.ly_do_tra_lai && <span className="text-red-600">Đã trả lại: {dc.ly_do_tra_lai}</span>}
          {dc.ghi_chu && <span>Ghi chú: {dc.ghi_chu}</span>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><p className="text-[11px] font-semibold text-gray-400">Tổng net (trước VAT)</p><p className="font-bold"><Tien v={dc.tong_net} /></p></div>
          <div><p className="text-[11px] font-semibold text-gray-400">VAT net</p><p className="font-bold"><Tien v={dc.tong_vat_net ?? tongVat} /></p></div>
          <div><p className="text-[11px] font-semibold text-gray-400">Tổng báo khách</p><p className="font-bold"><Tien v={dc.tong_ban} /></p></div>
          <div><p className="text-[11px] font-semibold text-gray-400">LN tạm tính</p><p className="font-bold"><Tien v={n(dc.tong_ban) - n(dc.tong_net)} /></p></div>
        </div>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className={tblCls} style={{ minWidth: 1250 }}>
          <thead>
            <tr>
              <th className={thCls} rowSpan={2}>Hạng mục</th>
              <th className={thCls} rowSpan={2}>NCC</th>
              <th className={`${thCls} text-center`} colSpan={6}>Giá net HNS</th>
              <th className={`${thCls} text-center`} colSpan={3}>Giá bán khách</th>
              <th className={`${thCls} text-right`} rowSpan={2}>LN tạm tính</th>
            </tr>
            <tr>
              <th className={thCls}>ĐVT</th>
              <th className={`${thCls} text-right`}>SL</th>
              <th className={`${thCls} text-right`}>Số lần</th>
              <th className={`${thCls} text-right`}>Đơn giá</th>
              <th className={`${thCls} text-right`}>VAT</th>
              <th className={`${thCls} text-right`}>Thành tiền</th>
              <th className={`${thCls} text-right`}>SL × lần</th>
              <th className={`${thCls} text-right`}>Đơn giá</th>
              <th className={`${thCls} text-right`}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && <EmptyRow cols={12} text="Lần gửi này không có hạng mục." />}
            {nhomList.map((g) => {
              const ls = lines.filter((l) => (l.nhom ?? '') === g)
              return (
                <Fragment key={g || '_'}>
                  {g && (
                    <tr className="bg-brand-50/40">
                      <td className={`${tdCls} font-semibold`} colSpan={7}>{g}</td>
                      <td className={`${tdNum} font-semibold`}><Tien v={ls.reduce((s, l) => s + n(l.thanh_tien), 0)} /></td>
                      <td className={tdCls} colSpan={2} />
                      <td className={`${tdNum} font-semibold`}><Tien v={ls.reduce((s, l) => s + ban(l), 0)} /></td>
                      <td className={`${tdNum} font-semibold`}><Tien v={ls.reduce((s, l) => s + ban(l) - n(l.thanh_tien), 0)} /></td>
                    </tr>
                  )}
                  {ls.map((l, i) => (
                    <tr key={`${l.service_id}-${i}`}>
                      <td className={tdCls}>{l.ten}</td>
                      <td className={`${tdCls} text-xs text-gray-500`}>{l.ncc_ten}</td>
                      <td className={tdCls}>{l.dvt}</td>
                      <td className={tdNum}>{n(l.so_luong).toLocaleString('vi-VN')}</td>
                      <td className={tdNum}>{n(l.so_lan).toLocaleString('vi-VN')}</td>
                      <td className={tdNum}><Tien v={n(l.don_gia)} /></td>
                      <td className={tdNum}>{n(l.vat_rate)}%</td>
                      <td className={tdNum}><Tien v={n(l.thanh_tien)} /></td>
                      <td className={tdNum}>{l.include_in_quote ? `${n(l.quote_so_luong).toLocaleString('vi-VN')} × ${n(l.quote_so_lan).toLocaleString('vi-VN')}` : <span className="text-gray-300">Không báo</span>}</td>
                      <td className={tdNum}>{l.include_in_quote ? <Tien v={n(l.quote_don_gia)} /> : ''}</td>
                      <td className={tdNum}><Tien v={ban(l)} /></td>
                      <td className={tdNum}><Tien v={ban(l) - n(l.thanh_tien)} /></td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {lines.length > 0 && (
              <tr className="bg-[#f8f9fa] font-bold">
                <td className={tdCls} colSpan={7}>Tổng cộng</td>
                <td className={tdNum}><Tien v={n(dc.tong_net)} /></td>
                <td className={tdCls} colSpan={2} />
                <td className={tdNum}><Tien v={n(dc.tong_ban)} /></td>
                <td className={tdNum}><Tien v={n(dc.tong_ban) - n(dc.tong_net)} /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {traLai && (
        <LyDoModal title={`Trả lại dự chi lần ${dc.lan}`} danger confirmLabel="Trả lại" onClose={() => setTraLai(false)}
          onSubmit={(v) => call('POST', '/hanh-dong', { action: 'tra_lai_du_chi', du_chi_id: dc.id, ly_do: v })} />
      )}
    </div>
  )
}
