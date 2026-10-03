'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

function safePath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function LoginRedirect() {
  const params = useSearchParams()
  useEffect(() => {
    const next = safePath(params.get('next'))
    window.location.replace(`https://ihns.vn/login?client=ketoan&next=${encodeURIComponent(next)}`)
  }, [params])
  return <p className="mt-2 text-sm text-gray-400">Đang chuyển tới trang đăng nhập iHNS...</p>
}

export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="text-2xl font-black"><span className="text-accent-500">HNS</span><span className="text-brand-600"> Kế toán</span></div>
        <Suspense fallback={<p className="mt-2 text-sm text-gray-400">Đang tải...</p>}><LoginRedirect /></Suspense>
      </div>
    </div>
  )
}
