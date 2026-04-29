import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { PlanGateProvider } from './contexts/PlanGateContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Income from './pages/Income'
import Expenses from './pages/Expenses'
import DailySpending from './pages/DailySpending'
import Savings from './pages/Savings'
import Tips from './pages/Tips'
import Import from './pages/Import'
import Categories from './pages/Categories'
import Reports from './pages/Reports'
import Admin from './pages/Admin'

const Spinner = () => (
  <div className="min-h-screen bg-dark-800 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  </div>
)

// Rota privada: só checa se está logado (plano é tratado via PlanGateContext)
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-800 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
      <Route path="/" element={
        <PrivateRoute>
          <PlanGateProvider>
            <Layout />
          </PlanGateProvider>
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="income" element={<Income />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="daily" element={<DailySpending />} />
        <Route path="savings" element={<Savings />} />
        <Route path="tips" element={<Tips />} />
        <Route path="import" element={<Import />} />
        <Route path="categories" element={<Categories />} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
