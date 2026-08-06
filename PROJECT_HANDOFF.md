# PROJECT_HANDOFF.md — ketoan.hanoisuntravel.com

> File này gom toàn bộ ngữ cảnh dự án (kiến trúc, quyết định, quy ước làm việc, việc còn
> dang dở) để khi copy thư mục dự án sang máy/vị trí khác, một phiên Claude Code mới đọc
> file này là nắm được bối cảnh đầy đủ — vì bộ nhớ hội thoại của Claude gắn với đường dẫn
> thư mục cũ, không tự động đi theo khi copy sang chỗ khác.
>
> Cập nhật lần cuối: 2026-08-06 (cuối phiên làm việc dài xây dựng app này).

## 1. Dự án này là gì

Web app nội bộ cho **phòng kế toán Hanoi Sun Travel (HNS)** quản lý hồ sơ nhân sự
(HDV/MC/NS — hướng dẫn viên, MC, nhân sự khác) theo từng **đoàn** (tour), và tạo hợp đồng
Word cho từng người trong đoàn. Thay thế quy trình thủ công cũ: kế toán nhận ảnh CCCD/thẻ
HDV qua Zalo, gõ tay vào file Excel tổng hợp năm + gõ tay vào mẫu hợp đồng Word.

**Người dùng**: chỉ kế toán HNS (không phải HDV, không phải sale/CRM).

Xem thêm kế hoạch gốc (bối cảnh brainstorm ban đầu, đã thực hiện gần hết) tại
`structured-noodling-plum.md` nếu file đó còn tồn tại trong thư mục — phần "Giai đoạn 2
(AMIS WeSign)" trong đó **vẫn chưa làm**, xem mục 8 bên dưới.

⚠️ **`README.md` trong repo đã LỖI THỜI** ở mục "Việc còn thiếu" (nói xuất `.docx` và cột
Tỉnh/TP chưa làm — thực ra cả hai đã xong từ lâu). Tin theo file `PROJECT_HANDOFF.md` này
trước, `README.md` chỉ còn đúng phần "Setup lần đầu" (biến môi trường, tạo bucket...).

## 2. Kiến trúc & nguyên tắc thiết kế

- **Next.js 16 App Router + TypeScript + Tailwind v4**, deploy Vercel.
- **Supabase**: Postgres + Storage (bucket `ho-so-hdv` private, ký URL) + Auth.
- **Dùng CHUNG 1 Supabase project với app chị em `hns-crm`** (quyết định có chủ đích, không
  tách project riêng) — cùng 1 `auth.users`. Vì role CRM không có khái niệm "kế toán", quyền
  vào `nhansu`/`doan`/`ho_so` được giới hạn bằng **allowlist theo email riêng**
  (`ke_toan_allowlist` + hàm SQL `is_ke_toan()`), KHÔNG dùng role của CRM — tránh mọi nhân
  viên CRM đọc được dữ liệu CCCD.
- **Nguyên tắc tách UI/API tuyệt đối**: mọi component client (`'use client'`) chỉ được
  `fetch('/api/...')`, KHÔNG BAO GIỜ import Supabase client hay gọi `supabase.from(...)`
  trực tiếp trong component. Supabase client (kể cả service-role) chỉ sống server-side trong
  route handler (`src/lib/supabase/{server,admin}.ts`). Đây là điểm **cố ý lệch** so với
  `hns-crm` (repo đó cho component gọi thẳng Supabase). Lợi ích: sau này đổi UI hoặc đổi
  backend đều không ảnh hưởng lẫn nhau, chỉ cần giữ đúng hợp đồng JSON của từng endpoint.
  → Đã verify (đọc code) là kiến trúc hiện tại tuân thủ đúng nguyên tắc này 100%.
- **OpenAI gpt-4o (vision)** đọc ảnh CCCD/thẻ HDV — khớp pattern đã dùng thật trong production
  ở `hns-crm` (`api/intake-extract/route.ts`), dùng chung SDK/key convention nội bộ HNS.
- **Telegram Bot API (webhook)** — kênh nhập liệu thứ 2 song song với dashboard web, chỉ kế
  toán thao tác. Xem `src/app/api/telegram/webhook/route.ts`.
