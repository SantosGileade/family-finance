import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  ChevronRight, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Wallet
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getIncome, getExpenses, getDailySpending,
  getSavings, getCategoryLimits, getProfile
} from '../lib/supabase'
import { useLang } from '../hooks/useLang'
import MonthPicker from '../components/MonthPicker'
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

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
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
  const [cardLimit,  setCardLimit]  = useState(400)
  const [loading,    setLoading]    = useState(true)

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
    getProfile(user.id).then(({ data }) => { if (data?.card_limit) setCardLimit(data.card_limit) })
  }, [user])

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
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
                      + daily.reduce((s, d) => s + Number(d.amount), 0)
  const totalPending = expenses.filter(e => e.status === 'pendente').reduce((s, e) => s + Number(e.amount), 0)

  // Saldo anterior
  const pIncTotal = prevIncome.reduce((s, i) => s + Number(i.amount), 0)
  const pPaidExp  = prevExp.filter(e => !e.status || e.status === 'pago')
  const pCash     = pPaidExp.filter(e => e.category !== 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
                  + prevDaily.filter(d => d.payment_method !== 'credit_card').reduce((s, d) => s + Number(d.amount), 0)
  const prevMonthBal   = pIncTotal - pCash
  const accBalance     = balance + prevMonthBal
  const hasPrevBal     = pIncTotal > 0 || pCash > 0

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

  // Insight único — o mais relevante
  let insight = null
  if (prevTotal > 0 && Math.abs(totalExpenses - prevTotalExp) > prevTotalExp * 0.05) {
    const pct = Math.abs(totalDiff).toFixed(0)
    insight = totalDiff < 0
      ? { type: 'good', text: `Gastos ${pct}% abaixo do mês passado 🎉` }
      : { type: 'bad',  text: `Gastos ${pct}% acima do mês passado` }
  } else if (catRanked[0]) {
    insight = { type: 'info', text: `Maior gasto: ${catRanked[0][0]} — ${formatBRL(catRanked[0][1])}` }
  }

  const todayStr   = format(new Date(), 'yyyy-MM-dd')
  const todaySpend = daily.filter(d => d.date === todayStr).reduce((s, d) => s + Number(d.amount), 0)

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
          <h1 className="page-title">Dashboard 📊</h1>
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
            <p className={`text-3xl font-bold tracking-tight mt-0.5 ${accBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatBRL(accBalance)}
            </p>
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

        {/* Linha inferior: Renda / Despesas — mais compacta */}
        <div className="flex gap-4 pt-2.5 mt-2.5 border-t border-white/6">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={11} className="text-emerald-400 shrink-0" />
            <span className="text-gray-500 text-xs">{t('Renda · Income')}</span>
            <span className="text-emerald-400 text-xs font-semibold">{formatBRL(totalIncome)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown size={11} className="text-red-400 shrink-0" />
            <span className="text-gray-500 text-xs">{t('Despesas · Expenses')}</span>
            <span className="text-red-400 text-xs font-semibold">{formatBRL(totalExpenses)}</span>
            {prevTotalExp > 0 && (
              <span className={`text-[10px] font-medium flex items-center gap-0.5 ${totalDiff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {totalDiff > 0 ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                {Math.abs(totalDiff).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>

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

      {/* ── 🥉 CATEGORIAS + GASTO DO DIA ─────────────────────────── */}
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
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%"
                    innerRadius={45} outerRadius={68} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={v => [formatBRL(v), '']}
                    contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legenda em grid 2 colunas */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                {pieData.map(({ name, value }, i) => {
                  const pct = currTotal > 0 ? ((value / currTotal) * 100).toFixed(0) : 0
                  const lim = limitsMap[name] || limitsMap[stripEmoji(name)]
                  const hasLim = lim && lim.limit_type !== 'none'
                  const limitThreshold = hasLim
                    ? (lim.limit_type === 'value' ? lim.limit_value : totalIncome * lim.limit_value / 100)
                    : null
                  const overLimit = hasLim && value > limitThreshold
                  return (
                    <div key={name} className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className={`text-xs truncate flex-1 ${overLimit ? 'text-red-400' : 'text-gray-400'}`}>{name}</span>
                      <span className={`text-xs font-medium shrink-0 ${overLimit ? 'text-red-400' : 'text-gray-500'}`}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm">Nenhum gasto registrado este mês</p>
              <p className="text-gray-600 text-xs mt-1">Use o ⚡ para registrar gastos do dia a dia</p>
            </div>
          )}

          {/* Gasto do dia — sempre visível dentro do card */}
          <div className={`flex items-center justify-between mt-3 pt-3 border-t border-white/6`}>
            <div className="flex items-center gap-2">
              <span className="text-base">📅</span>
              <div>
                <p className="text-gray-400 text-xs">Gasto hoje</p>
                <p className={`text-sm font-semibold ${todaySpend > 0 ? 'text-white' : 'text-gray-600'}`}>
                  {todaySpend > 0 ? formatBRL(todaySpend) : 'Nenhum gasto'}
                </p>
              </div>
            </div>
            <Link to="/daily"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
              Registrar <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 🔹 INSIGHT ────────────────────────────────────────────── */}
      {insight && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
          insight.type === 'good' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-300'
          : insight.type === 'bad' ? 'bg-red-500/8 border-red-500/15 text-red-300'
          : 'bg-blue-500/8 border-blue-500/15 text-blue-300'
        }`}>
          <span className="text-base shrink-0">💡</span>
          <p className="font-medium">{insight.text}</p>
        </div>
      )}

    </div>
  )
}
