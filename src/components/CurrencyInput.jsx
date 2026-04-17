// Máscara de dinheiro: digita apenas números, formata automaticamente
// Ex: digitar "4490" exibe "44,90" | "1234567" exibe "12.345,67"

function formatMask(digits) {
  if (!digits) return ''
  const num = parseInt(digits, 10)
  if (isNaN(num) || num === 0) return ''
  return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CurrencyInput({ value, onChange, placeholder = 'R$ 0,00', className = '', required = false, autoFocus = false }) {
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '')
    onChange(digits)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatMask(value)}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      required={required}
      autoFocus={autoFocus}
    />
  )
}

// Converte dígitos brutos ("4490") ou string formatada para número (44.90)
export const parseCurrency = (str) => {
  if (!str) return 0
  const digits = String(str).replace(/\D/g, '')
  if (!digits) return 0
  return parseInt(digits, 10) / 100
}