- **Bảng màu thương hiệu** tái dùng từ hệ sinh thái nội bộ HNS: brand blue (`#127faf`/
  `#0069a0`, nền sidebar `#f0f9ff`) + accent orange (`#ef5e2f`), rounded-xl/2xl,
  `lucide-react` icon, `clsx`.

## 3. Data model (Postgres/Supabase)

Migrations nằm ở `supabase/migrations/`, chạy **đúng thứ tự tên file** (đã sort theo thời
gian) qua Supabase SQL Editor. Danh sách đầy đủ tính đến cuối phiên này:

| File | Nội dung |
|---|---|
| `20260717_init.sql` | Bảng gốc: `nhansu`, `doan`, `ho_so`, `bot_session` |
| `20260718_restrict_ke_toan.sql` | `ke_toan_allowlist` + hàm `is_ke_toan()` + RLS siết theo allowlist |
| `20260718b_storage_bucket.sql` | Tạo bucket Storage `ho-so-hdv` (private) |
| `20260718c_notifications.sql` | Bảng `notifications` (chuông thông báo góc trên) |
| `20260719_hop_dong_templates.sql` | Bảng `hop_dong_templates` (biểu mẫu Word upload sẵn) |
| `20260719b_ho_so_hop_dong_files.sql` | Bảng `ho_so_hop_dong_files` (lịch sử mỗi lần xuất hợp đồng — không ghi đè) |
| `20260719c_ho_so_hop_dong_files_ten.sql` | Thêm `file_name` (tên đẹp có dấu) cho bảng trên |
| `20260719d_ho_so_ngay_ket_thuc.sql` | Thêm `ho_so.ngay_ket_thuc` |
| `20260719e_nhansu_tinh_tp.sql` | Thêm `nhansu.tinh_tp` |
| `20260719f_ke_toan_super_admin.sql` | Thêm `ke_toan_allowlist.is_super_admin` + hàm `is_super_admin()` |
| `20260720_doan_soft_delete.sql` | Thêm `doan.deleted_at` (xóa mềm đoàn) |
| `20260724_loai_nhan_su.sql` | Bảng `loai_nhan_su` (danh mục loại nhân sự tự tạo) + `nhansu.loai_nhan_su_id` |
| `20260724b_gop_prefix_vao_loai_nhan_su.sql` | **Gộp** `nhansu.prefix` (HDV/MC/NS cứng) vào `loai_nhan_su.ma` — xóa hẳn cột `prefix` |

**Các bảng chính (trạng thái SAU khi chạy hết migration trên):**

- **`nhansu`** — danh bạ người dùng chung (khớp theo `so_cccd`, tái dùng qua nhiều đoàn):
  `id, ho_ten, dia_chi, tinh_tp, so_cccd, ngay_sinh, ngay_cap, noi_cap, ma_so_thue_tncn, sdt,
  so_the_hdv, loai_the_hdv, han_the_hdv, stk, ten_ngan_hang, email, loai_nhan_su_id (NOT NULL,
  FK), created_at`. **Không còn cột `prefix`** (đã gộp vào `loai_nhan_su`).
- **`loai_nhan_su`** — danh mục "loại nhân sự" do kế toán TỰ TẠO (không giới hạn HDV/MC/NS):
  `id, ten (tên hiển thị), ma (mã ngắn NOT NULL — dùng đặt tên file hợp đồng + khớp
  hop_dong_templates.loai), created_at`. Default cột `nhansu.loai_nhan_su_id` = loại có
  `ma = 'HDV'` (qua hàm `default_loai_nhan_su_id()`, vì Postgres không cho subquery trực
  tiếp trong `DEFAULT`).
- **`doan`**: `id, ten_doan, hanh_trinh, ngay_di, ngay_ve, sl_khach, deleted_at (xóa mềm),
  created_at`.
