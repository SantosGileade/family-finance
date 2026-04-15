import { useState, useEffect } from 'react'
import { Plus, Trash2, Target, Loader2, X, TrendingDown, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getDailySpending, addDailySpending, deleteDailySpending } from '../lib/supabase'
import MonthSelector from '../components/MonthSelector'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import { format, getDaysInMonth } from 'date-fns'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const DAILY_GOAL = 30
const DAILY_GOAL_OLD = 60 // o valor atual

const SPENDING_TAGS = [
  '🍔 Lanche', '🛒 Mercado', '🚌 Transporte', '☕ Café',
  '💊 Farmácia', '🎮 Lazer', '👕 Roupa', '⛽ Combustível', '🍕 Delivery', '💈 Barbearia', '🎁 Presente', '📱 App', '🏪 Loja',
]

export default function DailySpending() {
  const { user } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)

  const [form, setForm] = useState({
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'cash', // 'cash' ou 'credit_card'
  })

  const load = async () => {
    setLoading(true)
    const { data } = await getDailySpending(user.id, month, year)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    await addDailySpending({
      user_id: user.id,
      description: form.description,
      amount: parseCurrency(form.amount),
      date: form.date,
      payment_method: form.payment_method,
    })
    setForm({ description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), payment_method: 'cash' })
    setShowModal(false)
    setSaving(false)
    await load()
    window.dispatchEvent(new Event('finance-updated'))
  }

  const handleDelete = async (id) => {
    await deleteDailySpending(id)
    setItems(items.filter(i => i.id !== id))
    window.dispatchEvent(new Event('finance-updated'))
  }

  const openModal = (dateStr) => {
    setForm({ description: '', amount: '', date: dateStr })
    setShowModal(true)
  }

  // Group by date
  const byDate = {}
  items.forEach(item => {
    if (!byDate[item.date]) byDate[item.date] = []
    byDate[item.date].push(item)
  })

  const dayTotal = (dateStr) => (byDate[dateStr] || []).reduce((s, d) => s + Number(d.amount), 0)

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayTotal = dayTotal(todayStr)
  const totalMonth = items.reduce((s, i) => s + Number(i.amount), 0)
  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const daysElapsed = month === now.getMonth() + 1 && year === now.getFullYear()
    ? now.getDate()
    : daysInMonth
  const daysWithSpend = [...new Set(items.map(d => d.date))].length
  const avgDaily = daysElapsed > 0 ? totalMonth / daysElapsed : 0

  // Savings vs old habit
  const savedVsOld = Math.max(0, (DAILY_GOAL_OLD - avgDaily) * daysElapsed)

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const calDays = []
  for (let i = 0; i < firstDay; i++) calDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d)

  const getDayColor = (dateStr) => {
    const t = dayTotal(dateStr)
    if (t === 0) return 'bg-dark-600 text-gray-600'
    if (t <= DAILY_GOAL) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    if (t <= DAILY_GOAL * 1.5) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    return 'bg-red-500/20 text-red-400 border border-red-500/30'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Gastos Diários 📅</h1>
          <p className="text-gray-500 text-sm">Daily Spending · Controle do dia a dia</p>
        </div>
        <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`card border ${todayTotal <= DAILY_GOAL ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
          <p className="text-gray-400 text-xs mb-1">Hoje · Today</p>
          <p className={`text-2xl font-bold ${todayTotal <= DAILY_GOAL ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatBRL(todayTotal)}
          </p>
          <div className="progress-bar mt-2">
            <div
              className={`progress-fill ${todayTotal <= DAILY_GOAL ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min((todayTotal / DAILY_GOAL) * 100, 100)}%` }}
            />
          </div>
          <p className="text-gray-500 text-xs mt-1">Meta: {formatBRL(DAILY_GOAL)}</p>
        </div>

        <div className="card">
          <p className="text-gray-400 text-xs mb-1">Total do mês · Month total</p>
          <p className="text-2xl font-bold text-white">
            {formatBRL(totalMonth)}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {daysWithSpend} {daysWithSpend === 1 ? 'dia registrado' : 'dias registrados'}
          </p>
          <p className="text-gray-600 text-xs mt-0.5">
            {daysWithSpend > 0 ? `~${formatBRL(totalMonth / daysWithSpend)}/dia gasto` : 'Nenhum gasto ainda'}
          </p>
        </div>
      </div>

      {/* Savings vs old habit */}
      {savedVsOld > 0 && (
        <div className="card border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-emerald-400" />
            <p className="text-emerald-400 font-semibold text-sm">
              Você economizou vs. hábito antigo!
            </p>
          </div>
          <p className="text-2xl font-bold text-white">{formatBRL(savedVsOld)}</p>
          <p className="text-gray-500 text-xs mt-1">
            Em {daysElapsed} dias, você gastou {formatBRL(avgDaily)}/dia vs {formatBRL(DAILY_GOAL_OLD)}/dia antes.
            <br />
            <span className="italic text-gray-600">Savings compared to old daily habit!</span>
          </p>
        </div>
      )}

      {/* Add button */}
      <button onClick={() => openModal(todayStr)} className="btn-primary w-full">
        <Plus size={18} /> Registrar gasto de hoje · Add today's spending
      </button>

      {/* Calendar */}
      <div className="card">
        <p className="section-title mb-4">Calendário · Calendar</p>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <p key={d} className="text-center text-gray-600 text-xs font-medium py-1">{d}</p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const total = dayTotal(dateStr)
            const isToday = dateStr === todayStr
            const isFuture = new Date(dateStr) > new Date()
            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && (setSelectedDay(selectedDay === dateStr ? null : dateStr))}
                disabled={isFuture}
                className={`
                  aspect-square rounded-lg flex flex-col items-center justify-center p-0.5 transition-all text-xs
                  ${isFuture ? 'opacity-20 cursor-default' : 'hover:scale-105 cursor-pointer'}
                  ${isToday ? 'ring-2 ring-emerald-500' : ''}
                  ${total > 0 ? getDayColor(dateStr) : 'bg-dark-600 text-gray-600 hover:bg-dark-500'}
                `}
              >
                <span className="font-semibold">{day}</span>
                {total > 0 && (
                  <span className="text-[9px] leading-tight">
                    {parseFloat(total.toFixed(2))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 flex-wrap">
          {[
            { color: 'bg-emerald-500/30 border border-emerald-500/50', label: `≤ R$${DAILY_GOAL} · On target` },
            { color: 'bg-yellow-500/30 border border-yellow-500/50', label: 'Um pouco alto · A bit high' },
            { color: 'bg-red-500/30 border border-red-500/50', label: 'Acima · Over budget' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${color}`} />
              <span className="text-gray-500 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day detail */}
      {selectedDay && byDate[selectedDay] && (
        <div className="card border border-white/10">
          <p className="section-title">
            Gastos de {selectedDay} · Spending on {selectedDay}
          </p>
          <div className="space-y-2">
            {byDate[selectedDay].map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-dark-600 rounded-xl p-3">
                <div className="flex-1">
                  <p className="text-white text-sm">{item.description}</p>
                </div>
                <p className="text-red-400 font-semibold">{formatBRL(item.amount)}</p>
                <button onClick={() => handleDelete(item.id)} className="btn-danger p-1.5">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <p className="text-right text-gray-400 text-sm font-semibold pt-2 border-t border-white/5">
              Total: <span className="text-white">{formatBRL(dayTotal(selectedDay))}</span>
            </p>
          </div>
        </div>
      )}

      {/* Recent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">Últimos gastos · Recent</p>
          <span className="text-gray-500 text-xs">Total: {formatBRL(totalMonth)}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="card text-center py-8">
            <Target size={36} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum gasto registrado</p>
            <p className="text-gray-600 text-xs mt-1">No spending recorded this month</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 15).map(item => (
              <div key={item.id} className="card-hover flex items-center gap-3 p-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                  item.payment_method === 'credit_card'
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-dark-600 text-gray-400'
                }`}>
                  {item.payment_method === 'credit_card' ? '💳' : '💵'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{item.description}</p>
                  <p className="text-gray-500 text-xs">{item.date}</p>
                </div>
                <p className="text-red-400 font-semibold shrink-0">{formatBRL(item.amount)}</p>
                <button onClick={() => handleDelete(item.id)} className="btn-danger shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Registrar gasto · Add Spending</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="label">O que foi? · What was it?</label>
                <input
                  className="input-field"
                  placeholder="Ex: Lanche, Uber, Mercado..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  required
                />
                {/* Quick tags */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SPENDING_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setForm({ ...form, description: tag })}
                      className="px-2 py-1 bg-dark-600 hover:bg-dark-500 text-gray-300 text-xs rounded-lg transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Quanto? · Amount (R$)</label>
                <CurrencyInput
                  className="input-field text-lg font-semibold"
                  value={form.amount}
                  onChange={v => setForm({ ...form, amount: v })}
                  required
                  autoFocus
                />
                {form.amount && parseCurrency(form.amount) > DAILY_GOAL && (
                  <p className="text-yellow-400 text-xs mt-1">
                    ⚠️ Esse gasto sozinho já supera a meta diária de R$ {DAILY_GOAL}!
                  </p>
                )}
              </div>

              <div>
                <label className="label">Data · Date</label>
                <input
                  className="input-field"
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              {/* Payment method toggle */}
              <div>
                <label className="label">Como pagou? · Payment method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cash', emoji: '💵', label: 'Dinheiro/Débito', sub: 'Cash / Debit' },
                    { value: 'credit_card', emoji: '💳', label: 'Cartão Crédito', sub: 'Credit Card' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, payment_method: opt.value })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        form.payment_method === opt.value
                          ? opt.value === 'credit_card'
                            ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                            : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 bg-dark-600 text-gray-400'
                      }`}
                    >
                      <p className="text-xl mb-1">{opt.emoji}</p>
                      <p className="text-xs font-semibold">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.sub}</p>
                    </button>
                  ))}
                </div>
                {form.payment_method === 'credit_card' && (
                  <p className="text-blue-400 text-xs mt-2">
                    💳 Vai descontar do limite do cartão. Não precisa adicionar em Despesas!
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Plus size={16} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
