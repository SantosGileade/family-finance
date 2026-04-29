import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getDailySpending } from '../lib/supabase'
import { useLang } from '../hooks/useLang'

const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#a855f7']

// Agrupa apenas gastos diários — categorias como Fixas/Variáveis ficam fora
const groupByCategory = (dailyItems) => {
  const map = {}
  dailyItems.forEach(d => {
    const key = d.description || 'Outros'
    map[key] = (map[key] || 0) + Number(d.amount)
  })
  return map
}

const PERIOD_TABS = [
  { key: 'current', label: 'Este mês'     },
  { key: 'prev',    label: 'Mês anterior' },
  { key: 'both',    label: 'Comparativo'  },
]

export default function Reports() {
  const { user } = useAuth()
  const t = useLang()
  const now = new Date()

  const [period, setPeriod] = useState('current')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)

  const [currDay, setCurrDay] = useState([])
  const [prevDay, setPrevDay] = useState([])

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      getDailySpending(user.id, month, year),
      getDailySpending(user.id, prevMonth, prevYear),
    ]).then(([cd, pd]) => {
      setCurrDay(cd.data || [])
      setPrevDay(pd.data || [])
      setLoading(false)
    })
  }, [user, month, year])

  const currCats  = groupByCategory(currDay)
  const prevCats  = groupByCategory(prevDay)
  const currTotal = Object.values(currCats).reduce((s, v) => s + v, 0)
  const prevTotal = Object.values(prevCats).reduce((s, v) => s + v, 0)

  // Sorted ranking
  const currRanked = Object.entries(currCats).sort((a, b) => b[1] - a[1])
  const prevRanked = Object.entries(prevCats).sort((a, b) => b[1] - a[1])

  // Pie data
  const pieData = currRanked.map(([name, value]) => ({ name, value }))

  // Insights
  const insights = []
  if (prevTotal > 0) {
    const diff = currTotal - prevTotal
    const pct  = Math.abs((diff / prevTotal) * 100).toFixed(0)
    insights.push({
      type: diff > 0 ? 'bad' : 'good',
      text: diff > 0
        ? `Total ${pct}% acima do mês anterior (${formatBRL(Math.abs(diff))} a mais)`
        : `Total ${pct}% abaixo do mês anterior (${formatBRL(Math.abs(diff))} economizados)`,
    })
  }
  if (currRanked[0]) {
    insights.push({ type: 'info', text: `Maior gasto: ${currRanked[0][0]} com ${formatBRL(currRanked[0][1])}` })
  }
  currRanked.forEach(([cat, val]) => {
    const prev = prevCats[cat] || 0
    if (prev > 0) {
      const pct = ((val - prev) / prev) * 100
      if (pct >= 40)  insights.push({ type: 'bad',  text: `${cat} aumentou ${pct.toFixed(0)}% vs mês anterior` })
      if (pct <= -30) insights.push({ type: 'good', text: `${cat} reduziu ${Math.abs(pct).toFixed(0)}% vs mês anterior` })
    }
  })

  const activeData = period === 'prev' ? prevRanked  : currRanked
  const activeTotal = period === 'prev' ? prevTotal : currTotal

  const monthName = (m, y) => {
    const d = new Date(y, m - 1, 1)
    return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Relatório 📊</h1>
          <p className="text-gray-500 text-sm">Análise completa por categoria</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor de mês simples */}
          <button
            onClick={() => {
              const d = new Date(year, month - 2, 1)
              setMonth(d.getMonth() + 1)
              setYear(d.getFullYear())
            }}
            className="text-gray-400 hover:text-white text-lg px-2 py-1 rounded-lg hover:bg-white/5"
          >‹</button>
          <span className="text-white text-sm font-medium min-w-[100px] text-center capitalize">
            {monthName(month, year)}
          </span>
          <button
            onClick={() => {
              const d = new Date(year, month, 1)
              setMonth(d.getMonth() + 1)
              setYear(d.getFullYear())
            }}
            className="text-gray-400 hover:text-white text-lg px-2 py-1 rounded-lg hover:bg-white/5"
            disabled={month === now.getMonth() + 1 && year === now.getFullYear()}
          >›</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-700 p-1 rounded-xl">
        {PERIOD_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setPeriod(tab.key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              period === tab.key ? 'bg-dark-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Comparativo side-by-side */}
          {period === 'both' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: monthName(month, year), total: currTotal, type: 'curr' },
                  { label: monthName(prevMonth, prevYear), total: prevTotal, type: 'prev' },
                ].map(({ label, total, type }) => (
                  <div key={type} className="card text-center">
                    <p className="text-gray-400 text-xs mb-1 capitalize truncate">{label}</p>
                    <p className="text-white text-lg font-bold">{formatBRL(total)}</p>
                    {type === 'curr' && prevTotal > 0 && (
                      <div className={`flex items-center justify-center gap-1 mt-1 text-xs font-medium ${
                        currTotal > prevTotal ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {currTotal > prevTotal ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
                        {Math.abs(((currTotal - prevTotal)/prevTotal)*100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Tabela comparativa */}
              <div className="card overflow-hidden p-0">
                <div className="px-4 py-3 border-b border-white/6">
                  <p className="text-white font-semibold text-sm">Comparação por categoria</p>
                </div>
                <div className="divide-y divide-white/5">
                  {[...new Set([...Object.keys(currCats), ...Object.keys(prevCats)])].map(cat => {
                    const curr = currCats[cat] || 0
                    const prev = prevCats[cat] || 0
                    const diff = curr - prev
                    const pct  = prev > 0 ? ((diff / prev) * 100) : (curr > 0 ? 100 : 0)
                    return (
                      <div key={cat} className="flex items-center gap-3 px-4 py-3">
                        <p className="flex-1 text-sm text-gray-300 truncate">{cat}</p>
                        <p className="text-gray-500 text-xs w-20 text-right">{formatBRL(prev)}</p>
                        <p className="text-white text-sm font-medium w-20 text-right">{formatBRL(curr)}</p>
                        {prev > 0 || curr > 0 ? (
                          <div className={`flex items-center gap-0.5 text-xs font-medium w-14 justify-end ${
                            diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-gray-500'
                          }`}>
                            {diff > 0 ? <ArrowUpRight size={11}/> : diff < 0 ? <ArrowDownRight size={11}/> : null}
                            {diff !== 0 ? `${Math.abs(pct).toFixed(0)}%` : '—'}
                          </div>
                        ) : <div className="w-14" />}
                      </div>
                    )
                  })}
                </div>
                <div className="px-4 py-3 bg-dark-600/50 border-t border-white/6 flex items-center">
                  <p className="flex-1 text-sm text-gray-400 font-medium">Total</p>
                  <p className="text-gray-500 text-xs w-20 text-right">{formatBRL(prevTotal)}</p>
                  <p className="text-white text-sm font-bold w-20 text-right">{formatBRL(currTotal)}</p>
                  <div className={`flex items-center gap-0.5 text-xs font-bold w-14 justify-end ${
                    currTotal > prevTotal ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {prevTotal > 0 && (
                      <>
                        {currTotal > prevTotal ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
                        {Math.abs(((currTotal - prevTotal)/prevTotal)*100).toFixed(0)}%
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Total do período */}
              <div className="card text-center py-5 border border-white/8">
                <p className="text-gray-400 text-sm mb-1 capitalize">{
                  period === 'prev' ? monthName(prevMonth, prevYear) : monthName(month, year)
                }</p>
                <p className="text-white text-3xl font-bold">{formatBRL(activeTotal)}</p>
                {period === 'current' && prevTotal > 0 && (
                  <div className={`flex items-center justify-center gap-1 mt-2 text-sm font-medium ${
                    currTotal > prevTotal ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {currTotal > prevTotal ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                    {Math.abs(((currTotal - prevTotal)/prevTotal)*100).toFixed(0)}% vs mês anterior
                  </div>
                )}
              </div>

              {/* Gráfico pizza */}
              {pieData.length > 0 && (
                <div className="card">
                  <p className="section-title mb-1">Distribuição por categoria</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={period === 'prev'
                          ? prevRanked.map(([name, value]) => ({ name, value }))
                          : pieData}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        paddingAngle={2} dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={v => [formatBRL(v), '']}
                        contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px' }}
                      />
                      <Legend
                        iconType="circle" iconSize={8}
                        formatter={v => <span style={{ color: '#9ca3af', fontSize: 10 }}>{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Ranking */}
              {activeData.length > 0 && (
                <div>
                  <p className="section-title mb-3">Ranking de categorias</p>
                  <div className="space-y-2">
                    {activeData.map(([cat, val], i) => {
                      const pct     = activeTotal > 0 ? (val / activeTotal) * 100 : 0
                      const prevVal = prevCats[cat] || 0
                      const currVal = currCats[cat] || 0
                      const catDiff = prevVal > 0 ? ((currVal - prevVal) / prevVal) * 100 : 0
                      return (
                        <div key={cat} className="card p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs text-gray-600 font-bold w-4 shrink-0">{i+1}</span>
                            <p className="flex-1 text-white text-sm font-medium truncate">{cat}</p>
                            <p className="text-white text-sm font-bold">{formatBRL(val)}</p>
                            {period === 'current' && prevVal > 0 && (
                              <div className={`flex items-center gap-0.5 text-xs font-medium ${
                                catDiff > 0 ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                {catDiff > 0 ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
                                {Math.abs(catDiff).toFixed(0)}%
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                }}
                              />
                            </div>
                            <span className="text-gray-500 text-xs w-8 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div>
              <p className="section-title mb-3">💡 Insights automáticos</p>
              <div className="space-y-2">
                {insights.map((ins, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
                    ins.type === 'bad'  ? 'bg-red-500/8 border-red-500/15 text-red-300'
                    : ins.type === 'good' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-300'
                    : 'bg-blue-500/8 border-blue-500/15 text-blue-300'
                  }`}>
                    <span className="text-base shrink-0">
                      {ins.type === 'bad' ? '⚠️' : ins.type === 'good' ? '✅' : 'ℹ️'}
                    </span>
                    <p>{ins.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeData.length === 0 && (
            <div className="card text-center py-12">
              <BarChart2 size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">Nenhum gasto registrado</p>
              <p className="text-gray-600 text-sm mt-1">Registre gastos para ver a análise</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