- **`ho_so`** (1 dòng = 1 người trong 1 đoàn): `id, doan_id, nhansu_id, ngay_dich_vu,
  ngay_ket_thuc, so_ngay_cong_tac, don_gia_ngay, so_tien_chi_tra, thue_nop (auto 10%),
  chi_tra (auto 90%), loai_hop_dong, tinh_trang_thanh_toan, trang_thai, ngay_duyet,
  nhap_misa, anh_cccd_truoc_url, anh_cccd_sau_url, anh_the_hdv_url, anh_xac_nhan_url,
  so_hop_dong, file_hop_dong_url (bản mới nhất), amis_document_id (chưa dùng — chừa cho
  Giai đoạn 2), ngay_ky, created_at`. Xóa **hard delete** (khác với `doan` là soft delete) —
  cascade sang `ho_so_hop_dong_files`.
- **`ho_so_hop_dong_files`** — lịch sử MỌI lần xuất hợp đồng (không ghi đè): `id, ho_so_id,
  file_url, file_name, created_at`. Kế toán thường **chỉ xem file mới nhất**; **super admin**
  xem được toàn bộ lịch sử (gate ở tầng UI, xem `HoSoDetailModal` trong
  `src/app/doan/[id]/page.tsx`).
- **`hop_dong_templates`** — biểu mẫu Word (.docx) kế toán tự upload, có placeholder dạng
  `{{tag}}`: `id, ten, loai (khớp với loai_nhan_su.ma để tự chọn mẫu), file_url, file_name,
  is_active, created_at`.
- **`ke_toan_allowlist`**: `email, is_super_admin` — allowlist RIÊNG của app này, không liên
  quan role CRM.
- **`notifications`**: chuông thông báo góc trên bên phải.
- **`bot_session`**: trạng thái hội thoại Telegram theo `chat_id` (vì serverless không giữ
  state giữa các lần gọi).

## 4. Auth & phân quyền

Đăng nhập qua Supabase Auth **dùng chung** với `hns-crm` (cùng `auth.users`). Gate 2 tầng:

1. **`is_ke_toan()`** (SQL function, security definer) — bắt buộc để vào được app này. Check
   ở CẢ 2 nơi: RLS trong Postgres VÀ tầng application (`src/lib/auth.ts#requireUser()` +
   `src/app/api/auth/login/route.ts`) — ban đầu chỉ có RLS, dẫn tới lỗ hổng: nhân viên CRM
   hợp lệ vẫn login được vào app (thấy shell rỗng vì RLS chặn data, nhưng vẫn login được).
   Đã vá bằng cách gọi `is_ke_toan()` ngay tại login, `signOut()` nếu false.
2. **`is_super_admin`** (cột bool trên `ke_toan_allowlist` + hàm `is_super_admin()`) — tầng
   quyền THỨ 2, hiện chỉ gate: (a) mục "Cài đặt → Biểu mẫu hợp đồng" trong sidebar, (b) xem
   lịch sử đầy đủ file hợp đồng trong modal chi tiết hồ sơ (kế toán thường chỉ thấy bản mới
   nhất).
   - Set super admin thủ công bằng SQL: `update ke_toan_allowlist set is_super_admin = true
     where email = '...';` — **không có UI** để tự cấp, phải chạy tay trong Supabase SQL
     Editor.
3. `AuthUser` (client, `src/contexts/auth.tsx`) có `{ id, email, is_super_admin }`, cache ở
   `sessionStorage` (key `ketoan_user_v1`) — nếu vừa đổi `is_super_admin` trong DB mà UI chưa
   cập nhật, có thể do cache này, cần hard reload/re-login.
4. **Tạo tài khoản kế toán mới**: KHÔNG có UI trong app này (chủ đích — định hướng dài hạn là
   tách quản lý người dùng khỏi CRM). Hiện tại: bên `hns-crm` cần thêm bước
   `insert ... on conflict do update` vào `ke_toan_allowlist` (bảng nằm trong project Supabase
   chung) khi tạo tài khoản kế toán — đây là thay đổi ở repo KHÁC (`hns-crm`), không nằm
   trong repo này.

## 5. Các luồng chính đã build

### 5.1 "Thêm nhân sự" (AI trích xuất, dashboard)
`AddNhanSuModal` trong `src/app/doan/[id]/page.tsx` → kế toán thả/dán ảnh của **1 người**
(CCCD 2 mặt, thẻ HDV, ảnh xác nhận Zalo) → `POST /api/doan/[id]/nhansu-moi/extract` gọi
`extractProfileFromImages()` (`src/lib/ai-extract.ts`, model gpt-4o) tự phân loại từng ảnh +
gộp field → kế toán soát/sửa → chọn "Loại nhân sự" (bắt buộc, có nút tạo loại mới ngay tại
chỗ) → Lưu → `POST /api/doan/[id]/nhansu-moi` (`upsertNhanSuFromExtract` trong
`src/lib/ho-so.ts`, khớp theo `so_cccd`, dùng CHUNG với bot Telegram).

