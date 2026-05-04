import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center justify-center w-8 h-8 rounded-xl
                 bg-dark-700 border border-white/8 text-gray-400
                 hover:text-white hover:bg-dark-600 transition-all
                 active:scale-95 shrink-0"
      aria-label="Voltar"
    >
      <ChevronLeft size={18} />
    </button>
  )
}
