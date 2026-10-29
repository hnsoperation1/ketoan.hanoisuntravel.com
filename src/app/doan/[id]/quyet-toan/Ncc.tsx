'use client'

import { useState } from 'react'
import { AlertTriangle, ExternalLink, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { SelectMenu } from '@/components/SelectMenu'
import DateInput from '@/components/DateInput'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { formatDateVN, formatTien } from '@/lib/format'
import { THANH_TOAN_LOAI_LABEL, type QtHoaDonNcc, type QtThanhToanNcc } from '@/lib/quyetToan'
import {
  Badge, Card, EmptyRow, Field, MoneyInput, QtModal, Tien, VAT_OPTIONS, btnBrand, btnGhost, btnPrimary, inputCls, nccOptions,
  tblCls, tdCls, tdNum, thCls, type QtCtx,
} from './shared'
import { SaoKePicker } from './SaoKePicker'

const n = (v: unknown) => Number(v ?? 0) || 0
const homNay = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

const EA_STATUS: Record<string, string> = { draft: 'Nháp', requested: 'Đã đề nghị', approved: 'Đã duyệt', paid: 'Đã chi', cancelled: 'Đã huỷ' }

export default function Ncc(ctx: QtCtx) {
  const { b, kq, khoa, call } = ctx
  const { confirm, dialog } = useConfirmDialog()
  const [hdForm, setHdForm] = useState<Partial<QtHoaDonNcc> | null>(null)
  const [ttForm, setTtForm] = useState<Partial<QtThanhToanNcc> | null>(null)

  const xoa = async (path: string, ten: string) => {
    if (await confirm({ title: `Xoá ${ten}?`, tone: 'danger', confirmLabel: 'Xoá' })) void call('DELETE', path)
  }
  const tenCp = (id: string | null) => (id ? b.chi_phi.find((c) => c.id === id)?.ten ?? '' : '')
  const eaMap = new Map(b.event_advances.map((e) => [e.id, e]))

  return (
    <div className="space-y-4">
      <Card title="Bảng kê hoá đơn đầu vào" actions={!khoa && (
        <button type="button" className={btnPrimary} onClick={() => setHdForm({ vat_rate: 8, gia_tri: 0, ngay_hoa_don: homNay() })}><Plus size={13} /> Thêm hoá đơn</button>
      )}>
        <div className="-m-4 overflow-x-auto">
          <table className={tblCls} style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th className={thCls}>Số HĐ</th><th className={thCls}>Ngày</th><th className={thCls}>NCC</th>
                <th className={`${thCls} text-right`}>Giá trị</th><th className={`${thCls} text-right`}>VAT</th>
                <th className={`${thCls} text-right`}>Tiền VAT</th><th className={`${thCls} text-right`}>Tổng</th>
                <th className={thCls}>File</th><th className={thCls}>Ghi chú</th><th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {b.hoa_don.length === 0 && <EmptyRow cols={10} />}
              {b.hoa_don.map((h) => (
                <tr key={h.id}>
                  <td className={tdCls}>{h.so_hoa_don}</td>
                  <td className={tdCls}>{formatDateVN(h.ngay_hoa_don)}</td>
                  <td className={tdCls}>{h.ncc_ten}</td>
                  <td className={tdNum}><Tien v={n(h.gia_tri)} /></td>
                  <td className={tdNum}>{n(h.vat_rate)}%</td>
                  <td className={tdNum}><Tien v={n(h.tien_vat)} /></td>
                  <td className={tdNum}><Tien v={n(h.tong)} /></td>
                  <td className={tdCls}>{h.file_url && <a href={h.file_url} target="_blank" rel="noopener noreferrer" className="text-brand-600" aria-label="Mở file"><ExternalLink size={13} /></a>}</td>
                  <td className={`${tdCls} text-xs`}>{h.ghi_chu}</td>
                  <td className={tdCls}>{!khoa && <HanhDong onSua={() => setHdForm(h)} onXoa={() => xoa(`/hoa-don/${h.id}`, `hoá đơn ${h.so_hoa_don ?? ''}`)} />}</td>
                </tr>
              ))}
              {b.hoa_don.length > 0 && (
                <tr className="bg-[#f8f9fa] font-bold">
                  <td className={tdCls} colSpan={3}>Tổng</td>
                  <td className={tdNum}><Tien v={b.hoa_don.reduce((s, h) => s + n(h.gia_tri), 0)} /></td>
                  <td className={tdCls} />
                  <td className={tdNum}><Tien v={b.hoa_don.reduce((s, h) => s + n(h.tien_vat), 0)} /></td>
                  <td className={tdNum}><Tien v={b.hoa_don.reduce((s, h) => s + n(h.tong), 0)} /></td>
                  <td className={tdCls} colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Bảng kê thanh toán NCC" actions={
        <button type="button" className={btnPrimary} onClick={() => setTtForm({ loai: 'thanh_toan', ngay: homNay(), so_tien: 0 })}><Plus size={13} /> Thêm thanh toán</button>
      }>
        <div className="-m-4 overflow-x-auto">
          <table className={tblCls} style={{ minWidth: 1050 }}>
            <thead>
              <tr>
                <th className={thCls}>Ngày</th><th className={thCls}>NCC</th><th className={thCls}>Loại</th>
                <th className={`${thCls} text-right`}>Số tiền</th><th className={thCls}>Tài khoản</th>
                <th className={thCls}>Theo đề nghị / dòng chi phí</th><th className={thCls}>Ghi chú</th><th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {b.thanh_toan.length === 0 && <EmptyRow cols={8} />}
              {b.thanh_toan.map((t) => (
                <tr key={t.id}>
                  <td className={tdCls}>{formatDateVN(t.ngay)}</td>
                  <td className={tdCls}>{t.ncc_ten}</td>
                  <td className={tdCls}><Badge tone={t.loai === 'hoan_coc' ? 'amber' : t.loai === 'thanh_toan' ? 'green' : 'brand'}>{THANH_TOAN_LOAI_LABEL[t.loai]}</Badge></td>
                  <td className={tdNum}><Tien v={n(t.so_tien)} /></td>
                  <td className={tdCls}>{t.tai_khoan}{t.sao_ke_id && <Landmark size={12} className="ml-1 inline text-brand-500" aria-label="Từ sao kê" />}</td>
                  <td className={`${tdCls} text-xs`}>
                    {t.event_advance_id && <div>Đề nghị TƯ: {eaMap.get(t.event_advance_id)?.supplier_name ?? '—'}</div>}
                    {t.chi_phi_id && <div>CP: {tenCp(t.chi_phi_id)}</div>}
                  </td>
                  <td className={`${tdCls} text-xs`}>{t.ghi_chu}</td>
                  <td className={tdCls}><HanhDong onSua={() => setTtForm(t)} onXoa={() => xoa(`/thanh-toan/${t.id}`, 'khoản thanh toán')} /></td>
                </tr>
              ))}
              {b.thanh_toan.length > 0 && (
                <tr className="bg-[#f8f9fa] font-bold">
                  <td className={tdCls} colSpan={3}>Tổng đã chi</td>
                  <td className={tdNum}><Tien v={b.thanh_toan.reduce((s, t) => s + n(t.so_tien), 0)} /></td>
                  <td className={tdCls} colSpan={4} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {b.event_advances.length > 0 && (
        <Card title="Đề nghị tạm ứng NCC">
          <div className="-m-4 overflow-x-auto">
            <table className={tblCls} style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th className={thCls}>NCC</th><th className={`${thCls} text-right`}>Tỷ lệ</th><th className={`${thCls} text-right`}>Đề nghị</th>
                  <th className={`${thCls} text-right`}>Đã chi</th><th className={thCls}>Trạng thái</th><th className={thCls} />
                </tr>
              </thead>
              <tbody>
                {b.event_advances.map((e) => (
                  <tr key={e.id}>
                    <td className={tdCls}>{e.supplier_name}{e.notes && <div className="text-xs text-gray-400">{e.notes}</div>}</td>
                    <td className={tdNum}>{n(e.advance_rate)}%</td>
                    <td className={tdNum}><Tien v={e.advance_amount} /></td>
                    <td className={tdNum}><Tien v={n(e.paid_amount)} /></td>
                    <td className={tdCls}><Badge tone={e.status === 'paid' ? 'green' : e.status === 'cancelled' ? 'red' : 'amber'}>{EA_STATUS[e.status] ?? e.status}</Badge></td>
                    <td className={tdCls}>
                      {e.status !== 'cancelled' && n(e.paid_amount) < n(e.advance_amount) && (
                        <button type="button" className={btnBrand} onClick={() => setTtForm({ loai: 'tam_ung', ngay: homNay(), so_tien: n(e.advance_amount) - n(e.paid_amount), event_advance_id: e.id, nha_cung_cap_id: e.nha_cung_cap_id, ncc_ten: e.supplier_name })}>Chi</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Công nợ theo NCC">
        <div className="-m-4 overflow-x-auto">
          <table className={tblCls} style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th className={thCls}>NCC</th><th className={`${thCls} text-right`}>Phải trả gồm VAT</th><th className={`${thCls} text-right`}>Đã trả</th>
                <th className={`${thCls} text-right`}>Còn nợ</th><th className={`${thCls} text-right`}>Hoá đơn đã nhận</th><th className={thCls}>Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {kq.congNoNcc.length === 0 && <EmptyRow cols={6} />}
              {kq.congNoNcc.map((r) => (
                <tr key={r.key} className={r.lechHoaDon ? 'bg-amber-50/40' : ''}>
                  <td className={tdCls}>{r.ncc_ten || '—'}</td>
                  <td className={tdNum}><Tien v={r.phaiTra} /></td>
                  <td className={tdNum}><Tien v={r.daTra} /></td>
                  <td className={tdNum}><Tien v={r.conNo} className={r.conNo > 0 ? 'font-semibold text-red-600' : ''} /></td>
                  <td className={tdNum}><Tien v={r.hoaDon} /></td>
                  <td className={`${tdCls} text-xs`}>
                    {r.lechHoaDon && <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={12} /> Hoá đơn lệch phải trả {formatTien(r.hoaDon - r.phaiTra)}</span>}
                    {r.conNo < 0 && <span className="text-red-600">Trả thừa {formatTien(-r.conNo)}</span>}
                  </td>
                </tr>
              ))}
              {kq.congNoNcc.length > 0 && (
                <tr className="bg-[#f8f9fa] font-bold">
                  <td className={tdCls}>Tổng</td>
                  <td className={tdNum}><Tien v={kq.congNoNcc.reduce((s, r) => s + r.phaiTra, 0)} /></td>
                  <td className={tdNum}><Tien v={kq.congNoNcc.reduce((s, r) => s + r.daTra, 0)} /></td>
                  <td className={tdNum}><Tien v={kq.tongCongNoNcc} /></td>
                  <td className={tdNum}><Tien v={kq.congNoNcc.reduce((s, r) => s + r.hoaDon, 0)} /></td>
                  <td className={tdCls} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {hdForm && <HoaDonForm ctx={ctx} init={hdForm} onClose={() => setHdForm(null)} />}
      {ttForm && <ThanhToanForm ctx={ctx} init={ttForm} onClose={() => setTtForm(null)} />}
      {dialog}
    </div>
  )
}

function HanhDong({ onSua, onXoa }: { onSua: () => void; onXoa: () => void }) {
  return (
    <div className="flex gap-1">
      <button type="button" aria-label="Sửa" onClick={onSua} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600"><Pencil size={14} /></button>
      <button type="button" aria-label="Xoá" onClick={onXoa} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
    </div>
  )
}

function HoaDonForm({ ctx, init, onClose }: { ctx: QtCtx; init: Partial<QtHoaDonNcc>; onClose: () => void }) {
  const [f, setF] = useState<Partial<QtHoaDonNcc>>(init)
  const [vatTay, setVatTay] = useState(init.id ? true : false)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof QtHoaDonNcc>(k: K, v: QtHoaDonNcc[K] | null | undefined) => setF((x) => ({ ...x, [k]: v }))
  const tienVat = vatTay && f.tien_vat != null ? n(f.tien_vat) : Math.round((n(f.gia_tri) * n(f.vat_rate)) / 100)
  return (
    <QtModal title={f.id ? 'Sửa hoá đơn đầu vào' : 'Thêm hoá đơn đầu vào'} onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
      <button type="button" className={btnBrand} disabled={busy} onClick={async () => {
        setBusy(true)
        const body = {
          nha_cung_cap_id: f.nha_cung_cap_id || null, ncc_ten: f.nha_cung_cap_id ? null : f.ncc_ten ?? null, so_hoa_don: f.so_hoa_don ?? null,
          ngay_hoa_don: f.ngay_hoa_don || null, gia_tri: n(f.gia_tri), vat_rate: n(f.vat_rate), tien_vat: tienVat,
          file_url: f.file_url ?? null, ghi_chu: f.ghi_chu ?? null,
        }
        const ok = await (f.id ? ctx.call('PATCH', `/hoa-don/${f.id}`, body) : ctx.call('POST', '/hoa-don', body))
        setBusy(false)
        if (ok) onClose()
      }}>Lưu</button>
    </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="NCC (danh mục)" className="col-span-2"><SelectMenu size="sm" value={f.nha_cung_cap_id ?? ''} options={nccOptions(ctx.b, { id: f.nha_cung_cap_id ?? null, ten: f.ncc_ten ?? null })} onChange={(v) => set('nha_cung_cap_id', v || null)} /></Field>
        {!f.nha_cung_cap_id && <Field label="Tên NCC" className="col-span-2"><input className={inputCls} value={f.ncc_ten ?? ''} onChange={(e) => set('ncc_ten', e.target.value)} /></Field>}
        <Field label="Số hoá đơn"><input className={inputCls} value={f.so_hoa_don ?? ''} onChange={(e) => set('so_hoa_don', e.target.value)} /></Field>
        <Field label="Ngày hoá đơn"><DateInput value={f.ngay_hoa_don ?? ''} onChange={(v) => set('ngay_hoa_don', v || null)} /></Field>
        <Field label="Giá trị trước thuế"><MoneyInput value={f.gia_tri ?? 0} onChange={(v) => set('gia_tri', v ?? 0)} /></Field>
        <Field label="VAT"><SelectMenu size="sm" value={String(f.vat_rate ?? 8)} options={VAT_OPTIONS} onChange={(v) => set('vat_rate', Number(v))} /></Field>
        <Field label="Tiền VAT">
          <MoneyInput value={tienVat} onChange={(v) => { setVatTay(true); set('tien_vat', v ?? 0) }} />
        </Field>
        <Field label="Tổng"><input className={inputCls} disabled value={formatTien(n(f.gia_tri) + tienVat)} /></Field>
        <Field label="Link file hoá đơn" className="col-span-2"><input className={inputCls} value={f.file_url ?? ''} onChange={(e) => set('file_url', e.target.value)} placeholder="https://" /></Field>
        <Field label="Ghi chú" className="col-span-2"><input className={inputCls} value={f.ghi_chu ?? ''} onChange={(e) => set('ghi_chu', e.target.value)} /></Field>
      </div>
    </QtModal>
  )
}

function ThanhToanForm({ ctx, init, onClose }: { ctx: QtCtx; init: Partial<QtThanhToanNcc>; onClose: () => void }) {
  const { b } = ctx
  const [f, setF] = useState<Partial<QtThanhToanNcc>>({ ...init, so_tien: init.so_tien != null ? Math.abs(n(init.so_tien)) : 0 })
  const [saoKe, setSaoKe] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof QtThanhToanNcc>(k: K, v: QtThanhToanNcc[K] | null | undefined) => setF((x) => ({ ...x, [k]: v }))
  const eaOpts = [{ value: '', label: '— Không theo đề nghị —' }, ...b.event_advances.filter((e) => e.status !== 'cancelled').map((e) => ({ value: e.id, label: `${e.supplier_name} · ${formatTien(e.advance_amount)}` }))]
  const cpOpts = [{ value: '', label: '— Không gắn —' }, ...b.chi_phi.filter((c) => c.nguoi_chi === 'ncc').map((c) => ({ value: c.id, label: `${c.ten}${c.ncc_ten ? ` · ${c.ncc_ten}` : ''}` }))]
  return (
    <QtModal title={f.id ? 'Sửa thanh toán NCC' : 'Thêm thanh toán NCC'} onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
      <button type="button" className={btnBrand} disabled={busy || !f.ngay} onClick={async () => {
        setBusy(true)
        const body = {
          nha_cung_cap_id: f.nha_cung_cap_id || null, ncc_ten: f.nha_cung_cap_id ? null : f.ncc_ten ?? null, loai: f.loai ?? 'thanh_toan',
          ngay: f.ngay, so_tien: f.loai === 'hoan_coc' ? -Math.abs(n(f.so_tien)) : n(f.so_tien), tai_khoan: f.tai_khoan ?? null,
          sao_ke_id: f.sao_ke_id ?? null, event_advance_id: f.event_advance_id || null, chi_phi_id: f.chi_phi_id || null, ghi_chu: f.ghi_chu ?? null,
        }
        const ok = await (f.id ? ctx.call('PATCH', `/thanh-toan/${f.id}`, body) : ctx.call('POST', '/thanh-toan', body))
        setBusy(false)
        if (ok) onClose()
      }}>Lưu</button>
    </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Chi theo đề nghị tạm ứng NCC" className="col-span-2">
          <SelectMenu size="sm" value={f.event_advance_id ?? ''} options={eaOpts} onChange={(v) => {
            const e = b.event_advances.find((x) => x.id === v)
            setF((x) => ({ ...x, event_advance_id: v || null, ...(e ? { nha_cung_cap_id: e.nha_cung_cap_id, ncc_ten: e.supplier_name, loai: 'tam_ung' as const } : {}) }))
          }} />
        </Field>
        <Field label="NCC (danh mục)" className="col-span-2"><SelectMenu size="sm" value={f.nha_cung_cap_id ?? ''} options={nccOptions(b, { id: f.nha_cung_cap_id ?? null, ten: f.ncc_ten ?? null })} onChange={(v) => set('nha_cung_cap_id', v || null)} /></Field>
        {!f.nha_cung_cap_id && <Field label="Tên NCC" className="col-span-2"><input className={inputCls} value={f.ncc_ten ?? ''} onChange={(e) => set('ncc_ten', e.target.value)} /></Field>}
        <Field label="Loại"><SelectMenu size="sm" value={f.loai ?? 'thanh_toan'} options={Object.entries(THANH_TOAN_LOAI_LABEL).map(([value, label]) => ({ value, label }))} onChange={(v) => set('loai', v as QtThanhToanNcc['loai'])} /></Field>
        <Field label="Ngày"><DateInput value={f.ngay ?? ''} onChange={(v) => set('ngay', v)} /></Field>
        <Field label={f.loai === 'hoan_coc' ? 'Số tiền NCC hoàn lại' : 'Số tiền'}><MoneyInput value={f.so_tien ?? 0} onChange={(v) => set('so_tien', Math.abs(v ?? 0))} /></Field>
        <Field label="Tài khoản"><input className={inputCls} value={f.tai_khoan ?? ''} onChange={(e) => set('tai_khoan', e.target.value)} /></Field>
        <Field label="Gắn dòng chi phí" className="col-span-2"><SelectMenu size="sm" value={f.chi_phi_id ?? ''} options={cpOpts} onChange={(v) => set('chi_phi_id', v || null)} /></Field>
        <Field label="Ghi chú" className="col-span-2"><input className={inputCls} value={f.ghi_chu ?? ''} onChange={(e) => set('ghi_chu', e.target.value)} /></Field>
        <div className="col-span-2 flex items-center gap-2">
          <button type="button" className={btnGhost} onClick={() => setSaoKe(true)}><Landmark size={13} /> Chọn từ sao kê</button>
          {f.sao_ke_id && <span className="text-xs text-emerald-700">Đã gắn sao kê <button type="button" className="ml-1 text-gray-400 underline" onClick={() => set('sao_ke_id', null)}>bỏ</button></span>}
        </div>
      </div>
      {saoKe && (
        <SaoKePicker loai="chi" goiY={f.ncc_ten ?? ''} onClose={() => setSaoKe(false)}
          onPick={(r) => setF((x) => ({ ...x, sao_ke_id: r.sao_ke_id, ngay: r.ngay ?? x.ngay, so_tien: r.so_tien, tai_khoan: r.tai_khoan, ghi_chu: x.ghi_chu || r.dien_giai || null }))} />
      )}
    </QtModal>
  )
}
