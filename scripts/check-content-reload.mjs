// Chạy trước `next build` (package.json). Quy tắc chung toàn ERP (2026-10-12): nút / thao tác "Làm mới"
// CHỈ tải lại vùng nội dung, không tải lại cả trang — mọi màn, kể cả màn thêm sau này.
//  1. Cấm window.location.reload() (và location.href = location.href) trong src/ — làm mới thì dùng
//     refresh() của useTopbar() (src/contexts/topbar.tsx). Chỗ thật sự phải tải lại cả trang (vd vừa đăng xuất)
//     ghi chú `cho-phep-tai-lai-ca-trang: <lý do>` ngay dòng đó hoặc dòng ngay trên.
//  2. Khung chung phải còn bọc vùng nội dung bằng cơ chế dựng lại (<ContentReload>).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SHELL = { file: 'src/components/AppShell.tsx', mark: '<ContentReload>' }
const BANNED = [/location\.reload\s*\(/, /location\.href\s*=\s*(window\.)?location\.href\b/]
const ALLOW = 'cho-phep-tai-lai-ca-trang'
const COMMENT = /^\s*(\/\/|\*|\/\*|\{\/\*)/   // dòng chú thích không tính

const root = process.cwd()
const errors = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(tsx?|jsx?|mjs)$/.test(name)) {
      const lines = readFileSync(p, 'utf8').split(/\r?\n/)
      lines.forEach((line, i) => {
        if (!COMMENT.test(line) && BANNED.some((re) => re.test(line)) && !line.includes(ALLOW) && !(lines[i - 1] ?? '').includes(ALLOW))
          errors.push(`${relative(root, p)}:${i + 1}  ${line.trim()}`)
      })
    }
  }
}
walk(join(root, 'src'))
if (!readFileSync(join(root, SHELL.file), 'utf8').includes(SHELL.mark))
  errors.push(`${SHELL.file}: vùng nội dung không còn bọc ${SHELL.mark} — nút Làm mới sẽ không dựng lại được trang`)

if (errors.length) {
  console.error('\n✖ Vi phạm quy tắc "Làm mới chỉ tải lại vùng nội dung" (scripts/check-content-reload.mjs):\n')
  for (const e of errors) console.error('  ' + e)
  console.error(`\n  → Dùng refresh() của useTopbar() (src/contexts/topbar.tsx) thay cho tải lại cả trang.\n    Bắt buộc tải lại cả trang thì ghi chú "${ALLOW}: <lý do>" ở dòng đó.\n`)
  process.exit(1)
}
console.log('✓ Làm mới chỉ tải lại vùng nội dung')
