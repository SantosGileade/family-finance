/**
 * Campo de valor monetário com formatação automática:
 * - Enquanto digita: mostra o que o usuário digitou ("1500")
 * - Ao sair do campo (blur): formata para "1.500,00"
 * - Ao entrar no campo (focus): seleciona tudo para facilitar edição
 *
 * Exemplos:
 *   digitar "1500"     → blur → "1.500,00"
 *   digitar "15,5"     → blur → "15,50"
 *   digitar "1500,50"  → blur → "1.500,50"
 */

/**
 * Converte string digitada pelo usuário em número float.
 * "1500"      → 1500.00
 * "1.500,00"  → 1500.00
 * "15,50"     → 15.50
 * "15.50"     → 15.50
 */
export const parseCurrency = (str) => {
  if (!str) return 0
  const s = String(str).trim()
  // Tem ponto E vírgula → ponto=milhar, vírgula=decimal
  if (s.includes('.') && s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  // Só vírgula → decimal brasileiro (ex: "15,50")
  if (s.includes(',')) {
    return parseFloat(s.replace(',', '.')) || 0
  }
  // Só dígitos ou ponto decimal (ex: "1500" ou "15.50")
  return parseFloat(s) || 0
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
    // Permite apenas dígitos, vírgula e ponto enquanto digita
    const raw = e.target.value.replace(/[^\d.,]/g, '')
    onChange(raw)
  }

  const handleBlur = () => {
    // Ao sair do campo, formata para "1.500,00"
    const val = parseCurrency(value)
    if (val > 0) {
      onChange(
        val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      )
    }
  }

  const handleFocus = (e) => {
    // Ao entrar, seleciona tudo para facilitar redigitar
    e.target.select()
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={className}
      required={required}
      autoFocus={autoFocus}
      style={{ fontSize: 16 }} // evita zoom automático no iOS
    />
  )
}
