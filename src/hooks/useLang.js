import { useAuth } from '../contexts/AuthContext'

/**
 * Retorna uma função t() que:
 * - Para admin: retorna o texto completo (PT · EN)
 * - Para usuários comuns: retorna apenas a parte portuguesa (antes do ' · ')
 *
 * Uso: const t = useLang()
 *      t("Renda · Income")  →  admin: "Renda · Income"  |  user: "Renda"
 */
export const useLang = () => {
  const { isAdmin } = useAuth()

  return (str) => {
    if (isAdmin || typeof str !== 'string') return str
    const sep = str.indexOf(' · ')
    return sep === -1 ? str : str.slice(0, sep)
  }
}
