import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import BalanceBar from './BalanceBar'

export default function Layout() {
  return (
    <div className="flex h-screen bg-dark-800 overflow-hidden flex-col">
      {/* Balance bar - visible on all pages */}
      <BalanceBar />

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
    </div>
  )
}
