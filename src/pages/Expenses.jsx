import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, CreditCard, Loader2, X, Receipt, Pencil, CheckCircle, Clock } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getExpenses, addExpense, updateExpense, deleteExpense, payExpense, getDailySpending, addDailySpending, updateDailySpending, deleteDailySpending, deleteAllNonCreditExpenses, deleteAllCreditExpenses, getAllCreditCardExpenses, getProfile, deleteCreditCardSeries } from '../lib/supabase'
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
  '💳 Fatura Cartão': { emoji: '💳', bg: 'bg-red-500/15', text: 'text-red-400' },
}

const SUBCATEGORIES = {
  fixed: ['Aluguel · Rent', 'Água · Water', 'Luz · Electricity', 'Internet', 'Gás · Gas', 'Plano de saúde · Health plan', 'Escola · School', 'Outro · Other'],
  variable: ['Mercado · Grocery', 'Farmácia · Pharmacy', 'Transporte · Transport', 'Roupas · Clothes', 'Lazer · Entertainment', 'Restaurante · Restaurant', 'Outro · Other'],
  credit_card: ['Compra online · Online purchase', 'Supermercado · Supermarket', 'Parcelamento · Installment', 'Assinatura · Subscription', 'Outro · Other'],
}

export default function Expenses() {
  const { user, isAdmin } = useAuth()
  const isCopyingRef = useRef(false)  // evita auto-cópia duplicada
  const { check } = usePlanGate()
  const t = useLang()
  const location = useLocation()
  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
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
  const [clearConfirm, setClearConfirm] = useState(null)  // 'expenses' | 'credit' | null
  const [clearing, setClearing] = useState(false)
  const [showFaturaModal, setShowFaturaModal] = useState(false)
  const [faturaLoading, setFaturaLoading] = useState(false)
  const [faturaAmount, setFaturaAmount]   = useState('')
  const [cardLimit, setCardLimit] = useState(0)
  const [allCardCommitted, setAllCardCommitted] = useState(0)
  const [limitError, setLimitError] = useState('')
  const [futureCardItems, setFutureCardItems] = useState([])  // parcelas de outros meses

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'fixed',
    date: format(new Date(), 'yyyy-MM-dd'),
    installments: 1,
  })

  const load = async () => {
    setLoading(true)
    const [expRes, dailyRes, profileRes, allCardRes] = await Promise.all([
      getExpenses(user.id, month, year),
      getDailySpending(user.id, month, year),
      getProfile(user.id),
      getAllCreditCardExpenses(user.id),
    ])
    if (profileRes.data?.card_limit) setCardLimit(profileRes.data.card_limit)
    const allCardData = allCardRes.data || []
    const committed = allCardData
      .filter(e => e.status !== 'pago')
      .reduce((s, e) => s + Number(e.amount), 0)
    setAllCardCommitted(committed)
    // Parcelas de cartão em meses diferentes do mês sendo visualizado (pendentes)
    const otherMonthItems = allCardData.filter(e =>
      e.status !== 'pago' &&
      !(e.month === month && e.year === year)
    )
    setFutureCardItems(otherMonthItems)
    let expenses = expRes.data || []
    const allDaily = dailyRes.data || []

    // Auto-copia despesas fixas do mês anterior quando o mês atual ainda não tem nenhuma.
    // Só faz isso para o mês atual (não para meses passados).
    // Usa localStorage para registrar que a cópia já foi processada, evitando que
    // despesas removidas via "Já paguei" ressurjam ao recarregar a página.
    const now = new Date()
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
    const hasFixed = expenses.some(e => e.is_recurring && e.category === 'fixed')
    const copyKey = `fc_${user.id}_${year}_${month}`
    const copyAlreadyDone = !!localStorage.getItem(copyKey)

    if (isCurrentMonth && !hasFixed && !copyAlreadyDone && !isCopyingRef.current) {
      isCopyingRef.current = true
      // Marca imediatamente para bloquear chamadas paralelas (Strict Mode / hot reload)
      localStorage.setItem(copyKey, '1')
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear  = month === 1 ? year - 1 : year

      // Segunda verificação no banco para evitar race condition / strict mode duplo
      const { data: recheckData } = await getExpenses(user.id, month, year)
      const alreadyHasFixed = (recheckData || []).some(e => e.is_recurring && e.category === 'fixed')
      if (alreadyHasFixed) { isCopyingRef.current = false; expenses = recheckData || expenses }
      else {

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
      isCopyingRef.current = false
      } // fim do else (segunda verificação)
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
    setLimitError('')
    setForm({ description: '', amount: '', category: 'fixed', date: format(new Date(), 'yyyy-MM-dd') })
  }

  // Limite disponível no cartão = limite total − todas as parcelas pendentes − gastos diários de cartão do mês
  const cardAvailable = cardLimit - allCardCommitted - dailyCardItems.reduce((s, i) => s + Number(i.amount), 0)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!check()) return
    setLimitError('')

    // Bloqueia compra no cartão que ultrapasse o limite disponível
    if (form.category === 'credit_card' && !editingItem) {
      const purchaseTotal = parseCurrency(form.amount)
      if (purchaseTotal > cardAvailable) {
        setLimitError(`Limite insuficiente. Disponível: ${formatBRL(Math.max(cardAvailable, 0))}`)
        return
      }
    }

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
      const nParcelas = Number(form.installments) || 1
      const amountPerInstallment = Math.round((amount / nParcelas) * 100) / 100

      if (nParcelas <= 1) {
        // Parcela única — vai pro daily_spending como antes
        await addDailySpending({
          user_id: user.id,
          description: form.description,
          amount,
          payment_method: 'credit_card',
          date: form.date,
        })
      } else {
        // Parcelado — cria uma despesa por mês nas próximas N parcelas
        const baseDate = new Date(form.date + 'T12:00:00')
        const futures = []
        for (let p = 0; p < nParcelas; p++) {
          const d = new Date(baseDate)
          d.setMonth(d.getMonth() + p)
          const dateStr = format(d, 'yyyy-MM-dd')
          const desc = `${form.description} (${p + 1}/${nParcelas})`
          futures.push(addExpense({
            user_id: user.id,
            description: desc,
            amount: amountPerInstallment,
            category: 'credit_card',
            date: dateStr,
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            is_recurring: false,
            status: p === 0 ? 'pendente' : 'pendente',
          }))
        }
        await Promise.all(futures)
      }
    } else {
      // Cria a despesa do mês atual
      // Despesa com data futura fica pendente até ser descontada
      const addedToday = format(new Date(), 'yyyy-MM-dd')
      const isFutureExpense = form.date > addedToday
      await addExpense({
        user_id: user.id,
        description: form.description,
        amount,
        category: form.category,
        date: form.date,
        month: enteredMonth,
        year: enteredYear,
        is_recurring: form.category === 'fixed',
        ...(isFutureExpense && { status: 'pendente' }),
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

  // Remove despesa fixa auto-copiada que já foi paga de outra forma (ex: extrato).
  // Também seta a flag de localStorage para que a auto-cópia não re-dispare ao recarregar.
  const handleAlreadyPaid = async (id) => {
    await deleteExpense(id)
    setItems(prev => prev.filter(i => i.id !== id))
    localStorage.setItem(`fc_${user.id}_${year}_${month}`, '1')
    window.dispatchEvent(new Event('finance-updated'))
  }

  // Consolida todas as despesas de cartão do mês em uma única "Fatura Cartão" pendente.
  // As compras individuais são deletadas; a fatura é uma despesa variável que,
  // quando paga, desconta do saldo em conta (sem dupla contagem).
  const handlePagarFatura = async () => {
    const valorFatura = parseCurrency(faturaAmount)
    if (!valorFatura || valorFatura <= 0) return
    setFaturaLoading(true)
    await deleteAllCreditExpenses(user.id, month, year)
    const monthName = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' })
    const isParcial = valorFatura < totalCard
    // Cria a fatura no valor escolhido pelo usuário
    await addExpense({
      user_id: user.id,
      description: `Fatura Cartão – ${monthName}${isParcial ? ' (parcial)' : ''}`,
      amount: valorFatura,
      category: '💳 Fatura Cartão',
      date: format(new Date(), 'yyyy-MM-dd'),
      month,
      year,
      is_recurring: false,
      status: 'pendente',
    })
    // Se pagamento parcial, registra o restante como nova parcela de cartão pendente no mês
    if (isParcial) {
      const resto = Math.round((totalCard - valorFatura) * 100) / 100
      await addExpense({
        user_id: user.id,
        description: `Restante fatura – ${monthName}`,
        amount: resto,
        category: 'credit_card',
        date: format(new Date(), 'yyyy-MM-dd'),
        month,
        year,
        is_recurring: false,
        status: 'pendente',
      })
    }
    setShowFaturaModal(false)
    setFaturaLoading(false)
    await load()
    window.dispatchEvent(new Event('finance-updated'))
  }

  const handleDelete = async () => {
    if (!check()) return
    if (!confirmId) return
    if (confirmId.source === 'expense') {
      const item = confirmId.item
      if (item?.category === 'credit_card' && item.description?.match(/^.+ \(\d+\/\d+\)$/)) {
        // Parcela de cartão: deleta toda a série (todas as parcelas futuras e presentes)
        const { deletedCount } = await deleteCreditCardSeries(user.id, item)
        if (deletedCount > 1) {
          // Pode ter removido itens de outros meses — re-carrega para garantir estado correto
          await load()
        } else {
          setItems(items.filter(i => i.id !== confirmId.id))
        }
      } else {
        await deleteExpense(confirmId.id)
        setItems(items.filter(i => i.id !== confirmId.id))
      }
    } else {
      await deleteDailySpending(confirmId.id)
      setDailyCardItems(dailyCardItems.filter(i => i.id !== confirmId.id))
    }
    setConfirmId(null)
    window.dispatchEvent(new Event('finance-updated'))
  }

  const handleClearAll = async () => {
    setClearing(true)
    if (clearConfirm === 'expenses') {
      await deleteAllNonCreditExpenses(user.id, month, year)
      setItems(prev => prev.filter(i => i.category === 'credit_card'))
      setDailyCashItems([])
    } else if (clearConfirm === 'credit') {
      await deleteAllCreditExpenses(user.id, month, year)
      setItems(prev => prev.filter(i => i.category !== 'credit_card'))
      setDailyCardItems([])
    }
    setClearConfirm(null)
    setClearing(false)
    window.dispatchEvent(new Event('finance-updated'))
  }

  // Build filtered list depending on active tab
  const filteredExpenses = tab === 'all' ? items : items.filter(i => i.category === tab)

  const totalFixed = items.filter(i => i.category === 'fixed').reduce((s, i) => s + Number(i.amount), 0)
  // Gastos diários (débito/dinheiro) contam como variáveis
  const totalVar = items.filter(i => i.category === 'variable').reduce((s, i) => s + Number(i.amount), 0)
                 + dailyCashItems.reduce((s, i) => s + Number(i.amount), 0)
  const totalCardExp = items.filter(i => i.category === 'credit_card').reduce((s, i) => s + Number(i.amount), 0)
  const totalCardDaily = dailyCardItems.reduce((s, i) => s + Number(i.amount), 0)
  const totalCard = totalCardExp + totalCardDaily
  const totalAll = totalFixed + totalVar + totalCard  // totalVar já inclui dailyCash

  const totalsMap = { all: totalAll, fixed: totalFixed, variable: totalVar, credit_card: totalCard }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Despesas</h1>
          <p className="text-gray-500 text-sm">{t('Expenses · Contas e gastos do mês')}</p>
        </div>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* Summary row — clicável para filtrar */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setTab(tab === 'fixed' ? 'all' : 'fixed')}
          className={`card text-center p-3 transition-all active:scale-95 ${tab === 'fixed' ? 'border-blue-500/40 bg-blue-500/10' : 'hover:border-blue-500/20'}`}
        >
          <p className="text-blue-400 font-bold">{formatBRL(totalFixed)}</p>
          <p className={`text-xs ${tab === 'fixed' ? 'text-blue-400/70' : 'text-gray-500'}`}>🏠 Fixas</p>
        </button>
        <button
          onClick={() => setTab(tab === 'variable' ? 'all' : 'variable')}
          className={`card text-center p-3 transition-all active:scale-95 ${tab === 'variable' ? 'border-yellow-500/40 bg-yellow-500/10' : 'hover:border-yellow-500/20'}`}
        >
          <p className="text-yellow-400 font-bold">{formatBRL(totalVar)}</p>
          <p className={`text-xs ${tab === 'variable' ? 'text-yellow-400/70' : 'text-gray-500'}`}>🛒 Variáveis</p>
        </button>
        <button
          onClick={() => setTab(tab === 'credit_card' ? 'all' : 'credit_card')}
          className={`card text-center p-3 transition-all active:scale-95 ${tab === 'credit_card' ? 'border-red-500/40 bg-red-500/10' : 'hover:border-red-500/20'}`}
        >
          <p className="text-red-400 font-bold">{formatBRL(totalCard)}</p>
          <p className={`text-xs ${tab === 'credit_card' ? 'text-red-400/70' : 'text-gray-500'}`}>💳 Cartão</p>
        </button>
      </div>


      {/* ── Fatura do Cartão — aparece quando há despesas de cartão ── */}
      {totalCard > 0 && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-red-500/25 bg-red-500/8">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">💳 Fatura do cartão</p>
            <p className="text-red-400 font-bold text-base">{formatBRL(totalCard)}</p>
            <p className="text-gray-500 text-xs mt-0.5">Consolida tudo e gera uma conta a pagar</p>
          </div>
          <button
            onClick={() => { setFaturaAmount(String(Math.round(totalCard * 100))); setShowFaturaModal(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                       bg-red-500/15 hover:bg-red-500/25 text-red-300
                       border border-red-500/30 transition-all active:scale-95 shrink-0"
          >
            <CreditCard size={14} /> Gerar fatura
          </button>
        </div>
      )}

      {/* ── Parcelas comprometidas em outros meses ── */}
      {futureCardItems.length > 0 && (() => {
        const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
        const totalFuture = futureCardItems.reduce((s, e) => s + Number(e.amount), 0)
        // Agrupa por ano-mês para exibição
        const grouped = futureCardItems.reduce((acc, e) => {
          const key = `${e.year}-${String(e.month).padStart(2,'0')}`
          if (!acc[key]) acc[key] = { month: e.month, year: e.year, items: [], total: 0 }
          acc[key].items.push(e)
          acc[key].total += Number(e.amount)
          return acc
        }, {})
        const sortedGroups = Object.values(grouped).sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        )
        return (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-blue-500/10">
              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-blue-400" />
                <span className="text-blue-300 text-xs font-semibold">Parcelas em outros meses</span>
              </div>
              <span className="text-blue-400 text-xs font-bold">{formatBRL(totalFuture)} comprometido</span>
            </div>
            <div className="divide-y divide-blue-500/8">
              {sortedGroups.map(group => (
                <div key={`${group.year}-${group.month}`} className="px-3.5 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-xs font-medium">
                      {MONTHS_PT[group.month - 1]}/{group.year}
                    </span>
                    <span className="text-blue-400/80 text-xs font-semibold">{formatBRL(group.total)}</span>
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-2">
                        <span className="text-gray-500 text-xs truncate">{e.description}</span>
                        <span className="text-gray-400 text-xs shrink-0">{formatBRL(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Add button */}
      <button onClick={() => { if (!check()) return; setShowModal(true) }} className="btn-primary w-full">
        <Plus size={18} /> {t('Adicionar despesa · Add expense')}
      </button>

      {/* Botões discretos de limpeza */}
      {(items.length > 0 || dailyCashItems.length > 0 || dailyCardItems.length > 0) && (
        <div className="flex items-center justify-center gap-4">
          {(items.filter(i => i.category !== 'credit_card').length > 0 || dailyCashItems.length > 0) && (
            <button
              onClick={() => setClearConfirm('expenses')}
              className="flex items-center gap-1.5 text-xs text-red-400/50 hover:text-red-400 transition-colors"
            >
              <Trash2 size={11} /> Limpar despesas
            </button>
          )}
          {(items.filter(i => i.category === 'credit_card').length > 0 || dailyCardItems.length > 0) && (
            <>
              {(items.filter(i => i.category !== 'credit_card').length > 0 || dailyCashItems.length > 0) && (
                <span className="text-gray-700 text-xs">·</span>
              )}
              <button
                onClick={() => setClearConfirm('credit')}
                className="flex items-center gap-1.5 text-xs text-red-400/50 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} /> Limpar cartão
              </button>
            </>
          )}
        </div>
      )}

      {/* Filtro ativo — exibe pill quando alguma categoria está selecionada */}
      {tab !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">Filtrando:</span>
          <button
            onClick={() => setTab('all')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                       bg-emerald-500/15 text-emerald-400 border border-emerald-500/20
                       hover:bg-emerald-500/25 transition-all"
          >
            {tab === 'fixed' ? '🏠 Fixas' : tab === 'variable' ? '🛒 Variáveis' : '💳 Cartão'}
            <X size={11} />
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (tab === 'variable'    && filteredExpenses.length === 0 && dailyCashItems.length === 0) ||
           (tab === 'credit_card'  && filteredExpenses.length === 0 && dailyCardItems.length === 0) ||
           (tab !== 'variable' && tab !== 'credit_card' && filteredExpenses.length === 0) ? (
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
                  const isFuture = item.date > todayStr
                  const isFatura = item.category === '💳 Fatura Cartão'
                  // Formata a data futura como DD/MM
                  const [, fMon, fDay] = item.date.split('-')
                  const futureLabel = `${fDay}/${fMon}`
                  return (
                    <div key={`exp-${item.id}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isFuture
                          ? 'bg-blue-500/5 border-blue-500/15'
                          : isFatura
                          ? 'bg-red-500/5 border-red-500/20'
                          : 'bg-amber-500/5 border-amber-500/15'
                      }`}>
                      <div className={`w-10 h-10 ${ci.bg} rounded-xl flex items-center justify-center text-lg shrink-0`}>
                        {isFuture ? '📅' : ci.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-medium text-sm truncate">{item.description}</p>
                          {item.is_recurring && <span className="badge-blue">🔄 Fixo</span>}
                          {item.category === '💳 Fatura Cartão' && (
                            <span className="text-xs bg-red-500/15 text-red-300 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                              💳 Fatura
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-xs bg-blue-500/15 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                              📅 Será descontada em {futureLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5">{item.date}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold text-sm ${isFuture ? 'text-blue-400' : isFatura ? 'text-red-400' : 'text-amber-400'}`}>
                          {formatBRL(item.amount)}
                        </p>
                        <div className="flex gap-1 justify-end mt-1 flex-wrap">
                          {isFuture ? (
                            <>
                              <button
                                onClick={() => handlePay(item.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold
                                           bg-blue-500/15 hover:bg-blue-500/25 text-blue-300
                                           border border-blue-500/30 rounded-lg transition-all active:scale-95"
                              >
                                <CheckCircle size={11} /> Descontar agora
                              </button>
                              <button onClick={() => setConfirmId({ id: item.id, source: 'expense', item })} className="btn-danger text-xs">
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              {item.category === '💳 Fatura Cartão' ? (
                                /* Fatura gerada → botão de descontar do saldo */
                                <button
                                  onClick={() => handlePay(item.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold
                                             bg-red-500/15 hover:bg-red-500/25 text-red-300
                                             border border-red-500/30 rounded-lg transition-all active:scale-95"
                                >
                                  <CreditCard size={11} /> Descontar agora
                                </button>
                              ) : item.category === 'credit_card' ? (
                                /* Parcela de cartão → não tem "Pagar" individual; pagamento é via fatura */
                                <span className="text-xs text-blue-400/70 border border-blue-500/15 bg-blue-500/5
                                                 px-2 py-1 rounded-lg font-medium">
                                  💳 Pague via fatura
                                </span>
                              ) : (
                                /* Despesa fixa ou variável → botão de pagar normal */
                                <button
                                  onClick={() => handlePay(item.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold
                                             bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400
                                             border border-emerald-500/30 rounded-lg transition-all active:scale-95"
                                >
                                  <CheckCircle size={11} /> Pagar
                                </button>
                              )}
                              {item.is_recurring && item.category !== 'credit_card' && (
                                <button
                                  onClick={() => handleAlreadyPaid(item.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold
                                             bg-gray-500/15 hover:bg-gray-500/25 text-gray-400
                                             border border-gray-500/30 rounded-lg transition-all active:scale-95"
                                  title="Já registrei este pagamento de outra forma"
                                >
                                  ✓ Já paguei
                                </button>
                              )}
                              <button onClick={() => setConfirmId({ id: item.id, source: 'expense', item })} className="btn-danger text-xs">
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
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
                          <button onClick={() => setConfirmId({ id: item.id, source: 'expense', item })} className="btn-danger text-xs">
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
          {(tab === 'all' || tab === 'variable') && dailyCashItems.map((item) => (
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

      {/* Confirm delete (individual) */}
      {confirmId && (
        <ConfirmDialog
          message={
            confirmId.item?.category === 'credit_card' && confirmId.item?.description?.match(/^.+ \(\d+\/\d+\)$/)
              ? `Todas as parcelas desta compra serão removidas e o limite voltará ao normal.`
              : 'Essa despesa será removida permanentemente.'
          }
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Confirm clear all (expenses ou cartão) */}
      {clearConfirm && (
        <div className="modal-overlay" onClick={() => setClearConfirm(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-red-500/15 rounded-2xl flex items-center justify-center text-2xl">
                {clearConfirm === 'credit' ? '💳' : '🗑️'}
              </div>
              <div>
                {clearConfirm === 'expenses' ? (
                  <>
                    <p className="text-white font-semibold text-base">Limpar despesas do mês</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Remove todas as despesas <span className="text-blue-400">fixas</span>,{' '}
                      <span className="text-yellow-400">variáveis</span> e{' '}
                      <span className="text-yellow-400">gastos diários de débito</span> deste mês.
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {items.filter(i => i.category !== 'credit_card').length + dailyCashItems.length} lançamento(s) ·{' '}
                      {formatBRL(totalFixed + totalVar)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-semibold text-base">Limpar cartão de crédito</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Remove todas as despesas e gastos diários de{' '}
                      <span className="text-red-400">cartão de crédito</span> deste mês.
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {items.filter(i => i.category === 'credit_card').length + dailyCardItems.length} lançamento(s) ·{' '}
                      {formatBRL(totalCard)}
                    </p>
                  </>
                )}
                <p className="text-gray-600 text-xs mt-2 italic">Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setClearConfirm(null)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2.5 rounded-xl
                             transition-all flex items-center gap-2 justify-center active:scale-95 disabled:opacity-60"
                >
                  {clearing
                    ? <><Loader2 size={15} className="animate-spin" /> Limpando...</>
                    : <><Trash2 size={15} /> Limpar tudo</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Gerar Fatura do Cartão */}
      {showFaturaModal && (() => {
        const valorDigitado = parseCurrency(faturaAmount)
        const isParcial     = valorDigitado > 0 && valorDigitado < totalCard
        const restante      = isParcial ? totalCard - valorDigitado : 0
        const valorInvalido = valorDigitado <= 0 || valorDigitado > totalCard
        return (
          <div className="modal-overlay" onClick={() => !faturaLoading && setShowFaturaModal(false)}>
            <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 bg-red-500/15 rounded-2xl flex items-center justify-center text-2xl">
                  💳
                </div>
                <div className="w-full text-left">
                  <p className="text-white font-semibold text-base text-center">Gerar Fatura do Cartão</p>
                  <p className="text-gray-400 text-sm mt-1 text-center">
                    Total do cartão: <span className="text-red-400 font-bold">{formatBRL(totalCard)}</span>
                  </p>

                  {/* Campo de valor editável */}
                  <div className="mt-4 mb-1">
                    <p className="text-gray-500 text-xs mb-1.5">Valor a pagar agora</p>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
                      <CurrencyInput
                        value={faturaAmount}
                        onChange={setFaturaAmount}
                        className="w-full bg-dark-600 border border-white/10 rounded-xl pl-10 pr-4 py-3
                                   text-white font-bold text-lg focus:outline-none focus:border-red-500/50
                                   focus:ring-2 focus:ring-red-500/20 transition-all"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Indicador de pagamento parcial */}
                  {isParcial && (
                    <div className="mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left">
                      <p className="text-amber-300 text-xs font-semibold">⚠️ Pagamento parcial</p>
                      <p className="text-amber-400/80 text-xs mt-0.5">
                        Restante de <span className="font-bold">{formatBRL(restante)}</span> ficará pendente no cartão.
                      </p>
                    </div>
                  )}
                  {valorDigitado > totalCard && (
                    <p className="text-red-400 text-xs mt-2 text-center">
                      Valor não pode ser maior que o total da fatura.
                    </p>
                  )}

                  <p className="text-gray-600 text-xs mt-3 text-center italic">
                    As {(items.filter(i => i.category === 'credit_card').length + dailyCardItems.length)} despesas individuais serão removidas.
                  </p>
                </div>

                <p className="text-gray-500 text-xs text-center -mt-2">
                  A fatura aparecerá em <span className="text-amber-400">Pendentes</span> e só desconta do saldo ao clicar <span className="text-red-400">Descontar agora</span>.
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setShowFaturaModal(false)}
                    disabled={faturaLoading}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePagarFatura}
                    disabled={faturaLoading || valorInvalido}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2.5 rounded-xl
                               transition-all flex items-center gap-2 justify-center active:scale-95 disabled:opacity-60"
                  >
                    {faturaLoading
                      ? <><Loader2 size={15} className="animate-spin" /> Gerando...</>
                      : <><CreditCard size={15} /> {isParcial ? 'Gerar fatura parcial' : 'Gerar fatura'}</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

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

              {/* Limite disponível + erro — só para cartão de crédito */}
              {!editingItem && form.category === 'credit_card' && (
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                  cardAvailable <= 0
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : parseCurrency(form.amount) > cardAvailable
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-dark-600/50 border-white/5 text-gray-400'
                }`}>
                  <span>💳 Limite disponível</span>
                  <span className="font-semibold">{formatBRL(Math.max(cardAvailable, 0))}</span>
                </div>
              )}

              {/* Parcelas — só para cartão de crédito */}
              {!editingItem && form.category === 'credit_card' && (
                <div>
                  <label className="label">Parcelas</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1,2,3,4,5,6,10,12].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, installments: n }))}
                        className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                          form.installments === n
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-dark-600 border-white/8 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        {n === 1 ? 'À vista' : `${n}x`}
                      </button>
                    ))}
                  </div>
                  {form.installments > 1 && parseCurrency(form.amount) > 0 && (
                    <p className="text-gray-500 text-xs mt-2">
                      = {formatBRL(parseCurrency(form.amount) / form.installments)}/mês por {form.installments} meses
                    </p>
                  )}
                </div>
              )}

              {/* Erro de limite */}
              {limitError && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-center font-medium">
                  🚫 {limitError}
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
