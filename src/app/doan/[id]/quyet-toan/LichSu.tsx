'use client'

import { formatDateTimeVN } from '@/lib/format'
import { nhanLichSu } from '@/lib/quyetToanBundle'
import { Card, EmptyRow, tblCls, tdCls, thCls, type QtCtx } from './shared'

export default function LichSu({ b, ten }: QtCtx) {
  return (
    <Card title="Lịch sử thao tác">
      <div className="-m-4 overflow-x-auto">
        <table className={tblCls} style={{ minWidth: 700 }}>
          <thead><tr><th className={thCls}>Thời gian</th><th className={thCls}>Người</th><th className={thCls}>Thao tác</th><th className={thCls}>Lý do</th></tr></thead>
          <tbody>
            {b.lich_su.length === 0 && <EmptyRow cols={4} />}
            {b.lich_su.map((h) => {
              const lan = h.meta && typeof h.meta === 'object' && 'lan' in h.meta ? ` lần ${String(h.meta.lan)}` : ''
              return (
                <tr key={h.id}>
                  <td className={`${tdCls} whitespace-nowrap`}>{formatDateTimeVN(h.created_at)}</td>
                  <td className={tdCls}>{ten(h.user_id) || '—'}</td>
                  <td className={tdCls}>{nhanLichSu(h.hanh_dong)}{lan}</td>
                  <td className={`${tdCls} text-xs`}>{h.ly_do}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
