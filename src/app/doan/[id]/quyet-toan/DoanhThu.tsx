'use client'

import { SelectMenu } from '@/components/SelectMenu'
import { docSoTien, KHACH_TRANG_THAI_LABEL, type QtKhachDieuChinh } from '@/lib/quyetToan'
import { Badge, Card, EmptyRow, Field, MoneyInput, Tien, VAT_OPTIONS, tblCls, tdCls, tdNum, thCls, type QtCtx } from './shared'

const n = (v: unknown) => Number(v ?? 0) || 0
const TT_LABEL: Record<QtKhachDieuChinh['trang_thai'], { label: string; tone: 'gray' | 'green' | 'red' }> = {
  de_xuat: { label: 'Đề xuất', tone: 'gray' },
  khach_dong_y: { label: 'Khách đồng ý', tone: 'green' },
  khach_tu_choi: { label: 'Khách từ chối', tone: 'red' },
}

function BangPs({ title, rows }: { title: string; rows: QtKhachDieuChinh[] }) {
  return (
    <Card title={title}>
      <div className="-m-4 overflow-x-auto">
        <table className={tblCls} style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th className={thCls}>STT</th>
              <th className={thCls}>Nội dung</th>
              <th className={thCls}>ĐVT</th>
              <th className={`${thCls} text-right`}>Đơn giá</th>
              <th className={`${thCls} text-right`}>SL</th>
              <th className={`${thCls} text-right`}>Thành tiền</th>
              <th className={`${thCls} text-right`}>VAT</th>
              <th className={thCls}>Ý kiến HNS</th>
              <th className={thCls}>Ý kiến khách</th>
              <th className={thCls}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow cols={10} />}
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className={tdCls}>{i + 1}</td>
                <td className={tdCls}>{r.ten}</td>
                <td className={tdCls}>{r.dvt}</td>
                <td className={tdNum}><Tien v={n(r.don_gia)} /></td>
                <td className={tdNum}>{n(r.so_luong).toLocaleString('vi-VN')}</td>
                <td className={tdNum}><Tien v={n(r.thanh_tien)} /></td>
                <td className={tdNum}>{n(r.vat_rate)}%</td>
                <td className={`${tdCls} text-xs`}>{r.y_kien_hns}</td>
                <td className={`${tdCls} text-xs`}>{r.y_kien_khach}</td>
                <td className={tdCls}><Badge tone={TT_LABEL[r.trang_thai].tone}>{TT_LABEL[r.trang_thai].label}</Badge></td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-[#f8f9fa] font-bold">
                <td className={tdCls} colSpan={5}>Cộng khách đồng ý</td>
                <td className={tdNum}><Tien v={rows.filter((r) => r.trang_thai === 'khach_dong_y').reduce((s, r) => s + n(r.thanh_tien), 0)} /></td>
                <td className={tdCls} colSpan={4} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function DoanhThu({ b, kq, khoa, call }: QtCtx) {
  const qt = b.qt
  const patch = (body: Record<string, unknown>) => call('PATCH', '', body)
  const tang = b.khach.filter((k) => k.loai === 'tang')
  const giam = b.khach.filter((k) => k.loai === 'giam')
  const tamTinh = (qt?.khach_trang_thai ?? 'dang_lam') !== 'khach_chot'

  return (
    <div className="space-y-4">
      <Card title={<span className="flex items-center gap-2">Doanh thu {tamTinh && <Badge tone="amber">Tạm tính</Badge>}</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Giá trị hợp đồng (trước VAT)">
            <MoneyInput disabled={khoa} value={qt?.gia_tri_hd ?? null} placeholder={`Theo dự chi: ${n(b.du_chi[0]?.tong_ban).toLocaleString('vi-VN')}`}
              onChange={(v) => { if (v !== (qt?.gia_tri_hd ?? null)) void patch({ gia_tri_hd: v }) }} />
          </Field>
          <Field label="VAT ra">
            <SelectMenu size="sm" disabled={khoa || qt?.co_vat === false} value={String(qt?.vat_ra_rate ?? 8)} options={VAT_OPTIONS} onChange={(v) => patch({ vat_ra_rate: Number(v) })} />
          </Field>
          <Field label="COM khách">
            <MoneyInput disabled={khoa} value={qt?.com_khach ?? 0} onChange={(v) => { if ((v ?? 0) !== n(qt?.com_khach)) void patch({ com_khach: v ?? 0 }) }} />
          </Field>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr><td className="px-3 py-2 text-gray-600">Giá trị hợp đồng{qt?.gia_tri_hd == null ? ', theo tổng báo khách của dự chi' : ''}</td><td className="px-3 py-2 text-right font-semibold"><Tien v={kq.giaTriHd} /></td></tr>
              <tr><td className="px-3 py-2 text-gray-600">Phát sinh tăng</td><td className="px-3 py-2 text-right font-semibold text-emerald-700">+ <Tien v={kq.tang} /></td></tr>
              <tr><td className="px-3 py-2 text-gray-600">Phát sinh giảm</td><td className="px-3 py-2 text-right font-semibold text-red-600">− <Tien v={kq.giam} /></td></tr>
              <tr className="bg-[#f8f9fa]"><td className="px-3 py-2 font-semibold">Doanh thu trước VAT</td><td className="px-3 py-2 text-right font-bold"><Tien v={kq.doanhThu} /></td></tr>
              <tr><td className="px-3 py-2 text-gray-600">VAT ra{qt?.co_vat === false ? ', không xuất VAT' : ''}</td><td className="px-3 py-2 text-right font-semibold"><Tien v={kq.vatRa} /></td></tr>
              <tr className="bg-brand-50/50"><td className="px-3 py-2 font-bold">Tổng quyết toán với khách</td><td className="px-3 py-2 text-right text-base font-bold text-brand-700"><Tien v={kq.tongQuyetToan} /></td></tr>
              <tr><td colSpan={2} className="px-3 py-2 text-xs italic text-gray-500">Bằng chữ: {docSoTien(kq.tongQuyetToan)}</td></tr>
            </tbody>
          </table>
        </div>
        {(kq.tangDeXuat > 0 || kq.giamDeXuat > 0) && (
          <p className="mt-2 text-xs text-amber-700">Đang đề xuất, chưa tính: tăng {kq.tangDeXuat.toLocaleString('vi-VN')} · giảm {kq.giamDeXuat.toLocaleString('vi-VN')}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">Trạng thái với khách: {KHACH_TRANG_THAI_LABEL[qt?.khach_trang_thai ?? 'dang_lam']}</p>
      </Card>
      <BangPs title="Phát sinh tăng" rows={tang} />
      <BangPs title="Phát sinh giảm" rows={giam} />
    </div>
  )
}
