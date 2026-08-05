import { useState, useEffect } from 'react'
import BackButton from '../components/BackButton'
import { Plus, Pencil, Trash2, Loader2, X, Tag, Eye, EyeOff, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePlanGate } from '../contexts/PlanGateContext'
import {
  getUserCategories, addUserCategory, updateUserCategory, deleteUserCategory,
  updateHiddenCategories, getCategoryLimits, upsertCategoryLimit, getIncome,
} from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import CurrencyInput, { parseCurrency } from '../components/CurrencyInput'
import { DEFAULT_CATEGORIES, EMOJI_OPTIONS } from '../data/defaultCategories'

const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Modal de limite de gasto por categoria ──────────────────────────
function LimitModal({ category, currentLimit, onSave, onClose, income }) {
  // Inicializa com o valor atual (qualquer tipo anterior vira 'value')
  const initValue = currentLimit?.limit_type === 'value'
    ? String(Math.round((currentLimit?.limit_value || 0) * 100))
    : currentLimit?.limit_type === 'percentage' && income > 0
      ? String(Math.round(income * (currentLimit.limit_value || 0) / 100 * 100))
      : ''

  const [value,   setValue]   = useState(initValue)
  const [hasLimit, setHasLimit] = useState(
    !!currentLimit && currentLimit.limit_type !== 'none'
  )
  const [saving, setSaving] = useState(false)

  const numVal = parseCurrency(value)
  const pctOfIncome = income > 0 && numVal > 0
    ? ((numVal / income) * 100).toFixed(1)
    : null

  const handleSave = async () => {
    setSaving(true)
    if (!hasLimit) {
      await onSave('none', 0)
    } else {
      await onSave('value', numVal)
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold">{category.emoji || '🏷️'} {category.label || category.name}</h2>
            <p className="text-gray-500 text-xs mt-0.5">Limite de gastos mensais</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        {/* Toggle: com ou sem limite */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setHasLimit(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
              !hasLimit ? 'bg-dark-500 border-white/20 text-white' : 'bg-dark-600 border-white/8 text-gray-400'
            }`}
          >
            Sem limite
          </button>
          <button
            onClick={() => { setHasLimit(true) }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
              hasLimit ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-dark-600 border-white/8 text-gray-400'
            }`}
          >
            Definir limite
          </button>
        </div>

        {/* Campo de valor */}
        {hasLimit && (
          <div className="mb-5">
            <label className="label">Valor limite por mês (R$)</label>
            <CurrencyInput
              className="input-field text-lg font-semibold"
              value={value}
              onChange={setValue}
              placeholder="0,00"
              autoFocus
            />
            {/* Porcentagem calculada automaticamente */}
            {pctOfIncome && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-emerald-400 text-xs font-medium">≈ {pctOfIncome}%</span>
                <span className="text-gray-500 text-xs">da sua renda deste mês</span>
              </div>
            )}
            {!pctOfIncome && income === 0 && (
              <p className="text-gray-600 text-xs mt-1.5">
                Adicione sua renda para ver a porcentagem
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || (hasLimit && !numVal)}
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
  const { user, profile, refreshProfile } = useAuth()
  const { check } = usePlanGate()

  const [hidden,       setHidden]       = useState([])
  const [custom,       setCustom]       = useState([])
  const [limits,       setLimits]       = useState({})
  const [monthIncome,  setMonthIncome]  = useState(0)
  const [loading,      setLoading]      = useState(true)

  const [showCatModal,   setShowCatModal]   = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [editingItem,    setEditingItem]    = useState(null)
  const [limitTarget,    setLimitTarget]    = useState(null)  // categoria sendo editada no limit modal
  const [confirmId,      setConfirmId]      = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '📌', limitValue: '' })

  useEffect(() => {
    if (profile?.hidden_categories) setHidden(profile.hidden_categories)
  }, [profile])

  const load = async () => {
    setLoading(true)
    const now = new Date()
    const [catRes, limRes, incRes] = await Promise.all([
      getUserCategories(user.id),
      getCategoryLimits(user.id),
      getIncome(user.id, now.getMonth() + 1, now.getFullYear()),
    ])
    setCustom(catRes.data || [])
    const limMap = {}
    ;(limRes.data || []).forEach(l => { limMap[l.category_label] = l })
    setLimits(limMap)
    const totalInc = (incRes.data || []).reduce((s, i) => s + Number(i.amount), 0)
    setMonthIncome(totalInc)
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
    const previousHidden = hidden
    const newHidden = hidden.includes(label)
      ? hidden.filter(h => h !== label)
      : [...hidden, label]
    setHidden(newHidden)
    const { error } = await updateHiddenCategories(user.id, newHidden)
    if (error) {
      setHidden(previousHidden)
      console.error('Erro ao salvar categorias ocultas:', error)
      return
    }
    await refreshProfile()
  }

  const showAll = async () => {
    const previousHidden = hidden
    setHidden([])
    const { error } = await updateHiddenCategories(user.id, [])
    if (error) {
      setHidden(previousHidden)
      console.error('Erro ao mostrar todas as categorias:', error)
      return
    }
    await refreshProfile()
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
    setForm({ name: '', emoji: '📌', limitValue: '' })
    setShowCatModal(true)
  }

  const openEdit = (item) => {
    if (!check()) return
    setEditingItem(item)
    // Pré-preenche o limite se existir
    const existingLimit = limits[item.name]
    const preLimit = existingLimit?.limit_type === 'value'
      ? String(Math.round((existingLimit.limit_value || 0) * 100))
      : ''
    setForm({ name: item.name, emoji: item.emoji, limitValue: preLimit })
    setShowCatModal(true)
  }

  const handleSaveCat = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    let savedId = editingItem?.id

    if (editingItem) {
      const { data } = await updateUserCategory(editingItem.id, { name: form.name.trim(), emoji: form.emoji })
      if (data?.[0]) setCustom(prev => prev.map(c => c.id === editingItem.id ? data[0] : c))
    } else {
      const { data } = await addUserCategory({ user_id: user.id, name: form.name.trim(), emoji: form.emoji })
      if (data?.[0]) {
        setCustom(prev => [...prev, data[0]])
        savedId = data[0].id
      }
    }

    // Salva o limite se foi definido
    const limitVal = parseCurrency(form.limitValue)
    const catLabel = form.name.trim()
    if (limitVal > 0) {
      await upsertCategoryLimit(user.id, catLabel, 'value', limitVal)
      setLimits(prev => ({ ...prev, [catLabel]: { limit_type: 'value', limit_value: limitVal } }))
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
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="page-title">Categorias</h1>
      </div>

      {/* Categorias padrão */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-gray-400 text-sm font-medium">Categorias padrão</p>
            <span className="text-xs bg-dark-600 text-gray-500 px-2 py-0.5 rounded-full">{visibleCount} ativas</span>
          </div>
          {hidden.length > 0 && (
            <button onClick={showAll}
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
          income={monthIncome}
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
              {/* Limite mensal — opcional, discreto */}
              <div className="border-t border-white/6 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-500 text-xs">Limite mensal <span className="text-gray-600">(opcional)</span></p>
                  {form.limitValue && parseCurrency(form.limitValue) > 0 && monthIncome > 0 && (
                    <span className="text-emerald-400 text-xs">
                      ≈ {((parseCurrency(form.limitValue) / monthIncome) * 100).toFixed(1)}% da renda
                    </span>
                  )}
                </div>
                <CurrencyInput
                  className="w-full bg-dark-600/60 border border-white/8 rounded-xl px-3 py-2
                             text-white text-sm placeholder-gray-600
                             focus:outline-none focus:border-emerald-500/40 transition-all"
                  value={form.limitValue}
                  onChange={v => setForm({ ...form, limitValue: v })}
                  placeholder="Sem limite"
                />
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
