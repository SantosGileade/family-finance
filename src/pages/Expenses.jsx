import { useState, useEffect } from 'react'
import { Plus, Trash2, CreditCard, Loader2, X, Receipt, Pencil, CheckCircle, Clock } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getExpenses, addExpense, updateExpense, deleteExpense, payExpense, getDailySpending, addDailySpending, updateDailySpending, deleteDailySpending } from '../lib/supabase'
import { useLang } from '../hooks/useLang'
import { usePlanGate } from '../contexts/PlanGateContext'
import MonthPicker from '../components/MonthPicker'
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
  const { user, isAdmin } = useAuth()
  const { check } = usePlanGate()
  const t = useLang()
  const location = useLocation()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // Allow pre-selecting tab via navigation state (e.g. from BalanceBar click)
  const [tab, setTab] = useState(location.state?.tab || 'all')

  const [items, setItems] = useState([])
  const [dailyCardItems, setDailyCardItems] = useState([])
  const [dailyCashItems, setDailyCashItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [editingItem, setEditingItem] = useState(null)

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'fixed',
    date: format(new Date(), 'yyyy-MM-dd'),
  })

  const load = async () => {
    setLoading(true)
    const [expRes, dailyRes] = await Promise.all([
      getExpenses(user.id, month, year),
      getDailySpending(user.id, month, year),
    ])
    let expenses = expRes.data || []
    const allDaily = dailyRes.data || []

    // Auto-copia despesas fixas do mês anterior quando o mês atual ainda não tem nenhuma
    // Só faz isso para o mês atual (não para meses passados)
    const now = new Date()
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
    const hasFixed = expenses.some(e => e.is_recurring && e.category === 'fixed')

    if (isCurrentMonth && !hasFixed) {
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear  = month === 1 ? year - 1 : year
      const { data: prevExp } = await getExpenses(user.id, prevMonth, prevYear)
      const recurring = (prevExp || []).filter(e => e.is_recurring && e.category === 'fixed')

      if (recurring.length > 0) {
        const copies = await Promise.all(recurring.map(item => {
          const day     = new Date(item.date).getDate()
          const lastDay = new Date(year, month, 0).getDate()
          const newDay  = Math.min(day, lastDay)
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(newDay).padStart(2,'0')}`
          return addExpense({
            user_id: user.id,
            description: item.description,
            amount: item.amount,
            category: 'fixed',
            date: dateStr,
            month,
            year,
            is_recurring: true,
            status: 'pendente',
          })
        }))
        // Atualiza a lista com as cópias recém-criadas
        const newItems = copies.map(r => r.data?.[0]).filter(Boolean)
        expenses = [...expenses, ...newItems]
        window.dispatchEvent(new Event('finance-updated'))
      }
    }

    setItems(expenses)
    setDailyCardItems(allDaily.filter(d => d.payment_method === 'credit_card'))
    setDailyCashItems(allDaily.filter(d => d.payment_method !== 'credit_card'))
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  // If navigated with a tab state, apply it
  useEffect(() => {
    if (location.state?.tab) {
      setTab(location.state.tab)
    }
  }, [location.state])

  const openEdit = (item, source) => {
    setEditingItem({ id: item.id, source })
    setForm({
      description: item.description,
      amount: String(Math.round(Number(item.amount) * 100)),
      category: item.category || 'credit_card',
      date: item.date,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setForm({ description: '', amount: '', category: 'fixed', date: format(new Date(), 'yyyy-MM-dd') })
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!check()) return
    setSaving(true)
    const d = new Date(form.date + 'T12:00:00')
    const enteredMonth = d.getMonth() + 1
    const enteredYear = d.getFullYear()
    const enteredDay = d.getDate()
    const amount = parseCurrency(form.amount)

    if (editingItem) {
      if (editingItem.source === 'expense') {
        await updateExpense(editingItem.id, {
          description: form.description,
          amount,
          category: form.category,
          date: form.date,
          month: enteredMonth,
          year: enteredYear,
          is_recurring: form.category === 'fixed',
        })
      } else {
        await updateDailySpending(editingItem.id, {
          description: form.description,
          amount,
          date: form.date,
        })
      }
    } else if (form.category === 'credit_card') {
      // Cartão vai direto pro daily_spending para aparecer também no Diário
      await addDailySpending({
        user_id: user.id,
        description: form.description,
        amount,
        payment_method: 'credit_card',
        date: form.date,
      })
    } else {
      // Cria a despesa do mês atual
      await addExpense({
        user_id: user.id,
        description: form.description,
        amount,
        category: form.category,
        date: form.date,
        month: enteredMonth,
        year: enteredYear,
        is_recurring: form.category === 'fixed',
      })

      // Se marcada como recorrente, replica para os meses restantes do ano
      if (form.category === 'fixed') {
        const futures = []
        for (let m = enteredMonth + 1; m <= 12; m++) {
          const lastDay = new Date(enteredYear, m, 0).getDate()
          const newDay  = Math.min(enteredDay, lastDay)
          const dateStr = `${enteredYear}-${String(m).padStart(2,'0')}-${String(newDay).padStart(2,'0')}`
          futures.push(addExpense({
            user_id: user.id,
            description: form.description,
            amount,
            category: 'fixed',
            date: dateStr,
            month: m,
            year: enteredYear,
            is_recurring: true,
            status: 'pendente',   // futuras: pendente até o usuário pagar
          }))
        }
        await Promise.all(futures)
      }
    }
    closeModal()
    setSaving(false)
    await load()
    window.dispatchEvent(new Event('finance-updated'))
  }


  // Marca despesa como paga e atualiza saldo
  const handlePay = async (id) => {
    const { data } = await payExpense(id)
    if (data?.[0]) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'pago' } : i))
      window.dispatchEvent(new Event('finance-updated'))
    }
  }

  const handleDelete = async () => {
    if (!check()) return
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
  const totalDailyCash = dailyCashItems.reduce((s, i) => s + Number(i.amount), 0)
  const totalAll = totalFixed + totalVar + totalCard + totalDailyCash

  const totalsMap = { all: totalAll, fixed: totalFixed, variable: totalVar, credit_card: totalCard }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Despesas 🧾</h1>
          <p className="text-gray-500 text-sm">{t('Expenses · Contas e gastos do mês')}</p>
        </div>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
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
            {isAdmin && <span className="text-gray-500 italic">Goal: get off the credit card!</span>}
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
      <button onClick={() => { if (!check()) return; setShowModal(true) }} className="btn-primary w-full">
        <Plus size={18} /> {t('Adicionar despesa · Add expense')}
      </button>


      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              tab === tabItem.key
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-dark-700 text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            {tabItem.emoji} {t(tabItem.label)}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === tabItem.key ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
              {formatBRL(totalsMap[tabItem.key])}
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
          {isAdmin && <p className="text-gray-600 text-sm mt-1">No expenses recorded</p>}
          <button onClick={() => { if (!check()) return; setShowModal(true) }} className="btn-primary mx-auto mt-4">
            <Plus size={16} /> Adicionar despesa
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── PENDENTES ─────────────────────────────── */}
          {filteredExpenses.filter(i => i.status === 'pendente').length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-amber-400" />
                <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">
                  Pendentes · {filteredExpenses.filter(i => i.status === 'pendente').length}
                </p>
              </div>
              <div className="space-y-2">
                {filteredExpenses.filter(i => i.status === 'pendente').map(item => {
                  const ci = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.variable
                  return (
                    <div key={`exp-${item.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl border
                                 bg-amber-500/5 border-amber-500/15">
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
                      <div className="text-right shrink-0">
                        <p className="text-amber-400 font-bold text-sm">{formatBRL(item.amount)}</p>
                        <div className="flex gap-1 justify-end mt-1">
                          <button
                            onClick={() => handlePay(item.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold
                                       bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400
                                       border border-emerald-500/30 rounded-lg transition-all active:scale-95"
                          >
                            <CheckCircle size={11} /> Pagar
                          </button>
                          <button onClick={() => setConfirmId({ id: item.id, source: 'expense' })} className="btn-danger text-xs">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PAGAS ─────────────────────────────────── */}
          {filteredExpenses.filter(i => !i.status || i.status === 'pago').length > 0 && (
            <div>
              {filteredExpenses.filter(i => i.status === 'pendente').length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wide">
                    Pagas · {filteredExpenses.filter(i => !i.status || i.status === 'pago').length}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {filteredExpenses.filter(i => !i.status || i.status === 'pago').map(item => {
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
                          {item.category === 'variable' && !item.is_recurring && (
                            <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">🛒 Variável</span>
                          )}
                          {item.category === 'credit_card' && (
                            <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">💳 Cartão</span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5">{item.date}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${ci.text}`}>{formatBRL(item.amount)}</p>
                        <div className="flex gap-1 justify-end mt-1">
                          <button onClick={() => openEdit(item, 'expense')} className="btn-secondary text-xs">
                            <Pencil size={12} /> Editar
                          </button>
                          <button onClick={() => setConfirmId({ id: item.id, source: 'expense' })} className="btn-danger text-xs">
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Daily spending items paid by cash/debit (only shown in All tab) */}
          {tab === 'all' && dailyCashItems.map((item) => (
            <div key={`daily-cash-${item.id}`} className="card-hover flex items-center gap-3 p-3 border border-yellow-500/10">
              <div className="w-10 h-10 bg-yellow-500/15 rounded-xl flex items-center justify-center text-lg shrink-0">
                📅
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-medium text-sm truncate">{item.description}</p>
                  <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                    📅 Diário débito
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5">{item.date}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-yellow-400">{formatBRL(item.amount)}</p>
                <div className="flex gap-1 justify-end mt-1">
                  <button onClick={() => openEdit(item, 'daily')} className="btn-secondary text-xs">
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => setConfirmId({ id: item.id, source: 'daily' })} className="btn-danger text-xs">
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}

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
                <div className="flex gap-1 justify-end mt-1">
                  <button onClick={() => openEdit(item, 'daily')} className="btn-secondary text-xs">
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => setConfirmId({ id: item.id, source: 'daily' })} className="btn-danger text-xs">
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
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
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">{editingItem ? t('Editar despesa · Edit Expense') : t('Adicionar despesa · Add Expense')}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              {editingItem?.source !== 'daily' && (
                <div>
                  <label className="label">{t('Categoria · Category')}</label>
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
                        {isAdmin && <p className="text-xs text-gray-500">{c.sub}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">{t('Descrição · Description')}</label>
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
                <label className="label">{t('Valor · Amount (R$)')}</label>
                <CurrencyInput
                  className="input-field"
                  value={form.amount}
                  onChange={v => setForm({ ...form, amount: v })}
                  required
                />
              </div>

              <div>
                <label className="label">{t('Data · Date')}</label>
                <input
                  className="input-field"
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              {!editingItem && form.category === 'fixed' && (
                <p className="text-blue-400 text-xs bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                  🔄 Será criada automaticamente para todos os meses restantes do ano.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : editingItem ? <><Pencil size={16} /> Salvar alterações</> : <><Plus size={16} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
