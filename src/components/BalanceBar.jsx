import { useState, useEffect } from 'react'
import { Wallet, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, getExpenses } from '../lib/supabase'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function BalanceBar() {
  const { user } = useAuth()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!user) return
    setLoading(true)
    const [inc, exp] = await Promise.all([
      getIncome(user.id, month, year),
      getExpenses(user.id, month, year),
    ])
    const totalInc = (inc.data || []).reduce((s, i) => s + Number(i.amount), 0)
    const totalExp = (exp.data || []).reduce((s, e) => s + Number(e.amount), 0)
    setIncome(totalInc)
    setExpenses(totalExp)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const balance = income - expenses
  const isPositive = balance >= 0

  return (
    <div className="bg-dark-900 border-b border-white/5 px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">

        {/* App name */}
        <div className="flex items-center gap-2">
          <span className="text-base">💰</span>
          <span className="text-white text-sm font-bold hidden sm:block">FinançasFamília</span>
        </div>

        {/* Saldo */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">Saldo do mês</span>
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1 border ${
            isPositive
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-red-500/15 border-red-500/30'
          }`}>
            <Wallet size={13} className={isPositive ? 'text-emerald-400' : 'text-red-400'} />
            <span className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {loading ? '...' : formatBRL(balance)}
            </span>
          </div>
          <button
            onClick={load}
            className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors rounded-lg hover:bg-white/5"
            title="Atualizar saldo"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

      </div>
    </div>
  )
}
