import { useState, useRef, useEffect } from 'react'
import { Zap, X, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { addDailySpending } from '../lib/supabase'
import { format } from 'date-fns'

const parseCurrency = (str) => {
  const normalized = String(str).replace(',', '.')
  const val = parseFloat(normalized)
  return isNaN(val) ? 0 : val
}

export default function QuickAdd() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState('debit') // 'debit' | 'credit_card'
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const amountRef = useRef(null)

  // Foca no campo de valor ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => amountRef.current?.focus(), 120)
    }
  }, [open])

  const handleOpen = () => {
    setAmount('')
    setDescription('')
    setMethod('debit')
    setSaved(false)
    setOpen(true)
  }

  const handleClose = () => {
    if (saving) return
    setOpen(false)
  }

  const handleSave = async () => {
    const val = parseCurrency(amount)
    if (!val || val <= 0) {
      amountRef.current?.focus()
      return
    }
    setSaving(true)
    await addDailySpending({
      user_id: user.id,
      description: description.trim() || 'Gasto rápido',
      amount: val,
      payment_method: method === 'credit_card' ? 'credit_card' : 'debit',
      date: format(new Date(), 'yyyy-MM-dd'),
    })
    window.dispatchEvent(new Event('finance-updated'))
    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setOpen(false)
      setSaved(false)
    }, 800)
  }

  // Salvar com Enter no campo de valor (se descrição estiver vazia, foca nela)
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
          {/* Fundo escurecido */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

          {/* Sheet / Modal */}
          <div className="relative w-full sm:max-w-sm bg-dark-700 rounded-t-3xl sm:rounded-2xl
                          border border-white/10 shadow-2xl z-10
                          animate-slide-up px-5 pt-5 pb-8 sm:pb-5">

            {/* Handle bar (mobile) */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500/15 rounded-xl flex items-center justify-center">
                  <Zap size={16} className="text-emerald-400" fill="currentColor" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">Gasto Rápido ⚡</p>
                  <p className="text-gray-500 text-xs">Quick Add</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-gray-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Valor grande */}
            <div className="mb-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">R$</span>
                <input
                  ref={amountRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => {
                    // Permite só números, vírgula e ponto
                    const v = e.target.value.replace(/[^0-9.,]/g, '')
                    setAmount(v)
                  }}
                  onKeyDown={handleAmountKeyDown}
                  className="w-full bg-dark-600 border border-white/10 rounded-2xl
                             pl-14 pr-4 py-4 text-white text-2xl font-bold
                             placeholder-gray-600 focus:outline-none focus:border-emerald-500/50
                             focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="mb-4">
              <input
                id="qa-desc"
                type="text"
                placeholder="O que foi? (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full bg-dark-600 border border-white/10 rounded-xl
                           px-4 py-3 text-white text-sm placeholder-gray-600
                           focus:outline-none focus:border-emerald-500/50
                           focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            {/* Toggle pagamento */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setMethod('debit')}
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

            {/* Botão salvar */}
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all
                         flex items-center justify-center gap-2 active:scale-95 ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
              }`}
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
