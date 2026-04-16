import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ message = 'Tem certeza que deseja excluir?', onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 bg-red-500/15 rounded-2xl flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>

          <div>
            <p className="text-white font-semibold text-base">Excluir registro</p>
            <p className="text-gray-400 text-sm mt-1">{message}</p>
            <p className="text-gray-600 text-xs mt-1 italic">This action cannot be undone.</p>
          </div>

          <div className="flex gap-3 w-full pt-1">
            <button
              onClick={onCancel}
              className="btn-secondary flex-1"
            >
              Cancelar · Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2.5 rounded-xl
                         transition-all duration-200 flex items-center gap-2 justify-center active:scale-95"
            >
              Excluir · Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
