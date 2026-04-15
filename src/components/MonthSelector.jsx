import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function MonthSelector({ month, year, onChange }) {
  const prev = () => {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }

  const next = () => {
    const now = new Date()
    const isCurrentOrFuture =
      year > now.getFullYear() ||
      (year === now.getFullYear() && month >= now.getMonth() + 1)
    if (isCurrentOrFuture) return
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={prev}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="text-center min-w-32">
        <p className="text-white font-semibold text-sm">
          {MONTHS_PT[month - 1]} {year}
        </p>
        <p className="text-gray-500 text-xs">{MONTHS_EN[month - 1]}</p>
      </div>

      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={18} />
      </button>

      {!isCurrentMonth && (
        <button
          onClick={() => onChange(now.getMonth() + 1, now.getFullYear())}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-all"
        >
          Hoje
        </button>
      )}
    </div>
  )
}
