import { useState, useEffect } from 'react'
import { Plus, Trash2, TrendingUp, Loader2, X, DollarSign, Pencil } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, addIncome, updateIncome, deleteIncome } from '../lib/supabase'
import MonthPicker from '../components/MonthPicker'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import ConfirmDialog from '../components/ConfirmDialog'
import { useLang } from '../hooks/useLang'
import { format } from 'date-fns'
import { usePlanGate } from '../contexts/PlanGateContext'
import { useAccounts } from '../hooks/useAccounts'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const INCOME_CATEGORIES = [
  { value: 'salary', label: 'Salário · Salary', emoji: '💼' },
  { value: 'freelance', label: 'Freelance · Freelance', emoji: '💻' },
  { value: 'bonus', label: 'Bônus · Bonus', emoji: '🎁' },
  { value: 'investment', label: 'Investimento · Investment', emoji: '📈' },
  { value: 'other', label: 'Outro · Other', emoji: '💰' },
]

export default function Income() {
  const { user, isAdmin } = useAuth()
  const { check } = usePlanGate()
  const t = useLang()
  const { accounts, principalAccount, hasMultiple } = useAccounts()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'salary',
    date: format(new Date(), 'yyyy-MM-dd'),
    account_id: null,
  })

  const load = async () => {
    setLoading(true)
    const { data } = await getIncome(user.id, month, year)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  const openEdit = (item) => {
    setEditingId(item.id)
    setForm({
      description: item.description,
      amount: String(Math.round(Number(item.amount) * 100)),
      category: item.category,
      date: item.date,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm({ description: '', amount: '', category: 'salary', date: format(new Date(), 'yyyy-MM-dd'), account_id: principalAccount?.id || null })
  }

  // Pré-seleciona conta principal ao abrir modal
  const openModal = () => {
    if (!check()) return
    setForm(f => ({ ...f, account_id: principalAccount?.id || null }))
    setShowModal(true)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!check()) return
    setSaving(true)
    const d = new Date(form.date + 'T12:00:00')
    const payload = {
      description: form.description,
      amount: parseCurrency(form.amount),
      category: form.category,
      date: form.date,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    }
    if (editingId) {
      await updateIncome(editingId, payload)
    } else {
      await addIncome({ user_id: user.id, ...payload, account_id: form.account_id || null })
    }
    closeModal()
    setSaving(false)
    await load()
    window.dispatchEvent(new Event('finance-updated'))
  }

  const handleDelete = async (id) => {
    if (!check()) return
    await deleteIncome(id)
    setItems(items.filter(i => i.id !== id))
    setConfirmId(null)
    window.dispatchEvent(new Event('finance-updated'))
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0)

  const catEmoji = (cat) => INCOME_CATEGORIES.find(c => c.value === cat)?.emoji || '💰'
  const catLabel = (cat) => INCOME_CATEGORIES.find(c => c.value === cat)?.label.split(' · ')[0] || 'Outro'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Renda</h1>
          <p className="text-gray-500 text-sm">{t('Income · Entradas de dinheiro')}</p>
        </div>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* Total card */}
      <div className="card border border-emerald-500/20 bg-gradient-to-br from-dark-700 to-dark-600">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{t('Total do mês · Monthly total')}</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">{formatBRL(total)}</p>
            <p className="text-gray-500 text-xs mt-1">{items.length} entrada(s) registrada(s)</p>
          </div>
          <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center">
            <TrendingUp size={32} className="text-emerald-400" />
          </div>
        </div>

        <button onClick={openModal} className="btn-primary w-full mt-4">
          <Plus size={18} /> {t('Adicionar renda · Add income')}
        </button>
      </div>

      {/* List */}
      <div>
        <p className="section-title">{t('Lançamentos · Records')}</p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="card text-center py-10">
            <DollarSign size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nenhuma entrada registrada</p>
            {isAdmin && <p className="text-gray-600 text-sm mt-1">No income recorded for this month</p>}
            <button onClick={openModal} className="btn-primary mx-auto mt-4">
              <Plus size={16} /> Adicionar renda
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="card-hover flex items-center gap-3 p-3">
                <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center text-lg shrink-0">
                  {catEmoji(item.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{item.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="badge-green">{catLabel(item.category)}</span>
                    <span className="text-gray-500 text-xs">{item.date}</span>
                    {(() => {
                      const acc = accounts.find(a => a.id === item.account_id)
                      return acc ? (
                        <span className="text-xs text-gray-600 flex items-center gap-0.5">
                          {acc.emoji} {acc.name}
                        </span>
                      ) : null
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold">{formatBRL(item.amount)}</p>
                  <div className="flex gap-1 justify-end mt-1">
                    <button onClick={() => openEdit(item)} className="btn-secondary text-xs">
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => setConfirmId(item.id)} className="btn-danger text-xs">
                      <Trash2 size={12} /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Potencial de economia — substitui o 50/30/20 */}
      {total > 0 && (
        <div className="card border border-emerald-500/15">
          <p className="text-white font-semibold text-sm mb-1">🌱 Comece pequeno</p>
          <p className="text-gray-500 text-xs mb-4">
            Você não precisa guardar 20% agora. Qualquer valor guardado já é progresso real.
          </p>

          {/* Metas escalonadas */}
          <div className="space-y-3">
            {[
              { pct: 1,  label: 'Iniciando',     color: 'bg-emerald-500', tip: 'O primeiro passo importa mais que o tamanho.' },
              { pct: 5,  label: 'Construindo',   color: 'bg-blue-500',    tip: 'Hábito formado. Já dá pra sentir a diferença.' },
              { pct: 10, label: 'Crescendo',      color: 'bg-purple-500',  tip: 'Dois dígitos. Você está no caminho certo.' },
            ].map(({ pct, label, color, tip }) => (
              <div key={pct} className="bg-dark-600/60 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-gray-300 text-xs font-medium">{pct}% — {label}</span>
                  <span className="text-white text-xs font-bold">{formatBRL(total * pct / 100)}/mês</span>
                </div>
                <div className="h-1.5 rounded-full bg-dark-700 overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct * 5}%` }} />
                </div>
                <p className="text-gray-600 text-[10px] mt-1 italic">{tip}</p>
              </div>
            ))}
          </div>

          <p className="text-gray-600 text-xs mt-3 text-center">
            {formatBRL(total * 0.01)}/mês durante 1 ano = {formatBRL(total * 0.01 * 12)} guardados 💪
          </p>
        </div>
      )}

      {/* Confirm delete */}
      {confirmId && (
        <ConfirmDialog
          message="Essa entrada de renda será removida permanentemente."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">{editingId ? t('Editar renda · Edit Income') : t('Adicionar renda · Add Income')}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="label">{t('Descrição · Description')}</label>
                <input
                  className="input-field"
                  placeholder="Ex: Salário de Abril"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  required
                />
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
                <label className="label">{t('Categoria · Category')}</label>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {INCOME_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.emoji} {t(c.label)}</option>
                  ))}
                </select>
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

              <div className="flex gap-3 pt-2">
                {/* Seletor de conta — só com 2+ contas */}
                {hasMultiple && (
                  <div>
                    <label className="label">Conta</label>
                    <div className="flex flex-wrap gap-2">
                      {accounts.map(acc => (
                        <button key={acc.id} type="button"
                          onClick={() => setForm(f => ({ ...f, account_id: acc.id }))}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-all ${
                            form.account_id === acc.id
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              : 'bg-dark-600 border-white/8 text-gray-400'
                          }`}
                        >
                          {acc.emoji} {acc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : editingId ? <><Pencil size={16} /> Salvar alterações</> : <><Plus size={16} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
