'use client'
import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

const VI_MONTHS_SHORT = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']
const VI_MONTHS_FULL  = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']
const DAY_HEADERS = ['T2','T3','T4','T5','T6','T7','CN']

type ViewMode = 'day' | 'month' | 'year'

interface Props {
  value: string        // yyyy-mm-dd hoặc ''
  onChange: (val: string) => void
  className?: string
  placeholder?: string
}

function toDisplay(iso: string) {
  if (iso?.length >= 10) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
  return ''
}

export default function DateInput({ value, onChange, className = '', placeholder = 'dd/mm/yyyy' }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const initYear  = value?.length >= 10 ? parseInt(value.slice(0, 4)) : new Date().getFullYear()
  const initMonth = value?.length >= 10 ? parseInt(value.slice(5, 7)) - 1 : new Date().getMonth()

  const [open, setOpen]           = useState(false)
  const [viewMode, setViewMode]   = useState<ViewMode>('day')
  const [alignRight, setAlignRight] = useState(false)
  const [openUp, setOpenUp]       = useState(false)
  const [viewYear, setViewYear]   = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth)
  const [yearBase, setYearBase]   = useState(Math.floor(initYear / 12) * 12)
  const [textVal, setTextVal]     = useState(toDisplay(value))
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTextVal(toDisplay(value))
    if (value?.length >= 10) {
      setViewYear(parseInt(value.slice(0, 4)))
      setViewMonth(parseInt(value.slice(5, 7)) - 1)
    }
  }, [value])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function openCalendar() {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setAlignRight(rect.left + 264 > window.innerWidth - 16)
    setOpenUp(window.innerHeight - rect.bottom < 320)
    setViewMode('day')
    setOpen(true)
  }

  // ── Text input ──────────────────────────────────────────────────────────────
  function handleTextChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d/]/g, '')
    const digits = raw.replace(/\//g, '')
    let formatted = digits.slice(0, 8)
    if (formatted.length > 4) formatted = formatted.slice(0, 2) + '/' + formatted.slice(2, 4) + '/' + formatted.slice(4)
    else if (formatted.length > 2) formatted = formatted.slice(0, 2) + '/' + formatted.slice(2)
    setTextVal(formatted)

    if (digits.length === 8) {
      const dd = parseInt(digits.slice(0, 2))
      const mm = parseInt(digits.slice(2, 4))
      const yyyy = parseInt(digits.slice(4, 8))
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1900 && yyyy <= 2100) {
        const iso = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
        onChange(iso)
        setViewYear(yyyy); setViewMonth(mm - 1)
      }
    } else if (digits.length === 0) {
      onChange('')
    }
  }

  function handleTextBlur() {
    // If incomplete, revert to last valid value
    if (textVal && textVal.replace(/\//g, '').length < 8) setTextVal(toDisplay(value))
  }

  // ── Day selection ───────────────────────────────────────────────────────────
  function selectDay(day: number) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setOpen(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay    = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const cells       = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const selectedDay = value?.length >= 10
    && parseInt(value.slice(0, 4)) === viewYear
    && parseInt(value.slice(5, 7)) - 1 === viewMonth
    ? parseInt(value.slice(8, 10)) : null
  const todayDay = today.slice(0, 7) === `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
    ? parseInt(today.slice(8, 10)) : null

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Input row */}
      <div className={`flex items-center border rounded-lg bg-white transition-all ${
        open ? 'border-brand-400 ring-2 ring-brand-100' : 'border-gray-200 hover:border-brand-300'
      }`}>
        <input
          ref={inputRef}
          type="text"
          value={textVal}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onFocus={openCalendar}
          placeholder={placeholder}
          className="flex-1 text-sm px-3 py-1.5 outline-none bg-transparent placeholder-gray-400 min-w-0"
        />
        <button type="button" tabIndex={-1}
          onClick={() => open ? setOpen(false) : (openCalendar(), inputRef.current?.focus())}
          className="px-2.5 text-gray-400 hover:text-brand-500 transition-colors flex-shrink-0">
          <CalendarDays size={14} className={open ? 'text-brand-500' : ''} />
        </button>
      </div>

      {/* Popup */}
      {open && (
        <div className={`absolute z-[200] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-64
          ${openUp ? 'bottom-full mb-2' : 'top-full mt-2'}
          ${alignRight ? 'right-0' : 'left-0'}`}>

          {/* Header */}
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-3 py-3">
            {viewMode === 'day' && (
              <div className="flex items-center justify-between">
                <button onClick={prevMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewMode('month')}
                    className="text-sm font-bold text-white hover:bg-white/20 px-2 py-0.5 rounded-lg transition-colors">
                    {VI_MONTHS_FULL[viewMonth]}
                  </button>
                  <button onClick={() => { setYearBase(Math.floor(viewYear / 12) * 12); setViewMode('year') }}
                    className="text-sm font-bold text-white hover:bg-white/20 px-2 py-0.5 rounded-lg transition-colors">
                    {viewYear}
                  </button>
                </div>
                <button onClick={nextMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {viewMode === 'month' && (
              <div className="flex items-center justify-between">
                <button onClick={() => setViewYear(y => y - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => { setYearBase(Math.floor(viewYear / 12) * 12); setViewMode('year') }}
                  className="text-sm font-bold text-white hover:bg-white/20 px-2 py-0.5 rounded-lg transition-colors">
                  {viewYear}
                </button>
                <button onClick={() => setViewYear(y => y + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {viewMode === 'year' && (
              <div className="flex items-center justify-between">
                <button onClick={() => setYearBase(b => b - 12)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm font-bold text-white">{yearBase} – {yearBase + 11}</span>
                <button onClick={() => setYearBase(b => b + 12)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-3">
            {/* Day view */}
            {viewMode === 'day' && (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {DAY_HEADERS.map(d => (
                    <div key={d} className={`text-[11px] font-bold text-center py-1 ${d === 'CN' ? 'text-accent-500' : 'text-gray-400'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {cells.map((day, i) => {
                    if (day === null) return <div key={`e-${i}`} />
                    const isSun = (firstDay + day - 1) % 7 === 6
                    const isSelected = selectedDay === day
                    const isToday = todayDay === day
                    return (
                      <button key={day} onClick={() => selectDay(day)}
                        className={`text-sm h-8 w-8 mx-auto rounded-full flex items-center justify-center font-medium transition-all
                          ${isSelected
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                            : isToday
                              ? 'border-2 border-accent-400 text-accent-600 font-bold'
                              : isSun
                                ? 'text-accent-500 hover:bg-accent-50'
                                : 'text-gray-700 hover:bg-brand-50 hover:text-brand-700'
                          }`}>
                        {day}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-center">
                  <button onClick={() => { onChange(today); setOpen(false) }}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-800 px-3 py-1 rounded-lg hover:bg-brand-50 transition-colors">
                    Hôm nay
                  </button>
                </div>
              </>
            )}

            {/* Month view — 4×3 grid */}
            {viewMode === 'month' && (
              <div className="grid grid-cols-4 gap-1.5">
                {VI_MONTHS_SHORT.map((m, i) => (
                  <button key={i} onClick={() => { setViewMonth(i); setViewMode('day') }}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      viewMonth === i
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-brand-50 hover:text-brand-700'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            )}

            {/* Year view — 4×3 grid */}
            {viewMode === 'year' && (
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => yearBase + i).map(y => (
                  <button key={y} onClick={() => { setViewYear(y); setViewMode('month') }}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      viewYear === y
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-brand-50 hover:text-brand-700'
                    }`}>
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
