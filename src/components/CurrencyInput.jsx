/**
 * Máscara de valor monetário — padrão app bancário brasileiro:
 *
 *   Digite "1"      → "0,01"
 *   Digite "15"     → "0,15"
 *   Digite "150"    → "1,50"
 *   Digite "1500"   → "15,00"   ← quinze reais
 *   Digite "15000"  → "150,00"
 *   Digite "150000" → "1.500,00"
 *
 * O valor no estado é sempre a string de dígitos (ex: "1500").
 * Use parseCurrency("1500") → 15.00 para salvar no banco.
 */

const formatMask = (digits) => {
  if (!digits || digits === '0') return ''
  const num = parseInt(digits, 10)
  if (isNaN(num) || num === 0) return ''
  return (num / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  required = false,
  autoFocus = false,
}) {
  const handleChange = (e) => {
    // Mantém apenas dígitos, sem zeros à esquerda
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '')
    onChange(digits)
  }

  const handleFocus = (e) => {
    // Rola o campo para ficar visível acima do teclado virtual no mobile
    setTimeout(() => {
      e.target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatMask(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={className}
      required={required}
      autoFocus={autoFocus}
      style={{ fontSize: 16 }} // evita zoom no iOS
    />
  )
}

/**
 * Converte dígitos brutos ("1500") ou string formatada para número.
 * "1500"      → 15.00
 * "150000"    → 1500.00
 * "1.500,00"  → 1500.00   (string formatada de volta ao número)
 */
export const parseCurrency = (str) => {
  if (!str) return 0
  const s = String(str).trim()
  // Se já estiver formatado ("1.500,00"), converte normalmente
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  // Dígitos brutos → divide por 100
  const digits = s.replace(/\D/g, '')
  if (!digits) return 0
  return parseInt(digits, 10) / 100
}
