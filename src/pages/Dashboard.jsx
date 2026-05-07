import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  ChevronRight, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Wallet, CreditCard, Settings, X, Loader2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getIncome, getExpenses, getDailySpending,
  getSavings, getCategoryLimits, getProfile, getAccounts, upsertProfile
} from '../lib/supabase'
import { useAccounts } from '../hooks/useAccounts'
import { useLang } from '../hooks/useLang'
import MonthPicker from '../components/MonthPicker'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import { format } from 'date-fns'

const formatBRL  = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const COLORS     = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316']
const stripEmoji = (s) => String(s).replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '').trim()

const groupByCategory = (items) => {
  const map = {}
  items.forEach(d => {
    const k = d.description || 'Outros'
    map[k] = (map[k] || 0) + Number(d.amount)
  })
  return map
}

// ── Pool de mensagens contextuais ─────────────────────────────────
// Cada categoria de mensagem tem múltiplas variações para não repetir
const MSG_POOL = {
  catNearLimit: [
    (cat, pct) => `🔶 ${cat} está em ${pct}% do seu limite mensal.`,
    (cat, pct) => `Atenção! Você já usou ${pct}% do limite de ${cat}.`,
    (cat, pct) => `Cuidado com ${cat} — faltam só ${100 - pct}% para atingir o limite.`,
    (cat, pct) => `${cat} próximo do teto: ${pct}% do limite utilizado.`,
  ],
  catOverLimit: [
    (cat) => `🚨 Você ultrapassou o limite de ${cat} este mês!`,
    (cat) => `⚠️ Limite de ${cat} estourado. Revise seus gastos.`,
    (cat) => `${cat} passou do limite configurado. Hora de rever!`,
  ],
  spendingDown: [
    (pct) => `Seus gastos caíram ${pct}% em relação ao mês passado. 🎉`,
    (pct) => `Ótimo! Você gastou ${pct}% menos que no mês anterior.`,
    (pct) => `Progresso real: ${pct}% de redução nos gastos. 💪`,
    (pct) => `Mês mais econômico: ${pct}% abaixo do período anterior.`,
  ],
  spendingUp: [
    (pct) => `Gastos ${pct}% acima do mês passado. Fique de olho!`,
    (pct) => `Você gastou ${pct}% a mais que no período anterior.`,
    (pct) => `Atenção: ${pct}% de aumento nos gastos este mês.`,
  ],
  todayOnTrack: [
    () => `Gasto de hoje dentro da meta diária. Bom ritmo! ✅`,
    () => `Meta diária respeitada. Continue assim!`,
    () => `Hoje está no caminho certo com os gastos. 👍`,
  ],
  todayOver: [
    (goal) => `Gasto de hoje ultrapassou sua meta de ${goal}.`,
    (goal) => `Meta diária de ${goal} superada. Atenção amanhã!`,
  ],
  topCatHigh: [
    (cat, pct) => `${cat} representa ${pct}% de todos os seus gastos.`,
    (cat, pct) => `Sua maior categoria é ${cat} com ${pct}% do total.`,
  ],
  daysLeft: [
    (days, bal) => `Faltam ${days} dias no mês com ${bal} disponível.`,
    (days) => `Últimos ${days} dias do mês. Mantenha o controle!`,
  ],
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildMessages({ currCats, limitsMap, totalIncome, totalExpenses, prevTotalExp,
                         todaySpend, dailyGoal, catRanked, currTotal, daysInMonth, daysElapsed }) {
  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const candidates = []

  // 1. Alertas de limite por categoria
  Object.entries(currCats).forEach(([cat, spent]) => {
    const lim = limitsMap[cat] || limitsMap[stripEmoji(cat)]
    if (!lim || lim.limit_type === 'none') return
    const threshold = lim.limit_type === 'value'
      ? lim.limit_value
      : totalIncome * lim.limit_value / 100
    if (threshold <= 0) return
    const pct = Math.round((spent / threshold) * 100)
    if (pct >= 100) {
      candidates.push({ type: 'warning', priority: 1, text: pickRandom(MSG_POOL.catOverLimit)(cat) })
    } else if (pct >= 75) {
      candidates.push({ type: 'warning', priority: 2, text: pickRandom(MSG_POOL.catNearLimit)(cat, pct) })
    }
  })

  // 2. Comparação com mês anterior
  if (prevTotalExp > 0) {
    const diff = totalExpenses - prevTotalExp
    const pct  = Math.abs((diff / prevTotalExp) * 100).toFixed(0)
    if (diff < -prevTotalExp * 0.05) {
      candidates.push({ type: 'success', priority: 3, text: pickRandom(MSG_POOL.spendingDown)(pct) })
    } else if (diff > prevTotalExp * 0.1) {
      candidates.push({ type: 'warning', priority: 3, text: pickRandom(MSG_POOL.spendingUp)(pct) })
    }
  }

  // 3. Gasto do dia
  if (todaySpend > dailyGoal * 1.1) {
    candidates.push({ type: 'warning', priority: 4, text: pickRandom(MSG_POOL.todayOver)(fmt(dailyGoal)) })
  } else if (todaySpend > 0 && todaySpend <= dailyGoal * 0.6) {
    candidates.push({ type: 'success', priority: 5, text: pickRandom(MSG_POOL.todayOnTrack)() })
  }

  // 4. Categoria dominante
  if (catRanked[0] && currTotal > 0) {
    const [topCat, topVal] = catRanked[0]
    const pct = Math.round((topVal / currTotal) * 100)
    if (pct >= 35) {
      candidates.push({ type: 'info', priority: 5, text: pickRandom(MSG_POOL.topCatHigh)(topCat, pct) })
    }
  }

  // 5. Dias restantes no mês
  const daysLeft = daysInMonth - daysElapsed
  if (daysLeft <= 5 && daysLeft > 0) {
    candidates.push({ type: 'info', priority: 6, text: pickRandom(MSG_POOL.daysLeft)(daysLeft, fmt(0)) })
  }

  // Ordena por prioridade e remove duplicatas de tipo
  const sorted = candidates.sort((a, b) => a.priority - b.priority)
  const seen = new Set()
  return sorted.filter(m => {
    if (seen.has(m.type + m.priority)) return false
    seen.add(m.type + m.priority)
    return true
  })
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const { accounts, hasMultiple } = useAccounts()
  const t = useLang()
  const navigate = useNavigate()
  const now = new Date()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())

  const [income,     setIncome]     = useState([])
  const [expenses,   setExpenses]   = useState([])
  const [daily,      setDaily]      = useState([])
  const [savings,    setSavings]    = useState([])
  const [prevIncome, setPrevIncome] = useState([])
  const [prevExp,    setPrevExp]    = useState([])
  const [prevDaily,  setPrevDaily]  = useState([])
  const [limitsMap,  setLimitsMap]  = useState({})
  const [cardLimit,      setCardLimit]      = useState(400)
  const [profileGoal,    setProfileGoal]    = useState(0)   // meta diária definida pelo usuário
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitInput,     setLimitInput]     = useState('')
  const [savingLimit,    setSavingLimit]    = useState(false)
  const [loading,        setLoading]        = useState(true)

  const fetchAll = async (m, y) => {
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    return Promise.all([
      getIncome(user.id, m, y),
      getExpenses(user.id, m, y),
      getDailySpending(user.id, m, y),
      getSavings(user.id),
      getIncome(user.id, pm, py),
      getExpenses(user.id, pm, py),
      getDailySpending(user.id, pm, py),
      getCategoryLimits(user.id),
    ])
  }

  useEffect(() => {
    if (!user) return
    getProfile(user.id).then(({ data }) => {
      if (data?.card_limit) setCardLimit(data.card_limit)
      if (data?.daily_goal)  setProfileGoal(data.daily_goal)
    })
  }, [user])

  const handleSaveLimit = async (e) => {
    e.preventDefault()
    const value = parseCurrency(limitInput)
    if (!value || value <= 0) return
    setSavingLimit(true)
    await upsertProfile({ id: user.id, card_limit: value })
    setCardLimit(value)
    setSavingLimit(false)
    setShowLimitModal(false)
    setLimitInput('')
  }

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchAll(month, year).then(([inc, exp, day, sav, pInc, pEx, pDa, lim]) => {
      setIncome(inc.data || [])
      setExpenses(exp.data || [])
      setDaily(day.data || [])
      setSavings(sav.data || [])
      setPrevIncome(pInc.data || [])
      setPrevExp(pEx.data || [])
      setPrevDaily(pDa.data || [])
      const lMap = {}
      ;(lim.data || []).forEach(l => { lMap[l.category_label] = l })
      setLimitsMap(lMap)
      setLoading(false)
    })
  }, [user, month, year])

  useEffect(() => {
    const h = () => {
      if (!user) return
      // Re-busca o profile para pegar daily_goal atualizado
      getProfile(user.id).then(({ data }) => {
        if (data?.card_limit) setCardLimit(data.card_limit)
        if (data?.daily_goal !== undefined) setProfileGoal(data.daily_goal || 0)
      })
      fetchAll(month, year).then(([inc, exp, day, sav, pInc, pEx, pDa]) => {
        setIncome(inc.data || [])
        setExpenses(exp.data || [])
        setDaily(day.data || [])
        setSavings(sav.data || [])
        setPrevIncome(pInc.data || [])
        setPrevExp(pEx.data || [])
        setPrevDaily(pDa.data || [])
      })
    }
    window.addEventListener('finance-updated', h)
    return () => window.removeEventListener('finance-updated', h)
  }, [user, month, year])

  // ── Cálculos ──────────────────────────────────────────────────────
  const totalIncome  = income.reduce((s, i) => s + Number(i.amount), 0)
  const totalSavings = savings.reduce((s, sv) => s + Number(sv.amount), 0)
  const paidExp      = expenses.filter(e => !e.status || e.status === 'pago')
  const cashExp      = paidExp.filter(e => e.category !== 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
                     + daily.filter(d => d.payment_method !== 'credit_card').reduce((s, d) => s + Number(d.amount), 0)
  const balance      = totalIncome - cashExp
  // Apenas despesas pagas (já descontadas do bolso)
  const totalExpenses = paidExp.reduce((s, e) => s + Number(e.amount), 0)
                      + daily.reduce((s, d) => s + Number(d.amount), 0)
  const totalPending  = expenses.filter(e => e.status === 'pendente').reduce((s, e) => s + Number(e.amount), 0)

  // Cartão
  const creditCardUsed = paidExp.filter(e => e.category === 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
                       + daily.filter(d => d.payment_method === 'credit_card').reduce((s, d) => s + Number(d.amount), 0)
  const cardAvailable  = cardLimit - creditCardUsed

  // Saldo anterior
  const pIncTotal = prevIncome.reduce((s, i) => s + Number(i.amount), 0)
  const pPaidExp  = prevExp.filter(e => !e.status || e.status === 'pago')
  const pCash     = pPaidExp.filter(e => e.category !== 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
                  + prevDaily.filter(d => d.payment_method !== 'credit_card').reduce((s, d) => s + Number(d.amount), 0)
  const prevMonthBal        = pIncTotal - pCash
  const totalInitialBalance = accounts.reduce((s, a) => s + Number(a.initial_balance || 0), 0)
  const accBalance          = balance + prevMonthBal + totalInitialBalance
  const hasPrevBal          = pIncTotal > 0 || pCash > 0

  // Fix #4 — saldo real por conta (initial + transações filtradas por account_id)
  const accountBalances = accounts.map(acc => {
    const isPrincipal = acc.is_principal || accounts.indexOf(acc) === 0
    const owns = (item) => item.account_id === acc.id || (isPrincipal && !item.account_id)
    const accInc  = income.filter(owns).reduce((s, i) => s + Number(i.amount), 0)
    const accExp  = paidExp.filter(e => e.category !== 'credit_card' && owns(e)).reduce((s, e) => s + Number(e.amount), 0)
    const accDay  = daily.filter(d => d.payment_method !== 'credit_card' && owns(d)).reduce((s, d) => s + Number(d.amount), 0)
    return { ...acc, currentBalance: Number(acc.initial_balance || 0) + accInc - accExp - accDay }
  })

  // Comparação total gastos
  const prevTotalExp = prevExp.reduce((s, e) => s + Number(e.amount), 0)
                     + prevDaily.reduce((s, d) => s + Number(d.amount), 0)
  const totalDiff    = prevTotalExp > 0 ? ((totalExpenses - prevTotalExp) / prevTotalExp) * 100 : 0

  // Categorias
  const currCats  = groupByCategory(daily)
  const prevCats  = groupByCategory(prevDaily)
  const currTotal = Object.values(currCats).reduce((s, v) => s + v, 0)
  const prevTotal = Object.values(prevCats).reduce((s, v) => s + v, 0)
  const catRanked = Object.entries(currCats).sort((a, b) => b[1] - a[1])
  const pieData   = catRanked.slice(0, 6).map(([name, value]) => ({ name, value }))

  const todayStr   = format(new Date(), 'yyyy-MM-dd')
  const todaySpend = daily.filter(d => d.date === todayStr).reduce((s, d) => s + Number(d.amount), 0)

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const totalFixed  = expenses.filter(e => e.category === 'fixed').reduce((s, e) => s + Number(e.amount), 0)
  const availableForDaily = totalIncome - totalFixed
  // Usa meta definida pelo usuário se existir, senão calcula pela renda
  const dailyGoal = profileGoal > 0 ? profileGoal
    : availableForDaily > 0 ? Math.max(10, Math.round(availableForDaily / daysInMonth)) : 30

  // Gera mensagens contextuais (max 2 total; se pendências visíveis, max 1)
  const allMessages = buildMessages({
    currCats, limitsMap, totalIncome, totalExpenses, prevTotalExp,
    todaySpend, dailyGoal, catRanked, currTotal, daysInMonth, daysElapsed,
  })
  const msgLimit = totalPending > 0 ? 1 : 2
  const smartMessages = allMessages.slice(0, msgLimit)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in pb-4">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-gray-500 text-sm">{t('Visão geral · Overview')}</p>
        </div>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* ── 🥇 SALDO (principal) — slim ─────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-dark-700 to-dark-600 border border-white/8 px-4 py-3.5">
        {/* Linha superior: label + valor + ícone */}
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-gray-400 text-xs">Saldo disponível</p>
            {/* Fix #3 — clicar no saldo navega para despesas */}
            <button onClick={() => navigate('/expenses')} title="Ver despesas"
              className={`text-3xl font-bold tracking-tight mt-0.5 text-left hover:opacity-75 transition-opacity active:scale-95 ${accBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatBRL(accBalance)}
            </button>
            {hasPrevBal && prevMonthBal !== 0 && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${prevMonthBal >= 0 ? 'text-emerald-500/70' : 'text-red-400/70'}`}>
                {prevMonthBal >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {prevMonthBal >= 0 ? '+' : ''}{formatBRL(prevMonthBal)} do mês anterior
              </p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3 ${accBalance >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
            <Wallet size={20} className={accBalance >= 0 ? 'text-emerald-400' : 'text-red-400'} />
          </div>
        </div>

        {/* Breakdown por conta — clicável → /accounts */}
        {hasMultiple && accountBalances.length > 0 && (
          <button
            onClick={() => navigate('/accounts')}
            className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2.5 mt-2 border-t border-white/6
                       w-full text-left hover:opacity-80 transition-opacity active:scale-98"
            title="Gerenciar contas"
          >
            {accountBalances.map(acc => (
              <div key={acc.id} className="flex items-center gap-1.5">
                <span className="text-sm">{acc.emoji}</span>
                <span className="text-gray-400 text-xs">{acc.name}</span>
                <span className={`text-xs font-semibold ${acc.currentBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {formatBRL(acc.currentBalance)}
                </span>
              </div>
            ))}
          </button>
        )}

        {/* Linha inferior: Despesas pagas | Cartão disponível */}
        <div className="flex gap-4 pt-2.5 mt-2.5 border-t border-white/6">
          <div className="flex items-center gap-1.5">
            <TrendingDown size={11} className="text-red-400 shrink-0" />
            <span className="text-gray-500 text-xs">Gasto</span>
            <span className="text-red-400 text-xs font-semibold">{formatBRL(totalExpenses)}</span>
          </div>
          <div className="w-px bg-white/10 self-stretch" />
          <div className="flex items-center gap-1.5">
            <CreditCard size={11} className={cardAvailable >= 0 ? 'text-blue-400 shrink-0' : 'text-red-400 shrink-0'} />
            <span className="text-gray-500 text-xs">Cartão</span>
            <span className={`text-xs font-semibold ${cardAvailable >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {formatBRL(Math.max(cardAvailable, 0))} livre
            </span>
            <button
              onClick={() => { setLimitInput(String(Math.round(cardLimit * 100))); setShowLimitModal(true) }}
              className="text-gray-600 hover:text-gray-400 transition-colors ml-0.5"
              title="Editar limite"
            >
              <Settings size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* ── GASTO DIÁRIO ─────────────────────────────────────────── */}
      {(() => {
        const pct = dailyGoal > 0 ? (todaySpend / dailyGoal) * 100 : 0
        const isOver  = pct > 100
        const isLimit = pct >= 85 && pct <= 100   // chegando ou exatamente no limite
        const color = isOver ? {
          bar: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/20',
          bg: 'bg-red-500/8', label: 'Acima da meta', icon: '🔴'
        } : isLimit ? {
          bar: 'bg-orange-500', text: 'text-orange-400', border: 'border-white/8',
          bg: 'bg-dark-700', label: 'No limite', icon: '⚡'
        } : {
          bar: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/20',
          bg: 'bg-emerald-500/8', label: todaySpend === 0 ? 'Sem gastos hoje' : 'Dentro da meta', icon: '🟢'
        }
        return (
          <Link to="/daily"
            className={`block px-4 py-3.5 rounded-xl border ${color.bg} ${color.border}
                        transition-all active:scale-98`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">{color.icon}</span>
                <p className="text-white text-sm font-semibold">Gasto de hoje</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${color.text} font-medium`}>{color.label}</span>
                <ChevronRight size={13} className={color.text} />
              </div>
            </div>
            {/* Barra de progresso */}
            <div className="h-2 bg-dark-600 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            {/* Valores */}
            <div className="flex items-center justify-between">
              <span className={`text-base font-bold ${color.text}`}>
                {formatBRL(todaySpend)}
              </span>
              <span className="text-gray-500 text-xs">
                meta {formatBRL(dailyGoal)}/dia
              </span>
            </div>
          </Link>
        )
      })()}

      {/* ── 🥈 PENDÊNCIAS ────────────────────────────────────────── */}
      {totalPending > 0 && (
        <Link to="/expenses"
          className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl
                     bg-amber-500/8 border border-amber-500/20 active:scale-98 transition-all block">
          <div>
            <p className="text-amber-300 font-semibold text-sm">
              ⏳ {formatBRL(totalPending)} pendente de pagamento
            </p>
            <p className="text-gray-500 text-xs mt-0.5">Não impacta o saldo até ser pago</p>
          </div>
          <ChevronRight size={16} className="text-amber-400 shrink-0" />
        </Link>
      )}

      {/* ── 🥉 CATEGORIAS DO MÊS ────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-white font-semibold text-sm">Categorias do mês</p>
          <button onClick={() => navigate('/reports')}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
            Ver relatório <ChevronRight size={13} />
          </button>
        </div>

        <div className="card p-4">
          {pieData.length > 0 ? (
            <>
              {/* Mobile: donut + cards */}
              <div className="sm:hidden">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%"
                      innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="value">
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={v => [formatBRL(v), '']}
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#f9fafb' }}
                      itemStyle={{ color: '#e5e7eb' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Desktop: grid de cards (sem donut) | Mobile: lista abaixo do donut */}
              <div className="mt-2 sm:mt-0 sm:grid sm:grid-cols-2 sm:gap-2 space-y-1.5 sm:space-y-0">
                {pieData.map(({ name, value }, i) => {
                  const pct = currTotal > 0 ? ((value / currTotal) * 100).toFixed(0) : 0
                  const lim = limitsMap[name] || limitsMap[stripEmoji(name)]
                  const hasLim = lim && lim.limit_type !== 'none'
                  const limitThreshold = hasLim
                    ? (lim.limit_type === 'value' ? lim.limit_value : totalIncome * lim.limit_value / 100)
                    : null
                  const limitPct = hasLim && limitThreshold > 0
                    ? Math.min((value / limitThreshold) * 100, 100)
                    : null
                  const overLimit = hasLim && value > limitThreshold
                  const barColor = overLimit ? '#ef4444' : limitPct > 80 ? '#f59e0b' : COLORS[i % COLORS.length]
                  return (
                    <div key={name}
                      className={`px-3 py-2 rounded-xl border transition-all ${
                        overLimit ? 'bg-red-500/8 border-red-500/15' : 'bg-dark-600/50 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: barColor }} />
                        <span className={`text-xs font-medium flex-1 truncate ${overLimit ? 'text-red-400' : 'text-gray-200'}`}>
                          {name}
                        </span>
                        <span className={`text-xs font-bold shrink-0 ${overLimit ? 'text-red-400' : 'text-white'}`}>
                          {formatBRL(value)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-dark-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${limitPct ?? pct}%`, background: barColor }} />
                        </div>
                        <span className={`text-[10px] shrink-0 ${overLimit ? 'text-red-400' : 'text-gray-500'}`}>
                          {limitPct !== null ? `${limitPct.toFixed(0)}% limite` : `${pct}%`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            /* Estado vazio — donut neutro com mensagem central */
            <div className="relative">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={[{ value: 1 }]}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={68}
                    dataKey="value" strokeWidth={0}
                  >
                    <Cell fill="#1f2937" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-gray-500 text-xs text-center leading-tight">
                  Sem gastos<br/>registrados
                </p>
              </div>
              <p className="text-center text-gray-600 text-xs mt-1">
                Use o ⚡ para registrar seus gastos diários
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── AVISOS DO MÊS ─────────────────────────────────────────── */}
      {smartMessages.length > 0 && (
        <div className="space-y-2">
          {smartMessages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
              msg.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-300'
              : msg.type === 'warning' ? 'bg-amber-500/8 border-amber-500/15 text-amber-300'
              : 'bg-dark-700 border-white/8 text-gray-300'
            }`}>
              <p className="font-medium leading-snug">{msg.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal: editar limite do cartão */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowLimitModal(false)}>
          <div className="bg-dark-700 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">💳 Limite do cartão</h2>
              <button onClick={() => setShowLimitModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Atual: <span className="text-white font-semibold">{formatBRL(cardLimit)}</span>
            </p>
            <form onSubmit={handleSaveLimit} className="space-y-4">
              <CurrencyInput
                className="w-full bg-dark-600 border border-white/10 rounded-xl px-4 py-3
                           text-white text-lg font-semibold focus:outline-none focus:border-emerald-500/50"
                value={limitInput}
                onChange={setLimitInput}
                placeholder="0,00"
                autoFocus required
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowLimitModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={savingLimit}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm
                             flex items-center justify-center gap-2">
                  {savingLimit ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