Có check trùng CCCD **trong cùng 1 đoàn** (chặn thêm 2 lần), KHÔNG chặn trùng CCCD giữa các
đoàn khác nhau (1 người có thể ở nhiều đoàn).

### 5.2 Xuất hợp đồng Word (mail-merge)
`POST /api/ho-so/[id]/xuat-hop-dong` → tự chọn `hop_dong_templates` theo `loai_nhan_su.ma`
(hoặc kế toán chọn tay qua dropdown) → `buildMergeData()` (`src/lib/docx-merge.ts`) gom field
từ `nhansu` + `doan` + `ho_so` → `docxtemplater` + `pizzip` merge vào file `.docx` (delimiter
`{{tag}}`) → upload Storage → ghi 1 dòng mới vào `ho_so_hop_dong_files` (lịch sử, không ghi
đè) → cập nhật `ho_so.file_hop_dong_url` (con trỏ bản mới nhất).

Danh sách placeholder khả dụng xem ở trang "Cài đặt → Biểu mẫu hợp đồng"
(`src/app/cai-dat/bieu-mau-hop-dong/page.tsx`, hằng số `PLACEHOLDER_GROUPS`). Có
`ngay_ky` (ngày ký hợp đồng) format ra dạng chữ đầy đủ `"ngày dd tháng mm năm yyyy"` qua
`formatDateVNFull()` (`src/lib/format.ts`) — khác `formatDateVN()` (dd/mm/yyyy, dùng cho các
trường ngày khác + Excel).

Tải file qua route proxy `GET /api/ho-so/[id]/hop-dong-files/[fileId]/download` (KHÔNG link
thẳng URL Supabase Storage) — vì `Content-Disposition` với tên file có dấu tiếng Việt không
áp dụng được qua link cross-origin thẳng tới Storage (trình duyệt bỏ qua).

### 5.3 Xuất Excel ("Copy danh sách")
`src/lib/export-format.ts#buildDsHdvRows()` — build chuỗi tab-separated (TSV) khớp ĐÚNG thứ
tự cột file Excel gốc HNS (`HNS DOCS/01. DS HDV TONG HOP T1-T12.2026.xlsx`, bắt đầu dán từ cột
"Đoàn"), copy vào clipboard để dán thẳng. Có trick thêm dấu `'` trước các giá trị dạng số/ngày
(`textCell()`) để Excel không tự làm mất số 0 đầu hoặc tự định dạng lại ngày.

Đã BỎ tính năng "Copy Theo dõi HĐ" (4 cột riêng) theo yêu cầu — chỉ còn 1 nút "Copy danh
sách". 3 cột Tên Đoàn/Hành trình/Ngày dịch vụ CHỦ Ý không có trong Excel export (chỉ dùng
nội bộ app để tạo hợp đồng).

### 5.4 Soft-delete `doan` vs hard-delete `ho_so`
- `DELETE /api/doan/[id]` → **soft delete** (`deleted_at`), có modal cảnh báo trước khi xóa.
- `DELETE /api/ho-so/[id]` → **hard delete** thật (cascade `ho_so_hop_dong_files`), KHÔNG
  đụng `nhansu` (người đó có thể còn ở đoàn khác).
- Đây là khác biệt CHỦ Ý theo đúng yêu cầu gốc của user, không phải thiếu nhất quán.

### 5.5 Trang hướng dẫn sử dụng (`/docs`)
`src/app/docs/page.tsx` — 9 bước kèm ảnh minh họa, ảnh nằm ở
`public/docs/huong-dan-tao-hop-dong-hdv/step-1.png` .. `step-9.png`. Link vào từ 1 card trên
Dashboard (`src/app/page.tsx`).

## 6. Bản đồ mã nguồn (nhóm theo chức năng)

