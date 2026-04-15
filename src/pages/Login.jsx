import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) setError('E-mail ou senha incorretos. Tente novamente.')
      } else {
        const { error } = await signUp(email, password)
        if (error) {
          if (error.message.includes('already registered')) {
            setError('Este e-mail já está cadastrado. Faça login.')
          } else {
            setError('Erro ao criar conta. Verifique os dados e tente novamente.')
          }
        } else {
          setSuccess('✅ Conta criada! Verifique seu e-mail para confirmar o cadastro.')
        }
      }
    } catch {
      setError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-800 flex flex-col items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 animate-pulse-green">
            💰
          </div>
          <h1 className="text-2xl font-bold text-white">FinançasFamília</h1>
          <p className="text-gray-400 text-sm mt-1">
            <span className="text-emerald-400">Family Finance</span> · Controle financeiro para 2
          </p>
        </div>

        {/* Card */}
        <div className="card border border-white/8">
          <h2 className="text-white font-semibold text-lg mb-1">
            {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {mode === 'login'
              ? 'Acesse seu controle financeiro'
              : 'Comece a controlar suas finanças hoje'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail <span className="text-gray-600">· Email</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="input-field"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Senha <span className="text-gray-600">· Password</span></label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                  className="input-field pr-12"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl px-4 py-3">
                {success}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Aguarde...</>
              ) : (
                mode === 'login' ? '🔑 Entrar · Sign In' : '🚀 Criar conta · Sign Up'
              )}
            </button>
          </form>

          <div className="divider" />

          <p className="text-center text-sm text-gray-400">
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}
            {' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess('') }}
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
            </button>
          </p>
        </div>

        {/* Motivational tip */}
        <div className="mt-6 text-center px-4">
          <p className="text-gray-600 text-xs italic">
            "A journey of a thousand miles begins with a single step." — Lao Tzu
          </p>
          <p className="text-gray-700 text-xs mt-1">
            "Uma jornada de mil milhas começa com um único passo."
          </p>
        </div>
      </div>
    </div>
  )
}
