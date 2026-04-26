import { createContext, useContext, useState } from 'react'
import { useAuth } from './AuthContext'
import { MessageCircle, X, Lock } from 'lucide-react'

const WHATSAPP_NUMBER = '5521981905892'
const WHATSAPP_MSG = encodeURIComponent(
  'Olá! Me cadastrei no FinançasFamília e gostaria de ativar meu plano para começar a usar. 😊'
)

const PlanGateContext = createContext({})

function PlanModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-sm bg-dark-700 rounded-t-3xl sm:rounded-2xl
                   border border-white/10 shadow-2xl z-10 px-5 pt-5 pb-8 sm:pb-5
                   animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar mobile */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5 sm:hidden" />

        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Ícone */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/20 rounded-2xl
                         flex items-center justify-center text-3xl mb-3">
            🔓
          </div>
          <h2 className="text-white font-bold text-lg">Ative seu plano</h2>
          <p className="text-gray-400 text-sm mt-1">
            Para registrar e gerenciar seus dados, ative o acesso com o administrador.
          </p>
        </div>

        {/* Features preview */}
        <div className="bg-dark-600 rounded-xl p-4 mb-5 space-y-2">
          {[
            '💵 Controle de renda mensal',
            '🧾 Registro de despesas',
            '📅 Gasto diário com meta',
            '🐷 Poupança com metas',
            '📊 Dashboard com gráficos',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-300">
              <span className="text-emerald-400 text-xs">✓</span>
              {item}
            </div>
          ))}
        </div>

        {/* CTA WhatsApp */}
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-emerald-500
                     hover:bg-emerald-400 text-white font-semibold py-3.5 px-4
                     rounded-xl transition-colors active:scale-95 text-sm"
        >
          <MessageCircle size={18} />
          Falar com o administrador
        </a>

        <p className="text-center text-gray-600 text-xs mt-3">
          Envie seu comprovante e o acesso será liberado em minutos.
        </p>
      </div>
    </div>
  )
}

export const PlanGateProvider = ({ children }) => {
  const { isPlanActive } = useAuth()
  const [showModal, setShowModal] = useState(false)

  /**
   * Use este método antes de qualquer ação que requer plano ativo.
   * Retorna true se o plano estiver ativo, false caso contrário (e abre o modal).
   */
  const check = () => {
    if (isPlanActive) return true
    setShowModal(true)
    return false
  }

  return (
    <PlanGateContext.Provider value={{ check, isPlanActive }}>
      {children}
      {showModal && <PlanModal onClose={() => setShowModal(false)} />}
    </PlanGateContext.Provider>
  )
}

export const usePlanGate = () => useContext(PlanGateContext)
