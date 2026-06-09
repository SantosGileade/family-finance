import { useState, useRef, useEffect } from 'react'
import { CalendarDays } from 'lucide-react'

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function MonthPicker({ month, year, onChange }) {
  const [open, setOpen] = useState(false)
  const [displayYear, setDisplayYear] = useState(year)
  const ref = useRef(null)
  const now = new Date()

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Sincroniza displayYear quando year muda externamente
  useEffect(() => { setDisplayYear(year) }, [year])

  // Permite navegar até o mês seguinte ao atual
  const maxM    = now.getMonth() + 2 > 12 ? 1  : now.getMonth() + 2   // mês máximo (1-12)
  const maxYear = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()
  const canGoNextYear = displayYear < maxYear
  const isDisabled = (m, y) =>
    y > maxYear || (y === maxYear && m > maxM)

  return (
    <div className="relative" ref={ref}>
      {/* Botão compacto */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium
                   transition-all ${
          open
            ? 'bg-dark-600 border-emerald-500/30 text-emerald-400'
            : 'bg-dark-700 border-white/8 text-gray-300 hover:bg-dark-600 hover:text-white'
        }`}
      >
        <CalendarDays size={13} />
        {MONTHS_SHORT[month - 1]} {year}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50
                        bg-dark-700 border border-white/10 rounded-2xl p-3 shadow-2xl w-56
                        animate-fade-in">
          {/* Seletor de ano */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              onClick={() => setDisplayYear(y => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400
                         hover:text-white hover:bg-white/8 transition-colors text-sm"
            >‹</button>
            <span className="text-white text-sm font-semibold">{displayYear}</span>
            <button
              onClick={() => setDisplayYear(y => y + 1)}
              disabled={!canGoNextYear}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400
                         hover:text-white hover:bg-white/8 transition-colors text-sm
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >›</button>
          </div>

          {/* Grade de meses */}
          <div className="grid grid-cols-4 gap-1">
            {MONTHS_SHORT.map((label, i) => {
              const m = i + 1
              const disabled = isDisabled(m, displayYear)
              const isActive  = m === month && displayYear === year
              return (
                <button
                  key={label}
                  disabled={disabled}
                  onClick={() => { onChange(m, displayYear); setOpen(false) }}
                  className={`py-2 text-xs rounded-xl font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : disabled
                      ? 'text-gray-700 cursor-not-allowed'
                      : 'text-gray-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
