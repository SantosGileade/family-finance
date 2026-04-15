import { useState, useEffect } from 'react'
import { Plus, Minus, Trash2, PiggyBank, Loader2, X, Trophy, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getSavings, addSaving, deleteSaving } from '../lib/supabase'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import { format } from 'date-fns'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const MILESTONES = [
  { value: 100, emoji: '🌱', label: 'Primeira centena!', en: 'First hundred!' },
  { value: 500, emoji: '⭐', label: 'Meio caminho!', en: 'Halfway star!' },
  { value: 1000, emoji: '🏆', label: 'Mil reais!', en: 'One thousand!' },
  { value: 2000, emoji: '🚀', label: 'Dois mil!', en: 'Two thousand!' },
  { value: 5000, emoji: '💎', label: 'Cinco mil!', en: 'Five thousand!' },
  { value: 10000, emoji: '👑', label: 'Dez mil! Rei!', en: 'Ten thousand! King!' },
]

const SAVING_TIPS = [
  '🎯 Desafio: guardar R$ 1 hoje!',
  '💡 Cada centavo conta. Save each penny!',
  '🌱 Pequenas economias viram grandes conquistas!',
  '🏦 Pague a si mesmo primeiro. Pay yourself first.',
  '📅 R$ 1 por dia = R$ 365 por ano!',
]

