import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Loader2, X, Star, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePlanGate } from '../contexts/PlanGateContext'
import { addAccount, updateAccount, deleteAccount, setPrincipalAccount, getMonthlyTotals, getIncome, getExpenses, getDailySpending } from '../lib/supabase'
import { useAccounts } from '../hooks/useAccounts'
import ConfirmDialog from '../components/ConfirmDialog'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import BackButton from '../components/BackButton'

const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const ACCOUNT_EMOJIS = ['🏦','💳','💰','🟣','🟠','🔵','🔴','🟡','🟢','⬛','💚','🌐']

const DEFAULT_ACCOUNTS = [
  { emoji: '💳', name: 'Nubank' },
  { emoji: '🏦', name: 'Itaú' },
  { emoji: '🟠', name: 'C6 Bank' },
  { emoji: '🔵', name: 'Bradesco' },
  { emoji: '🟡', name: 'Banco do Brasil' },
  { emoji: '💰', name: 'Carteira' },
  { emoji: '🟢', name: 'Neon' },
]

export default function Accounts() {
  const { user } = useAuth()
  const { check } = usePlanGate()
  const { accounts, principalAccount, reload } = useAccounts()

  const [showModal,       setShowModal]       = useState(false)
  const [editingItem,     setEditingItem]     = useState(null)
  const [confirmId,       setConfirmId]       = useState(null)
  const [saving,          setSaving]          = useState(false)
  const [form,            setForm]            = useState({ name: '', emoji: '🏦', initialBalance: '' })
  const [currentBalance,  setCurrentBalance]  = useState(0)
  const [accountBalances, setAccountBalances] = useState({}) // { accountId: currentBalance }

  // Calcula saldo real por conta (initial_balance + transações do mês)
  useEffect(() => {
    if (!user || accounts.length === 0) return
    const now = new Date()
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    Promise.all([
      getIncome(user.id, m, y),
      getExpenses(user.id, m, y),
      getDailySpending(user.id, m, y),
    ]).then(([incRes, expRes, dayRes]) => {
      const incData = incRes.data || []
      const expData = expRes.data || []
      const dayData = dayRes.data || []
      const balMap = {}
      accounts.forEach((acc, idx) => {
        const isPrincipal = acc.is_principal || idx === 0
        const owns = (item) => item.account_id === acc.id || (isPrincipal && !item.account_id)
        const paidExp = expData.filter(e => !e.status || e.status === 'pago')
        const accInc = incData.filter(owns).reduce((s, i) => s + Number(i.amount), 0)
        const accExp = paidExp.filter(e => e.category !== 'credit_card' && owns(e)).reduce((s, e) => s + Number(e.amount), 0)
        const accDay = dayData.filter(d => d.payment_method !== 'credit_card' && owns(d)).reduce((s, d) => s + Number(d.amount), 0)
        balMap[acc.id] = Number(acc.initial_balance || 0) + accInc - accExp - accDay
      })
      setAccountBalances(balMap)
    }).catch(() => {})
  }, [user, accounts])

  // Escuta atualizações financeiras para recalcular
  useEffect(() => {
    const h = () => {
      if (!user || accounts.length === 0) return
      const now = new Date()
      Promise.all([
        getIncome(user.id, now.getMonth() + 1, now.getFullYear()),
        getExpenses(user.id, now.getMonth() + 1, now.getFullYear()),
        getDailySpending(user.id, now.getMonth() + 1, now.getFullYear()),
      ]).then(([incRes, expRes, dayRes]) => {
        const incData = incRes.data || []
        const expData = expRes.data || []
        const dayData = dayRes.data || []
        const balMap = {}
        accounts.forEach((acc, idx) => {
          const isPrincipal = acc.is_principal || idx === 0
          const owns = (item) => item.account_id === acc.id || (isPrincipal && !item.account_id)
          const paidExp = expData.filter(e => !e.status || e.status === 'pago')
          const accInc = incData.filter(owns).reduce((s, i) => s + Number(i.amount), 0)
          const accExp = paidExp.filter(e => e.category !== 'credit_card' && owns(e)).reduce((s, e) => s + Number(e.amount), 0)
          const accDay = dayData.filter(d => d.payment_method !== 'credit_card' && owns(d)).reduce((s, d) => s + Number(d.amount), 0)
          balMap[acc.id] = Number(acc.initial_balance || 0) + accInc - accExp - accDay
        })
        setAccountBalances(balMap)
      }).catch(() => {})
    }
    window.addEventListener('finance-updated', h)
    return () => window.removeEventListener('finance-updated', h)
  }, [user, accounts])

  // Calcula saldo acumulado do ano para pré-preencher a 1ª conta
  useEffect(() => {
    if (!user || accounts.length > 0) return
    const now = new Date()
    getMonthlyTotals(user.id, now.getFullYear())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const total = data.reduce((s, m) => s + (m.income || 0) - (m.expenses || 0), 0)
          setCurrentBalance(Math.max(0, total))
        }
      })
      .catch(() => {}) // ignora erros silenciosamente
  }, [user, accounts.length])

  const openAdd = (preset = null, preBalance = '') => {
    if (!check()) return
    setEditingItem(null)
    setForm({
      name: preset?.name || '',
      emoji: preset?.emoji || '🏦',
      initialBalance: preBalance,
    })
    setShowModal(true)
  }

  const openEdit = (item) => {
    if (!check()) return
    setEditingItem(item)
    setForm({
      name: item.name,
      emoji: item.emoji,
      initialBalance: String(Math.round((item.initial_balance || 0) * 100)),
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      emoji: form.emoji,
      initial_balance: parseCurrency(form.initialBalance),
    }
    if (editingItem) {
      await updateAccount(editingItem.id, payload)
    } else {
      await addAccount({
        ...payload,
        user_id: user.id,
        is_principal: accounts.length === 0,
      })
    }
    await reload()
    window.dispatchEvent(new Event('accounts-updated'))
    window.dispatchEvent(new Event('finance-updated'))
    setSaving(false)
    setShowModal(false)
    setEditingItem(null)
  }

  const handleDelete = async () => {
    if (!confirmId || accounts.length <= 1) return
    await deleteAccount(confirmId)
    await reload()
    window.dispatchEvent(new Event('accounts-updated'))
    window.dispatchEvent(new Event('finance-updated'))
    setConfirmId(null)
  }

  const handleSetPrincipal = async (id) => {
    await setPrincipalAccount(user.id, id)
    await reload()
    window.dispatchEvent(new Event('accounts-updated'))
    window.dispatchEvent(new Event('finance-updated'))
  }

  const totalInitial = accounts.reduce((s, a) => s + Number(a.initial_balance || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="page-title">Contas</h1>
      </div>

      {/* Resumo */}
      {accounts.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-dark-700 to-dark-600 border border-white/8 px-4 py-3.5">
          <p className="text-gray-400 text-xs">Saldo inicial total</p>
          <p className="text-white text-2xl font-bold mt-0.5">{formatBRL(totalInitial)}</p>
          <p className="text-gray-500 text-xs mt-1">{accounts.length} {accounts.length === 1 ? 'conta' : 'contas'} cadastrada{accounts.length === 1 ? '' : 's'}</p>
        </div>
      )}

      {/* Lista de contas */}
      {accounts.length === 0 ? (
        <div className="space-y-4">
          {/* Estado vazio explicativo */}
          <div className="card border border-emerald-500/20 bg-emerald-500/5 text-center py-6 px-5">
            <p className="text-3xl mb-3">🏦</p>
            <p className="text-white font-semibold text-base">Qual é a sua conta principal?</p>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              Seus lançamentos já estão registrados. Agora só precisa dar um nome para a conta que você usa — assim o app fica ainda mais organizado.
            </p>
            <p className="text-gray-600 text-xs mt-2">
              Você pode adicionar outras contas depois, se quiser separar por banco.
            </p>
          </div>

          <p className="text-gray-500 text-xs text-center">Toque para adicionar sua conta:</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => (
            <div key={acc.id}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                acc.is_principal
                  ? 'bg-emerald-500/8 border-emerald-500/20'
                  : 'bg-dark-700 border-white/6'
              }`}>
              <span className="text-2xl shrink-0">{acc.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm">{acc.name}</p>
                  {acc.is_principal && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                      Principal
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <p className={`text-sm font-semibold ${(accountBalances[acc.id] ?? acc.initial_balance) >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {formatBRL(accountBalances[acc.id] ?? acc.initial_balance ?? 0)}
                  </p>
                  {acc.initial_balance > 0 && accountBalances[acc.id] !== undefined && (
                    <p className="text-gray-600 text-[10px]">inicial: {formatBRL(acc.initial_balance)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!acc.is_principal && (
                  <button
                    onClick={() => handleSetPrincipal(acc.id)}
                    title="Definir como principal"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  onClick={() => openEdit(acc)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Pencil size={13} />
                </button>
                {accounts.length > 1 && (
                  <button
                    onClick={() => setConfirmId(acc.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Atalhos para adicionar conta conhecida */}
      <div>
        <p className="text-gray-500 text-xs mb-2">
          {accounts.length === 0 ? 'Selecione seu banco:' : 'Adicionar outra conta:'}
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_ACCOUNTS.filter(d => !accounts.some(a => a.name === d.name)).map(preset => (
            <button
              key={preset.name}
              onClick={() => openAdd(preset, accounts.length === 0 ? String(Math.round(currentBalance * 100)) : '')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-white/8
                         text-gray-400 hover:text-white hover:border-white/20 rounded-xl text-xs
                         transition-all active:scale-95"
            >
              {preset.emoji} {preset.name}
            </button>
          ))}
          <button
            onClick={() => openAdd(null, accounts.length === 0 ? String(Math.round(currentBalance * 100)) : '')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30
                       text-emerald-400 rounded-xl text-xs transition-all active:scale-95"
          >
            <Plus size={12} /> Outra conta
          </button>
        </div>
      </div>

      {/* Confirm delete */}
      {confirmId && (
        <ConfirmDialog
          message="Essa conta será removida. Transações vinculadas a ela não serão afetadas."
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Modal criar/editar */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">{editingItem ? 'Editar conta' : 'Nova conta'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Emoji picker */}
              <div>
                <label className="label mb-2">Ícone</label>
                <div className="flex flex-wrap gap-2">
                  {ACCOUNT_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, emoji }))}
                      className={`w-10 h-10 text-xl rounded-xl transition-all ${
                        form.emoji === emoji
                          ? 'bg-emerald-500/25 ring-2 ring-emerald-500/50'
                          : 'bg-dark-600 hover:bg-dark-500'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Nome da conta</label>
                <input
                  className="input-field"
                  placeholder="Ex: Nubank, Itaú, Carteira..."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required autoFocus style={{ fontSize: 16 }}
                />
              </div>

              <div>
                <label className="label">Saldo inicial (R$)</label>
                <CurrencyInput
                  className="input-field"
                  value={form.initialBalance}
                  onChange={v => setForm(f => ({ ...f, initialBalance: v }))}
                  placeholder="0,00"
                />
                <p className="text-gray-600 text-xs mt-1">
                  {accounts.length === 0 && currentBalance > 0
                    ? '✨ Calculado com base nos seus lançamentos. Ajuste se necessário.'
                    : accounts.length === 0
                    ? 'Opcional. Seus lançamentos já registrados continuam normalmente.'
                    : 'Quanto você tinha nessa conta ao começar a usá-la aqui.'}
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary flex-1">
                  {saving
                    ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                    : <><Check size={16} /> {editingItem ? 'Salvar' : 'Criar conta'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
