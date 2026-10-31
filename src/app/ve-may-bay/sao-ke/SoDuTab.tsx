'use client'

import { Fragment, useMemo } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { tinhSoDu, type DongSaoKe, type SoDuTaiKhoan } from '@/lib/saoKeTongHop'

type TaiKhoan = { ma: string; ten: string; so_tai_khoan: string | null; ngan_hang: string | null; chu_so_huu: string; chu_tai_khoan: string | null; loai_tien: string }

const tien = (v: number, usd = false) =>
  usd ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('vi-VN')

// Số dư đầu kỳ / thu / chi / vay / cuối kỳ của từng tài khoản trong kỳ đang chọn, nhóm Công ty / Cá nhân,
// cộng nhóm chỉ tài khoản VND (USD hiện riêng theo USD). Cột "Sheet" = kiểm tra cột dư cuối kỳ kế toán ghi
// trên sheet có khớp cộng dồn thu − chi + vay không (trên cả sheet, không theo kỳ).
export function SoDuTab({ rows, taiKhoans, hienTk, tu, den }: {
  rows: DongSaoKe[]
  taiKhoans: TaiKhoan[]
  hienTk: (ma: string) => boolean
  tu: string
  den: string
}) {
  const soDu = useMemo(() => tinhSoDu(rows, tu, den), [rows, tu, den])

  const nhom = useMemo(() => {
    const ds = taiKhoans.filter((t) => hienTk(t.ma) && soDu.has(t.ma))
    return [
      { ten: 'Công ty', ds: ds.filter((t) => t.chu_so_huu !== 'ca_nhan') },
      { ten: 'Cá nhân', ds: ds.filter((t) => t.chu_so_huu === 'ca_nhan') },
    ].filter((g) => g.ds.length)
  }, [taiKhoans, hienTk, soDu])

  const cong = (ds: TaiKhoan[]) => {
    const vnd = ds.filter((t) => t.loai_tien === 'VND').map((t) => soDu.get(t.ma)!)
    const s = (k: keyof Pick<SoDuTaiKhoan, 'dau_ky' | 'thu' | 'chi' | 'vay' | 'cuoi_ky'>) => vnd.reduce((a, t) => a + t[k], 0)
    return { dau_ky: s('dau_ky'), thu: s('thu'), chi: s('chi'), vay: s('vay'), cuoi_ky: s('cuoi_ky') }
  }
  const tong = cong(nhom.flatMap((g) => g.ds))

  const th = 'px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50'
  const td = 'px-3 py-2 whitespace-nowrap text-right tabular-nums'

  if (!nhom.length) return <p className="py-14 text-center text-gray-400 text-sm">Không có tài khoản nào khớp bộ lọc.</p>

  return (
    <div className="bg-white border border-gray-100 shadow-sm overflow-x-auto">
      <table className="text-sm w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className={`${th} text-left`}>Tài khoản</th>
            <th className={`${th} text-right`}>Đầu kỳ</th>
            <th className={`${th} text-right`}>Thu</th>
            <th className={`${th} text-right`}>Chi</th>
            <th className={`${th} text-right`}>Vay</th>
            <th className={`${th} text-right`}>Cuối kỳ</th>
            <th className={`${th} text-left`}>Sheet</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {nhom.map((g) => {
            const c = cong(g.ds)
            return (
              <Fragment key={g.ten}>
                <tr className="bg-gray-50/60">
                  <td colSpan={7} className="px-3 py-1.5 text-xs font-bold text-gray-700">{g.ten}</td>
                </tr>
                {g.ds.map((t) => {
                  const s = soDu.get(t.ma)!
                  const usd = t.loai_tien === 'USD'
                  const khop = s.cuoi_ky_sheet == null || Math.abs(s.cuoi_ky_sheet - s.cuoi_sheet_tinh) < 1
                  return (
                    <tr key={t.ma} className="hover:bg-gray-50/70">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-800">{t.ten}{usd && <span className="ml-1.5 text-[11px] font-semibold text-violet-600">USD</span>}</p>
                        <p className="text-xs text-gray-400">{[t.ngan_hang, t.so_tai_khoan, t.chu_tai_khoan].filter(Boolean).join(' · ') || 'Quỹ tiền mặt'}</p>
                      </td>
                      <td className={`${td} text-gray-600`}>{tien(s.dau_ky, usd)}</td>
                      <td className={`${td} text-emerald-600`}>{s.thu ? tien(s.thu, usd) : '—'}</td>
                      <td className={`${td} text-red-500`}>{s.chi ? tien(s.chi, usd) : '—'}</td>
                      <td className={`${td} text-gray-500`}>{s.vay ? tien(s.vay, usd) : '—'}</td>
                      <td className={`${td} font-semibold ${s.cuoi_ky < 0 ? 'text-red-600' : 'text-gray-900'}`}>{tien(s.cuoi_ky, usd)}</td>
                      <td className="px-3 py-2 text-xs">
                        {khop ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={13} /> Khớp</span>
                        ) : (
                          <div className="text-amber-700">
                            <span className="inline-flex items-center gap-1 font-semibold"><AlertTriangle size={13} /> Lệch {tien(s.cuoi_ky_sheet! - s.cuoi_sheet_tinh, usd)}</span>
                            {s.cho_lech.map((l, i) => (
                              <p key={i} className="text-[11px] text-amber-700/80 max-w-[260px] truncate" title={l.dien_giai ?? ''}>
                                {l.ngay ?? '—'}: {l.chenh > 0 ? '+' : ''}{tien(l.chenh, usd)} · {l.dien_giai ?? ''}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {nhom.length > 1 && (
                  <tr className="bg-gray-50/40 font-semibold">
                    <td className="px-3 py-2 text-gray-600 text-xs">Cộng {g.ten.toLowerCase()} (VND)</td>
                    <td className={`${td} text-gray-700`}>{tien(c.dau_ky)}</td>
                    <td className={`${td} text-emerald-700`}>{tien(c.thu)}</td>
                    <td className={`${td} text-red-600`}>{tien(c.chi)}</td>
                    <td className={`${td} text-gray-600`}>{c.vay ? tien(c.vay) : '—'}</td>
                    <td className={`${td} text-gray-900`}>{tien(c.cuoi_ky)}</td>
                    <td />
                  </tr>
                )}
              </Fragment>
            )
          })}
          <tr className="border-t-2 border-gray-200 font-bold">
            <td className="px-3 py-2.5 text-gray-800">Tổng (VND)</td>
            <td className={`${td} text-gray-800`}>{tien(tong.dau_ky)}</td>
            <td className={`${td} text-emerald-700`}>{tien(tong.thu)}</td>
            <td className={`${td} text-red-600`}>{tien(tong.chi)}</td>
            <td className={`${td} text-gray-700`}>{tong.vay ? tien(tong.vay) : '—'}</td>
            <td className={`${td} text-gray-900`}>{tien(tong.cuoi_ky)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