export default function Savings() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('add') // 'add' | 'withdraw'
  const [saving, setSaving] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  const [form, setForm] = useState({
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })

  const load = async () => {
    setLoading(true)
    const { data } = await getSavings(user.id)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const total = items.reduce((s, i) => s + Number(i.amount), 0)

  const nextMilestone = MILESTONES.find(m => m.value > total) || MILESTONES[MILESTONES.length - 1]
  const prevMilestone = [...MILESTONES].reverse().find(m => m.value <= total)
  const progress = prevMilestone
    ? ((total - prevMilestone.value) / (nextMilestone.value - prevMilestone.value)) * 100
    : (total / nextMilestone.value) * 100

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const prevTotal = total
    const amount = modalType === 'withdraw' ? -parseCurrency(form.amount) : parseCurrency(form.amount)
    await addSaving({
      user_id: user.id,
      amount,
      description: form.description || (modalType === 'add' ? 'Depósito' : 'Retirada'),
      date: form.date,
    })
    setForm({ description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') })
    setShowModal(false)
    setSaving(false)
    await load()

    // Check for new milestone
    const newTotal = prevTotal + amount
    if (MILESTONES.some(m => m.value > prevTotal && m.value <= newTotal)) {
      setCelebrating(true)
      setTimeout(() => setCelebrating(false), 4000)
    }
  }

  const handleDelete = async (id) => {
    await deleteSaving(id)
    setItems(items.filter(i => i.id !== id))
  }

  const openModal = (type) => {
    setModalType(type)
    setForm({ description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') })
    setShowModal(true)
  }

  const tipOfDay = SAVING_TIPS[new Date().getDate() % SAVING_TIPS.length]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Celebration overlay */}
      {celebrating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="text-center p-8">
            <div className="text-8xl mb-4 animate-bounce">🎉</div>
            <p className="text-3xl font-bold text-emerald-400">Meta atingida!</p>
            <p className="text-white text-lg mt-2">Milestone reached! 🏆</p>
            <button onClick={() => setCelebrating(false)} className="btn-primary mt-6 mx-auto">
              Yeeeah! 🙌
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="page-title">Poupança 🐷</h1>
        <p className="text-gray-500 text-sm">Savings · Sua reserva financeira</p>
      </div>

      {/* Total */}
      <div className="card border border-purple-500/20 bg-gradient-to-br from-dark-700 to-dark-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center">
              <PiggyBank size={28} className="text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total guardado · Total saved</p>
              <p className="text-3xl font-bold text-white">{formatBRL(total)}</p>
            </div>
          </div>

          {/* Milestone progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{prevMilestone ? `${prevMilestone.emoji} ${prevMilestone.label}` : '🌱 Início'}</span>
              <span>{nextMilestone.emoji} {formatBRL(nextMilestone.value)}</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill bg-purple-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Faltam {formatBRL(Math.max(nextMilestone.value - total, 0))} para o próximo marco!
              <span className="text-gray-600"> · {(Math.max(nextMilestone.value - total, 0) / 30).toFixed(0)} dias guardando R$30/dia</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-5">
            <button onClick={() => openModal('add')} className="btn-primary flex-1">
              <Plus size={18} /> Guardar · Save
            </button>
            <button
              onClick={() => openModal('withdraw')}
              disabled={total <= 0}
              className="btn-secondary flex-1 disabled:opacity-40"
            >
              <Minus size={18} /> Retirar · Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="card">
        <p className="section-title">Marcos · Milestones</p>
        <div className="grid grid-cols-3 gap-2">
          {MILESTONES.map((m) => {
            const reached = total >= m.value
            return (
              <div
                key={m.value}
                className={`p-3 rounded-xl text-center transition-all ${
                  reached
                    ? 'bg-purple-500/15 border border-purple-500/30'
                    : 'bg-dark-600 border border-white/5 opacity-50'
                }`}
              >
                <p className="text-2xl mb-1">{m.emoji}</p>
                <p className="text-xs font-semibold text-white">{formatBRL(m.value)}</p>
                <p className="text-xs text-gray-500">{m.label}</p>
                {reached && <p className="text-xs text-purple-400 mt-1">✅ Conquistado!</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tip */}
      <div className="card border border-emerald-500/15 bg-emerald-500/5">
        <p className="text-emerald-400 text-sm font-medium">{tipOfDay}</p>
      </div>

      {/* Quick save amounts */}
      <div className="card">
        <p className="section-title">Guardar rapidinho · Quick save</p>
        <div className="grid grid-cols-4 gap-2">
          {[1, 5, 10, 20, 50, 100, 200, 500].map(v => (
            <button
              key={v}
              onClick={async () => {
                const prevTotal = total
                setSaving(true)
                await addSaving({
                  user_id: user.id,
                  amount: v,
                  description: `Guardei R$ ${v}! 💪`,
                  date: format(new Date(), 'yyyy-MM-dd'),
                })
                await load()
                setSaving(false)
                const newTotal = prevTotal + v
                if (MILESTONES.some(m => m.value > prevTotal && m.value <= newTotal)) {
                  setCelebrating(true)
                  setTimeout(() => setCelebrating(false), 4000)
                }
              }}
              disabled={saving}
              className="bg-dark-600 hover:bg-emerald-500/20 border border-white/5 hover:border-emerald-500/30
                         text-gray-300 hover:text-emerald-400 font-semibold py-3 rounded-xl text-sm
                         transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              +{v}
            </button>
          ))}
        </div>
        <p className="text-gray-600 text-xs mt-2 text-center italic">
          Toque para guardar esse valor agora mesmo!
        </p>
      </div>

      {/* History */}
      <div>
        <p className="section-title">Histórico · History</p>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="card text-center py-10">
            <PiggyBank size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nenhum registro ainda</p>
            <p className="text-gray-600 text-sm mt-1">Start saving today! Even R$ 1 counts 💚</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isDeposit = Number(item.amount) >= 0
              return (
                <div key={item.id} className="card-hover flex items-center gap-3 p-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                    isDeposit ? 'bg-purple-500/15' : 'bg-red-500/15'
                  }`}>
                    {isDeposit ? '💰' : '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{item.description}</p>
                    <p className="text-gray-500 text-xs">{item.date}</p>
                  </div>
                  <p className={`font-bold shrink-0 ${isDeposit ? 'text-purple-400' : 'text-red-400'}`}>
                    {isDeposit ? '+' : ''}{formatBRL(item.amount)}
                  </p>
                  <button onClick={() => handleDelete(item.id)} className="btn-danger shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">
                {modalType === 'add' ? '💰 Guardar dinheiro · Save Money' : '💸 Retirar · Withdraw'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Quanto? · Amount (R$)</label>
                <CurrencyInput
                  className="input-field text-xl font-bold"
                  value={form.amount}
                  onChange={v => setForm({ ...form, amount: v })}
                  required
                  autoFocus
                />
                {form.amount && parseCurrency(form.amount) > 0 && (
                  <p className="text-emerald-400 text-sm mt-1 font-medium">
                    {modalType === 'add' ? '💪 ' : '📤 '}
                    {formatBRL(parseCurrency(form.amount))} {modalType === 'add' ? 'será guardado!' : 'será retirado.'}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Observação · Note (opcional)</label>
                <input
                  className="input-field"
                  placeholder={modalType === 'add' ? 'Ex: Sobrou do mês, vendei algo...' : 'Motivo da retirada...'}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Data · Date</label>
                <input
                  className="input-field"
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : (
                    modalType === 'add' ? <><Plus size={16} /> Guardar!</> : <><Minus size={16} /> Retirar</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
