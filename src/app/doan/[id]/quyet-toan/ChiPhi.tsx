'use client'

import { Fragment, useMemo, useState } from 'react'
import { ExternalLink, FileCheck2, Pencil, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { SelectMenu } from '@/components/SelectMenu'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { formatDateTimeVN, formatTien } from '@/lib/format'
import { NGUOI_CHI_LABEL, NGUON_LABEL, tinhDongChiPhi, type QtChiPhi } from '@/lib/quyetToan'
import {
  Badge, Card, EmptyRow, Field, MoneyInput, QtModal, Tien, VAT_OPTIONS, btnBrand, btnGhost, btnPrimary, inputCls, nccOptions,
  tblCls, tdCls, tdNum, thCls, type QtCtx,
} from './shared'

const n = (v: unknown) => Number(v ?? 0) || 0
const thieuChungTu = (c: QtChiPhi) => c.nguoi_chi === 'ncc' && !c.co_hd_ncc && !c.hoa_don_id

type Form = {
  id?: string; nhom: string; ten: string; dvt: string; so_luong: number | null; so_lan: number | null; don_gia: number | null
  gia_gom_vat: boolean; vat_rate: number; nguoi_chi: 'ncc' | 'hns' | 'com'; nha_cung_cap_id: string; ncc_ten: string; ghi_chu: string
}

const SO_SANH = ['ten', 'so_luong', 'so_lan', 'don_gia', 'vat_rate', 'gia_gom_vat', 'nguoi_chi', 'nha_cung_cap_id', 'ncc_ten'] as const

export default function ChiPhi(ctx: QtCtx) {
  const { b, khoa, call } = ctx
  const { confirm, dialog } = useConfirmDialog()
  const [chiThieu, setChiThieu] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [chungTu, setChungTu] = useState<QtChiPhi | null>(null)

  // Dự chi theo service_id (bản gửi gần nhất)
  const duChiMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of b.du_chi[0]?.lines ?? []) if (l.service_id) m.set(l.service_id, (m.get(l.service_id) ?? 0) + n(l.thanh_tien))
    return m
  }, [b.du_chi])

  // So lần gửi gần nhất với lần trước (qt_gui_ban_chup)
  const diff = useMemo(() => {
    const [moi, cu] = b.gui_ban_chup
    if (!moi || !cu) return null
    const cuMap = new Map((cu.chi_phi ?? []).map((r) => [r.id, r]))
    const moiIds = new Set((moi.chi_phi ?? []).map((r) => r.id))
    const trangThai = new Map<string, 'moi' | 'sua'>()
    for (const r of moi.chi_phi ?? []) {
      const c = cuMap.get(r.id)
      if (!c) trangThai.set(r.id, 'moi')
      else if (SO_SANH.some((k) => String(r[k] ?? '') !== String(c[k] ?? ''))) trangThai.set(r.id, 'sua')
    }
    const daXoa = (cu.chi_phi ?? []).filter((r) => !moiIds.has(r.id))
    return { trangThai, daXoa, lanMoi: moi.lan, lanCu: cu.lan }
  }, [b.gui_ban_chup])

  const rows = chiThieu ? b.chi_phi.filter(thieuChungTu) : b.chi_phi
  const nhomList: string[] = []
  for (const r of rows) if (!nhomList.includes(r.nhom ?? '')) nhomList.push(r.nhom ?? '')
  const soThieu = b.chi_phi.filter(thieuChungTu).length
  const hoaDonOpts = [{ value: '', label: '— Không gắn —' }, ...b.hoa_don.map((h) => ({ value: h.id, label: `${h.so_hoa_don || 'Không số'} · ${h.ncc_ten ?? ''} · ${formatTien(h.tong)}` }))]

  const tong = rows.reduce((s, r) => s + n(r.thanh_tien), 0)
  const tongVat = rows.reduce((s, r) => s + n(r.tien_vat), 0)
  const tongDuChi = rows.reduce((s, r) => s + (r.service_id ? duChiMap.get(r.service_id) ?? 0 : 0), 0)

  async function luu(f: Form) {
    const body = {
      nhom: f.nhom, ten: f.ten, dvt: f.dvt, so_luong: f.so_luong ?? 0, so_lan: f.so_lan ?? 1, don_gia: f.don_gia ?? 0,
      gia_gom_vat: f.gia_gom_vat, vat_rate: f.vat_rate, nguoi_chi: f.nguoi_chi,
      nha_cung_cap_id: f.nha_cung_cap_id || null, ncc_ten: f.nha_cung_cap_id ? null : f.ncc_ten, ghi_chu: f.ghi_chu,
    }
    return f.id ? call('PATCH', `/chi-phi/${f.id}`, body) : call('POST', '/chi-phi', body)
  }

  return (
    <div className="space-y-4">
      <Card title="Chi phí thực tế" actions={<>
        <button type="button" onClick={() => setChiThieu((v) => !v)}
          className={clsx('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold', chiThieu ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
          Thiếu chứng từ {soThieu > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{soThieu}</span>}
        </button>
        {!khoa && (
          <button type="button" className={btnPrimary} onClick={() => setForm({ nhom: '', ten: '', dvt: '', so_luong: 1, so_lan: 1, don_gia: 0, gia_gom_vat: false, vat_rate: 8, nguoi_chi: 'ncc', nha_cung_cap_id: '', ncc_ten: '', ghi_chu: '' })}>
            <Plus size={13} /> Thêm dòng kế toán
          </button>
        )}
      </>}>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          {b.qt?.lan_gui ? <span>Đã gửi kế toán lần {b.qt.lan_gui}{b.qt.gui_ke_toan_at ? ` · ${formatDateTimeVN(b.qt.gui_ke_toan_at)}` : ''}</span> : null}
          {diff && <span className="text-amber-700">Đang so lần {diff.lanMoi} với lần {diff.lanCu}: {diff.trangThai.size} dòng mới/sửa, {diff.daXoa.length} dòng xoá</span>}
        </div>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className={tblCls} style={{ minWidth: 1500 }}>
          <thead>
            <tr>
              <th className={thCls}>STT</th>
              <th className={thCls}>Dịch vụ</th>
              <th className={thCls}>Nguồn</th>
              <th className={thCls}>ĐVT</th>
              <th className={`${thCls} text-right`}>SL</th>
              <th className={`${thCls} text-right`}>Số lần</th>
              <th className={`${thCls} text-right`}>Đơn giá</th>
              <th className={`${thCls} text-right`}>VAT</th>
              <th className={`${thCls} text-right`}>Thành tiền</th>
              <th className={`${thCls} text-right`}>Tiền VAT</th>
              <th className={thCls}>Người chi</th>
              <th className={`${thCls} text-right`}>Dự chi</th>
              <th className={`${thCls} text-right`}>Chênh lệch</th>
              <th className={thCls}>Chứng từ</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow cols={15} text={chiThieu ? 'Không có dòng thiếu chứng từ.' : 'Điều hành chưa nhập chi phí thực tế.'} />}
            {nhomList.map((g) => {
              const ls = rows.filter((r) => (r.nhom ?? '') === g)
              return (
                <Fragment key={g || '_'}>
                  {g && <tr className="bg-brand-50/40"><td className={`${tdCls} font-semibold`} colSpan={15}>{g}</td></tr>}
                  {ls.map((r) => {
                    const dc = r.service_id ? duChiMap.get(r.service_id) ?? null : null
                    const tt = diff?.trangThai.get(r.id)
                    const laKt = r.nguon === 'ke_toan'
                    const hd = r.hoa_don_id ? b.hoa_don.find((h) => h.id === r.hoa_don_id) : null
                    return (
                      <tr key={r.id} className={clsx(thieuChungTu(r) && 'bg-red-50/30')}>
                        <td className={tdCls}>{rows.indexOf(r) + 1}</td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5">
                            <span>{r.ten}</span>
                            {tt === 'moi' && <Badge tone="green">Mới</Badge>}
                            {tt === 'sua' && <Badge tone="amber">Sửa</Badge>}
                          </div>
                          {r.ghi_chu && <div className="text-xs text-gray-400">{r.ghi_chu}</div>}
                        </td>
                        <td className={tdCls}><Badge tone={laKt ? 'violet' : r.nguon === 'phat_sinh' ? 'amber' : 'gray'}>{NGUON_LABEL[r.nguon]}</Badge></td>
                        <td className={tdCls}>{r.dvt}</td>
                        <td className={tdNum}>{n(r.so_luong).toLocaleString('vi-VN')}</td>
                        <td className={tdNum}>{n(r.so_lan).toLocaleString('vi-VN')}</td>
                        <td className={tdNum}><Tien v={n(r.don_gia)} />{r.gia_gom_vat && <div className="text-[10px] text-gray-400">gồm VAT</div>}</td>
                        <td className={tdNum}>{n(r.vat_rate)}%</td>
                        <td className={tdNum}><Tien v={n(r.thanh_tien)} /></td>
                        <td className={tdNum}><Tien v={n(r.tien_vat)} /></td>
                        <td className={tdCls}>
                          <span className="font-medium">{NGUOI_CHI_LABEL[r.nguoi_chi]}</span>
                          {r.ncc_ten && <div className="max-w-[180px] truncate text-xs text-gray-500" title={r.ncc_ten}>{r.ncc_ten}</div>}
                        </td>
                        <td className={tdNum}><Tien v={dc} /></td>
                        <td className={tdNum}>{dc == null ? <span className="text-gray-300">—</span> : <Tien v={n(r.thanh_tien) - dc} className={n(r.thanh_tien) - dc > 0 ? 'text-red-600' : 'text-emerald-600'} />}</td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" aria-label="Có hoá đơn NCC" disabled={khoa} checked={r.co_hd_ncc}
                              onChange={(e) => call('PATCH', `/chi-phi/${r.id}`, { co_hd_ncc: e.target.checked })} className="h-4 w-4 accent-brand-600" />
                            {hd && <span className="text-xs text-emerald-700">HĐ {hd.so_hoa_don || '—'}</span>}
                            {r.hd_ncc_url && <a href={r.hd_ncc_url} target="_blank" rel="noopener noreferrer" className="text-brand-600" aria-label="Mở file hoá đơn"><ExternalLink size={13} /></a>}
                            {!khoa && <button type="button" onClick={() => setChungTu(r)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600" aria-label="Sửa chứng từ"><FileCheck2 size={14} /></button>}
                          </div>
                        </td>
                        <td className={tdCls}>
                          {laKt && !khoa && (
                            <div className="flex gap-1">
                              <button type="button" aria-label="Sửa dòng" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600"
                                onClick={() => setForm({ id: r.id, nhom: r.nhom ?? '', ten: r.ten, dvt: r.dvt ?? '', so_luong: n(r.so_luong), so_lan: n(r.so_lan), don_gia: n(r.don_gia), gia_gom_vat: r.gia_gom_vat, vat_rate: n(r.vat_rate), nguoi_chi: r.nguoi_chi, nha_cung_cap_id: r.nha_cung_cap_id ?? '', ncc_ten: r.ncc_ten ?? '', ghi_chu: r.ghi_chu ?? '' })}>
                                <Pencil size={14} />
                              </button>
                              <button type="button" aria-label="Xoá dòng" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                onClick={async () => { if (await confirm({ title: 'Xoá dòng chi phí này?', message: r.ten, tone: 'danger', confirmLabel: 'Xoá' })) void call('DELETE', `/chi-phi/${r.id}`) }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
            {rows.length > 0 && (
              <tr className="bg-[#f8f9fa] font-bold">
                <td className={tdCls} colSpan={8}>Tổng cộng{b.qt?.com_khach ? ', chưa gồm COM khách' : ''}</td>
                <td className={tdNum}><Tien v={tong} /></td>
                <td className={tdNum}><Tien v={tongVat} /></td>
                <td className={tdCls} />
                <td className={tdNum}><Tien v={tongDuChi} /></td>
                <td className={tdNum}><Tien v={tong - tongDuChi} /></td>
                <td className={tdCls} colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {diff && diff.daXoa.length > 0 && (
        <Card title={`Dòng đã xoá so với lần gửi ${diff.lanCu}`}>
          <ul className="space-y-1 text-sm text-gray-600">
            {diff.daXoa.map((r) => <li key={r.id} className="line-through decoration-red-400">{r.ten} · {formatTien(n(r.thanh_tien))}</li>)}
          </ul>
        </Card>
      )}

      {form && <ChiPhiForm ctx={ctx} form={form} onClose={() => setForm(null)} onSave={luu} />}
      {chungTu && (
        <ChungTuModal row={chungTu} hoaDonOpts={hoaDonOpts} onClose={() => setChungTu(null)}
          onSave={(v) => call('PATCH', `/chi-phi/${chungTu.id}`, v)} />
      )}
      {dialog}
    </div>
  )
}

function ChiPhiForm({ ctx, form, onClose, onSave }: { ctx: QtCtx; form: Form; onClose: () => void; onSave: (f: Form) => Promise<boolean> }) {
  const [f, setF] = useState<Form>(form)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const xem = tinhDongChiPhi({ so_luong: f.so_luong ?? 0, so_lan: f.so_lan ?? 1, don_gia: f.don_gia ?? 0, gia_gom_vat: f.gia_gom_vat, vat_rate: f.vat_rate })
  const nhomGoiY = [...new Set(ctx.b.chi_phi.map((c) => c.nhom).filter((x): x is string => !!x))]
  return (
    <QtModal title={f.id ? 'Sửa dòng chi phí kế toán' : 'Thêm dòng chi phí kế toán'} onClose={onClose} wide footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
      <button type="button" className={btnBrand} disabled={busy || !f.ten.trim()} onClick={async () => { setBusy(true); const ok = await onSave(f); setBusy(false); if (ok) onClose() }}>Lưu</button>
    </>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Nhóm" className="col-span-2">
          <input className={inputCls} value={f.nhom} onChange={(e) => set('nhom', e.target.value)} />
          {nhomGoiY.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {nhomGoiY.map((g) => (
                <button key={g} type="button" onClick={() => set('nhom', g)}
                  className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', f.nhom === g ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>{g}</button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Dịch vụ" className="col-span-2"><input className={inputCls} value={f.ten} onChange={(e) => set('ten', e.target.value)} autoFocus /></Field>
        <Field label="ĐVT"><input className={inputCls} value={f.dvt} onChange={(e) => set('dvt', e.target.value)} /></Field>
        <Field label="SL"><MoneyInput thapPhan value={f.so_luong} onChange={(v) => set('so_luong', v)} /></Field>
        <Field label="Số lần"><MoneyInput thapPhan value={f.so_lan} onChange={(v) => set('so_lan', v)} /></Field>
        <Field label="Đơn giá"><MoneyInput value={f.don_gia} onChange={(v) => set('don_gia', v)} /></Field>
        <Field label="VAT"><SelectMenu size="sm" value={String(f.vat_rate)} options={VAT_OPTIONS} onChange={(v) => set('vat_rate', Number(v))} /></Field>
        <Field label="Đơn giá đã gồm VAT">
          <SelectMenu size="sm" value={f.gia_gom_vat ? '1' : '0'} options={[{ value: '0', label: 'Chưa gồm' }, { value: '1', label: 'Đã gồm' }]} onChange={(v) => set('gia_gom_vat', v === '1')} />
        </Field>
        <Field label="Người chi">
          <SelectMenu size="sm" value={f.nguoi_chi} options={Object.entries(NGUOI_CHI_LABEL).map(([value, label]) => ({ value, label }))} onChange={(v) => set('nguoi_chi', v as Form['nguoi_chi'])} />
        </Field>
        <Field label="NCC (danh mục)"><SelectMenu size="sm" value={f.nha_cung_cap_id} options={nccOptions(ctx.b)} onChange={(v) => set('nha_cung_cap_id', v)} /></Field>
        {!f.nha_cung_cap_id && <Field label="Tên NCC" className="col-span-2"><input className={inputCls} value={f.ncc_ten} onChange={(e) => set('ncc_ten', e.target.value)} /></Field>}
        <Field label="Ghi chú" className="col-span-2 md:col-span-4"><input className={inputCls} value={f.ghi_chu} onChange={(e) => set('ghi_chu', e.target.value)} /></Field>
      </div>
      <p className="mt-3 text-xs text-gray-500">Thành tiền chưa VAT <b>{formatTien(xem.thanhTien)}</b> · VAT <b>{formatTien(xem.tienVat)}</b> · Tổng <b>{formatTien(xem.tong)}</b></p>
    </QtModal>
  )
}

function ChungTuModal({ row, hoaDonOpts, onClose, onSave }: {
  row: QtChiPhi
  hoaDonOpts: { value: string; label: string }[]
  onClose: () => void
  onSave: (v: { co_hd_ncc: boolean; hd_ncc_url: string | null; hoa_don_id: string | null }) => Promise<boolean>
}) {
  const [co, setCo] = useState(row.co_hd_ncc)
  const [url, setUrl] = useState(row.hd_ncc_url ?? '')
  const [hd, setHd] = useState(row.hoa_don_id ?? '')
  return (
    <QtModal title={`Chứng từ: ${row.ten}`} onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
      <button type="button" className={btnBrand} onClick={async () => { if (await onSave({ co_hd_ncc: co, hd_ncc_url: url.trim() || null, hoa_don_id: hd || null })) onClose() }}>Lưu</button>
    </>}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={co} onChange={(e) => setCo(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Có hoá đơn / hợp đồng NCC</label>
        <Field label="Link file hoá đơn / chứng từ"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
        <Field label="Gắn hoá đơn đầu vào"><SelectMenu size="sm" value={hd} options={hoaDonOpts} onChange={setHd} /></Field>
      </div>
    </QtModal>
  )
}
