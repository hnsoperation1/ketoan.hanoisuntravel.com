'use client'

import { useRef, useState } from 'react'
import { Download, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5

export default function ImageViewer({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  function clampZoom(z: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom((z) => clampZoom(z - e.deltaY * 0.0015))
  }

  function handleMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setDragging(true)
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    })
  }
  function endDrag() {
    dragRef.current = null
    setDragging(false)
  }

  function reset() {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div className="fixed inset-0 z-100 bg-black/90 flex flex-col select-none">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-sm font-medium text-white truncate">{label}</span>
        <div className="flex items-center gap-1">
          <ViewerButton title="Thu nhỏ" onClick={() => setZoom((z) => clampZoom(z - 0.25))}>
            <ZoomOut size={16} />
          </ViewerButton>
          <ViewerButton title="Phóng to" onClick={() => setZoom((z) => clampZoom(z + 0.25))}>
            <ZoomIn size={16} />
          </ViewerButton>
          <ViewerButton title="Xoay trái" onClick={() => setRotation((r) => r - 90)}>
            <RotateCcw size={16} />
          </ViewerButton>
          <ViewerButton title="Xoay phải" onClick={() => setRotation((r) => r + 90)}>
            <RotateCw size={16} />
          </ViewerButton>
          <button onClick={reset} className="text-xs px-2.5 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            Reset
          </button>
          <a
            href={url}
            download
            title="Tải xuống"
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Download size={16} />
          </a>
          <ViewerButton title="Đóng" onClick={onClose}>
            <X size={18} />
          </ViewerButton>
        </div>
      </div>

      <div
        className="flex-1 overflow-hidden flex items-center justify-center"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={reset}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh signed URL động từ Supabase Storage */}
        <img
          src={url}
          alt={label}
          draggable={false}
          className="max-w-none max-h-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform 0.1s ease-out',
            maxWidth: '90vw',
            maxHeight: '80vh',
          }}
        />
      </div>
    </div>
  )
}

function ViewerButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  )
}
