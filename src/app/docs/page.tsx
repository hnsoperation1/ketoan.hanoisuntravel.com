'use client'

import { useEffect } from 'react'
import { useTopbar } from '@/contexts/topbar'

const DOCS_IMG_DIR = '/docs/huong-dan-tao-hop-dong-hdv'

const STEPS: { title: string; desc: string; image: string }[] = [
  {
    title: 'Tạo đoàn (nếu chưa có)',
    desc:
      'Vào menu "Quyết toán tour" → bấm "+ Thêm đoàn" → điền Tên đoàn, Hành trình, Ngày đi/Ngày về, Số khách dự kiến → bấm "Thêm đoàn".',
    image: `${DOCS_IMG_DIR}/step-1.png`,
  },
  {
    title: 'Điền thông tin đoàn',
    desc: 'Điền đủ Tên đoàn, Hành trình, Ngày đi/Ngày về, Số khách dự kiến rồi bấm "Thêm đoàn".',
    image: `${DOCS_IMG_DIR}/step-2.png`,
  },
  {
    title: 'Mở tab Nhân sự → Thêm nhân sự',
    desc: 'Bấm vào đoàn cần thêm người → chọn tab "Nhân sự" → bấm "+ Thêm nhân sự".',
    image: `${DOCS_IMG_DIR}/step-3.png`,
  },
  {
    title: 'Thả/dán ảnh của 1 người',
    desc:
      'Trong khung "Thêm nhân sự": kéo-thả, bấm "chọn ảnh", hoặc bấm vào ô rồi dán (Ctrl+V) đủ ảnh của MỘT người — CCCD mặt trước, CCCD mặt sau, thẻ HDV, ảnh xác nhận (nếu có). Mỗi lượt chỉ nên làm 1 người để AI không nhầm lẫn ảnh của người này với người khác.',
    image: `${DOCS_IMG_DIR}/step-4.png`,
  },
  {
    title: 'Bấm "Trích xuất thông tin"',
    desc: 'Đủ ảnh rồi thì bấm "Trích xuất thông tin" — AI bắt đầu đọc toàn bộ ảnh vừa thả vào.',
    image: `${DOCS_IMG_DIR}/step-5.png`,
  },
  {
    title: 'Soát lại thông tin & Lưu',
    desc:
      'AI điền sẵn các trường bên phải (Họ tên, Số CCCD, Ngày sinh, Địa chỉ, Tỉnh/TP, Thẻ HDV, SĐT, STK, Ngân hàng...) — kiểm tra, sửa chỗ nào chưa đúng, rồi bấm "Lưu và thêm nhân sự khác" (còn người tiếp theo) hoặc "Lưu và đóng".',
    image: `${DOCS_IMG_DIR}/step-6.png`,
  },
  {
    title: 'Nhập công tác phí',
    desc:
      'Ở bảng Nhân sự, bấm icon bút chì cạnh cột "CTP (thực nhận)" của từng người để nhập CTP/ngày thực nhận và số ngày công tác — hệ thống tự tính CTP/ngày (gộp), thuế TNCN và tổng CTP.',
    image: `${DOCS_IMG_DIR}/step-7.png`,
  },
  {
    title: 'Bổ sung hợp đồng & Xuất file',
    desc:
      'Bấm vào tên (hoặc icon mắt) để mở hồ sơ chi tiết, bấm "Sửa" nếu cần bổ sung Số hợp đồng/Từ ngày/Đến ngày, rồi bấm "Xuất hợp đồng (.docx)" ở mục "File hợp đồng" để tự tạo file Word điền sẵn dữ liệu.',
    image: `${DOCS_IMG_DIR}/step-8.png`,
  },
  {
    title: 'Xem lại toàn bộ file đã xuất',
    desc: 'Vào tab "File hợp đồng" ở đầu trang đoàn để xem tất cả hợp đồng đã xuất của cả đoàn, bấm "Xem file" để mở/tải.',
    image: `${DOCS_IMG_DIR}/step-9.png`,
  },
]

export default function DocsPage() {
  const { setBreadcrumb } = useTopbar()

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Hướng dẫn sử dụng</span>)
    return () => setBreadcrumb(null)
  }, [setBreadcrumb])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Hướng dẫn sử dụng</h1>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">1. Trích xuất ảnh &amp; tạo hợp đồng nhân sự</h2>
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-brand-50 text-brand-600 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh minh hoạ tĩnh, ẩn luôn nếu chưa có file */}
                <img
                  src={s.image}
                  alt={s.title}
                  className="mt-2 rounded-xl border border-gray-200 max-w-full"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
