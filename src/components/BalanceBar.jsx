import { useState, useEffect, useCallback } from 'react'
import { Wallet, CreditCard, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, getExpenses, getDailySpending } from '../lib/supabase'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CARD_LIMIT = 400 // Limite do cartão de crédito em R$

export default function BalanceBar() {
  const { user } = useAuth()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [income, setIncome] = useState(0)
  const [cashExpenses, setCashExpenses] = useState(0) // só fixas + variáveis (sem cartão)
  const [cardUsed, setCardUsed] = useState(0)         // só cartão de crédito
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [inc, exp, daily] = await Promise.all([
      getIncome(user.id, month, year),
      getExpenses(user.id, month, year),
      getDailySpending(user.id, month, year),
    ])
    const totalInc = (inc.data || []).reduce((s, i) => s + Number(i.amount), 0)

    // Todas as despesas entram no saldo (fixas + variáveis + cartão + gastos diários)
    const allExp = exp.data || []
    const totalExp = allExp.reduce((s, e) => s + Number(e.amount), 0)
    const totalDaily = (daily.data || []).reduce((s, d) => s + Number(d.amount), 0)
    const totalCard = allExp
      .filter(e => e.category === 'credit_card')
      .reduce((s, e) => s + Number(e.amount), 0)

    setIncome(totalInc)
    setCashExpenses(totalExp + totalDaily) // despesas + gastos diários
    setCardUsed(totalCard)
    setLoading(false)
  }, [user, month, year])

  // Carrega ao montar
  useEffect(() => { load() }, [load])

  // Auto-atualiza quando qualquer página adiciona/remove dados
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('finance-updated', handler)
    return () => window.removeEventListener('finance-updated', handler)
  }, [load])

  // Saldo real = renda - despesas em dinheiro (cartão é dívida futura, não sai do bolso agora)
  const balance = income - cashExpenses
  const cardAvailable = CARD_LIMIT - cardUsed
  const isBalancePositive = balance >= 0
  const isCardOk = cardAvailable > 0

  return (
    <div className="bg-dark-900 border-b border-white/5 px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center gap-3 flex-wrap justify-between">

        {/* App name */}
        <div className="flex items-center gap-2">
          <span className="text-base">💰</span>
          <span className="text-white text-sm font-bold hidden sm:block">FinançasFamília</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Saldo disponível (sem cartão) */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs hidden sm:block">Saldo</span>
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1 border ${
              isBalancePositive
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-red-500/15 border-red-500/30'
            }`}>
              <Wallet size={13} className={isBalancePositive ? 'text-emerald-400' : 'text-red-400'} />
              <span className={`text-sm font-bold ${isBalancePositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {loading ? '...' : formatBRL(balance)}
              </span>
            </div>
          </div>

          {/* Divisor */}
          <span className="text-gray-700 text-xs">·</span>

          {/* Limite do cartão disponível */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs hidden sm:block">Cartão</span>
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1 border ${
              isCardOk
                ? cardAvailable < 100
                  ? 'bg-yellow-500/10 border-yellow-500/20'
                  : 'bg-blue-500/10 border-blue-500/20'
                : 'bg-red-500/15 border-red-500/30'
            }`}>
              <CreditCard size={13} className={
                isCardOk
                  ? cardAvailable < 100 ? 'text-yellow-400' : 'text-blue-400'
                  : 'text-red-400'
              } />
              <span className={`text-sm font-bold ${
                isCardOk
                  ? cardAvailable < 100 ? 'text-yellow-400' : 'text-blue-400'
                  : 'text-red-400'
              }`}>
                {loading ? '...' : formatBRL(cardAvailable)}
              </span>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={load}
            className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors rounded-lg hover:bg-white/5"
            title="Atualizar"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  )
}
