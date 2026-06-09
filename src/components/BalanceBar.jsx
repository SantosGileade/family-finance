import { useState, useEffect, useCallback } from 'react'
import { Wallet, CreditCard, RefreshCw, Settings, X, Loader2, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, getExpenses, getDailySpending, getProfile, upsertProfile, getAccounts, getAllCreditCardExpenses } from '../lib/supabase'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function BalanceBar() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const [income,       setIncome]       = useState(0)
  const [cashExpenses, setCashExpenses] = useState(0)
  const [cardUsed,     setCardUsed]     = useState(0)
  const [prevCarry,    setPrevCarry]    = useState(0)
  const [cardLimit,    setCardLimit]    = useState(400)
  const [loading,      setLoading]      = useState(true)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitInput,   setLimitInput]   = useState('')
  const [savingLimit,  setSavingLimit]  = useState(false)

  useEffect(() => {
    if (!user) return
    getProfile(user.id).then(({ data }) => {
      if (data?.card_limit) setCardLimit(data.card_limit)
    })
  }, [user])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear  = month === 1 ? year - 1 : year

    const [inc, exp, daily, pInc, pExp, pDay, allCardRes] = await Promise.all([
      getIncome(user.id, month, year),
      getExpenses(user.id, month, year),
      getDailySpending(user.id, month, year),
      getIncome(user.id, prevMonth, prevYear),
      getExpenses(user.id, prevMonth, prevYear),
      getDailySpending(user.id, prevMonth, prevYear),
      getAllCreditCardExpenses(user.id),   // todas parcelas de cartão (todos os meses)
    ])
    const allExp     = exp.data || []
    const allDaily   = daily.data || []
    const allCardAll = allCardRes.data || []
    const paidExp    = allExp.filter(e => !e.status || e.status === 'pago')
    // Limite do cartão: soma TODAS as parcelas não pagas de todos os meses
    // (compra de R$1200 em 12x = R$1200 do limite, não só R$100)
    const totalCardExp   = allCardAll.filter(e => e.status !== 'pago').reduce((s, e) => s + Number(e.amount), 0)
    const totalCardDaily = allDaily.filter(d => d.payment_method === 'credit_card').reduce((s, d) => s + Number(d.amount), 0)
    // Saldo em conta: só despesas não-cartão pagas (cartão desconta só ao pagar a fatura)
    const paidNonCard = paidExp.filter(e => e.category !== 'credit_card')
    const currCash   = paidNonCard.reduce((s, e) => s + Number(e.amount), 0)
                     + allDaily.filter(d => d.payment_method !== 'credit_card').reduce((s, d) => s + Number(d.amount), 0)

    const pIncTotal  = (pInc.data || []).reduce((s, i) => s + Number(i.amount), 0)
    const pPaidExp   = (pExp.data || []).filter(e => !e.status || e.status === 'pago')
    const pCardExp   = pPaidExp.filter(e => e.category === 'credit_card').reduce((s, e) => s + Number(e.amount), 0)
    const pCardDay   = (pDay.data || []).filter(d => d.payment_method === 'credit_card').reduce((s, d) => s + Number(d.amount), 0)
    const prevCash   = (pPaidExp.reduce((s, e) => s + Number(e.amount), 0) - pCardExp)
                     + ((pDay.data || []).reduce((s, d) => s + Number(d.amount), 0) - pCardDay)

    const totalInc = (inc.data || []).reduce((s, i) => s + Number(i.amount), 0)

    // Soma saldo inicial das contas ao income (retrocompatível — getAccounts retorna [] se tabela não existir)
    let totalInitial = 0
    try {
      const { data: accs } = await getAccounts(user.id)
      totalInitial = (accs || []).reduce((s, a) => s + Number(a.initial_balance || 0), 0)
    } catch { /* tabela não existe ainda */ }

    setIncome(totalInc + totalInitial)
    setCashExpenses(currCash)
    setCardUsed(totalCardExp + totalCardDaily)
    setPrevCarry(pIncTotal - prevCash)
    setLoading(false)
  }, [user, month, year])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = () => load()
    window.addEventListener('finance-updated', h)
    window.addEventListener('accounts-updated', h)  // recarrega ao adicionar/remover contas
    return () => {
      window.removeEventListener('finance-updated', h)
      window.removeEventListener('accounts-updated', h)
    }
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

  const balance      = income - cashExpenses + prevCarry
  const cardAvailable = cardLimit - cardUsed
  const isPos = balance >= 0
  const isCardOk = cardAvailable > 0

  return (
    <>
      <div className="bg-dark-900 border-b border-white/5 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-2 justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-base">💰</span>
            <span className="text-white text-sm font-bold hidden sm:block">FinançasFamília</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Saldo */}
            <div className={`flex items-center gap-1 rounded-lg px-2 py-1 border ${
              isPos ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/15 border-red-500/30'
            }`}>
              <Wallet size={13} className={isPos ? 'text-emerald-400' : 'text-red-400'} />
              <span className={`text-sm font-bold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                {loading ? '...' : formatBRL(balance)}
              </span>
            </div>

            <span className="text-gray-700 text-xs">·</span>

            {/* Cartão */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setLimitInput(String(Math.round(cardLimit * 100))); setShowLimitModal(true) }}
                className="text-gray-600 hover:text-gray-400 transition-colors"
                title="Configurar limite"
              >
                <Settings size={12} />
              </button>
              <button
                onClick={() => navigate('/expenses', { state: { tab: 'credit_card' } })}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 border transition-opacity hover:opacity-80 ${
                  isCardOk
                    ? cardAvailable < 100 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-blue-500/10 border-blue-500/20'
                    : 'bg-red-500/15 border-red-500/30'
                }`}
              >
                <CreditCard size={13} className={
                  isCardOk ? (cardAvailable < 100 ? 'text-yellow-400' : 'text-blue-400') : 'text-red-400'
                } />
                <span className={`text-sm font-bold ${
                  isCardOk ? (cardAvailable < 100 ? 'text-yellow-400' : 'text-blue-400') : 'text-red-400'
                }`}>
                  {loading ? '...' : formatBRL(cardAvailable)}
                </span>
              </button>
            </div>

            {/* Refresh */}
            <button onClick={load} className="p-1.5 text-gray-600 hover:text-gray-400 rounded-lg hover:bg-white/5">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Admin */}
            {isAdmin && (
              <button onClick={() => navigate('/admin')}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/15
                           border border-purple-500/20 text-purple-400 hover:bg-purple-500/25 text-xs">
                <Shield size={12} />
                <span className="hidden sm:block font-medium">Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal limite */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
    </>
  )
}
