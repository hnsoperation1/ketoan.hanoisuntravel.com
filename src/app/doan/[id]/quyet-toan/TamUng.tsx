'use client'

import { useState } from 'react'
import DateInput from '@/components/DateInput'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { formatDateTimeVN, formatDateVN, formatTien } from '@/lib/format'
import { TAM_UNG_TRANG_THAI_LABEL, type QtTamUng } from '@/lib/quyetToan'
import { Badge, Card, EmptyRow, Field, LyDoModal, MoneyInput, QtModal, Tien, btnBrand, btnDanger, btnGhost, btnPrimary, inputCls, tblCls, tdCls, tdNum, thCls, type QtCtx } from './shared'

const n = (v: unknown) => Number(v ?? 0) || 0
const homNay = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const TONE = { de_nghi: 'amber', da_chi: 'brand', da_quyet_toan: 'green', tu_choi: 'red' } as const
const EA_STATUS: Record<string, string> = { draft: 'Nháp', requested: 'Đã đề nghị', approved: 'Đã duyệt', paid: 'Đã chi', cancelled: 'Đã huỷ' }

export default function TamUng(ctx: QtCtx) {
  const { b, kq, khoa, call, ten } = ctx
  const { confirm, dialog } = useConfirmDialog()
  const [chi, setChi] = useState<QtTamUng | null>(null)
  const [qtoan, setQtoan] = useState<QtTamUng | null>(null)
  const [tuChoi, setTuChoi] = useState<QtTamUng | null>(null)

  return (
    <div className="space-y-4">
      <Card title="Tạm ứng điều hành" actions={<span className="text-xs text-gray-500">Chưa hoàn: <b className={kq.tamUngChuaHoan > 0 ? 'text-red-600' : ''}>{formatTien(kq.tamUngChuaHoan)}</b></span>}>
        <div className="-m-4 overflow-x-auto">
          <table className={tblCls} style={{ minWidth: 1100 }}>
            <thead><tr>
              <th className={thCls}>Người ứng</th><th className={thCls}>Ngày đề nghị</th><th className={`${thCls} text-right`}>Đề nghị</th>
              <th className={thCls}>Lý do</th><th className={thCls}>Trạng thái</th><th className={thCls}>Ngày chi</th>
              <th className={`${thCls} text-right`}>Đã chi</th><th className={`${thCls} text-right`}>Đã dùng</th><th className={`${thCls} text-right`}>Hoàn lại</th>
              <th className={thCls} />
            </tr></thead>
            <tbody>
              {b.tam_ung.length === 0 && <EmptyRow cols={10} text="Chưa có đề nghị tạm ứng." />}
              {b.tam_ung.map((t) => (
                <tr key={t.id}>
                  <td className={tdCls}>{ten(t.nguoi_ung) || '—'}</td>
                  <td className={tdCls}>{formatDateTimeVN(t.created_at)}</td>
                  <td className={tdNum}><Tien v={n(t.so_tien_de_nghi)} /></td>
                  <td className={`${tdCls} text-xs`}>{t.ly_do}{t.ghi_chu_ke_toan && <div className="text-gray-400">KT: {t.ghi_chu_ke_toan}</div>}</td>
                  <td className={tdCls}><Badge tone={TONE[t.trang_thai]}>{TAM_UNG_TRANG_THAI_LABEL[t.trang_thai]}</Badge></td>
                  <td className={tdCls}>{formatDateVN(t.ngay_chi)}{t.tai_khoan && <div className="text-xs text-gray-400">{t.tai_khoan}</div>}</td>
                  <td className={tdNum}><Tien v={t.so_tien_chi} /></td>
                  <td className={tdNum}><Tien v={t.so_tien_da_dung} /></td>
                  <td className={tdNum}>{t.so_tien_hoan == null ? <span className="text-gray-300">—</span> : <><Tien v={t.so_tien_hoan} />{n(t.so_tien_hoan) < 0 && <div className="text-[10px] text-red-500">công ty bù thêm</div>}</>}</td>
                  <td className={tdCls}>
                    {!khoa && (
                      <div className="flex flex-wrap gap-1">
                        {(t.trang_thai === 'de_nghi' || t.trang_thai === 'da_chi') && <button type="button" className={btnPrimary} onClick={() => setChi(t)}>{t.trang_thai === 'de_nghi' ? 'Chi' : 'Sửa chi'}</button>}
                        {t.trang_thai === 'de_nghi' && <button type="button" className={btnDanger} onClick={() => setTuChoi(t)}>Từ chối</button>}
                        {(t.trang_thai === 'da_chi' || t.trang_thai === 'da_quyet_toan') && <button type="button" className={btnBrand} onClick={() => setQtoan(t)}>Quyết toán</button>}
                        {t.trang_thai === 'da_quyet_toan' && (
                          <button type="button" className={btnGhost} onClick={async () => {
                            if (await confirm({ title: 'Huỷ quyết toán khoản tạm ứng này?', message: 'Khoản sẽ về trạng thái Đã chi.', confirmLabel: 'Huỷ quyết toán', tone: 'danger' })) void call('PATCH', `/tam-ung/${t.id}`, { action: 'huy_quyet_toan' })
                          }}>Huỷ QT</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Đề nghị tạm ứng NCC">
        {b.event_advances.length === 0 ? <p className="text-sm text-gray-500">Chưa có đề nghị tạm ứng NCC.</p> : (
          <div className="-m-4 overflow-x-auto">
            <table className={tblCls} style={{ minWidth: 700 }}>
              <thead><tr>
                <th className={thCls}>NCC</th><th className={`${thCls} text-right`}>Tỷ lệ</th><th className={`${thCls} text-right`}>Đề nghị</th>
                <th className={`${thCls} text-right`}>Đã chi</th><th className={thCls}>Ngày chi</th><th className={thCls}>Trạng thái</th>
              </tr></thead>
              <tbody>
                {b.event_advances.map((e) => (
                  <tr key={e.id}>
                    <td className={tdCls}>{e.supplier_name}</td>
                    <td className={tdNum}>{n(e.advance_rate)}%</td>
                    <td className={tdNum}><Tien v={e.advance_amount} /></td>
                    <td className={tdNum}><Tien v={n(e.paid_amount)} /></td>
                    <td className={tdCls}>{formatDateVN(e.paid_at)}</td>
                    <td className={tdCls}><Badge tone={e.status === 'paid' ? 'green' : e.status === 'cancelled' ? 'red' : 'amber'}>{EA_STATUS[e.status] ?? e.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {chi && <ChiModal ctx={ctx} t={chi} onClose={() => setChi(null)} />}
      {qtoan && <QuyetToanModal ctx={ctx} t={qtoan} onClose={() => setQtoan(null)} />}
      {tuChoi && (
        <LyDoModal title="Từ chối đề nghị tạm ứng" danger confirmLabel="Từ chối" onClose={() => setTuChoi(null)}
          onSubmit={(v) => call('PATCH', `/tam-ung/${tuChoi.id}`, { action: 'tu_choi', ly_do: v })} />
      )}
      {dialog}
    </div>
  )
}

function ChiModal({ ctx, t, onClose }: { ctx: QtCtx; t: QtTamUng; onClose: () => void }) {
  const [ngay, setNgay] = useState(t.ngay_chi ?? homNay())
  const [soTien, setSoTien] = useState<number | null>(t.so_tien_chi ?? n(t.so_tien_de_nghi))
  const [tk, setTk] = useState(t.tai_khoan ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <QtModal title={`Chi tạm ứng cho ${ctx.ten(t.nguoi_ung) || 'điều hành'}`} onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
      <button type="button" className={btnBrand} disabled={busy || !ngay || !soTien} onClick={async () => {
        setBusy(true)
        const ok = await ctx.call('PATCH', `/tam-ung/${t.id}`, { action: 'chi', ngay_chi: ngay, so_tien_chi: soTien, tai_khoan: tk })
        setBusy(false)
        if (ok) onClose()
      }}>Lưu</button>
    </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày chi"><DateInput value={ngay} onChange={setNgay} /></Field>
        <Field label="Số tiền chi"><MoneyInput value={soTien} onChange={setSoTien} /></Field>
        <Field label="Tài khoản" className="col-span-2"><input className={inputCls} value={tk} onChange={(e) => setTk(e.target.value)} /></Field>
      </div>
      <p className="mt-3 text-xs text-gray-500">Đề nghị: {formatTien(n(t.so_tien_de_nghi))}{t.ly_do ? ` · ${t.ly_do}` : ''}</p>
    </QtModal>
  )
}

function QuyetToanModal({ ctx, t, onClose }: { ctx: QtCtx; t: QtTamUng; onClose: () => void }) {
  const [daDung, setDaDung] = useState<number | null>(t.so_tien_da_dung ?? n(t.so_tien_chi))
  const [busy, setBusy] = useState(false)
  const hoan = n(t.so_tien_chi) - n(daDung)
  return (
    <QtModal title="Quyết toán tạm ứng" onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Huỷ</button>
      <button type="button" className={btnBrand} disabled={busy || daDung == null} onClick={async () => {
        setBusy(true)
        const ok = await ctx.call('PATCH', `/tam-ung/${t.id}`, { action: 'quyet_toan', so_tien_da_dung: daDung })
        setBusy(false)
        if (ok) onClose()
      }}>Lưu</button>
    </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Đã chi"><input className={inputCls} disabled value={formatTien(n(t.so_tien_chi))} /></Field>
        <Field label="Số tiền đã dùng"><MoneyInput value={daDung} onChange={setDaDung} /></Field>
      </div>
      <p className="mt-3 text-sm">{hoan >= 0 ? <>Người ứng hoàn lại: <b>{formatTien(hoan)}</b></> : <>Công ty bù thêm cho người ứng: <b className="text-red-600">{formatTien(-hoan)}</b></>}</p>
    </QtModal>
  )
}
