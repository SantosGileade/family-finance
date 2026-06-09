import { useState, useRef, useEffect } from 'react'
import { Zap, X, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePlanGate } from '../contexts/PlanGateContext'
import { addDailySpending, getAllCreditCardExpenses, getDailySpending, getProfile } from '../lib/supabase'
import { format } from 'date-fns'
import { useLang } from '../hooks/useLang'
import CurrencyInput, { parseCurrency } from './CurrencyInput'
import { getUserCategories } from '../lib/supabase'
import { DEFAULT_CATEGORIES } from '../data/defaultCategories'
import { useAccounts } from '../hooks/useAccounts'


export default function QuickAdd() {
  const { user, isAdmin, profile } = useAuth()
  const { check } = usePlanGate()
  const t = useLang()
  const { accounts, principalAccount, hasMultiple } = useAccounts()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [selectedCat, setSelectedCat] = useState(null)
  const [customDesc, setCustomDesc] = useState('')
  const [method,       setMethod]       = useState('debit')
  const [accountId,    setAccountId]    = useState(null)
  const [installments, setInstallments] = useState(1)
  const [allCategories, setAllCategories] = useState(DEFAULT_CATEGORIES)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cardLimit, setCardLimit] = useState(0)
  const [cardUsed,  setCardUsed]  = useState(0)
  const [limitError, setLimitError] = useState('')
  const amountRef = useRef(null)

  // Carrega limite do cartão ao abrir o modal
  useEffect(() => {
    if (!open || !user) return
    const now = new Date()
    Promise.all([
      getProfile(user.id),
      getAllCreditCardExpenses(user.id),
      getDailySpending(user.id, now.getMonth() + 1, now.getFullYear()),
    ]).then(([prof, allCard, daily]) => {
      const limit = prof.data?.card_limit || 0
      const pendingCard = (allCard.data || [])
        .filter(e => e.status !== 'pago')
        .reduce((s, e) => s + Number(e.amount), 0)
      const dailyCard = (daily.data || [])
        .filter(d => d.payment_method === 'credit_card')
        .reduce((s, d) => s + Number(d.amount), 0)
      setCardLimit(limit)
      setCardUsed(pendingCard + dailyCard)
    })
  }, [open, user])

  // Carrega categorias ao abrir: padrão (filtrando ocultas) + personalizadas
  useEffect(() => {
    if (!open || !user) return
    const hidden = profile?.hidden_categories || []
    const visibleDefaults = DEFAULT_CATEGORIES.filter(c => !hidden.includes(c.label))

    getUserCategories(user.id).then(({ data }) => {
      const custom = (data || []).map(c => ({ emoji: c.emoji, label: c.name, id: c.id }))
      setAllCategories([...visibleDefaults, ...custom])
    })
  }, [open, user, profile])

  const handleOpen = () => {
    setAmount('')
    setSelectedCat(null)
    setCustomDesc('')
    setMethod('debit')
    setInstallments(1)
    setAccountId(principalAccount?.id || null)
    setSaved(false)
    setLimitError('')
    setOpen(true)
  }

  const handleClose = () => {
    if (saving) return
    setOpen(false)
  }

  // Máscara: aceita só dígitos, empilha da direita pra esquerda (estilo bancário)
  const handleAmountInput = (e) => {
    const digits = e.target.value.replace(/\D/g, '')
    const num = parseInt(digits || '0', 10)
    // Limita a 9 dígitos (R$ 9.999.999,99)
    if (num <= 999999999) setCents(num)
  }

  const formatBRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const cardAvailable = cardLimit - cardUsed

  const handleSave = async () => {
    if (!check()) return
    const val = parseCurrency(amount)
    if (!val || val <= 0) {
      amountRef.current?.focus()
      return
    }
    setLimitError('')

    // Bloqueia compra no cartão que ultrapasse o limite disponível
    if (method === 'credit_card') {
      if (val > cardAvailable) {
        setLimitError(`Limite insuficiente. Disponível: ${formatBRL(Math.max(cardAvailable, 0))}`)
        return
      }
    }

    setSaving(true)
    const finalDesc = selectedCat
      ? (selectedCat.label === 'Outro' && customDesc.trim()
          ? customDesc.trim()
          : `${selectedCat.emoji} ${selectedCat.label}`)
      : (customDesc.trim() || 'Gasto rápido')

    const today = format(new Date(), 'yyyy-MM-dd')
    if (method === 'credit_card' && installments > 1) {
      // Parcelado: cria uma despesa por mês via addExpense
      const { addExpense } = await import('../lib/supabase')
      const base = new Date()
      const perInstallment = Math.round((val / installments) * 100) / 100
      await Promise.all(Array.from({ length: installments }, (_, i) => {
        const d = new Date(base)
        d.setMonth(d.getMonth() + i)
        return addExpense({
          user_id: user.id,
          description: `${finalDesc} (${i + 1}/${installments})`,
          amount: perInstallment,
          category: 'credit_card',
          date: format(d, 'yyyy-MM-dd'),
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          is_recurring: false,
          status: 'pendente',
        })
      }))
    } else {
      await addDailySpending({
        user_id: user.id,
        description: finalDesc,
        amount: val,
        account_id: accountId || null,
        payment_method: method === 'credit_card' ? 'credit_card' : 'debit',
        date: today,
      })
    }
    window.dispatchEvent(new Event('finance-updated'))
    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setOpen(false)
      setSaved(false)
    }, 800)
  }

  const handleAmountKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (!description.trim()) {
        document.getElementById('qa-desc')?.focus()
      } else {
        handleSave()
      }
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={handleOpen}
        className="fixed z-40 bottom-20 right-4 sm:bottom-6 sm:right-6
                   w-14 h-14 rounded-full shadow-2xl
                   bg-emerald-500 hover:bg-emerald-400 active:scale-90
                   flex items-center justify-center
                   transition-all duration-200
                   ring-4 ring-emerald-500/20"
        title="Lançar gasto rápido"
        aria-label="Lançar gasto rápido"
      >
        <Zap size={24} className="text-white" fill="white" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

          {/* Sheet */}
          <div className="relative w-full sm:max-w-sm bg-dark-700 rounded-t-3xl sm:rounded-2xl
                          border border-white/10 shadow-2xl z-10
                          animate-slide-up px-5 pt-5 pb-8 sm:pb-5">

            {/* Handle bar mobile */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500/15 rounded-xl flex items-center justify-center">
                  <Zap size={16} className="text-emerald-400" fill="currentColor" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">Gasto Rápido ⚡</p>
                  {isAdmin && <p className="text-gray-500 text-xs">Quick Add</p>}
                </div>
              </div>
              <button onClick={handleClose} className="text-gray-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Valor */}
            <div className="mb-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold"
                      style={{ fontSize: 18 }}>
                  R$
                </span>
                <CurrencyInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="0,00"
                  autoFocus
                  className="w-full bg-dark-600 border border-white/10 rounded-2xl
                             pl-14 pr-4 py-4 text-white font-bold
                             focus:outline-none focus:border-emerald-500/50
                             focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Grade de categorias */}
            <div className="mb-4">
              <p className="text-gray-500 text-xs mb-2">O que foi?</p>
              <div className="grid grid-cols-4 gap-1.5">
                {allCategories.map(cat => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setSelectedCat(prev => prev?.label === cat.label ? null : cat)}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-all active:scale-95 ${
                      selectedCat?.label === cat.label
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-dark-600 border-white/8 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <span className="text-lg leading-none">{cat.emoji}</span>
                    <span className="text-[10px] leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* Campo de texto só aparece se "Outro" selecionado ou nenhuma categoria */}
              {(!selectedCat || selectedCat.label === 'Outro') && (
                <input
                  id="qa-desc"
                  type="text"
                  placeholder={selectedCat?.label === 'Outro' ? 'Descreva o gasto...' : 'Ou descreva aqui (opcional)'}
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  style={{ fontSize: 16 }}
                  className="w-full bg-dark-600 border border-white/10 rounded-xl
                             px-4 py-3 text-white placeholder-gray-600 mt-2
                             focus:outline-none focus:border-emerald-500/50
                             focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              )}
            </div>

            {/* Toggle pagamento */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => { setMethod('debit'); setInstallments(1) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  method === 'debit'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-dark-600 border-white/10 text-gray-400'
                }`}
              >
                💵 Dinheiro/Débito
              </button>
              <button
                type="button"
                onClick={() => setMethod('credit_card')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  method === 'credit_card'
                    ? 'bg-red-500/15 border-red-500/30 text-red-400'
                    : 'bg-dark-600 border-white/10 text-gray-400'
                }`}
              >
                💳 Cartão
              </button>
            </div>

            {/* Limite disponível — só no cartão de crédito */}
            {method === 'credit_card' && (
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs mb-3 ${
                cardAvailable <= 0
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : parseCurrency(amount) > cardAvailable
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-dark-600/50 border-white/5 text-gray-400'
              }`}>
                <span>💳 Limite disponível</span>
                <span className="font-semibold">{formatBRL(Math.max(cardAvailable, 0))}</span>
              </div>
            )}

            {/* Erro de limite */}
            {limitError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-center font-medium mb-3">
                🚫 {limitError}
              </p>
            )}

            {/* Parcelas — só no cartão de crédito */}
            {method === 'credit_card' && (
              <div className="mb-4">
                <p className="text-gray-500 text-xs mb-1.5">Parcelas</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[1,2,3,4,5,6,10,12].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallments(n)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        installments === n
                          ? 'bg-red-500/20 border-red-500/40 text-red-300'
                          : 'bg-dark-600 border-white/8 text-gray-400'
                      }`}
                    >
                      {n === 1 ? 'À vista' : `${n}x`}
                    </button>
                  ))}
                </div>
                {installments > 1 && parseCurrency(amount) > 0 && (
                  <p className="text-gray-500 text-xs mt-1.5">
                    = {(parseCurrency(amount) / installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                  </p>
                )}
              </div>
            )}

            {/* Seletor de conta — só aparece com 2+ contas E débito/dinheiro selecionado */}
            {hasMultiple && method !== 'credit_card' && (
              <div className="mb-4">
                <p className="text-gray-500 text-xs mb-1.5">Conta</p>
                <div className="flex gap-2 flex-wrap">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAccountId(acc.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        accountId === acc.id
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-dark-600 border-white/8 text-gray-400'
                      }`}
                    >
                      <span>{acc.emoji}</span>
                      <span>{acc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Salvar */}
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`w-full py-4 rounded-2xl font-bold transition-all
                         flex items-center justify-center gap-2 active:scale-95 ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
              }`}
              style={{ fontSize: 16 }}
            >
              {saving ? (
                <><Loader2 size={18} className="animate-spin" /> Salvando...</>
              ) : saved ? (
                <>✅ Salvo!</>
              ) : (
                <>⚡ Salvar agora</>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
