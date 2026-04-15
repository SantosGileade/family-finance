import { useState, useEffect } from 'react'
import { Plus, Trash2, TrendingUp, Loader2, X, DollarSign } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, addIncome, deleteIncome } from '../lib/supabase'
import MonthSelector from '../components/MonthSelector'
import { format } from 'date-fns'

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
  const { user } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'salary',
    date: format(new Date(), 'yyyy-MM-dd'),
  })

  const load = async () => {
    setLoading(true)
    const { data } = await getIncome(user.id, month, year)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    const d = new Date(form.date + 'T12:00:00')
    await addIncome({
      user_id: user.id,
      description: form.description,
      amount: Number(form.amount),
      category: form.category,
      date: form.date,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    })
    setForm({ description: '', amount: '', category: 'salary', date: format(new Date(), 'yyyy-MM-dd') })
    setShowModal(false)
    setSaving(false)
    await load()
  }

  const handleDelete = async (id) => {
    await deleteIncome(id)
    setItems(items.filter(i => i.id !== id))
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0)

  const catEmoji = (cat) => INCOME_CATEGORIES.find(c => c.value === cat)?.emoji || '💰'
  const catLabel = (cat) => INCOME_CATEGORIES.find(c => c.value === cat)?.label.split(' · ')[0] || 'Outro'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Renda 💵</h1>
          <p className="text-gray-500 text-sm">Income · Entradas de dinheiro</p>
        </div>
        <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
      </div>

      {/* Total card */}
      <div className="card border border-emerald-500/20 bg-gradient-to-br from-dark-700 to-dark-600">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Total do mês · Monthly total</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">{formatBRL(total)}</p>
            <p className="text-gray-500 text-xs mt-1">{items.length} entrada(s) registrada(s)</p>
          </div>
          <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center">
            <TrendingUp size={32} className="text-emerald-400" />
          </div>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary w-full mt-4">
          <Plus size={18} /> Adicionar renda · Add income
        </button>
      </div>

      {/* List */}
      <div>
        <p className="section-title">Lançamentos · Records</p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="card text-center py-10">
            <DollarSign size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nenhuma entrada registrada</p>
            <p className="text-gray-600 text-sm mt-1">No income recorded for this month</p>
            <button onClick={() => setShowModal(true)} className="btn-primary mx-auto mt-4">
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
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold">{formatBRL(item.amount)}</p>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="btn-danger text-xs mt-1"
                  >
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 50/30/20 insight */}
      {total > 0 && (
        <div className="card border border-blue-500/20">
          <p className="text-blue-400 font-semibold text-sm mb-3">
            💡 Regra 50/30/20 · 50/30/20 Rule
          </p>
          <p className="text-gray-500 text-xs mb-3">
            Uma forma inteligente de dividir sua renda de <span className="text-white">{formatBRL(total)}</span>:
          </p>
          <div className="space-y-2">
            {[
              { pct: 50, label: 'Necessidades · Needs', color: 'bg-blue-500', hint: 'Aluguel, mercado, contas' },
              { pct: 30, label: 'Desejos · Wants', color: 'bg-yellow-500', hint: 'Lazer, roupas, restaurantes' },
              { pct: 20, label: 'Poupança · Savings', color: 'bg-emerald-500', hint: 'Guardar para o futuro' },
            ].map(({ pct, label, color, hint }) => (
              <div key={pct}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{pct}% — {label}</span>
                  <span className="text-white font-semibold">{formatBRL(total * pct / 100)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-dark-600">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-gray-600 text-xs mt-0.5">{hint}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Adicionar renda · Add Income</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="label">Descrição · Description</label>
                <input
                  className="input-field"
                  placeholder="Ex: Salário de Abril"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Valor · Amount (R$)</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Categoria · Category</label>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {INCOME_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
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
