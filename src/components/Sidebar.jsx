import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, TrendingUp, CreditCard,
  Calendar, PiggyBank, Lightbulb, LogOut, FileUp
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', en: 'Overview' },
  { to: '/income', icon: TrendingUp, label: 'Renda', en: 'Income' },
  { to: '/expenses', icon: CreditCard, label: 'Despesas', en: 'Expenses' },
  { to: '/daily', icon: Calendar, label: 'Gastos Diários', en: 'Daily Spend' },
  { to: '/savings', icon: PiggyBank, label: 'Poupança', en: 'Savings' },
  { to: '/import', icon: FileUp, label: 'Importar', en: 'Import CSV' },
  { to: '/tips', icon: Lightbulb, label: 'Dicas', en: 'Tips & Learn' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <aside className="hidden sm:flex flex-col w-64 bg-dark-900 border-r border-white/5 p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-xl">
          💰
        </div>
        <div>
          <h1 className="text-white font-bold text-sm leading-tight">FinançasFamília</h1>
          <p className="text-gray-500 text-xs">Family Finance</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label, en }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'} />
                <div>
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  <p className="text-xs text-gray-600 leading-tight">{en}</p>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User / Sign out */}
      <div className="border-t border-white/5 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-bold text-sm">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.email}</p>
            <p className="text-gray-500 text-xs">Família 👨‍👩</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-gray-500 hover:text-red-400 text-sm px-2 py-1.5 w-full rounded-lg hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={15} />
          Sair / Sign out
        </button>
      </div>
    </aside>
  )
}