```
src/app/doan/[id]/page.tsx        # File LỚN NHẤT — trang chi tiết đoàn: bảng Nhân sự,
                                   # AddNhanSuModal, HoSoDetailModal, ImagePanel, FilesTab...
src/app/doan/page.tsx             # Danh sách đoàn
src/app/cai-dat/                  # Cài đặt (chỉ super admin thấy mục Biểu mẫu hợp đồng)
src/app/docs/page.tsx             # Hướng dẫn sử dụng
src/app/api/doan/                 # CRUD đoàn + "Thêm nhân sự" (extract + save)
src/app/api/ho-so/                # CRUD hồ sơ, ảnh, xuất hợp đồng, lịch sử file
src/app/api/hop-dong-templates/   # CRUD biểu mẫu Word
src/app/api/loai-nhan-su/         # CRUD danh mục loại nhân sự
src/app/api/telegram/webhook/     # Bot Telegram (kênh nhập liệu song song)
src/app/api/auth/                 # login/logout/me (check is_ke_toan + is_super_admin)
src/lib/ai-extract.ts             # 2 hàm gọi OpenAI gpt-4o: extractCccdFields (bot),
                                   # extractProfileFromImages (dashboard, tự phân loại ảnh)
src/lib/docx-merge.ts             # Mail-merge .docx (docxtemplater/pizzip)
src/lib/contract-file-name.ts     # Tên file hợp đồng (tách riêng, KHÔNG phụ thuộc
                                   # docxtemplater — để dùng được ở client component)
src/lib/export-format.ts          # Build TSV cho "Copy danh sách" (khớp cột Excel HNS)
src/lib/ho-so.ts                  # upsertNhanSuFromExtract, createHoSo (dùng chung
                                   # dashboard + bot)
src/lib/format.ts                 # formatDateVN, formatDateVNFull, deriveTinhTp,
                                   # slugifyFileName
src/lib/tax.ts                    # tinhThueVaChiTra (10%/90%)
src/lib/errors.ts                 # getErrorMessage(e: unknown) — BẮT BUỘC dùng thay vì
                                   # `e instanceof Error ? e.message : String(e)` vì
                                   # PostgrestError không phải Error thật, String(e) ra
                                   # "[object Object]"
src/lib/auth.ts                   # requireUser() — check session + is_ke_toan()
src/lib/supabase/{server,admin}.ts
src/contexts/auth.tsx             # AuthUser { id, email, is_super_admin }, cache sessionStorage
src/types/index.ts                # Toàn bộ type dùng chung FE/BE
```

## 7. Quy ước làm việc đã chốt với user (đọc kỹ trước khi code tiếp)

- **Xưng hô**: user muốn được gọi là **"anh"** (chỉ thị rõ ràng: "gọi anh là anh nhé em!"),
  họ tự xưng "chị" khi nói chuyện với AI. Đây là quy ước GIAO TIẾP, không phải code, nhưng
  quan trọng để giữ mạch làm việc nếu tiếp tục qua Claude Code.
- **Git commit/push**: user LUÔN tự làm, KHÔNG hỏi "anh có muốn commit/push không", chỉ báo
  đã sẵn sàng những gì.
- **Ngôn ngữ UI**: 100% tiếng Việt, giữ dấu đầy đủ mọi nơi (kể cả trong prompt AI, tên file,
  v.v.) — đây là điểm đã từng bị báo lỗi (AI trích xuất bị mất dấu) nên rất nhạy cảm.
- **Không tự chạy migration** — user tự chạy trong Supabase SQL Editor, AI chỉ viết file
  migration + hướng dẫn.
- **Style form/modal đã thống nhất**: field dạng "label phía trên, ô nhập phía dưới" (không
  dùng inline "Label: [box]"), 2 cột modal chi tiết tỉ lệ `40%/60%` (`grid md:grid-cols-[40%_1fr]`),
  mỗi cột tự cuộn độc lập (`overflow-y-auto` riêng, container ngoài `overflow-hidden`).
- **Bắt buộc check `.error` của MỌI lệnh Supabase mutate** (insert/update/delete) — từng có
  bug thật do 1 lệnh `insert` không check `error`, khiến API trả 200 OK dù ghi dữ liệu thất
  bại âm thầm (xem mục 9).
