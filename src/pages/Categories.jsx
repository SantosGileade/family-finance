import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Loader2, X, Tag, Eye, EyeOff, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePlanGate } from '../contexts/PlanGateContext'
import {
  getUserCategories, addUserCategory, updateUserCategory, deleteUserCategory,
  updateHiddenCategories, getCategoryLimits, upsertCategoryLimit,
} from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import { DEFAULT_CATEGORIES, EMOJI_OPTIONS } from '../data/defaultCategories'

const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Modal de limite de gasto por categoria ──────────────────────────
function LimitModal({ category, currentLimit, onSave, onClose, income }) {
  const [type, setType]   = useState(currentLimit?.limit_type || 'none')
  const [value, setValue] = useState(
    currentLimit?.limit_type === 'value'
      ? String(Math.round((currentLimit?.limit_value || 0) * 100))
      : String(currentLimit?.limit_value || '')
  )
  const [saving, setSaving] = useState(false)

  const suggestion = income > 0 ? Math.round(income * 0.3) : null

  const handleSave = async () => {
    setSaving(true)
    const numVal = type === 'value' ? parseCurrency(value) : parseFloat(value) || 0
    await onSave(type, numVal)
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold">{category.emoji || '🏷️'} {category.label || category.name}</h2>
            <p className="text-gray-500 text-xs mt-0.5">Configurar limite de gastos</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        {/* Opções de tipo */}
        <div className="space-y-2 mb-5">
          {[
            { key: 'none',       label: 'Sem limite',            desc: 'Sem controle de gastos nessa categoria' },
            { key: 'value',      label: 'Definir valor',         desc: 'Limite em reais por mês'                },
            { key: 'percentage', label: 'Definir por porcentagem', desc: 'Percentual da renda mensal'           },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setType(opt.key)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                type === opt.key
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-dark-600 border-white/8 hover:border-white/20'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                type === opt.key ? 'border-emerald-400' : 'border-gray-600'
              }`}>
                {type === opt.key && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
              </div>
              <div>
                <p className={`text-sm font-medium ${type === opt.key ? 'text-emerald-300' : 'text-gray-300'}`}>
                  {opt.label}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Input de valor */}
        {type === 'value' && (
          <div className="mb-4">
            <label className="label">Valor limite (R$/mês)</label>
            <CurrencyInput
              className="input-field"
              value={value}
              onChange={setValue}
              placeholder="0,00"
              autoFocus
            />
            {suggestion && (
              <p className="text-gray-500 text-xs mt-1.5">
                💡 Sugestão: {formatBRL(suggestion)} (30% da sua renda)
              </p>
            )}
          </div>
        )}

        {/* Input de porcentagem */}
        {type === 'percentage' && (
          <div className="mb-4">
            <label className="label">Porcentagem da renda (%)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                className="input-field pr-8"
                placeholder="Ex: 20"
                value={value}
                onChange={e => setValue(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                autoFocus
                style={{ fontSize: 16 }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
            </div>
            {income > 0 && value && (
              <p className="text-gray-500 text-xs mt-1.5">
                = {formatBRL(income * (parseFloat(value) || 0) / 100)} por mês
              </p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              💡 Sugestão: 30% da renda
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || (type !== 'none' && !value)}
            className="btn-primary flex-1"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar limite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Label compacto do limite ─────────────────────────────────────────
function LimitBadge({ limit }) {
  if (!limit || limit.limit_type === 'none') return null
  const text = limit.limit_type === 'value'
    ? formatBRL(limit.limit_value)
    : `${limit.limit_value}% da renda`
  return (
    <span className="text-xs text-gray-500 mt-0.5">Limite: {text}</span>
  )
}

export default function Categories() {
  const { user, profile } = useAuth()
  const { check } = usePlanGate()

  const [hidden,  setHidden]  = useState([])
  const [custom,  setCustom]  = useState([])
  const [limits,  setLimits]  = useState({})   // { label: { limit_type, limit_value } }
  const [loading, setLoading] = useState(true)

  const [showCatModal,   setShowCatModal]   = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [editingItem,    setEditingItem]    = useState(null)
  const [limitTarget,    setLimitTarget]    = useState(null)  // categoria sendo editada no limit modal
  const [confirmId,      setConfirmId]      = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '📌' })

  useEffect(() => {
    if (profile?.hidden_categories) setHidden(profile.hidden_categories)
  }, [profile])

  const load = async () => {
    setLoading(true)
    const [catRes, limRes] = await Promise.all([
      getUserCategories(user.id),
      getCategoryLimits(user.id),
    ])
    setCustom(catRes.data || [])
    const limMap = {}
    ;(limRes.data || []).forEach(l => { limMap[l.category_label] = l })
    setLimits(limMap)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Atualiza quando QuickAdd ou outro componente adiciona um gasto
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('finance-updated', handler)
    return () => window.removeEventListener('finance-updated', handler)
  }, [])

  const toggleHide = async (label) => {
    const newHidden = hidden.includes(label)
      ? hidden.filter(h => h !== label)
      : [...hidden, label]
    setHidden(newHidden)
    await updateHiddenCategories(user.id, newHidden)
  }

  const openLimitModal = (cat) => {
    setLimitTarget(cat)
    setShowLimitModal(true)
  }

  const handleSaveLimit = async (type, value) => {
    if (!limitTarget) return
    const label = limitTarget.label || limitTarget.name
    await upsertCategoryLimit(user.id, label, type, value)
    setLimits(prev => ({ ...prev, [label]: { limit_type: type, limit_value: value } }))
  }

  const openAdd = () => {
    if (!check()) return
    setEditingItem(null)
    setForm({ name: '', emoji: '📌' })
    setShowCatModal(true)
  }

  const openEdit = (item) => {
    if (!check()) return
    setEditingItem(item)
    setForm({ name: item.name, emoji: item.emoji })
    setShowCatModal(true)
  }

  const handleSaveCat = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    if (editingItem) {
      const { data } = await updateUserCategory(editingItem.id, { name: form.name.trim(), emoji: form.emoji })
      if (data?.[0]) setCustom(prev => prev.map(c => c.id === editingItem.id ? data[0] : c))
    } else {
      const { data } = await addUserCategory({ user_id: user.id, name: form.name.trim(), emoji: form.emoji })
      if (data?.[0]) setCustom(prev => [...prev, data[0]])
    }
    setSaving(false)
    setShowCatModal(false)
    setEditingItem(null)
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
      <div>
        <h1 className="page-title">Categorias</h1>
        <p className="text-gray-500 text-sm">Personalize suas categorias de gastos</p>
      </div>

      {/* Categorias padrão */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-gray-400 text-sm font-medium">Categorias padrão</p>
            <span className="text-xs bg-dark-600 text-gray-500 px-2 py-0.5 rounded-full">{visibleCount} ativas</span>
          </div>
          {hidden.length > 0 && (
            <button onClick={() => { setHidden([]); updateHiddenCategories(user.id, []) }}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              Mostrar todas
            </button>
          )}
        </div>
        <p className="text-gray-600 text-xs mb-3">Toque numa categoria para definir limite. Toque no olho para ocultar.</p>

        <div className="space-y-1.5">
          {DEFAULT_CATEGORIES.map(cat => {
            const isHidden = hidden.includes(cat.label)
            const lim = limits[cat.label]
            return (
              <div key={cat.label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all ${
                isHidden ? 'bg-dark-800/40 border-white/4 opacity-50' : 'bg-dark-700 border-white/6'
              }`}>
                <button
                  onClick={() => !isHidden && openLimitModal(cat)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  disabled={isHidden}
                >
                  <span className={`text-lg ${isHidden ? 'grayscale' : ''}`}>{cat.emoji}</span>
                  <div className="flex flex-col min-w-0">
                    <p className={`text-sm font-medium ${isHidden ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                      {cat.label}
                    </p>
                    <LimitBadge limit={lim} />
                  </div>
                </button>
                {!isHidden && (
                  <ChevronRight size={14} className="text-gray-600 shrink-0"
                    onClick={() => openLimitModal(cat)} />
                )}
                <button onClick={() => toggleHide(cat.label)} title={isHidden ? 'Mostrar' : 'Ocultar'}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
                    isHidden ? 'text-gray-600 hover:text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/8'
                  }`}>
                  {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="h-px bg-white/6" />

      {/* Categorias personalizadas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-emerald-400" />
            <p className="text-gray-400 text-sm font-medium">Suas categorias</p>
            {custom.length > 0 && (
              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">{custom.length}</span>
            )}
          </div>
          <button onClick={openAdd} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300">
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
            <button onClick={openAdd} className="btn-primary mx-auto mt-4">
              <Plus size={16} /> Nova categoria
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {custom.map(cat => {
              const lim = limits[cat.name]
              return (
                <div key={cat.id} className="flex items-center gap-3 bg-dark-700 border border-white/6 rounded-xl px-3 py-2.5">
                  <button onClick={() => openLimitModal({ label: cat.name, emoji: cat.emoji, isCustom: true })}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="text-xl">{cat.emoji}</span>
                    <div className="flex flex-col min-w-0">
                      <p className="text-white text-sm font-medium">{cat.name}</p>
                      <LimitBadge limit={lim} />
                    </div>
                  </button>
                  <ChevronRight size={14} className="text-gray-600 shrink-0"
                    onClick={() => openLimitModal({ label: cat.name, emoji: cat.emoji })} />
                  <div className="flex gap-0.5">
                    <button onClick={() => openEdit(cat)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setConfirmId(cat.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
            <button onClick={openAdd} className="btn-primary w-full mt-2">
              <Plus size={18} /> Nova categoria
            </button>
          </div>
        )}
      </div>

      {/* Dialogs / Modals */}
      {confirmId && (
        <ConfirmDialog
          message="Essa categoria será removida permanentemente."
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {showLimitModal && limitTarget && (
        <LimitModal
          category={limitTarget}
          currentLimit={limits[limitTarget.label || limitTarget.name]}
          onSave={handleSaveLimit}
          onClose={() => { setShowLimitModal(false); setLimitTarget(null) }}
          income={profile?.monthly_income || 0}
        />
      )}

      {showCatModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCatModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">{editingItem ? 'Editar categoria' : 'Nova categoria'}</h2>
              <button onClick={() => setShowCatModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveCat} className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-dark-600 border-2 border-emerald-500/30 rounded-2xl flex items-center justify-center text-3xl shrink-0">
                  {form.emoji}
                </div>
                <div className="flex-1">
                  <label className="label">Nome</label>
                  <input className="input-field" placeholder="Ex: Academia, Pet..."
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    required autoFocus style={{ fontSize: 16 }} />
                </div>
              </div>
              <div>
                <label className="label mb-2">Ícone</label>
                <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto bg-dark-600 rounded-xl p-2">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button key={emoji} type="button" onClick={() => setForm({ ...form, emoji })}
                      className={`w-9 h-9 flex items-center justify-center text-xl rounded-lg transition-all ${
                        form.emoji === emoji ? 'bg-emerald-500/25 ring-2 ring-emerald-500/50 scale-110' : 'hover:bg-white/10'
                      }`}>{emoji}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCatModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary flex-1">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Plus size={16} /> {editingItem ? 'Salvar' : 'Criar'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
