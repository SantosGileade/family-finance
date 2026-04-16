import { useState, useEffect } from 'react'
import { Plus, Trash2, CreditCard, Loader2, X, Receipt } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getExpenses, addExpense, deleteExpense, getDailySpending, deleteDailySpending } from '../lib/supabase'
import MonthSelector from '../components/MonthSelector'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import ConfirmDialog from '../components/ConfirmDialog'
import { format } from 'date-fns'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const TABS = [
  { key: 'all', label: 'Todas · All', emoji: '📋' },
  { key: 'fixed', label: 'Fixas · Fixed', emoji: '🏠' },
  { key: 'variable', label: 'Variáveis · Variable', emoji: '🛒' },
  { key: 'credit_card', label: 'Cartão · Credit Card', emoji: '💳' },
]

const CATEGORY_ICONS = {
  fixed: { emoji: '🏠', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  variable: { emoji: '🛒', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  credit_card: { emoji: '💳', bg: 'bg-red-500/15', text: 'text-red-400' },
}

const SUBCATEGORIES = {
  fixed: ['Aluguel · Rent', 'Água · Water', 'Luz · Electricity', 'Internet', 'Gás · Gas', 'Plano de saúde · Health plan', 'Escola · School', 'Outro · Other'],
  variable: ['Mercado · Grocery', 'Farmácia · Pharmacy', 'Transporte · Transport', 'Roupas · Clothes', 'Lazer · Entertainment', 'Restaurante · Restaurant', 'Outro · Other'],
  credit_card: ['Compra online · Online purchase', 'Supermercado · Supermarket', 'Parcelamento · Installment', 'Assinatura · Subscription', 'Outro · Other'],
}

export default function Expenses() {
  const { user } = useAuth()
  const location = useLocation()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // Allow pre-selecting tab via navigation state (e.g. from BalanceBar click)
  const [tab, setTab] = useState(location.state?.tab || 'all')

  const [items, setItems] = useState([])
  const [dailyCardItems, setDailyCardItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)      // { id, source: 'expense' | 'daily' }

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'fixed',
    date: format(new Date(), 'yyyy-MM-dd'),
    is_recurring: false,
  })

  const load = async () => {
    setLoading(true)
    const [expRes, dailyRes] = await Promise.all([
      getExpenses(user.id, month, year),
      getDailySpending(user.id, month, year),
    ])
    setItems(expRes.data || [])
    // Only keep daily items paid by credit card
    setDailyCardItems(
      (dailyRes.data || []).filter(d => d.payment_method === 'credit_card')
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  // If navigated with a tab state, apply it
  useEffect(() => {
    if (location.state?.tab) {
      setTab(location.state.tab)
    }
  }, [location.state])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    const d = new Date(form.date + 'T12:00:00')
    await addExpense({
      user_id: user.id,
      description: form.description,
      amount: parseCurrency(form.amount),
      category: form.category,
      date: form.date,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      is_recurring: form.is_recurring,
    })
    setForm({ description: '', amount: '', category: 'fixed', date: format(new Date(), 'yyyy-MM-dd'), is_recurring: false })
    setShowModal(false)
    setSaving(false)
    await load()
    window.dispatchEvent(new Event('finance-updated'))
  }

  const handleDelete = async () => {
    if (!confirmId) return
    if (confirmId.source === 'expense') {
      await deleteExpense(confirmId.id)
      setItems(items.filter(i => i.id !== confirmId.id))
    } else {
      await deleteDailySpending(confirmId.id)
      setDailyCardItems(dailyCardItems.filter(i => i.id !== confirmId.id))
    }
    setConfirmId(null)
    window.dispatchEvent(new Event('finance-updated'))
  }

  // Build filtered list depending on active tab
  const filteredExpenses = tab === 'all' ? items : items.filter(i => i.category === tab)

  const totalFixed = items.filter(i => i.category === 'fixed').reduce((s, i) => s + Number(i.amount), 0)
  const totalVar = items.filter(i => i.category === 'variable').reduce((s, i) => s + Number(i.amount), 0)
  const totalCardExp = items.filter(i => i.category === 'credit_card').reduce((s, i) => s + Number(i.amount), 0)
  const totalCardDaily = dailyCardItems.reduce((s, i) => s + Number(i.amount), 0)
  const totalCard = totalCardExp + totalCardDaily
  const totalAll = totalFixed + totalVar + totalCard

  const totalsMap = { all: totalAll, fixed: totalFixed, variable: totalVar, credit_card: totalCard }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Despesas 🧾</h1>
          <p className="text-gray-500 text-sm">Expenses · Contas e gastos do mês</p>
        </div>
        <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center p-3">
          <p className="text-blue-400 font-bold">{formatBRL(totalFixed)}</p>
          <p className="text-gray-500 text-xs">🏠 Fixas</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-yellow-400 font-bold">{formatBRL(totalVar)}</p>
          <p className="text-gray-500 text-xs">🛒 Variáveis</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-red-400 font-bold">{formatBRL(totalCard)}</p>
          <p className="text-gray-500 text-xs">💳 Cartão</p>
        </div>
      </div>

      {/* Credit card alert */}
      {totalCard > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 font-semibold text-sm mb-1">💳 Objetivo: sair do cartão!</p>
          <p className="text-red-300/70 text-xs">
            Você tem {formatBRL(totalCard)} no cartão. Tente reduzir isso mês a mês.
            <br />
            <span className="text-gray-500 italic">Goal: get off the credit card!</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-dark-600">
            <div
              className="h-full rounded-full bg-red-500 transition-all"
              style={{ width: `${Math.min((totalCard / (totalAll || 1)) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Cartão representa {totalAll > 0 ? ((totalCard / totalAll) * 100).toFixed(0) : 0}% das despesas
          </p>
        </div>
      )}

      {/* Add button */}
      <button onClick={() => setShowModal(true)} className="btn-primary w-full">
        <Plus size={18} /> Adicionar despesa · Add expense
      </button>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              tab === t.key
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-dark-700 text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            {t.emoji} {t.label.split(' · ')[0]}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
              {formatBRL(totalsMap[t.key])}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (tab !== 'credit_card' && filteredExpenses.length === 0) ||
         (tab === 'credit_card' && filteredExpenses.length === 0 && dailyCardItems.length === 0) ? (
        <div className="card text-center py-10">
          <Receipt size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Nenhuma despesa registrada</p>
          <p className="text-gray-600 text-sm mt-1">No expenses recorded</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mx-auto mt-4">
            <Plus size={16} /> Adicionar despesa
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Regular expense items */}
          {filteredExpenses.map((item) => {
            const ci = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.variable
            return (
              <div key={`exp-${item.id}`} className="card-hover flex items-center gap-3 p-3">
                <div className={`w-10 h-10 ${ci.bg} rounded-xl flex items-center justify-center text-lg shrink-0`}>
                  {ci.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium text-sm truncate">{item.description}</p>
                    {item.is_recurring && <span className="badge-blue">🔄 Fixo</span>}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{item.date}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${ci.text}`}>{formatBRL(item.amount)}</p>
                  <button
                    onClick={() => setConfirmId({ id: item.id, source: 'expense' })}
                    className="btn-danger text-xs mt-1"
                  >
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>
            )
          })}

          {/* Daily spending items paid by credit card (only shown in Cartão tab or All tab) */}
          {(tab === 'credit_card' || tab === 'all') && dailyCardItems.map((item) => (
            <div key={`daily-${item.id}`} className="card-hover flex items-center gap-3 p-3 border border-red-500/10">
              <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center text-lg shrink-0">
                💳
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-medium text-sm truncate">{item.description}</p>
                  <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                    📅 Diário
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5">{item.date}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-red-400">{formatBRL(item.amount)}</p>
                <button
                  onClick={() => setConfirmId({ id: item.id, source: 'daily' })}
                  className="btn-danger text-xs mt-1"
                >
                  <Trash2 size={12} /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      {confirmId && (
        <ConfirmDialog
          message="Essa despesa será removida permanentemente."
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Adicionar despesa · Add Expense</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="label">Categoria · Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'fixed', label: '🏠 Fixa', sub: 'Fixed' },
                    { value: 'variable', label: '🛒 Variável', sub: 'Variable' },
                    { value: 'credit_card', label: '💳 Cartão', sub: 'Credit Card' },
                  ].map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: c.value })}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        form.category === c.value
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 bg-dark-600 text-gray-400'
                      }`}
                    >
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-gray-500">{c.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Descrição · Description</label>
                <input
                  list="subcats"
                  className="input-field"
                  placeholder="Ex: Aluguel, Mercado..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  required
                />
                <datalist id="subcats">
                  {(SUBCATEGORIES[form.category] || []).map(s => (
                    <option key={s} value={s.split(' · ')[0]} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="label">Valor · Amount (R$)</label>
                <CurrencyInput
                  className="input-field"
                  value={form.amount}
                  onChange={v => setForm({ ...form, amount: v })}
                  required
                />
              </div>

              <div>
                <label className="label">Data · Date</label>
                <input
                  className="input-field"
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={e => setForm({ ...form, is_recurring: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-dark-600 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-gray-300 text-sm">🔄 Despesa fixa mensal · Monthly recurring</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Plus size={16} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
