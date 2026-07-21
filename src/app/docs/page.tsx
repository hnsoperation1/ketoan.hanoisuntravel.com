'use client'

import { useEffect } from 'react'
import { useTopbar } from '@/contexts/topbar'

const STEPS: { title: string; desc: string }[] = [
  {
    title: 'Tạo đoàn (nếu chưa có)',
    desc:
      'Vào menu "Quyết toán tour" → bấm "+ Thêm đoàn" → điền Tên đoàn, Hành trình, Ngày đi/Ngày về, Số khách dự kiến → bấm "Thêm đoàn".',
  },
  {
    title: 'Mở tab Nhân sự của đoàn',
    desc: 'Bấm vào đoàn cần thêm người → chọn tab "Nhân sự" → bấm "+ Thêm nhân sự".',
  },
  {
    title: 'Thả/dán ảnh của 1 người',
    desc:
      'Trong khung "Thêm nhân sự": kéo-thả, bấm "chọn ảnh", hoặc bấm vào ô rồi dán (Ctrl+V) đủ ảnh của MỘT người — CCCD mặt trước, CCCD mặt sau, thẻ HDV, ảnh xác nhận (nếu có). Mỗi lượt chỉ nên làm 1 người để AI không nhầm lẫn ảnh của người này với người khác.',
  },
  {
    title: 'Bấm "Trích xuất thông tin"',
    desc:
      'AI tự đọc toàn bộ ảnh và điền sẵn các trường bên phải: Họ tên, Số CCCD, Ngày sinh, Địa chỉ, Ngày cấp, Nơi cấp, Tỉnh/TP, Số thẻ HDV, Loại thẻ, Hạn thẻ, SĐT, Email, MS thuế TNCN, STK, Ngân hàng.',
  },
  {
    title: 'Soát lại & sửa nếu cần',
    desc: 'Kiểm tra nhanh các trường AI đọc được, sửa tay chỗ nào chưa đúng trước khi lưu.',
  },
  {
    title: 'Lưu',
    desc:
      'Bấm "Lưu và thêm nhân sự khác" nếu còn người tiếp theo (modal không đóng, dán ảnh người kế tiếp luôn), hoặc "Lưu và đóng" nếu đã xong.',
  },
  {
    title: 'Nhập công tác phí',
    desc:
      'Ở bảng Nhân sự, bấm icon bút chì cạnh cột "CTP (thực nhận)" của từng người để nhập CTP/ngày thực nhận và số ngày công tác — hệ thống tự tính CTP/ngày (gộp), thuế TNCN và tổng CTP.',
  },
  {
    title: 'Bổ sung thông tin hợp đồng',
    desc:
      'Bấm vào tên (hoặc icon mắt) để mở hồ sơ chi tiết, bấm "Sửa" nếu cần bổ sung thêm Số hợp đồng, Từ ngày/Đến ngày...',
  },
  {
    title: 'Xuất hợp đồng',
    desc:
      'Trong hồ sơ chi tiết, bấm "Xuất hợp đồng (.docx)" ở mục "File hợp đồng" — hệ thống tự tạo file Word điền sẵn dữ liệu, hiện ngay trong danh sách file bên dưới.',
  },
  {
    title: 'Xem lại toàn bộ file đã xuất',
    desc: 'Vào tab "File hợp đồng" ở đầu trang đoàn để xem tất cả hợp đồng đã xuất của cả đoàn, bấm "Xem file" để mở/tải.',
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
              <div>
                <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
