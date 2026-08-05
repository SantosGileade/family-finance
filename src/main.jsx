import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'
import './lib/pwaInstall'
import { isSupabaseConfigured } from './lib/supabase'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn('Não foi possível registrar o service worker:', error)
    })
  })
}

const MissingConfiguration = () => (
  <div className="min-h-screen bg-dark-800 text-gray-100 flex items-center justify-center p-6">
    <div className="card max-w-lg w-full text-center">
      <div className="text-4xl mb-4">⚙️</div>
      <h1 className="text-xl font-bold text-white">Configuração local necessária</h1>
      <p className="text-gray-400 text-sm mt-3 leading-relaxed">
        Crie o arquivo <strong className="text-gray-200">.env</strong> na raiz do projeto e informe as variáveis
        <strong className="text-gray-200"> VITE_SUPABASE_URL</strong> e
        <strong className="text-gray-200"> VITE_SUPABASE_ANON_KEY</strong>.
      </p>
      <p className="text-gray-500 text-xs mt-4">
        Copie o arquivo .env.example, preencha os dados e reinicie o npm run dev.
      </p>
    </div>
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    ) : <MissingConfiguration />}
  </StrictMode>,
)
