'use client'

import { Fragment, useMemo } from 'react'
import { laChuyenNoiBo, tongHopTheoMa, type DongSaoKe, type DongTheoMa } from '@/lib/saoKeTongHop'

const tien = (v: number) => (v ? Math.round(v).toLocaleString('vi-VN') : '—')

// Nhóm tài khoản theo chữ số đầu của mã (hệ thống tài khoản VAS)
const LOAI: Record<string, string> = {
  '1': 'Tài sản', '2': 'Tài sản dài hạn', '3': 'Nợ phải trả', '4': 'Vốn chủ sở hữu', '5': 'Doanh thu',
  '6': 'Chi phí', '7': 'Thu nhập khác', '8': 'Chi phí khác', '9': 'Xác định kết quả',
}

// Tổng thu/chi theo tài khoản kế toán đối ứng (cột Mã) trong kỳ — thay khối "TỔNG CỘNG" dán tay cuối mỗi sheet.
// Mã 111x/112x (tiền mặt, ngân hàng) = chuyển tiền giữa các quỹ của mình → tách riêng, không tính vào tổng thu/chi thật.
// Bấm 1 dòng → sang tab Giao dịch lọc theo mã đó.
export function TheoMaTab({ rows, tu, den, tenMa, onChonMa }: {
  rows: DongSaoKe[]
  tu: string
  den: string
  tenMa: Map<string, string>
  onChonMa: (ma: string) => void
}) {
  const ds = useMemo(() => tongHopTheoMa(rows, tu, den), [rows, tu, den])

  const nhom = useMemo(() => {
    const thuong = ds.filter((d) => d.ma && !laChuyenNoiBo(d.ma))
    const g = new Map<string, DongTheoMa[]>()
    for (const d of thuong) {
      const k = LOAI[d.ma[0]] ? d.ma[0] : '?'
      g.set(k, [...(g.get(k) ?? []), d])
    }
    const out = [...g.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ ten: LOAI[k] ?? 'Mã khác', ds: v }))
    const noiBo = ds.filter((d) => laChuyenNoiBo(d.ma))
    const chuaMa = ds.filter((d) => !d.ma)
    return { out, noiBo, chuaMa }
  }, [ds])

  const cong = (v: DongTheoMa[]) => v.reduce((a, d) => ({ thu: a.thu + d.thu, chi: a.chi + d.chi, so_dong: a.so_dong + d.so_dong }), { thu: 0, chi: 0, so_dong: 0 })
  const that = cong([...nhom.out.flatMap((g) => g.ds), ...nhom.chuaMa])
  const noiBo = cong(nhom.noiBo)

  const th = 'px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50'
  const td = 'px-3 py-2 whitespace-nowrap text-right tabular-nums'

  const dong = (d: DongTheoMa) => (
    <tr key={d.ma || '_'} onClick={() => onChonMa(d.ma)} className="hover:bg-brand-50/50 cursor-pointer">
      <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">{d.ma || '—'}</td>
      <td className="px-3 py-2 text-gray-700">{d.ma ? tenMa.get(d.ma) ?? <span className="text-amber-600">Chưa có trong hệ thống tài khoản</span> : 'Chưa ghi mã'}</td>
      <td className={`${td} text-emerald-600`}>{tien(d.thu)}</td>
      <td className={`${td} text-red-500`}>{tien(d.chi)}</td>
      <td className={`${td} ${d.thu - d.chi < 0 ? 'text-red-600' : 'text-gray-700'}`}>{tien(d.thu - d.chi)}</td>
      <td className={`${td} text-gray-400`}>{d.so_dong.toLocaleString('vi-VN')}</td>
    </tr>
  )
  const dongCong = (ten: string, c: { thu: number; chi: number; so_dong: number }, dam = false) => (
    <tr className={dam ? 'border-t-2 border-gray-200 font-bold' : 'bg-gray-50/40 font-semibold'}>
      <td colSpan={2} className={`px-3 py-2 ${dam ? 'text-gray-800' : 'text-gray-600 text-xs'}`}>{ten}</td>
      <td className={`${td} text-emerald-700`}>{tien(c.thu)}</td>
      <td className={`${td} text-red-600`}>{tien(c.chi)}</td>
      <td className={`${td} text-gray-800`}>{tien(c.thu - c.chi)}</td>
      <td className={`${td} text-gray-500`}>{c.so_dong.toLocaleString('vi-VN')}</td>
    </tr>
  )
  const tieuDe = (ten: string) => (
    <tr className="bg-gray-50/60"><td colSpan={6} className="px-3 py-1.5 text-xs font-bold text-gray-700">{ten}</td></tr>
  )

  if (!ds.length) return <p className="py-14 text-center text-gray-400 text-sm">Không có giao dịch nào trong kỳ.</p>

  return (
    <div className="bg-white border border-gray-100 shadow-sm overflow-x-auto">
      <table className="text-sm w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className={`${th} text-left w-24`}>Mã</th>
            <th className={`${th} text-left`}>Tài khoản kế toán</th>
            <th className={`${th} text-right`}>Thu</th>
            <th className={`${th} text-right`}>Chi</th>
            <th className={`${th} text-right`}>Chênh lệch</th>
            <th className={`${th} text-right`}>Số dòng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {nhom.out.map((g) => (
            <Fragment key={g.ten}>
              {tieuDe(g.ten)}
              {g.ds.map(dong)}
            </Fragment>
          ))}
          {nhom.chuaMa.length > 0 && (
            <>
              {tieuDe('Chưa ghi mã')}
              {nhom.chuaMa.map(dong)}
            </>
          )}
          {dongCong('Tổng thu / chi (không gồm chuyển nội bộ)', that, true)}
          {nhom.noiBo.length > 0 && (
            <>
              {tieuDe('Chuyển tiền giữa các quỹ / tài khoản của mình (111x, 112x)')}
              {nhom.noiBo.map(dong)}
              {dongCong('Cộng chuyển nội bộ', noiBo)}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
