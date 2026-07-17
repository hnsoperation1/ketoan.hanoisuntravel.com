'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface TopbarCtx {
  breadcrumb: ReactNode
  setBreadcrumb: (node: ReactNode) => void
}

const Ctx = createContext<TopbarCtx | null>(null)

export function TopbarProvider({ children }: { children: ReactNode }) {
  const [breadcrumb, setBreadcrumb] = useState<ReactNode>(null)
  return <Ctx.Provider value={{ breadcrumb, setBreadcrumb }}>{children}</Ctx.Provider>
}

export function useTopbar() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTopbar phải dùng trong TopbarProvider')
  return ctx
}
