import { NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, CreditCard, Calendar, PiggyBank, FileUp } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Início' },
  { to: '/income', icon: TrendingUp, label: 'Renda' },
  { to: '/expenses', icon: CreditCard, label: 'Despesas' },
  { to: '/daily', icon: Calendar, label: 'Diário' },
  { to: '/savings', icon: PiggyBank, label: 'Poupança' },
  { to: '/import', icon: FileUp, label: 'Importar' },
]

export default function BottomNav() {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-dark-900/95 backdrop-blur-md border-t border-white/5 pb-safe z-40">
      <div className="flex items-stretch">
        {navItems.map(({ to, icon: Icon, label }) => (
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
      </div>
    </nav>
  )
}
