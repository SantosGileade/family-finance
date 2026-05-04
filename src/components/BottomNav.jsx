import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, CreditCard, Calendar,
  MoreHorizontal, PiggyBank, FileUp, BarChart2,
  LogOut, X, ChevronRight, Tag, Lightbulb
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const mainItems = [
  { to: '/',         icon: LayoutDashboard, label: 'Início'   },
  { to: '/income',   icon: TrendingUp,      label: 'Renda'    },
  { to: '/expenses', icon: CreditCard,      label: 'Despesas' },
  { to: '/daily',    icon: Calendar,        label: 'Diário'   },
]

const sheetItems = [
  { to: '/reports',    icon: BarChart2, label: 'Relatórios',          sub: 'Análise de gastos'        },
  { to: '/savings',    icon: PiggyBank, label: 'Poupança',            sub: 'Seu cofrinho digital'     },
  { to: '/categories', icon: Tag,       label: 'Categorias',          sub: 'Gerenciar categorias'     },
  { to: '/import',     icon: FileUp,    label: 'Importar dados',      sub: 'Importar extrato CSV'     },
  { to: '/tips',       icon: Lightbulb, label: 'Dicas',               sub: 'Dicas e vocabulário'      },
]

export default function BottomNav() {
  const [open, setOpen] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSheetNav = (to) => {
    setOpen(false)
    navigate(to)
  }

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
  }

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-dark-900/95 backdrop-blur-md border-t border-white/5 pb-safe z-40">
        <div className="flex items-stretch">
          {mainItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all duration-200 ${
                  isActive ? 'text-emerald-400' : 'text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative ${isActive ? 'scale-110' : ''} transition-transform duration-200`}>
                    <Icon size={20} />
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Botão Mais */}
          <button
            onClick={() => setOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all duration-200 ${
              open ? 'text-emerald-400' : 'text-gray-500'
            }`}
          >
            <div className={`relative ${open ? 'scale-110' : ''} transition-transform duration-200`}>
              <MoreHorizontal size={20} />
              {open && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
              )}
            </div>
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {/* Bottom Sheet Overlay */}
      {open && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex items-end"
          onClick={() => setOpen(false)}
        >
          {/* Fundo escurecido */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="relative w-full bg-dark-800 rounded-t-3xl border-t border-white/8
                       shadow-2xl z-10 animate-slide-up select-none"
            onClick={e => e.stopPropagation()}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-white font-semibold text-base">Mais opções</p>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 bg-dark-600 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Itens principais */}
            <div className="px-4 pb-2 space-y-1">
              {sheetItems.map(({ to, icon: Icon, label, sub }) => (
                <button
                  key={to}
                  onClick={() => handleSheetNav(to)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl
                             bg-dark-700/60 active:bg-dark-600 active:scale-98
                             border border-white/5 transition-all duration-150 text-left"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{label}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 shrink-0" />
                </button>
              ))}
            </div>

            {/* Divisor */}
            <div className="mx-5 my-2 h-px bg-white/6" />

            {/* Sair */}
            <div className="px-4 pb-6">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl
                           hover:bg-red-500/10 active:scale-98
                           border border-transparent hover:border-red-500/20
                           transition-all duration-150 text-left"
              >
                <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <LogOut size={18} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-red-400 text-sm font-medium">Sair da conta</p>
                  <p className="text-gray-600 text-xs mt-0.5">Encerrar sessão</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