- **Prompt AI**: tránh đưa ví dụ giá trị THẬT/cụ thể (vd 1 địa chỉ đầy đủ nghe hợp lý) vào
  prompt — model có xu hướng "mượn" ví dụ đó làm câu trả lời khi ảnh mờ khó đọc. Dùng
  placeholder trừu tượng (`<cụm 1>, <cụm 2>...`) khi cần minh họa định dạng.

## 8. Việc còn dang dở / chưa làm

- **Giai đoạn 2 — tích hợp AMIS WeSign**: chưa làm, đang chờ xác nhận API access thật từ MISA
  (liên hệ hotline 1900 8177/1900 8677). Kiến trúc đã CHỪA SẴN chỗ (`ho_so.amis_document_id`,
  các giá trị `trang_thai` cho giai đoạn này) để cắm vào sau mà không đổi schema/dashboard/bot.
  Bước "Ms Trang KT mở mail duyệt & ký" vẫn luôn là thao tác tay ở cả 2 giai đoạn.
- **Trường thông tin công việc riêng theo từng `loai_nhan_su`**: hạ tầng phân loại
  (`loai_nhan_su`) đã xong, nhưng UI hiển thị field khác nhau theo từng loại (vd loại "Lái
  xe" cần field khác HDV) **CHƯA làm** — cần user cung cấp danh sách field cụ thể trước.
  `ma` (mã ngắn) hiện BẮT BUỘC nhập khi tạo loại mới (quyết định đã chốt).
- 3 vấn đề còn lại từ báo cáo của kế toán (chưa xử lý, xem ảnh chụp Telegram trong lịch sử
  hội thoại nếu cần chi tiết):
  2. MST cá nhân nên mặc định điền "MST đã điền ở link/Số CCCD", trường hợp điền MST cũ thì
     đang bị x2 thông tin.
  3. Chưa cập nhật được ngưỡng "dưới 5tr không nộp thuế TNCN" — hiện không sửa được trực tiếp
     trên app mà phải xuất hợp đồng ra rồi sửa tay.
  4. Khi đã bấm "xuất hợp đồng" rồi sửa lại thông tin, hồ sơ HDV update đúng nhưng file hợp
     đồng tổng (tải tất cả) chỉ hiện bản đầu tiên chưa cập nhật.
- README.md cần được viết lại cho khớp trạng thái thật (xem cảnh báo ở mục 1).

## 9. Bug đã gặp & bài học (để không lặp lại)

- **`String(e)` ra `"[object Object]"`**: `PostgrestError` của Supabase không phải `Error`
  thật → `e instanceof Error` fail. Đã fix bằng `getErrorMessage()` dùng chung
  (`src/lib/errors.ts`), áp dụng ở MỌI route có try/catch trả lỗi cho client.
- **Insert không check lỗi → API trả 200 OK dù ghi thất bại âm thầm**: ở
  `xuat-hop-dong/route.ts`, câu `insert` vào `ho_so_hop_dong_files` từng KHÔNG check
  `{ error }`, khiến kế toán thấy "xuất hợp đồng thành công" nhưng file không xuất hiện trong
  lịch sử. Bài học: mọi Supabase mutate PHẢI check `.error`, kể cả khi bước insert đó "chỉ là
  ghi log/lịch sử phụ" — im lặng bỏ qua lỗi luôn tệ hơn báo lỗi rõ ràng.
- **Postgres không cho subquery trực tiếp trong `DEFAULT`**: phải bọc qua 1 SQL function
  `stable` (xem `default_loai_nhan_su_id()` trong migration `20260724b`).
- **AI hallucination khi OCR mờ**: model có xu hướng "hoàn thiện" phần chữ mờ bằng thông tin
  nghe hợp lý thay vì để trống — đặc biệt nguy hiểm với ví dụ cụ thể ngay trong prompt (model
  copy luôn ví dụ). Xem mục 7 (quy ước viết prompt).
- **RLS không đủ, phải check quyền ở tầng app**: RLS chặn được DATA nhưng không chặn được
  LOGIN — nhân viên không phải kế toán vẫn login vào được app (thấy shell rỗng). Phải check
  `is_ke_toan()` ngay tại bước login, không chỉ dựa vào RLS.
