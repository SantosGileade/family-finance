import { useState, useEffect } from 'react'
import { Plus, Trash2, Target, Loader2, X, Pencil } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getDailySpending, addDailySpending, deleteDailySpending, getIncome, getExpenses, getUserCategories, upsertProfile } from '../lib/supabase'
import { DEFAULT_CATEGORIES } from '../data/defaultCategories'
import MonthPicker from '../components/MonthPicker'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import ConfirmDialog from '../components/ConfirmDialog'
import { format, getDaysInMonth } from 'date-fns'
import { useLang } from '../hooks/useLang'
import { usePlanGate } from '../contexts/PlanGateContext'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// dailyGoal é calculado dinamicamente por usuário (ver state abaixo)

export default function DailySpending() {
  const { user, isAdmin, profile } = useAuth()
  const { check } = usePlanGate()
  const t = useLang()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [items,          setItems]          = useState([])
  const [dailyGoal,       setDailyGoal]      = useState(30)
  const [suggestedGoal,   setSuggestedGoal]  = useState(30)
  const [showGoalEdit,    setShowGoalEdit]   = useState(false)
  const [goalInput,       setGoalInput]      = useState('')
  const [savingGoal,      setSavingGoal]     = useState(false)
  const [spendingTags,   setSpendingTags]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [selectedDay,  setSelectedDay]  = useState(null)   // dia clicado no calendário
  const [showDayModal, setShowDayModal] = useState(false)  // modal com gastos do dia
  const [showAllItems, setShowAllItems] = useState(false)  // expandir lista
  const [confirmId,    setConfirmId]    = useState(null)

  const [form, setForm] = useState({
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'cash', // 'cash' ou 'credit_card'
  })

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    const [dailyRes, incomeRes, expRes] = await Promise.all([
      getDailySpending(user.id, month, year),
      getIncome(user.id, month, year),
      getExpenses(user.id, month, year),
    ])
    setItems(dailyRes.data || [])

    const totalInc = (incomeRes.data || []).reduce((s, i) => s + Number(i.amount), 0)
    const totalFixed = (expRes.data || [])
      .filter(e => e.category === 'fixed')
      .reduce((s, e) => s + Number(e.amount), 0)
    const available = totalInc - totalFixed
    const daysInMes = new Date(year, month, 0).getDate()
    const calculated = available > 0 ? Math.max(10, Math.round(available / daysInMes)) : 30
    setSuggestedGoal(calculated)
    // Usa meta definida pelo usuário se existir, senão usa o cálculo
    const profileGoal = profile?.daily_goal
    setDailyGoal(profileGoal && profileGoal > 0 ? profileGoal : calculated)

    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  // Carrega as categorias do usuário (padrão filtradas + personalizadas)
  useEffect(() => {
    if (!user) return
    const hidden = profile?.hidden_categories || []
    // Padrão — filtra ocultas
    const visibleDefaults = DEFAULT_CATEGORIES
      .filter(c => !hidden.includes(c.label))
      .map(c => `${c.emoji} ${c.label}`)
    // Personalizadas
    getUserCategories(user.id).then(({ data }) => {
      const custom = (data || []).map(c => `${c.emoji} ${c.name}`)
      setSpendingTags([...visibleDefaults, ...custom])
    })
  }, [user, profile])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!check()) return
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
    await load(true)  // silent: sem spinner, atualiza em background
    window.dispatchEvent(new Event('finance-updated'))
  }

  const handleDelete = async (id) => {
    if (!check()) return
    await deleteDailySpending(id)
    setItems(items.filter(i => i.id !== id))
    setConfirmId(null)
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

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const calDays = []
  for (let i = 0; i < firstDay; i++) calDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d)

  const getDayColor = (dateStr) => {
    const t = dayTotal(dateStr)
    if (t === 0) return 'bg-dark-600 text-gray-600'
    if (t <= dailyGoal) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    if (t <= dailyGoal * 1.5) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    return 'bg-red-500/20 text-red-400 border border-red-500/30'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Gastos Diários</h1>
          <p className="text-gray-500 text-sm">{t('Daily Spending · Controle do dia a dia')}</p>
        </div>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`card border ${todayTotal <= dailyGoal ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
          <p className="text-gray-400 text-xs mb-1">{t('Hoje · Today')}</p>
          <p className={`text-2xl font-bold ${todayTotal <= dailyGoal ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatBRL(todayTotal)}
          </p>
          <div className="progress-bar mt-2">
            <div
              className={`progress-fill ${todayTotal <= dailyGoal ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min((todayTotal / dailyGoal) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-gray-500 text-xs">Meta: {formatBRL(dailyGoal)}/dia</p>
            <button
              onClick={() => { setGoalInput(String(Math.round(dailyGoal * 100))); setShowGoalEdit(true) }}
              className="text-gray-600 hover:text-emerald-400 transition-colors"
              title="Editar meta"
            >
              <Pencil size={11} />
            </button>
          </div>
        </div>

        <div className="card">
          <p className="text-gray-400 text-xs mb-1">{t('Total do mês · Month total')}</p>
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

      {/* ── INSIGHT RÁPIDO ─────────────────────────────────────── */}
      {items.length > 0 && (() => {
        const daysOnTarget = Object.keys(byDate).filter(d => dayTotal(d) <= dailyGoal).length
        const daysOver     = Object.keys(byDate).filter(d => dayTotal(d) > dailyGoal).length
        const total = daysOnTarget + daysOver
        let text, color
        if (daysOver === 0)
          { text = `Todos os ${total} dias dentro da meta! 🎉`; color = 'text-emerald-400' }
        else if (daysOnTarget >= daysOver)
          { text = `${daysOnTarget} de ${total} dias dentro da meta 💪`; color = 'text-emerald-400' }
        else
          { text = `${daysOver} de ${total} dias acima da meta — atenção!`; color = 'text-yellow-400' }
        return (
          <div className="px-4 py-2.5 rounded-xl bg-dark-700 border border-white/6 flex items-center gap-2">
            <span className="text-sm">📊</span>
            <p className={`text-xs font-medium ${color}`}>{text}</p>
          </div>
        )
      })()}

      {/* ── CALENDÁRIO ─────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">{t('Calendário · Calendar')}</p>
          {/* Botão + pequeno dentro do cabeçalho */}
          <button
            onClick={() => { if (!check()) return; openModal(todayStr) }}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25
                       border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium
                       transition-all active:scale-95"
          >
            <Plus size={12} /> Registrar
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {['D','S','T','Q','Q','S','S'].map((d, i) => (
            <p key={i} className="text-center text-gray-600 text-[10px] font-medium py-0.5">{d}</p>
          ))}
        </div>

        {/* Grade */}
        <div className="grid grid-cols-7 gap-0.5">
          {calDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const total   = dayTotal(dateStr)
            const isToday  = dateStr === todayStr
            const isFuture = new Date(dateStr) > new Date()
            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (isFuture) return
                  setSelectedDay(dateStr)
                  setShowDayModal(true)
                }}
                disabled={isFuture}
                className={`
                  aspect-square rounded-md flex flex-col items-center justify-center transition-all text-xs
                  ${isFuture ? 'opacity-20 cursor-default' : 'active:scale-95 cursor-pointer'}
                  ${isToday ? 'ring-1 ring-emerald-500' : ''}
                  ${total > 0 ? getDayColor(dateStr) : 'bg-dark-600/60 text-gray-600'}
                `}
              >
                <span className="font-semibold text-[11px]">{day}</span>
                {total > 0 && (
                  <span className="text-[7px] leading-none opacity-80 mt-0.5 font-medium">
                    R${total >= 1000 ? `${(total/1000).toFixed(1)}k` : total.toFixed(0)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Legenda clara */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 border border-emerald-500/60" />
            <span className="text-gray-500 text-[10px]">Dentro da meta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500/40 border border-yellow-500/60" />
            <span className="text-gray-500 text-[10px]">Próximo ao limite</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500/40 border border-red-500/60" />
            <span className="text-gray-500 text-[10px]">Passou da meta</span>
          </div>
        </div>
      </div>

      {/* ── ÚLTIMOS GASTOS (só 3, expandível) ──────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">Últimos gastos</p>
          <span className="text-gray-500 text-xs">Total: {formatBRL(totalMonth)}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="card text-center py-8">
            <Target size={36} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum gasto registrado</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {(showAllItems ? items : items.slice(0, 3)).map(item => (
                <div key={item.id} className="card-hover flex items-center gap-3 p-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                    item.payment_method === 'credit_card' ? 'bg-blue-500/15' : 'bg-dark-600'
                  }`}>
                    {item.payment_method === 'credit_card' ? '💳' : '💵'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{item.description}</p>
                    <p className="text-gray-500 text-xs">{item.date}</p>
                  </div>
                  <p className="text-red-400 font-semibold shrink-0 text-sm">{formatBRL(item.amount)}</p>
                  <button onClick={() => setConfirmId(item.id)} className="btn-danger shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {items.length > 3 && (
              <button
                onClick={() => setShowAllItems(v => !v)}
                className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-white
                           bg-dark-700 hover:bg-dark-600 border border-white/6
                           rounded-xl transition-all"
              >
                {showAllItems ? 'Mostrar menos' : `Ver todos (${items.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── CONFIRM DELETE ─────────────────────────────────────── */}
      {/* Modal editar meta diária */}
      {showGoalEdit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowGoalEdit(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-sm bg-dark-700 rounded-t-3xl sm:rounded-2xl
                          border border-white/10 shadow-2xl z-10 animate-slide-up px-5 pt-4 pb-8"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-semibold">Meta diária</p>
                <p className="text-gray-500 text-xs mt-0.5">Quanto quer gastar por dia no máximo</p>
              </div>
              <button onClick={() => setShowGoalEdit(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <CurrencyInput
              className="input-field text-lg font-semibold mb-3"
              value={goalInput}
              onChange={setGoalInput}
              placeholder="0,00"
              autoFocus
            />
            {suggestedGoal > 0 && (
              <p className="text-gray-500 text-xs mb-4">
                💡 Sugestão com base na sua renda: <span className="text-emerald-400 font-medium">{formatBRL(suggestedGoal)}/dia</span>
                {' '}
                <button onClick={() => setGoalInput(String(Math.round(suggestedGoal * 100)))}
                  className="text-emerald-400 underline hover:text-emerald-300">
                  usar
                </button>
              </p>
            )}
            <button
              onClick={async () => {
                const val = parseCurrency(goalInput)
                if (!val || val <= 0) return
                setSavingGoal(true)
                await upsertProfile({ id: user.id, daily_goal: val })
                setDailyGoal(val)
                window.dispatchEvent(new Event('finance-updated'))  // atualiza home
                setSavingGoal(false)
                setShowGoalEdit(false)
              }}
              disabled={savingGoal}
              className="btn-primary w-full"
            >
              {savingGoal ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar meta'}
            </button>
          </div>
        </div>
      )}

      {confirmId && (
        <ConfirmDialog
          message="Esse gasto diário será removido permanentemente."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* ── MODAL: GASTOS DO DIA ───────────────────────────────── */}
      {showDayModal && selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowDayModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-sm bg-dark-700 rounded-t-3xl sm:rounded-2xl
                          border border-white/10 shadow-2xl z-10 animate-slide-up px-5 pt-4 pb-8"
            onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-semibold">
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long', day: 'numeric', month: 'long'
                  })}
                </p>
                <p className={`text-xs mt-0.5 font-semibold ${
                  dayTotal(selectedDay) <= dailyGoal ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  Total: {formatBRL(dayTotal(selectedDay))}
                  {dayTotal(selectedDay) <= dailyGoal ? ' ✓ Dentro da meta' : ' · Acima da meta'}
                </p>
              </div>
              <button onClick={() => setShowDayModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-dark-600 text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            {/* Lista */}
            {byDate[selectedDay]?.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {byDate[selectedDay].map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-dark-600 rounded-xl p-3">
                    <span className="text-sm">{item.payment_method === 'credit_card' ? '💳' : '💵'}</span>
                    <p className="flex-1 text-white text-sm truncate">{item.description}</p>
                    <p className="text-red-400 font-semibold text-sm">{formatBRL(item.amount)}</p>
                    <button onClick={() => { handleDelete(item.id); if (byDate[selectedDay]?.length <= 1) setShowDayModal(false) }}
                      className="text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-6">Nenhum gasto registrado neste dia</p>
            )}
            {/* Botão adicionar neste dia */}
            <button
              onClick={() => { setShowDayModal(false); if (!check()) return; openModal(selectedDay) }}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5
                         bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30
                         text-emerald-400 text-sm font-medium rounded-xl transition-all"
            >
              <Plus size={15} /> Adicionar gasto neste dia
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">{t('Registrar gasto · Add Spending')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="label">{t('O que foi? · What was it?')}</label>
                <input
                  className="input-field"
                  placeholder="Ex: Lanche, Uber, Mercado..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  required
                />
                {/* Quick tags — categorias do usuário */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {spendingTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setForm({ ...form, description: tag })}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-all border ${
                        form.description === tag
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-dark-600 border-white/6 hover:bg-dark-500 text-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{t('Quanto? · Amount (R$)')}</label>
                <CurrencyInput
                  className="input-field text-lg font-semibold"
                  value={form.amount}
                  onChange={v => setForm({ ...form, amount: v })}
                  required
                  autoFocus
                />
                {form.amount && parseCurrency(form.amount) > dailyGoal && (
                  <p className="text-yellow-400 text-xs mt-1">
                    ⚠️ Esse gasto sozinho já supera a meta diária de R$ {dailyGoal}!
                  </p>
                )}
              </div>

              <div>
                <label className="label">{t('Data · Date')}</label>
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
                <label className="label">{t('Como pagou? · Payment method')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cash', emoji: '💵', label: 'Dinheiro/Débito', sub: 'Cash / Debit', showSub: isAdmin },
                    { value: 'credit_card', emoji: '💳', label: 'Cartão Crédito', sub: 'Credit Card', showSub: isAdmin },
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
                      {opt.showSub && <p className="text-xs text-gray-500">{opt.sub}</p>}
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
