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

1. **Cài dependency**: `npm install`
2. **Tạo project Supabase**, copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API) vào `.env.local` (xem `.env.example`).
3. **Chạy migration**: dán nội dung `supabase/migrations/20260717_init.sql` vào Supabase SQL Editor và chạy.
4. **Tạo bucket Storage** tên `ho-so-hdv`, để **private** (không public).
5. **Tạo tài khoản kế toán**: Supabase Dashboard > Authentication > Add user (email/password) —
   đây là tài khoản đăng nhập dashboard, không cần cho HDV.
6. **Tạo Telegram bot**: nhắn `@BotFather` trên Telegram, `/newbot`, lấy `TELEGRAM_BOT_TOKEN`.
7. **OpenAI**: lấy `OPENAI_API_KEY` từ platform.openai.com.
8. Tự đặt 1 chuỗi bất kỳ cho `TELEGRAM_WEBHOOK_SECRET` (dùng để xác thực webhook thật từ Telegram).
9. Deploy lên Vercel, set các biến môi trường trên ở Project Settings > Environment Variables,
   `NEXT_PUBLIC_APP_URL` = domain thật (vd `https://ketoan.hanoisuntravel.com`).
10. **Đăng ký webhook** (sau khi đã deploy, thay `<TOKEN>`/`<SECRET>`/`<DOMAIN>`):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMAIN>/api/telegram/webhook&secret_token=<SECRET>"
```

## Chạy local

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000), đăng nhập bằng tài khoản kế toán đã tạo ở bước 5.
Bot Telegram cần 1 URL public để nhận webhook — dùng `ngrok http 3000` khi test local rồi
trỏ `setWebhook` tạm thời vào URL ngrok đó.

## Việc còn thiếu (xem plan để biết thêm chi tiết)

- Xuất hợp đồng `.docx` mail-merge — cần file mẫu hợp đồng thật.
- Tích hợp AMIS WeSign (Giai đoạn 2) — cần xác nhận API access với MISA.
- Cột "TỈNH" trong export chưa có field riêng trong schema, để trống khi copy.
