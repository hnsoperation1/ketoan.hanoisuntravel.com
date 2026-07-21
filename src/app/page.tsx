'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { FileSpreadsheet, ChevronRight, BookOpen } from 'lucide-react'
import { useTopbar } from '@/contexts/topbar'

export default function DashboardPage() {
  const { setBreadcrumb } = useTopbar()

  useEffect(() => {
    setBreadcrumb(<span className="text-sm font-semibold text-gray-700">Tổng quan</span>)
    return () => setBreadcrumb(null)
  }, [setBreadcrumb])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Tổng quan</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/doan"
          className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-brand-300 transition-colors group"
        >
          <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet size={20} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">Hợp đồng HDV</div>
          </div>
          <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
        </Link>

        <Link
          href="/docs"
          className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-brand-300 transition-colors group"
        >
          <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <BookOpen size={20} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">Hướng dẫn sử dụng</div>
          </div>
          <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
        </Link>
      </div>
    </div>
  )
}
