import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  Calendar, CreditCard, ChevronRight, Target, AlertCircle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, getExpenses, getDailySpending, getSavings, getMonthlyTotals } from '../lib/supabase'
import MonthSelector from '../components/MonthSelector'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const formatBRL = (v) =>
  v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-dark-600 border border-white/10 rounded-xl p-3 text-sm shadow-xl">
        <p className="text-gray-300 font-medium mb-1">{MONTHS_SHORT[label - 1]}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">
            {p.name}: {formatBRL(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { user } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [daily, setDaily] = useState([])
  const [savings, setSavings] = useState([])
  const [monthlyTotals, setMonthlyTotals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      getIncome(user.id, month, year),
      getExpenses(user.id, month, year),
      getDailySpending(user.id, month, year),
      getSavings(user.id),
      getMonthlyTotals(user.id, year),
    ]).then(([inc, exp, day, sav, monthly]) => {
      setIncome(inc.data || [])
      setExpenses(exp.data || [])
      setDaily(day.data || [])
      setSavings(sav.data || [])
      setMonthlyTotals(monthly)
      setLoading(false)
    })
  }, [user, month, year])

  const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
    + daily.reduce((s, d) => s + Number(d.amount), 0)
  const totalSavings = savings.reduce((s, sv) => s + Number(sv.amount), 0)
  // Saldo = renda - despesas em dinheiro/débito (cartão é dívida futura)
  const cashExpenses = expenses.filter(e => e.category !== 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
    + daily.filter(d => d.payment_method !== 'credit_card').reduce((s, d) => s + Number(d.amount), 0)
  const balance = totalIncome - cashExpenses
  const creditCard = expenses.filter(e => e.category === 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
    + daily.filter(d => d.payment_method === 'credit_card').reduce((s, d) => s + Number(d.amount), 0)

  // Today's spending
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todaySpend = daily
    .filter(d => d.date === todayStr)
    .reduce((s, d) => s + Number(d.amount), 0)
  const DAILY_GOAL = 30

  // This month daily average
  const daysWithSpend = [...new Set(daily.map(d => d.date))].length
  const avgDaily = daysWithSpend > 0 ? daily.reduce((s, d) => s + Number(d.amount), 0) / daysWithSpend : 0

  // Category breakdown for pie
  const categoryMap = {}
  expenses.forEach(e => {
    const key = e.category === 'fixed' ? 'Fixas' :
                e.category === 'variable' ? 'Variáveis' :
                e.category === 'credit_card' ? 'Cartão' : 'Outros'
    categoryMap[key] = (categoryMap[key] || 0) + Number(e.amount)
  })
  const pieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }))

  // Chart data - last 6 months
  const chartData = monthlyTotals.filter(m => m.income > 0 || m.expenses > 0).slice(-6)

  const creditCardPercent = totalIncome > 0 ? (creditCard / totalIncome) * 100 : 0

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
          <p className="text-gray-500 text-sm">Visão geral · Overview</p>
        </div>
        <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* Credit card alert */}
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
              Você gastou {formatBRL(creditCard)} no cartão este mês ({creditCardPercent.toFixed(0)}% do salário).
              {creditCardPercent > 30 && ' Reduza para menos de 30%!'}
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-card border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="stat-label">Renda · Income</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <p className="stat-value text-emerald-400">{formatBRL(totalIncome)}</p>
        </div>

        <div className="stat-card border border-red-500/10">
          <div className="flex items-center justify-between">
            <span className="stat-label">Despesas · Expenses</span>
            <TrendingDown size={16} className="text-red-400" />
          </div>
          <p className="stat-value text-red-400">{formatBRL(totalExpenses)}</p>
        </div>

        <div className={`stat-card border ${balance >= 0 ? 'border-blue-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <span className="stat-label">Saldo · Balance</span>
            <Wallet size={16} className={balance >= 0 ? 'text-blue-400' : 'text-red-400'} />
          </div>
          <p className={`stat-value ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {formatBRL(balance)}
          </p>
        </div>

        <div className="stat-card border border-purple-500/20">
          <div className="flex items-center justify-between">
            <span className="stat-label">Poupança · Savings</span>
            <PiggyBank size={16} className="text-purple-400" />
          </div>
          <p className="stat-value text-purple-400">{formatBRL(totalSavings)}</p>
        </div>
      </div>

      {/* Daily goal card */}
      <div className="card border border-white/8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-emerald-400" />
            <div>
              <p className="text-white font-semibold text-sm">Gasto Diário · Daily Spending</p>
              <p className="text-gray-500 text-xs">Meta: R$ {DAILY_GOAL},00 por dia</p>
            </div>
          </div>
          <Link to="/daily" className="text-emerald-400 text-xs hover:text-emerald-300 flex items-center gap-1">
            Ver tudo <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-dark-600 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs mb-1">Hoje · Today</p>
            <p className={`text-xl font-bold ${todaySpend <= DAILY_GOAL ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatBRL(todaySpend)}
            </p>
            <p className="text-xs mt-1">
              {todaySpend === 0 ? (
                <span className="text-gray-500">Nenhum gasto hoje 🎉</span>
              ) : todaySpend <= DAILY_GOAL ? (
                <span className="text-emerald-400">✅ Dentro da meta!</span>
              ) : (
                <span className="text-red-400">⚠️ Acima da meta!</span>
              )}
            </p>
          </div>
          <div className="bg-dark-600 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs mb-1">Média Mensal · Monthly Avg</p>
            <p className={`text-xl font-bold ${avgDaily <= DAILY_GOAL ? 'text-emerald-400' : 'text-yellow-400'}`}>
              {formatBRL(avgDaily)}
            </p>
            <p className="text-xs mt-1 text-gray-500">por dia / per day</p>
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
          <span className="text-xs text-gray-500">Meta: R$ {DAILY_GOAL}</span>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bar chart */}
          <div className="card">
            <p className="section-title">Receitas vs Despesas</p>
            <p className="text-gray-500 text-xs mb-3">Income vs Expenses</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(v) => MONTHS_SHORT[v - 1]}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income" name="Renda" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          <div className="card">
            <p className="section-title">Categorias este mês</p>
            <p className="text-gray-500 text-xs mb-3">Expense categories</p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatBRL(value), '']}
                    contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-36 text-gray-500 text-sm">
                Nenhuma despesa registrada
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div>
        <p className="section-title">Ações rápidas · Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { to: '/income', emoji: '💵', label: 'Adicionar renda', sub: 'Add income' },
            { to: '/expenses', emoji: '🧾', label: 'Lançar despesa', sub: 'Add expense' },
            { to: '/daily', emoji: '📅', label: 'Gasto de hoje', sub: "Today's spend" },
            { to: '/savings', emoji: '🐷', label: 'Guardar dinheiro', sub: 'Save money' },
            { to: '/tips', emoji: '💡', label: 'Ver dicas', sub: 'See tips' },
            { to: '/expenses', emoji: '💳', label: 'Controle cartão', sub: 'Credit card' },
          ].map(({ to, emoji, label, sub }) => (
            <Link
              key={to + label}
              to={to}
              className="card-hover flex items-center gap-3 p-3"
            >
              <span className="text-2xl">{emoji}</span>
              <div>
                <p className="text-white text-sm font-medium leading-tight">{label}</p>
                <p className="text-gray-500 text-xs">{sub}</p>
              </div>
              <ChevronRight size={14} className="text-gray-600 ml-auto" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
