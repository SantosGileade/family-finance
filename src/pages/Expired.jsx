import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2, RefreshCw, LogOut, MessageCircle, Clock } from 'lucide-react'

const WHATSAPP_NUMBER = '5521981905892' // Troque pelo seu número com DDI+DDD
const WHATSAPP_MSG = encodeURIComponent('Olá! Efetuei o pagamento e gostaria de ativar meu acesso ao FinançasFamília.')

export default function Expired() {
  const { profile, isPlanActive, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isPlanActive) navigate('/', { replace: true })
  }, [isPlanActive])

  const [checking, setChecking] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const neverActivated = !profile?.plano_ativo && !profile?.data_expiracao
  const expired = profile?.plano_ativo || profile?.data_expiracao

  const handleCheck = async () => {
    setChecking(true)
    const fresh = await refreshProfile()
    setChecking(false)
    const active = fresh?.is_admin || (
      fresh?.plano_ativo && fresh?.data_expiracao && new Date(fresh.data_expiracao) > new Date()
    )
    if (active) {
      setRedirecting(true)
      navigate('/', { replace: true })
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-dark-800 flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-white">
            {neverActivated ? 'Acesso não ativado' : 'Acesso expirado'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {profile?.email || 'Conta detectada'}
          </p>
        </div>

        <div className="bg-dark-700 border border-white/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <Clock size={18} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-300 text-sm">
              {neverActivated
                ? 'Sua conta ainda não foi ativada. Aguarde a confirmação do administrador.'
                : 'Seu plano venceu. Para continuar usando, renove seu acesso.'}
            </p>
          </div>

          <div className="text-center py-2">
            <p className="text-gray-300 text-sm font-medium mb-1">Como ativar?</p>
            <p className="text-gray-500 text-xs">
              Envie o comprovante de pagamento via Pix e entre em contato pelo WhatsApp abaixo.
            </p>
          </div>

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            <MessageCircle size={18} />
            Falar com o administrador
          </a>

          <button
            onClick={handleCheck}
            disabled={checking || redirecting}
            className="flex items-center justify-center gap-2 w-full bg-dark-600 hover:bg-dark-500 border border-white/10 text-gray-300 font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
          >
            {checking || redirecting
              ? <><Loader2 size={16} className="animate-spin" /> Verificando...</>
              : <><RefreshCw size={16} /> Já paguei, verificar acesso</>
            }
          </button>

          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
          >
            <LogOut size={14} />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
