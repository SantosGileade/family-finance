import { useState, useEffect, useCallback } from 'react'
import { Wallet, CreditCard, RefreshCw, Settings, X, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, getExpenses, getDailySpending, getProfile, upsertProfile } from '../lib/supabase'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function BalanceBar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [income, setIncome] = useState(0)
  const [cashExpenses, setCashExpenses] = useState(0)
  const [cardUsed, setCardUsed] = useState(0)
  const [cardLimit, setCardLimit] = useState(400)
  const [loading, setLoading] = useState(true)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitInput, setLimitInput] = useState('')
  const [savingLimit, setSavingLimit] = useState(false)

  // Carrega limite do cartão do perfil (só uma vez por usuário)
  useEffect(() => {
    if (!user) return
    getProfile(user.id).then(({ data }) => {
      if (data?.card_limit) setCardLimit(data.card_limit)
    })
  }, [user])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [inc, exp, daily] = await Promise.all([
      getIncome(user.id, month, year),
      getExpenses(user.id, month, year),
      getDailySpending(user.id, month, year),
    ])
    const totalInc = (inc.data || []).reduce((s, i) => s + Number(i.amount), 0)

    const allExp = exp.data || []
    const allDaily = daily.data || []

    // Total de todas as saídas (despesas fixas/variáveis + gastos diários)
    const totalExp = allExp.reduce((s, e) => s + Number(e.amount), 0)
    const totalDaily = allDaily.reduce((s, d) => s + Number(d.amount), 0)

    // Limite do cartão = despesas categorizadas como cartão + gastos diários pagos no cartão
    const totalCardExp = allExp
      .filter(e => e.category === 'credit_card')
      .reduce((s, e) => s + Number(e.amount), 0)
    const totalCardDaily = allDaily
      .filter(d => d.payment_method === 'credit_card')
      .reduce((s, d) => s + Number(d.amount), 0)

    setIncome(totalInc)
    // Só fixas + variáveis (sem cartão) — cartão é dívida futura, não sai do caixa agora
    setCashExpenses((totalExp - totalCardExp) + (totalDaily - totalCardDaily))
    setCardUsed(totalCardExp + totalCardDaily) // cartão de despesas + cartão do diário
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

  const balance = income - cashExpenses
  const cardAvailable = cardLimit - cardUsed
  const isBalancePositive = balance >= 0
  const isCardOk = cardAvailable > 0

  return (
    <>
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
            <button
              onClick={() => { setLimitInput(String(Math.round(cardLimit * 100))); setShowLimitModal(true) }}
              title="Configurar limite do cartão"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <Settings size={12} />
            </button>
            <span className="text-gray-500 text-xs hidden sm:block">Cartão</span>
            <button
              onClick={() => navigate('/expenses', { state: { tab: 'credit_card' } })}
              title="Ver despesas do cartão"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 border transition-opacity hover:opacity-80 active:scale-95 ${
                isCardOk
                  ? cardAvailable < 100
                    ? 'bg-yellow-500/10 border-yellow-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                  : 'bg-red-500/15 border-red-500/30'
              }`}
            >
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
            </button>
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

    {/* Modal: configurar limite do cartão */}
    {showLimitModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && setShowLimitModal(false)}>
        <div className="bg-dark-700 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">💳 Limite do cartão</h2>
            <button onClick={() => setShowLimitModal(false)} className="text-gray-500 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Limite atual: <span className="text-white font-semibold">{formatBRL(cardLimit)}</span>
          </p>
          <form onSubmit={handleSaveLimit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Novo limite · New limit (R$)</label>
              <CurrencyInput
                className="w-full bg-dark-600 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-emerald-500/50"
                value={limitInput}
                onChange={setLimitInput}
                autoFocus
                required
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowLimitModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors text-sm">
                Cancelar
              </button>
              <button type="submit" disabled={savingLimit}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                {savingLimit ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar limite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}
