import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  Target, AlertCircle, ChevronRight, ArrowUpRight, ArrowDownRight, BarChart2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, getExpenses, getDailySpending, getSavings, getMonthlyTotals } from '../lib/supabase'
import { useLang } from '../hooks/useLang'
import MonthSelector from '../components/MonthSelector'
import { format } from 'date-fns'

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-600 border border-white/10 rounded-xl p-3 text-sm shadow-xl">
      <p className="text-gray-300 font-medium mb-1">{MONTHS_SHORT[label - 1]}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {formatBRL(p.value)}
        </p>
      ))}
    </div>
  )
}

// Agrupa apenas gastos diários por categoria/descrição
// Despesas fixas/variáveis/cartão ficam fora — são tratadas separadamente
const groupByCategory = (dailyItems) => {
  const map = {}
  dailyItems.forEach(d => {
    const key = d.description || 'Outros'
    map[key] = (map[key] || 0) + Number(d.amount)
  })
  return map
}

// Gera insights automáticos comparando mês atual vs anterior
const generateInsights = (currCats, prevCats, currTotal, prevTotal) => {
  const insights = []

  // Comparação total
  if (prevTotal > 0) {
    const diff = currTotal - prevTotal
    const pct = Math.abs((diff / prevTotal) * 100).toFixed(0)
    if (Math.abs(diff) > prevTotal * 0.05) {
      insights.push({
        type: diff > 0 ? 'warning' : 'success',
        icon: diff > 0 ? '📈' : '📉',
        text: diff > 0
          ? `Gastos totais ${pct}% acima do mês passado`
          : `Gastos totais ${pct}% abaixo do mês passado`,
      })
    }
  }

  // Maior categoria
  const topEntry = Object.entries(currCats).sort((a, b) => b[1] - a[1])[0]
  if (topEntry) {
    insights.push({
      type: 'info',
      icon: '🏆',
      text: `Maior gasto: ${topEntry[0]} (${formatBRL(topEntry[1])})`,
    })
  }

  // Categorias que mais variaram
  Object.entries(currCats).forEach(([cat, val]) => {
    const prev = prevCats[cat] || 0
    if (prev > 0 && val > 0) {
      const pct = ((val - prev) / prev) * 100
      if (pct >= 30) {
        insights.push({
          type: 'warning',
          icon: '⚠️',
          text: `${cat} subiu ${pct.toFixed(0)}% em relação ao mês passado`,
        })
      } else if (pct <= -25) {
        insights.push({
          type: 'success',
          icon: '✅',
          text: `${cat} caiu ${Math.abs(pct).toFixed(0)}% em relação ao mês passado`,
        })
      }
    }
  })

  return insights.slice(0, 4)
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const t = useLang()
  const navigate = useNavigate()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [daily, setDaily] = useState([])
  const [savings, setSavings] = useState([])
  const [monthlyTotals, setMonthlyTotals] = useState([])
  const [prevExpenses, setPrevExpenses] = useState([])
  const [prevDaily, setPrevDaily] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear  = month === 1 ? year - 1 : year

    Promise.all([
      getIncome(user.id, month, year),
      getExpenses(user.id, month, year),
      getDailySpending(user.id, month, year),
      getSavings(user.id),
      getMonthlyTotals(user.id, year),
      getExpenses(user.id, prevMonth, prevYear),
      getDailySpending(user.id, prevMonth, prevYear),
    ]).then(([inc, exp, day, sav, monthly, pExp, pDay]) => {
      setIncome(inc.data || [])
      setExpenses(exp.data || [])
      setDaily(day.data || [])
      setSavings(sav.data || [])
      setMonthlyTotals(monthly)
      setPrevExpenses(pExp.data || [])
      setPrevDaily(pDay.data || [])
      setLoading(false)
    })
  }, [user, month, year])

  const totalIncome   = income.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
                      + daily.reduce((s, d) => s + Number(d.amount), 0)
  const totalSavings  = savings.reduce((s, sv) => s + Number(sv.amount), 0)
  const cashExpenses  = expenses.filter(e => e.category !== 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
                      + daily.filter(d => d.payment_method !== 'credit_card').reduce((s, d) => s + Number(d.amount), 0)
  const balance       = totalIncome - cashExpenses
  const creditCard    = expenses.filter(e => e.category === 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
                      + daily.filter(d => d.payment_method === 'credit_card').reduce((s, d) => s + Number(d.amount), 0)

  const prevTotal = prevExpenses.reduce((s, e) => s + Number(e.amount), 0)
                  + prevDaily.reduce((s, d) => s + Number(d.amount), 0)
  const totalDiff = prevTotal > 0 ? ((totalExpenses - prevTotal) / prevTotal) * 100 : 0

  const todayStr   = format(new Date(), 'yyyy-MM-dd')
  const todaySpend = daily.filter(d => d.date === todayStr).reduce((s, d) => s + Number(d.amount), 0)

  const totalFixed  = expenses.filter(e => e.category === 'fixed').reduce((s, e) => s + Number(e.amount), 0)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const DAILY_GOAL  = (totalIncome - totalFixed) > 0
    ? Math.max(10, Math.round((totalIncome - totalFixed) / daysInMonth)) : 30

  const daysWithSpend = [...new Set(daily.map(d => d.date))].length
  const avgDaily      = daysWithSpend > 0 ? daily.reduce((s, d) => s + Number(d.amount), 0) / daysWithSpend : 0

  // Categorias
  const currCats = groupByCategory(daily)
  const prevCats = groupByCategory(prevDaily)
  const topCategories = Object.entries(currCats).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const insights = generateInsights(currCats, prevCats, totalExpenses, prevTotal)

  const creditCardPercent = totalIncome > 0 ? (creditCard / totalIncome) * 100 : 0

  const currentMonth = now.getMonth() + 1
  const chartData    = Array.isArray(monthlyTotals)
    ? monthlyTotals.filter(m => m.month <= currentMonth).slice(-6) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dashboard 📊</h1>
          <p className="text-gray-500 text-sm">{t('Visão geral · Overview')}</p>
        </div>
        <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* Alerta cartão */}
      {creditCard > 0 && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          creditCardPercent > 30
            ? 'bg-red-500/10 border-red-500/20 text-red-300'
            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
        }`}>
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              {creditCardPercent > 30 ? '⚠️ Cartão alto!' : '📌 Cartão de crédito'}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {formatBRL(creditCard)} no cartão ({creditCardPercent.toFixed(0)}% da renda).
              {creditCardPercent > 30 && ' Reduza para menos de 30%!'}
            </p>
          </div>
        </div>
      )}

      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-card border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="stat-label">{t('Renda · Income')}</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <p className="stat-value text-emerald-400">{formatBRL(totalIncome)}</p>
        </div>

        <div className="stat-card border border-red-500/10">
          <div className="flex items-center justify-between">
            <span className="stat-label">{t('Despesas · Expenses')}</span>
            <TrendingDown size={16} className="text-red-400" />
          </div>
          <p className="stat-value text-red-400">{formatBRL(totalExpenses)}</p>
          {prevTotal > 0 && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
              totalDiff > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {totalDiff > 0
                ? <ArrowUpRight size={12} />
                : <ArrowDownRight size={12} />}
              {Math.abs(totalDiff).toFixed(0)}% vs mês anterior
            </div>
          )}
        </div>

        <div className={`stat-card border ${balance >= 0 ? 'border-blue-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <span className="stat-label">{t('Saldo · Balance')}</span>
            <Wallet size={16} className={balance >= 0 ? 'text-blue-400' : 'text-red-400'} />
          </div>
          <p className={`stat-value ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {formatBRL(balance)}
          </p>
          <p className="text-gray-600 text-xs mt-0.5">Renda − despesas</p>
        </div>

        <div className="stat-card border border-purple-500/20">
          <div className="flex items-center justify-between">
            <span className="stat-label">{t('Poupança · Savings')}</span>
            <PiggyBank size={16} className="text-purple-400" />
          </div>
          <p className="stat-value text-purple-400">{formatBRL(totalSavings)}</p>
        </div>
      </div>

      {/* Insights automáticos */}
      {insights.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">💡 Insights do mês</p>
          </div>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
                ins.type === 'warning'
                  ? 'bg-red-500/8 border-red-500/15 text-red-300'
                  : ins.type === 'success'
                  ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-300'
                  : 'bg-blue-500/8 border-blue-500/15 text-blue-300'
              }`}>
                <span className="text-base shrink-0">{ins.icon}</span>
                <p>{ins.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 3 categorias */}
      {topCategories.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">🏆 Top categorias</p>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              Ver tudo <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {topCategories.map(([cat, val], i) => {
              const pct = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0
              const prevVal = prevCats[cat] || 0
              const catDiff = prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : 0
              return (
                <div key={cat} className="card p-3 flex items-center gap-3">
                  <div className="w-7 h-7 bg-dark-600 rounded-full flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white text-sm font-medium truncate">{cat}</p>
                      <p className="text-white text-sm font-bold shrink-0 ml-2">{formatBRL(val)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-500 text-xs shrink-0">{pct.toFixed(0)}%</span>
                      {prevVal > 0 && (
                        <span className={`text-xs font-medium shrink-0 ${catDiff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {catDiff > 0 ? '+' : ''}{catDiff.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Botão Ver relatório */}
      <button
        onClick={() => navigate('/reports')}
        className="w-full flex items-center justify-center gap-2
                   bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                   text-emerald-400 font-semibold py-3.5 rounded-xl transition-all active:scale-95"
      >
        <BarChart2 size={18} />
        Ver relatório completo
        <ChevronRight size={16} />
      </button>

      {/* Meta diária */}
      <div className="card border border-white/8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-emerald-400" />
            <div>
              <p className="text-white font-semibold text-sm">{t('Gasto Diário · Daily Spending')}</p>
              <p className="text-gray-500 text-xs">Meta: {formatBRL(DAILY_GOAL)} por dia</p>
            </div>
          </div>
          <Link to="/daily" className="text-emerald-400 text-xs hover:text-emerald-300 flex items-center gap-1">
            Ver tudo <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-dark-600 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs mb-1">{t('Hoje · Today')}</p>
            <p className={`text-xl font-bold ${todaySpend <= DAILY_GOAL ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatBRL(todaySpend)}
            </p>
            <p className="text-xs mt-1">
              {todaySpend === 0
                ? <span className="text-gray-500">Nenhum gasto hoje 🎉</span>
                : todaySpend <= DAILY_GOAL
                ? <span className="text-emerald-400">✅ Dentro da meta!</span>
                : <span className="text-red-400">⚠️ Acima da meta!</span>}
            </p>
          </div>
          <div className="bg-dark-600 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs mb-1">{t('Média Mensal · Monthly Avg')}</p>
            <p className={`text-xl font-bold ${avgDaily <= DAILY_GOAL ? 'text-emerald-400' : 'text-yellow-400'}`}>
              {formatBRL(avgDaily)}
            </p>
            <p className="text-xs mt-1 text-gray-500">por dia</p>
          </div>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${todaySpend <= DAILY_GOAL ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min((todaySpend / DAILY_GOAL) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">R$ 0</span>
          <span className="text-xs text-gray-500">Meta: {formatBRL(DAILY_GOAL)}</span>
        </div>
      </div>

      {/* Gráfico mensal */}
      {chartData.length > 0 && (
        <div className="card">
          <p className="section-title">Receitas vs Despesas</p>
          {isAdmin && <p className="text-gray-500 text-xs mb-3">Income vs Expenses</p>}
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="month" tickFormatter={v => MONTHS_SHORT[v - 1]}
                tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v > 0 ? `${v}` : '0'} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="income" name="Renda" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
