import { useEffect, useState } from 'react'
import { CheckCircle, Download, MoreVertical, Share, X } from 'lucide-react'
import { clearInstallPrompt, getInstallPrompt } from '../lib/pwaInstall'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const getDevice = () => {
  const ua = navigator.userAgent || ''
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/i.test(ua)
  const safari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)
  return { ios, android, safari }
}

export default function InstallApp() {
  const [installed, setInstalled] = useState(isStandalone())
  const [canPrompt, setCanPrompt] = useState(Boolean(getInstallPrompt()))
  const [showHelp, setShowHelp] = useState(false)
  const [prompting, setPrompting] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const update = () => {
      setInstalled(isStandalone())
      setCanPrompt(Boolean(getInstallPrompt()))
    }
    window.addEventListener('pwa-install-change', update)
    media.addEventListener?.('change', update)
    return () => {
      window.removeEventListener('pwa-install-change', update)
      media.removeEventListener?.('change', update)
    }
  }, [])

  if (installed) return null

  const handleInstall = async () => {
    const prompt = getInstallPrompt()
    if (!prompt) {
      setShowHelp(true)
      return
    }
    setPrompting(true)
    await prompt.prompt()
    const choice = await prompt.userChoice
    clearInstallPrompt()
    setPrompting(false)
    if (choice.outcome !== 'accepted') setShowHelp(true)
  }

  const device = getDevice()

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        disabled={prompting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] transition-all text-sm font-semibold"
      >
        <Download size={17} />
        {prompting ? 'Abrindo instalação...' : 'Instalar no celular'}
      </button>

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-white font-semibold text-lg">Instalar o aplicativo</h2>
                <p className="text-gray-400 text-sm mt-1">É rápido e não ocupa espaço como um app comum.</p>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} className="w-8 h-8 rounded-full bg-dark-600 text-gray-400 flex items-center justify-center" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            {device.ios ? (
              <div className="space-y-3">
                {!device.safari && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-amber-300 text-sm">
                    Primeiro, abra esta página no <strong>Safari</strong>.
                  </div>
                )}
                <Step number="1" icon={<Share size={18} />} text="No Safari, toque no botão Compartilhar." />
                <Step number="2" text="Role as opções e toque em “Adicionar à Tela de Início”." />
                <Step number="3" icon={<CheckCircle size={18} />} text="Ative “Abrir como App da Web” e toque em Adicionar." />
              </div>
            ) : (
              <div className="space-y-3">
                <Step number="1" icon={<MoreVertical size={18} />} text="Abra esta página no Google Chrome e toque nos três pontinhos." />
                <Step number="2" text="Toque em “Instalar app” ou “Adicionar à tela inicial”." />
                <Step number="3" icon={<CheckCircle size={18} />} text="Confirme em Instalar ou Adicionar." />
                {!device.android && !canPrompt && (
                  <p className="text-gray-500 text-xs pt-1">No computador, procure o ícone de instalação no lado direito da barra de endereço.</p>
                )}
              </div>
            )}

            <button type="button" onClick={() => setShowHelp(false)} className="btn-primary w-full mt-5">Entendi</button>
          </div>
        </div>
      )}
    </>
  )
}

function Step({ number, icon, text }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-dark-600/70 border border-white/5 p-3">
      <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-sm">{icon || number}</div>
      <p className="text-gray-200 text-sm leading-relaxed">{text}</p>
    </div>
  )
}
