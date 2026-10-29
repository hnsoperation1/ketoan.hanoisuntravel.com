'use client'

import { useState } from 'react'
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import DateInput from '@/components/DateInput'
import { SelectMenu } from '@/components/SelectMenu'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { formatDateTimeVN, formatDateVN, formatTien } from '@/lib/format'
import type { QtLichThu, QtThuKhach } from '@/lib/quyetToan'
import { Badge, Card, EmptyRow, Field, MoneyInput, QtModal, Tien, btnBrand, btnGhost, btnPrimary, inputCls, tblCls, tdCls, tdNum, thCls, type QtCtx } from './shared'
import { SaoKePicker } from './SaoKePicker'

const n = (v: unknown) => Number(v ?? 0) || 0
const homNay = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

export default function ThuKhach(ctx: QtCtx) {
  const { b, kq, call } = ctx
  const { confirm, dialog } = useConfirmDialog()
  const [thuForm, setThuForm] = useState<Partial<QtThuKhach> | null>(null)
  const [lichForm, setLichForm] = useState<Partial<QtLichThu> | null>(null)

  const thu = [...b.thu_khach].sort((a, c) => a.ngay.localeCompare(c.ngay))
  // Lịch thu: số phải thu từng đợt + lũy kế so với đã thu
  const lich = [...b.lich_thu].sort((a, c) => a.dot - c.dot || a.han.localeCompare(c.han))
  const phaiThu = lich.map((l) => (l.so_tien != null ? n(l.so_tien) : Math.round((kq.tongQuyetToan * n(l.ty_le)) / 100)))
  const lichRows = lich.map((l, i) => {
    const phai = phaiThu[i]
    const luyKe = phaiThu.slice(0, i + 1).reduce((s, x) => s + x, 0)
    const thieu = luyKe - kq.daThu
    const trangThai = thieu < 1 ? 'du' : l.han < homNay() ? 'qua_han' : 'chua_den'
    return { l, phai, luyKe, thieu, trangThai }
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm"><p className="text-[11px] font-semibold uppercase text-gray-400">Phải thu</p><p className="text-lg font-bold"><Tien v={kq.tongQuyetToan} /></p></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm"><p className="text-[11px] font-semibold uppercase text-gray-400">Đã thu</p><p className="text-lg font-bold text-emerald-600"><Tien v={kq.daThu} /></p></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm"><p className="text-[11px] font-semibold uppercase text-gray-400">Công nợ khách</p><p className="text-lg font-bold"><Tien v={kq.congNoKhach} className={kq.congNoKhach > 0 ? 'text-red-600' : ''} /></p></div>
      </div>

      <Card title="Khách thanh toán" actions={
        <button type="button" className={btnPrimary} onClick={() => setThuForm({ lan: (b.thu_khach.reduce((m, t) => Math.max(m, n(t.lan)), 0) || 0) + 1, ngay: homNay(), so_tien: 0 })}><Plus size={13} /> Thêm lần thu</button>
      }>
        <div className="-m-4 overflow-x-auto">
          <table className={tblCls} style={{ minWidth: 760 }}>
            <thead><tr>
              <th className={thCls}>Lần</th><th className={thCls}>Ngày</th><th className={`${thCls} text-right`}>Số tiền</th>
              <th className={thCls}>Tài khoản</th><th className={thCls}>Ghi chú</th><th className={thCls} />
            </tr></thead>
            <tbody>
              {thu.length === 0 && <EmptyRow cols={6} />}
              {thu.map((t) => (
                <tr key={t.id}>
                  <td className={tdCls}>{t.lan ?? ''}</td>
                  <td className={tdCls}>{formatDateVN(t.ngay)}</td>
                  <td className={tdNum}><Tien v={n(t.so_tien)} /></td>
                  <td className={tdCls}>{t.tai_khoan}{t.sao_ke_id && <Landmark size={12} className="ml-1 inline text-brand-500" aria-label="Từ sao kê" />}</td>
                  <td className={`${tdCls} text-xs`}>{t.ghi_chu}</td>
                  <td className={tdCls}>
                    <div className="flex gap-1">
                      <button type="button" aria-label="Sửa" onClick={() => setThuForm(t)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600"><Pencil size={14} /></button>
                      <button type="button" aria-label="Xoá" onClick={async () => { if (await confirm({ title: 'Xoá lần thu này?', tone: 'danger', confirmLabel: 'Xoá' })) void call('DELETE', `/thu-khach/${t.id}`) }} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {thu.length > 0 && <tr className="bg-[#f8f9fa] font-bold"><td className={tdCls} colSpan={2}>Tổng đã thu</td><td className={tdNum}><Tien v={kq.daThu} /></td><td className={tdCls} colSpan={3} /></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Lịch thu theo đợt" actions={
        <button type="button" className={btnPrimary} onClick={() => setLichForm({ dot: (b.lich_thu.reduce((m, l) => Math.max(m, l.dot), 0) || 0) + 1, han: homNay() })}><Plus size={13} /> Thêm đợt</button>
      }>
        <div className="-m-4 overflow-x-auto">
          <table className={tblCls} style={{ minWidth: 900 }}>
            <thead><tr>
              <th className={thCls}>Đợt</th><th className={thCls}>Hạn</th><th className={`${thCls} text-right`}>Phải thu</th>
              <th className={`${thCls} text-right`}>Lũy kế</th><th className={thCls}>Tình trạng</th><th className={thCls}>Ghi chú</th>
              <th className={thCls}>Đã báo</th><th className={thCls} />
            </tr></thead>
            <tbody>
              {lichRows.length === 0 && <EmptyRow cols={8} />}
              {lichRows.map(({ l, phai, luyKe: lk, thieu, trangThai }) => (
                <tr key={l.id}>
                  <td className={tdCls}>{l.dot}</td>
                  <td className={tdCls}>{formatDateVN(l.han)}</td>
                  <td className={tdNum}><Tien v={phai} />{l.so_tien == null && <div className="text-[10px] text-gray-400">{n(l.ty_le)}% giá trị QT</div>}</td>
                  <td className={tdNum}><Tien v={lk} /></td>
                  <td className={tdCls}>
                    {trangThai === 'du' && <Badge tone="green">Đã thu đủ</Badge>}
                    {trangThai === 'qua_han' && <Badge tone="red">Quá hạn, thiếu {formatTien(thieu)}</Badge>}
                    {trangThai === 'chua_den' && <Badge>Chưa đến hạn</Badge>}
                  </td>
                  <td className={`${tdCls} text-xs`}>{l.ghi_chu}</td>
                  <td className={`${tdCls} text-xs text-gray-500`}>{formatDateTimeVN((l as QtLichThu & { da_bao_at?: string | null }).da_bao_at)}</td>
                  <td className={tdCls}>
                    <div className="flex gap-1">
                      <button type="button" aria-label="Sửa" onClick={() => setLichForm(l)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600"><Pencil size={14} /></button>
                      <button type="button" aria-label="Xoá" onClick={async () => { if (await confirm({ title: `Xoá đợt ${l.dot}?`, tone: 'danger', confirmLabel: 'Xoá' })) void call('DELETE', `/lich-thu/${l.id}`) }} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {thuForm && <ThuForm ctx={ctx} init={thuForm} onClose={() => setThuForm(null)} />}
      {lichForm && <LichForm ctx={ctx} init={lichForm} onClose={() => setLichForm(null)} />}
      {dialog}
    </div>
  )
}

function ThuForm({ ctx, init, onClose }: { ctx: QtCtx; init: Partial<QtThuKhach>; onClose: () => void }) {
  const [f, setF] = useState<Partial<QtThuKhach>>(init)
  const [saoKe, setSaoKe] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof QtThuKhach>(k: K, v: QtThuKhach[K] | null | undefined) => setF((x) => ({ ...x, [k]: v }))
  return (
    <QtModal title={f.id ? 'Sửa lần thu' : 'Thêm lần thu khách'} onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
      <button type="button" className={btnBrand} disabled={busy || !f.ngay} onClick={async () => {
        setBusy(true)
        const body = { lan: f.lan ?? null, ngay: f.ngay, so_tien: n(f.so_tien), tai_khoan: f.tai_khoan ?? null, sao_ke_id: f.sao_ke_id ?? null, ghi_chu: f.ghi_chu ?? null }
        const ok = await (f.id ? ctx.call('PATCH', `/thu-khach/${f.id}`, body) : ctx.call('POST', '/thu-khach', body))
        setBusy(false)
        if (ok) onClose()
      }}>Lưu</button>
    </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lần"><MoneyInput value={f.lan ?? null} onChange={(v) => set('lan', v == null ? null : Math.round(v))} /></Field>
        <Field label="Ngày"><DateInput value={f.ngay ?? ''} onChange={(v) => set('ngay', v)} /></Field>
        <Field label="Số tiền"><MoneyInput value={f.so_tien ?? 0} onChange={(v) => set('so_tien', v ?? 0)} /></Field>
        <Field label="Tài khoản"><input className={inputCls} value={f.tai_khoan ?? ''} onChange={(e) => set('tai_khoan', e.target.value)} /></Field>
        <Field label="Ghi chú" className="col-span-2"><input className={inputCls} value={f.ghi_chu ?? ''} onChange={(e) => set('ghi_chu', e.target.value)} /></Field>
        <div className="col-span-2 flex items-center gap-2">
          <button type="button" className={btnGhost} onClick={() => setSaoKe(true)}><Landmark size={13} /> Chọn từ sao kê</button>
          {f.sao_ke_id && <span className="text-xs text-emerald-700">Đã gắn sao kê <button type="button" className="ml-1 text-gray-400 underline" onClick={() => set('sao_ke_id', null)}>bỏ</button></span>}
        </div>
      </div>
      {saoKe && (
        <SaoKePicker loai="thu" goiY={ctx.b.opp.khach ?? ''} onClose={() => setSaoKe(false)}
          onPick={(r) => setF((x) => ({ ...x, sao_ke_id: r.sao_ke_id, ngay: r.ngay ?? x.ngay, so_tien: r.so_tien, tai_khoan: r.tai_khoan, ghi_chu: x.ghi_chu || r.dien_giai || null }))} />
      )}
    </QtModal>
  )
}

function LichForm({ ctx, init, onClose }: { ctx: QtCtx; init: Partial<QtLichThu>; onClose: () => void }) {
  const [f, setF] = useState<Partial<QtLichThu>>(init)
  const [theo, setTheo] = useState<'tien' | 'pct'>(init.so_tien == null && init.ty_le != null ? 'pct' : 'tien')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof QtLichThu>(k: K, v: QtLichThu[K] | null | undefined) => setF((x) => ({ ...x, [k]: v }))
  const xem = theo === 'pct' ? Math.round((ctx.kq.tongQuyetToan * n(f.ty_le)) / 100) : n(f.so_tien)
  return (
    <QtModal title={f.id ? `Sửa đợt ${f.dot}` : 'Thêm đợt thu'} onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
      <button type="button" className={btnBrand} disabled={busy || !f.han} onClick={async () => {
        setBusy(true)
        const body = { dot: f.dot ?? null, han: f.han, so_tien: theo === 'tien' ? n(f.so_tien) : null, ty_le: theo === 'pct' ? n(f.ty_le) : null, ghi_chu: f.ghi_chu ?? null }
        const ok = await (f.id ? ctx.call('PATCH', `/lich-thu/${f.id}`, body) : ctx.call('POST', '/lich-thu', body))
        setBusy(false)
        if (ok) onClose()
      }}>Lưu</button>
    </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Đợt"><MoneyInput value={f.dot ?? null} onChange={(v) => set('dot', v == null ? undefined : Math.round(v))} /></Field>
        <Field label="Hạn thu"><DateInput value={f.han ?? ''} onChange={(v) => set('han', v)} /></Field>
        <Field label="Cách tính"><SelectMenu size="sm" value={theo} options={[{ value: 'tien', label: 'Số tiền' }, { value: 'pct', label: '% giá trị quyết toán' }]} onChange={(v) => setTheo(v as 'tien' | 'pct')} /></Field>
        {theo === 'tien'
          ? <Field label="Số tiền"><MoneyInput value={f.so_tien ?? 0} onChange={(v) => set('so_tien', v ?? 0)} /></Field>
          : <Field label="Tỷ lệ %"><MoneyInput thapPhan value={f.ty_le ?? null} onChange={(v) => set('ty_le', v)} /></Field>}
        <Field label="Ghi chú" className="col-span-2"><input className={inputCls} value={f.ghi_chu ?? ''} onChange={(e) => set('ghi_chu', e.target.value)} /></Field>
      </div>
      <p className="mt-3 text-xs text-gray-500">Phải thu đợt này: <b>{formatTien(xem)}</b></p>
    </QtModal>
  )
}
