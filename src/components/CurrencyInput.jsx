// Componente de input que aceita vírgula e ponto como separador decimal
// Funciona tanto no celular (teclado numérico) quanto no desktop
// Ex: 44,90 → 44.90 / 4,14 → 4.14 / 19,90 → 19.90

export default function CurrencyInput({ value, onChange, placeholder = '0,00', className = '', required = false, autoFocus = false }) {

  const handleChange = (e) => {
    let raw = e.target.value
    // Permite só números, vírgula e ponto
    raw = raw.replace(/[^0-9.,]/g, '')
    // Troca vírgula por ponto (padrão JS)
    raw = raw.replace(',', '.')
    // Evita dois pontos
    const parts = raw.split('.')
    if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('')
    onChange(raw)
  }

  const handleBlur = (e) => {
    // Formata ao sair do campo
    const num = parseFloat(e.target.value)
    if (!isNaN(num)) onChange(num.toFixed(2))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      required={required}
      autoFocus={autoFocus}
    />
  )
}

// Helper: converte string (com vírgula ou ponto) para número
export const parseCurrency = (str) => {
  if (!str) return 0
  const normalized = String(str).replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}
