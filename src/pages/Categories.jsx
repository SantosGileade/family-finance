import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Loader2, X, Tag, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePlanGate } from '../contexts/PlanGateContext'
import {
  getUserCategories, addUserCategory,
  updateUserCategory, deleteUserCategory,
  updateHiddenCategories,
} from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import { DEFAULT_CATEGORIES, EMOJI_OPTIONS } from '../data/defaultCategories'

export default function Categories() {
  const { user, profile, refreshProfile } = useAuth()
  const { check } = usePlanGate()

  const [hidden, setHidden] = useState([])         // labels das categorias ocultas
  const [custom, setCustom] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '📌' })

  // Carrega estado inicial a partir do profile
  useEffect(() => {
    if (profile?.hidden_categories) {
      setHidden(profile.hidden_categories)
    }
  }, [profile])

  const load = async () => {
    setLoading(true)
    const { data } = await getUserCategories(user.id)
    setCustom(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Toggle ocultar/mostrar categoria padrão
  const toggleHide = async (label) => {
    const newHidden = hidden.includes(label)
      ? hidden.filter(h => h !== label)
      : [...hidden, label]
    setHidden(newHidden)
    await updateHiddenCategories(user.id, newHidden)
    await refreshProfile()
  }

  const openAdd = () => {
    if (!check()) return
    setEditingItem(null)
    setForm({ name: '', emoji: '📌' })
    setShowModal(true)
  }

  const openEdit = (item) => {
    if (!check()) return
    setEditingItem(item)
    setForm({ name: item.name, emoji: item.emoji })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setForm({ name: '', emoji: '📌' })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    if (editingItem) {
      const { data } = await updateUserCategory(editingItem.id, {
        name: form.name.trim(), emoji: form.emoji,
      })
      if (data?.[0]) setCustom(prev => prev.map(c => c.id === editingItem.id ? data[0] : c))
    } else {
      const { data } = await addUserCategory({
        user_id: user.id, name: form.name.trim(), emoji: form.emoji,
      })
      if (data?.[0]) setCustom(prev => [...prev, data[0]])
    }
    setSaving(false)
    closeModal()
  }

  const handleDelete = async () => {
    if (!confirmId) return
    await deleteUserCategory(confirmId)
    setCustom(prev => prev.filter(c => c.id !== confirmId))
    setConfirmId(null)
  }

  const visibleCount = DEFAULT_CATEGORIES.length - hidden.length

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Categorias 🏷️</h1>
        <p className="text-gray-500 text-sm">Personalize as categorias do seu app</p>
      </div>

      {/* Categorias padrão com toggle */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-gray-400 text-sm font-medium">Categorias padrão</p>
            <span className="text-xs bg-dark-600 text-gray-500 px-2 py-0.5 rounded-full">
              {visibleCount} ativas
            </span>
          </div>
          {hidden.length > 0 && (
            <button
              onClick={() => { setHidden([]); updateHiddenCategories(user.id, []).then(() => refreshProfile()) }}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Mostrar todas
            </button>
          )}
        </div>

        <p className="text-gray-600 text-xs mb-3">
          Toque no olho para ocultar categorias que você não usa. Elas continuam no sistema, mas não aparecem nos seus gastos.
        </p>

        <div className="space-y-2">
          {DEFAULT_CATEGORIES.map(cat => {
            const isHidden = hidden.includes(cat.label)
            return (
              <div
                key={cat.label}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                  isHidden
                    ? 'bg-dark-800/50 border-white/4 opacity-50'
                    : 'bg-dark-700 border-white/6'
                }`}
              >
                <span className={`text-xl ${isHidden ? 'grayscale' : ''}`}>{cat.emoji}</span>
                <p className={`flex-1 text-sm font-medium ${isHidden ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                  {cat.label}
                </p>
                <button
                  onClick={() => toggleHide(cat.label)}
                  title={isHidden ? 'Mostrar' : 'Ocultar'}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    isHidden
                      ? 'text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
                  }`}
                >
                  {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Divisor */}
      <div className="h-px bg-white/6" />

      {/* Categorias personalizadas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-emerald-400" />
            <p className="text-gray-400 text-sm font-medium">Suas categorias</p>
            {custom.length > 0 && (
              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">
                {custom.length}
              </span>
            )}
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus size={14} /> Nova
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : custom.length === 0 ? (
          <div className="card text-center py-8 border border-dashed border-white/10">
            <Tag size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Nenhuma categoria personalizada</p>
            <p className="text-gray-600 text-xs mt-1">Ex: Academia, Pet, Escola...</p>
            <button onClick={openAdd} className="btn-primary mx-auto mt-4">
              <Plus size={16} /> Nova categoria
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {custom.map(cat => (
              <div key={cat.id}
                className="flex items-center gap-3 bg-dark-700 border border-white/6 rounded-xl px-4 py-3">
                <span className="text-2xl">{cat.emoji}</span>
                <p className="flex-1 text-white text-sm font-medium">{cat.name}</p>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(cat)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setConfirmId(cat.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={openAdd} className="btn-primary w-full mt-2">
              <Plus size={18} /> Nova categoria
            </button>
          </div>
        )}
      </div>

      {/* ConfirmDialog */}
      {confirmId && (
        <ConfirmDialog
          message="Essa categoria será removida. Os gastos já registrados não serão afetados."
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Modal criar/editar */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">
                {editingItem ? 'Editar categoria' : 'Nova categoria'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-dark-600 border-2 border-emerald-500/30 rounded-2xl flex items-center justify-center text-3xl shrink-0">
                  {form.emoji}
                </div>
                <div className="flex-1">
                  <label className="label">Nome da categoria</label>
                  <input
                    className="input-field"
                    placeholder="Ex: Academia, Pet, Escola..."
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required autoFocus style={{ fontSize: 16 }}
                  />
                </div>
              </div>

              <div>
                <label className="label mb-2">Escolha um ícone</label>
                <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto bg-dark-600 rounded-xl p-2">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button key={emoji} type="button" onClick={() => setForm({ ...form, emoji })}
                      className={`w-9 h-9 flex items-center justify-center text-xl rounded-lg transition-all ${
                        form.emoji === emoji
                          ? 'bg-emerald-500/25 ring-2 ring-emerald-500/50 scale-110'
                          : 'hover:bg-white/10'
                      }`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary flex-1">
                  {saving
                    ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                    : <><Plus size={16} /> {editingItem ? 'Salvar' : 'Criar'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
