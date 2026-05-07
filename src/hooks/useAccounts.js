import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAccounts } from '../lib/supabase'

/**
 * Hook que carrega as contas do usuário.
 * Retorna:
 *   - accounts: lista de contas
 *   - principalAccount: conta marcada como principal (ou a primeira)
 *   - hasMultiple: true se o usuário tem mais de 1 conta
 *   - reload: função para recarregar
 */
export function useAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await getAccounts(user.id)
      if (!error) setAccounts(data || [])
      // Se a tabela não existir ainda, simplesmente fica com [] sem quebrar o app
    } catch {
      // Ignora silenciosamente — tabela accounts pode não existir ainda
    }
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])

  // Atualiza quando contas são adicionadas/removidas/editadas
  useEffect(() => {
    const h = () => reload()
    window.addEventListener('accounts-updated', h)
    return () => window.removeEventListener('accounts-updated', h)
  }, [reload])

  const principalAccount = accounts.find(a => a.is_principal) || accounts[0] || null
  // hasMultiple só é true com 2+ contas — com 0 ou 1, o app funciona igual ao original
  // Transações sem account_id pertencem implicitamente à conta principal
  const hasMultiple      = accounts.length > 1

  return { accounts, principalAccount, hasMultiple, loading, reload }
}
