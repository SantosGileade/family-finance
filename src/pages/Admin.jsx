import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAllProfiles, updateUserPlan } from '../lib/supabase'
import { format, addDays, isPast, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Users, CheckCircle, XCircle, Clock, Shield,
  ArrowLeft, Loader2, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'

const PlanBadge = ({ profile }) => {
  if (profile.is_admin) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">Admin</span>
  }
  if (!profile.plano_ativo || !profile.data_expiracao) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">Inativo</span>
  }
  if (isPast(new Date(profile.data_expiracao))) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">Expirado</span>
  }
  const daysLeft = differenceInDays(new Date(profile.data_expiracao), new Date())
  if (daysLeft <= 7) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Expira em {daysLeft}d</span>
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Ativo · {daysLeft}d</span>
}

const UserRow = ({ profile, onUpdate }) => {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedDays, setSelectedDays] = useState(null)   // dias selecionados mas não salvos
  const [dateInput, setDateInput] = useState(
    profile.data_expiracao ? format(new Date(profile.data_expiracao), 'yyyy-MM-dd') : ''
  )
  const [dateSaved, setDateSaved] = useState(false)        // feedback "data aplicada"

  const displayName = profile.email || profile.name || `${profile.id.substring(0, 8)}...`

  // Confirma a seleção de dias e salva
  const confirmActivate = async () => {
    if (!selectedDays) return
    setLoading(true)
    const base = profile.data_expiracao && !isPast(new Date(profile.data_expiracao))
      ? new Date(profile.data_expiracao)
      : new Date()
    const newDate = addDays(base, selectedDays)
    const { error } = await updateUserPlan(profile.id, {
      plano_ativo: true,
      data_expiracao: newDate.toISOString()
    })
    if (!error) {
      onUpdate({ ...profile, plano_ativo: true, data_expiracao: newDate.toISOString() })
      setDateInput(format(newDate, 'yyyy-MM-dd'))
      setSelectedDays(null)
    }
    setLoading(false)
  }

  const deactivate = async () => {
    setLoading(true)
    const { error } = await updateUserPlan(profile.id, { plano_ativo: false })
    if (!error) {
      onUpdate({ ...profile, plano_ativo: false })
      setSelectedDays(null)
    }
    setLoading(false)
  }

  const applyDate = async () => {
    if (!dateInput) return
    setLoading(true)
    const newDate = new Date(dateInput + 'T23:59:59').toISOString()
    const { error } = await updateUserPlan(profile.id, {
      plano_ativo: true,
      data_expiracao: newDate
    })
    if (!error) {
      onUpdate({ ...profile, plano_ativo: true, data_expiracao: newDate })
      setDateSaved(true)
      setTimeout(() => setDateSaved(false), 2500)
    }
    setLoading(false)
  }

  return (
    <div className="bg-dark-700 border border-white/8 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/4 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-dark-600 rounded-full flex items-center justify-center text-sm font-medium text-gray-300 shrink-0">
            {(profile.email || profile.name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{displayName}</p>
            {profile.data_expiracao && (
              <p className="text-gray-500 text-xs">
                Expira: {format(new Date(profile.data_expiracao), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <PlanBadge profile={profile} />
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </div>

      {expanded && !profile.is_admin && (
        <div className="px-4 pb-4 border-t border-white/6 pt-3 space-y-3">

          {/* Seleção de dias — só seleciona, não salva */}
          <div>
            <p className="text-gray-500 text-xs mb-1.5">Selecione o período:</p>
            <div className="flex gap-2">
              {[30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDays(prev => prev === d ? null : d)}
                  disabled={loading}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-all disabled:opacity-50 ${
                    selectedDays === d
                      ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 font-semibold'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {selectedDays === d ? `✓ +${d} dias` : `+${d} dias`}
                </button>
              ))}
            </div>
          </div>

          {/* Botão confirmar ativação */}
          <button
            onClick={confirmActivate}
            disabled={loading || !selectedDays}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-sm rounded-lg border transition-colors disabled:opacity-40
              bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
              : <><CheckCircle size={14} /> {selectedDays ? `Ativar +${selectedDays} dias` : 'Selecione um período acima'}</>
            }
          </button>

          {/* Separador */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-gray-600 text-xs">ou data específica</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Data personalizada */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateInput}
              onChange={(e) => { setDateInput(e.target.value); setDateSaved(false) }}
              className="flex-1 bg-dark-600 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={applyDate}
              disabled={loading || !dateInput}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                dateSaved
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-dark-600 hover:bg-dark-500 border-white/10 text-gray-300'
              }`}
            >
              {dateSaved ? '✓ Aplicado' : 'Aplicar'}
            </button>
          </div>

          {/* Desativar plano (só se ativo) */}
          {profile.plano_ativo && (
            <button
              onClick={deactivate}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm rounded-lg border transition-colors disabled:opacity-50
                bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                : <><XCircle size={14} /> Desativar plano</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getAllProfiles()
      setProfiles(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleUpdate = (updated) => {
    setProfiles(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
  }

  const now = new Date()
  const nonAdmins = profiles.filter(p => !p.is_admin)
  const stats = {
    total: nonAdmins.length,
    active: nonAdmins.filter(p => p.plano_ativo && p.data_expiracao && new Date(p.data_expiracao) > now).length,
    inactive: nonAdmins.filter(p => !p.plano_ativo || !p.data_expiracao || new Date(p.data_expiracao) <= now).length,
}


  const filtered = profiles.filter(p => {
    if (filter === 'active') return p.plano_ativo && p.data_expiracao && new Date(p.data_expiracao) > now
    if (filter === 'inactive') return !p.plano_ativo || !p.data_expiracao || new Date(p.data_expiracao) <= now
    return true
  })

  return (
    <div className="min-h-screen bg-dark-800">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/15 border border-purple-500/30 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Painel Admin</h1>
              <p className="text-gray-500 text-xs">Gestão de usuários e planos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar ao app
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-dark-700 border border-white/8 rounded-xl p-3 text-center">
            <Users size={16} className="text-gray-500 mx-auto mb-1" />
            <p className="text-white font-bold text-xl">{stats.total}</p>
            <p className="text-gray-500 text-xs">Total</p>
          </div>
          <div className="bg-dark-700 border border-white/8 rounded-xl p-3 text-center">
            <CheckCircle size={16} className="text-emerald-400 mx-auto mb-1" />
            <p className="text-emerald-400 font-bold text-xl">{stats.active}</p>
            <p className="text-gray-500 text-xs">Ativos</p>
          </div>
          <div className="bg-dark-700 border border-white/8 rounded-xl p-3 text-center">
            <XCircle size={16} className="text-red-400 mx-auto mb-1" />
            <p className="text-red-400 font-bold text-xl">{stats.inactive}</p>
            <p className="text-gray-500 text-xs">Inativos</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-dark-700 p-1 rounded-xl mb-4">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'active', label: 'Ativos' },
            { key: 'inactive', label: 'Inativos' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === tab.key
                  ? 'bg-dark-600 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* User list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={20} className="animate-spin text-emerald-500" />
            <span className="text-gray-400 text-sm">Carregando usuários...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <UserRow key={p.id} profile={p} onUpdate={handleUpdate} />
            ))}
          </div>
        )}

        <p className="text-center text-gray-600 text-xs mt-6">
          Para criar usuários, peça para eles se cadastrarem pelo app. Depois ative o plano aqui.
        </p>
      </div>
    </div>
  )
}
