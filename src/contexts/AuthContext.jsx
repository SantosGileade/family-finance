import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // loadProfile com timeout de 6s — evita travar quando rede está lenta (ex: tab voltando do sleep)
  const loadProfile = async (authUser) => {
    if (!authUser) {
      setProfile(null)
      return null
    }
    try {
      const result = await Promise.race([
        getProfile(authUser.id),
        new Promise(resolve => setTimeout(() => resolve({ data: null }), 6000))
      ])
      if (result?.data) setProfile(result.data)
      return result?.data ?? null
    } catch {
      return null
    }
  }

  const refreshProfile = async () => {
    if (!user) return null
    const { data } = await getProfile(user.id)
    if (data) setProfile(data)
    return data
  }

  useEffect(() => {
    // Safety net: se depois de 10s loading ainda estiver true, força false
    const safetyTimer = setTimeout(() => setLoading(false), 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      clearTimeout(safetyTimer)
      const u = session?.user ?? null
      setUser(u)

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (u) {
          setLoading(true) // mantém loading enquanto busca o profile (evita flash em /expired)
          await loadProfile(u)
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Aba voltando do sleep — token foi renovado, profile já está em memória
        // NÃO chama loadProfile de novo para evitar hang com rede lenta
        // só garante que o user está atualizado
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
      }

      // Sempre para o loading independente do tipo de evento
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimer)
    }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const isPlanActive = Boolean(
    profile?.is_admin ||
    (profile?.plano_ativo && profile?.data_expiracao && new Date(profile.data_expiracao) > new Date())
  )

  const isAdmin = profile?.is_admin === true

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isPlanActive, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
