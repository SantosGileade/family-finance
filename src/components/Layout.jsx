import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import BalanceBar from './BalanceBar'
import QuickAdd from './QuickAdd'
import { usePlanGate } from '../contexts/PlanGateContext'
import { MessageCircle } from 'lucide-react'

const WHATSAPP_NUMBER = '5521981905892'
const WHATSAPP_MSG = encodeURIComponent(
  'Olá! Me cadastrei no FinançasFamília e gostaria de ativar meu plano. 😊'
)

function PlanBanner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <p className="text-amber-300 text-xs">
          🔒 Plano inativo — navegue à vontade e ative para começar a registrar.
        </p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-emerald-400
                     hover:text-emerald-300 transition-colors shrink-0"
        >
          <MessageCircle size={13} />
          Ativar plano
        </a>
      </div>
    </div>
  )
}

export default function Layout() {
  const { isPlanActive } = usePlanGate()
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="flex h-screen bg-dark-800 overflow-hidden flex-col">
      {/* Banner suave para plano inativo */}
      {!isPlanActive && <PlanBanner />}

      {/* Balance bar — oculto no Dashboard (o saldo já aparece no conteúdo da Home) */}
      {!isHome && <BalanceBar />}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - visible on desktop */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 pb-28 sm:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom nav - visible on mobile */}
      <BottomNav />

      {/* Floating quick-add button - visible on all pages */}
      <QuickAdd />
    </div>
  )
}
