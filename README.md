# ketoan.hanoisuntravel.com — Hồ sơ & hợp đồng HDV/MC/NS

Web app + Telegram bot + AI cho phòng kế toán HNS: gửi ảnh CCCD/thẻ HDV cho bot,
AI tự trích xuất thông tin, kế toán xác nhận, dashboard theo dõi theo đoàn và
xuất dữ liệu đúng định dạng cột của `HNS DOCS/01. DS HDV TONG HOP T1-T12.2026.xlsx`
để dán trực tiếp vào file Excel hiện có.

Xem plan đầy đủ tại `structured-noodling-plum.md` (Context/Kiến trúc/Data model/Giai đoạn 2).

## Kiến trúc

- **Next.js (App Router) + Tailwind v4**, deploy Vercel.
- **Supabase**: Postgres + Storage (bucket private) + Auth.
- **OpenAI gpt-4o** đọc CCCD/thẻ HDV (khớp pattern đã dùng ở `hns-crm`).
- **Telegram Bot API** (webhook) — chỉ kế toán thao tác, không phải HDV.
- **Nguyên tắc**: mọi component client chỉ `fetch('/api/...')`, không import Supabase
  vào component — xem `src/lib/supabase/{server,admin}.ts` và các route trong `src/app/api/`.

## Setup lần đầu

App này **dùng chung Supabase project với `hns-crm`** (quyết định của team, không tách
project riêng) — nghĩa là cùng 1 database, cùng 1 danh sách `auth.users`. Vì bảng `users`
của CRM không có role "kế toán" riêng, quyền truy cập bảng `nhansu`/`doan`/`ho_so` được
giới hạn bằng 1 allowlist theo email độc lập (xem `20260718_restrict_ke_toan.sql`), **không
phải** theo role của CRM — không thì mọi nhân viên CRM đọc/ghi được cả dữ liệu CCCD.

1. **Cài dependency**: `npm install`
2. **Lấy thông tin project Supabase** (đã dùng chung với hns-crm) ở Project Settings > API:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, và **`SUPABASE_SERVICE_ROLE_KEY`
   (key "service_role" — khác với anon key, đừng lấy nhầm 2 key giống nhau)** vào `.env.local`.
3. **Chạy 2 migration theo đúng thứ tự** trong Supabase SQL Editor:
   - `supabase/migrations/20260717_init.sql` (tạo bảng `nhansu`/`doan`/`ho_so`/`bot_session`)
   - `supabase/migrations/20260718_restrict_ke_toan.sql` (tạo allowlist + siết RLS)
4. **Thêm email kế toán được phép** vào allowlist (chạy trong SQL Editor, thay email thật):
   ```sql
   insert into ke_toan_allowlist (email) values ('ketoan@hanoisuntravel.com');
   ```
5. **Tạo bucket Storage** tên `ho-so-hdv`, để **private** (không public).
6. **Tài khoản đăng nhập**: dùng tài khoản CRM có sẵn của kế toán đó (đã có trong
   `auth.users` của project chung) — chỉ cần email đó có mặt trong `ke_toan_allowlist` ở
   bước 4 là đăng nhập được vào app này. Không cần tạo user mới trừ khi kế toán chưa có
   tài khoản CRM nào.
7. **Tạo Telegram bot**: nhắn `@BotFather` trên Telegram, `/newbot`, lấy `TELEGRAM_BOT_TOKEN`.
8. **OpenAI**: lấy `OPENAI_API_KEY` thật từ platform.openai.com (không phải giá trị placeholder).
9. Tự đặt 1 chuỗi bất kỳ cho `TELEGRAM_WEBHOOK_SECRET` (dùng để xác thực webhook thật từ Telegram).
10. Deploy lên Vercel, set các biến môi trường trên ở Project Settings > Environment Variables,
   `NEXT_PUBLIC_APP_URL` = domain thật (vd `https://ketoan.hanoisuntravel.com`).
11. **Đăng ký webhook** (sau khi đã deploy, thay `<TOKEN>`/`<SECRET>`/`<DOMAIN>`):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMAIN>/api/telegram/webhook&secret_token=<SECRET>"
```

## Chạy local

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000), đăng nhập bằng tài khoản CRM của kế toán
đã thêm vào `ke_toan_allowlist` ở bước 4.
Bot Telegram cần 1 URL public để nhận webhook — dùng `ngrok http 3000` khi test local rồi
trỏ `setWebhook` tạm thời vào URL ngrok đó.

## Việc còn thiếu (xem plan để biết thêm chi tiết)

- Xuất hợp đồng `.docx` mail-merge — cần file mẫu hợp đồng thật.
- Tích hợp AMIS WeSign (Giai đoạn 2) — cần xác nhận API access với MISA.
- Cột "TỈNH" trong export chưa có field riêng trong schema, để trống khi copy.
