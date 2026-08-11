export type RoutingPart = { text: string; kind: 'airport' | 'airline' | 'sep' }

// Chuỗi routing vé máy bay dạng "HANVNSGNVNHAN" — xen kẽ mã sân bay 3 ký tự
// và mã hãng 2 ký tự, bắt đầu bằng sân bay. "//" đánh dấu chỗ đứt quãng
// (ARNK — khách tự di chuyển, không có chuyến bay nối). Tách ra để UI tô
// màu nhạt phần mã hãng, dễ đọc mã sân bay hơn.
export function parseRouting(routing: string): RoutingPart[] {
  const parts: RoutingPart[] = []
  const chains = routing.split('//')
  chains.forEach((chain, ci) => {
    if (ci > 0) parts.push({ text: '//', kind: 'sep' })
    let i = 0
    let expectAirport = true
    while (i < chain.length) {
      const len = expectAirport ? 3 : 2
      parts.push({ text: chain.slice(i, i + len), kind: expectAirport ? 'airport' : 'airline' })
      i += len
      expectAirport = !expectAirport
    }
  })
  return parts
}
