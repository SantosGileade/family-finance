import { useState, useRef } from 'react'
import BackButton from '../components/BackButton'
import { Upload, FileText, ChevronRight, ChevronLeft, Check, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { addIncome, addExpense } from '../lib/supabase'
import { format } from 'date-fns'

const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── CSV Parsers ───────────────────────────────────────────────────────────────

function parseCSVText(text) {
  text = text.replace(/^\uFEFF/, '')
  const lines = text.split('\n').filter(l => l.trim())
  // Usa TODAS as linhas para detectar o delimitador (primeira linha pode não ter)
  const maxSemis = Math.max(...lines.map(l => (l.match(/;/g) || []).length))
  const maxCommas = Math.max(...lines.map(l => (l.match(/,/g) || []).length))
  const maxTabs = Math.max(...lines.map(l => (l.match(/\t/g) || []).length))
  const delimiter = maxTabs > maxSemis && maxTabs > maxCommas ? '\t'
                  : maxSemis > maxCommas ? ';'
                  : ','
  return lines.map(l => parseLine(l, delimiter))
}

function parseLine(line, delimiter) {
  const result = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') inQ = !inQ
    else if (ch === delimiter && !inQ) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim().replace(/\r$/, ''))
  return result
}

function parseAmount(str) {
  if (!str || str === '0.00' || str === '0,00') return 0
  const isNeg = str.includes('-') || (str.startsWith('(') && str.endsWith(')'))
  let clean = str.replace(/[^0-9,.]/g, '')
  if (!clean) return 0
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (clean.includes(',')) {
    const parts = clean.split(',')
    clean = parts[parts.length - 1].length <= 2 ? clean.replace(',', '.') : clean.replace(/,/g, '')
  }
  const num = parseFloat(clean)
  if (isNaN(num)) return 0
  return isNeg ? -Math.abs(num) : num
}

function parseDate(str) {
  if (!str) return null
  str = str.trim()
  let m
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  m = str.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

// Encontra a linha onde os dados realmente começam (pula cabeçalhos de banco)
function findDataStart(rows) {
  for (let i = 0; i < Math.min(rows.length - 1, 20); i++) {
    const next = rows[i + 1]
    if (next && next[0] && parseDate(next[0])) return i
  }
  return 0
}

// Remove acentos para comparação robusta (ex: "saída" → "saida")
function sem(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Detecta o modo de valor: 'dual' (entrada/saída separadas), 'credit' (positivo=despesa, Nubank), 'single' (negativo=despesa)
function detectAmountMode(headerRow) {
  if (!headerRow) return 'single'
  const h = headerRow.map(c => sem(c))
  const hasEntrada = h.some(c => c.includes('entrada') || c.includes('cred'))
  const hasSaida = h.some(c => c.includes('saida') || c.includes('deb'))
  if (hasEntrada && hasSaida) return 'dual'
  // Nubank crédito: colunas 'date', 'title', 'amount'
  const hasTitle = h.some(c => c === 'title')
  const hasAmount = h.some(c => c === 'amount')
  if (hasTitle && hasAmount) return 'credit'
  return 'single'
}

function autoDetectCols(rows, headerIdx) {
  const header = rows[headerIdx] || []
  const samples = rows.slice(headerIdx + 1, headerIdx + 6)
  if (!samples.length) return null
  const numCols = Math.max(...samples.map(r => r.length))
  const mode = detectAmountMode(header)

  let dateCol = -1, descCol = -1, amountCol = -1, inCol = -1, outCol = -1

  // Mapeamento por nome de coluna (sem acentos)
  header.forEach((h, i) => {
    const s = sem(h)
    if (dateCol === -1 && (s.includes('data lan') || s === 'data' || s.includes('date'))) dateCol = i
    if (descCol === -1 && (s.includes('titulo') || s.includes('descri') || s === 'title')) descCol = i
    if (mode === 'dual') {
      if (inCol === -1 && (s.includes('entrada') || s.includes('cred'))) inCol = i
      if (outCol === -1 && (s.includes('saida') || s.includes('deb'))) outCol = i
    } else {
      if (amountCol === -1 && (s.includes('valor') || s.includes('amount') || s === 'amount' || s.includes('r$'))) amountCol = i
    }
  })

  // Fallback: detect by content
  if (dateCol === -1) {
    for (let c = 0; c < numCols; c++) {
      const vals = samples.map(r => r[c] || '').filter(Boolean)
      if (vals.filter(v => parseDate(v)).length >= vals.length * 0.5) { dateCol = c; break }
    }
  }
  if ((mode === 'single' || mode === 'credit') && amountCol === -1) {
    for (let c = 0; c < numCols; c++) {
      if (c === dateCol) continue
      const vals = samples.map(r => r[c] || '').filter(Boolean)
      if (vals.filter(v => parseAmount(v) !== 0 && !parseDate(v)).length >= vals.length * 0.4) { amountCol = c; break }
    }
  }
  if (descCol === -1) {
    for (let c = 0; c < numCols; c++) {
      if (c !== dateCol && c !== amountCol && c !== inCol && c !== outCol) { descCol = c; break }
    }
  }

  return { dateCol, descCol, amountCol, inCol, outCol, mode }
}

// ── Perfis de bancos ─────────────────────────────────────────────────────────

const BANK_PROFILES = [
  {
    id: 'nubank_credit',
    name: 'Nubank',
    sub: 'Cartão de crédito',
    logo: '🟣',
    // Nubank crédito: headers ingleses date,title,amount (vírgula)
    detect: (headers) => {
      const h = headers.map(s => s.toLowerCase().replace(/"/g, '').trim())
      return h.includes('date') && (h.includes('title') || h.includes('description')) && h.includes('amount')
    },
    colMap: { dateCol: 0, descCol: 1, amountCol: 2, inCol: -1, outCol: -1, mode: 'credit' },
  },
  {
    id: 'nubank_account',
    name: 'Nubank',
    sub: 'Conta corrente',
    logo: '🟣',
    // Nubank conta: Data,Valor,Identificador,Descrição  ou  Data,Descrição,Valor
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      const hasData = h.some(s => s === 'data')
      const hasValor = h.some(s => s === 'valor')
      const hasDesc = h.some(s => s.includes('descri') || s.includes('histor'))
      return hasData && hasValor && hasDesc && !h.includes('amount')
    },
    colMap: null, // usa autoDetect
  },
  {
    id: 'c6_bank',
    name: 'C6 Bank',
    sub: 'Extrato',
    logo: '⬛',
    // C6 Bank: detecta por nomes de colunas (sem verificar delimitador,
    // pois os semicolons já foram consumidos pelo parser)
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      const hasData      = h.some(s => s === 'data' || s.startsWith('data'))
      const hasLanc      = h.some(s => s.includes('lancamento') || s.includes('historico'))
      const hasSaldo     = h.some(s => s === 'saldo' || s.includes('saldo'))
      const hasDescricao = h.some(s => s.includes('descri'))
      return hasData && (hasLanc || hasSaldo || hasDescricao)
    },
    colMap: null,
  },
  // ── Itaú ─ dual columns Crédito / Débito ──────────────────────────
  {
    id: 'itau',
    name: 'Itaú',
    sub: 'Conta corrente / poupança',
    logo: '🟠',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return (h.some(s => s.includes('cred')) && h.some(s => s.includes('deb'))) &&
             h.some(s => s.includes('historico') || s.includes('lancamento') || s.includes('descri'))
    },
    colMap: null,
  },
  // ── Bradesco ────────────────────────────────────────────────────────
  {
    id: 'bradesco',
    name: 'Bradesco',
    sub: 'Extrato',
    logo: '🔴',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('docto') || s.includes('documento') || s.includes('natureza')) &&
             h.some(s => s === 'data' || s.startsWith('data'))
    },
    colMap: null,
  },
  // ── Banco do Brasil ─────────────────────────────────────────────────
  {
    id: 'bb',
    name: 'Banco do Brasil',
    sub: 'Extrato',
    logo: '🟡',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('tipo de lancamento') || s.includes('agencia origem') ||
                         s.includes('tipo lancamento'))
    },
    colMap: null,
  },
  // ── Caixa Econômica ─────────────────────────────────────────────────
  {
    id: 'caixa',
    name: 'Caixa',
    sub: 'Extrato',
    logo: '🔵',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('dependencia') || s.includes('saldo final') ||
                         s.includes('cod op'))
    },
    colMap: null,
  },
  // ── Santander ───────────────────────────────────────────────────────
  {
    id: 'santander',
    name: 'Santander',
    sub: 'Extrato',
    logo: '🔴',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('data mov') || s === 'movimento' || s.includes('compl')) &&
             h.some(s => s.includes('valor') || s.includes('val'))
    },
    colMap: null,
  },
  // ── Banco Inter ─────────────────────────────────────────────────────
  {
    id: 'inter',
    name: 'Banco Inter',
    sub: 'Extrato',
    logo: '🟠',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('tipo de operacao') || s.includes('tipo operacao') ||
                         s.includes('tipo de transacao'))
    },
    colMap: null,
  },
  // ── Sicoob / Sicredi ────────────────────────────────────────────────
  {
    id: 'sicoob',
    name: 'Sicoob / Sicredi',
    sub: 'Extrato',
    logo: '🟢',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('cooperativa') || s.includes('sicoob') ||
                         s.includes('sicredi') || s.includes('cod transacao'))
    },
    colMap: null,
  },
  // ── Neon ────────────────────────────────────────────────────────────
  {
    id: 'neon',
    name: 'Neon',
    sub: 'Extrato',
    logo: '🌐',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      // Neon tem coluna "Tipo" com valores Débito/Crédito
      return h.some(s => s === 'tipo') && h.some(s => s === 'data') &&
             h.some(s => s === 'valor' || s.includes('descri'))
    },
    colMap: null,
  },
  // ── PicPay ──────────────────────────────────────────────────────────
  {
    id: 'picpay',
    name: 'PicPay',
    sub: 'Extrato',
    logo: '💚',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('picpay') || s.includes('tipo de transacao')) ||
             h.some(s => s === 'status' && h.some(c => c === 'tipo'))
    },
    colMap: null,
  },
  // ── Mercado Pago ────────────────────────────────────────────────────
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    sub: 'Extrato',
    logo: '🔵',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('mercado') || s.includes('operacao') || s.includes('canal'))
    },
    colMap: null,
  },
  // ── XP / BTG ────────────────────────────────────────────────────────
  {
    id: 'xp_btg',
    name: 'XP / BTG',
    sub: 'Extrato',
    logo: '⚫',
    detect: (headers) => {
      const h = headers.map(s => sem(s.replace(/"/g, '')))
      return h.some(s => s.includes('ativo') || s.includes('produto') || s.includes('financeiro'))
    },
    colMap: null,
  },
  // ── Genérico ────────────────────────────────────────────────────────
  {
    id: 'generic',
    name: 'Outro banco',
    sub: 'Formato genérico',
    logo: '🏦',
    detect: () => false,
    colMap: null,
  },
]

function detectBank(rows, hIdx) {
  if (!rows.length) return null
  // Tenta o hIdx e também as 5 primeiras linhas (para bancos com metadata antes do cabeçalho)
  const candidates = [...new Set([hIdx, 0, 1, 2, 3, 4])]
    .map(i => rows[i])
    .filter(Boolean)

  for (const profile of BANK_PROFILES) {
    if (profile.id === 'generic') continue
    for (const headerRow of candidates) {
      if (profile.detect(headerRow)) return profile
    }
  }
  return null
}

// ── Constantes ────────────────────────────────────────────────────────────────

const EXPENSE_CATS = [
  { value: 'variable', label: '🛒 Variável' },
  { value: 'fixed', label: '🏠 Fixa' },
  { value: 'credit_card', label: '💳 Cartão' },
]
const INCOME_CATS = [
  { value: 'salary', label: '💼 Salário' },
  { value: 'other', label: '💰 Outro' },
  { value: 'freelance', label: '💻 Freelance' },
  { value: 'bonus', label: '🎁 Bônus' },
  { value: 'investment', label: '📈 Investimento' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Import() {
  const { user } = useAuth()
  const fileRef = useRef()

  const [step,          setStep]          = useState('upload')
  const [rows,          setRows]          = useState([])
  const [fileName,      setFileName]      = useState('')
  const [headerIdx,     setHeaderIdx]     = useState(0)
  const [colMap,        setColMap]        = useState({ dateCol: 0, descCol: 1, amountCol: 2, inCol: -1, outCol: -1, mode: 'single' })
  const [entries,       setEntries]       = useState([])
  const [saving,        setSaving]        = useState(false)
  const [done,          setDone]          = useState(null)
  const [dragOver,      setDragOver]      = useState(false)
  const [detectedBank,  setDetectedBank]  = useState(null)   // perfil detectado
  const [selectedBank,  setSelectedBank]  = useState(null)   // banco escolhido pelo usuário

  const numCols = rows.length > 0 ? Math.max(...rows.slice(0, 15).map(r => r.length)) : 0
  const headerRow = rows[headerIdx] || []
  const sampleRows = rows.slice(headerIdx + 1, headerIdx + 5)

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCSVText(e.target.result)
      setRows(parsed)
      const hIdx = findDataStart(parsed)
      setHeaderIdx(hIdx)

      // Tenta detectar o banco automaticamente
      const bank = detectBank(parsed, hIdx)
      setDetectedBank(bank)
      setSelectedBank(bank)

      // Aplica o colMap do perfil ou usa autoDetect
      const profileMap = bank?.colMap
      const autoMap    = autoDetectCols(parsed, hIdx)
      const finalMap   = profileMap || autoMap || { dateCol: 0, descCol: 1, amountCol: 2, inCol: -1, outCol: -1, mode: 'single' }
      setColMap(finalMap)

      // Se banco detectado → vai direto para preview (sem tela de configuração)
      // Se não detectado → vai para seleção de banco (mais simples que tela técnica)
      if (bank) {
        // Gera as entradas imediatamente com o colMap detectado
        const dataRows2 = parsed.slice(hIdx + 1)
        // (buildEntries usa state, então guardamos para usar após setState)
        setStep('bank_confirm')
      } else {
        setStep('bank_select')
      }
      setDone(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  const buildEntries = () => {
    const dataRows = rows.slice(headerIdx + 1)
    return dataRows
      .filter(row => row.some(c => c))
      .flatMap(row => {
        const rawDate = colMap.dateCol >= 0 ? (row[colMap.dateCol] || '') : ''
        const rawDesc = colMap.descCol >= 0 ? (row[colMap.descCol] || '') : ''
        const date = parseDate(rawDate)

        if (colMap.mode === 'dual') {
          const entrada = parseAmount(row[colMap.inCol] || '0')
          const saida = parseAmount(row[colMap.outCol] || '0')
          if (entrada === 0 && saida === 0) return []
          const amount = entrada > 0 ? entrada : saida
          const type = entrada > 0 ? 'income' : 'expense'
          return [{
            id: Math.random().toString(36).slice(2),
            date: date || format(new Date(), 'yyyy-MM-dd'),
            description: rawDesc,
            amount,
            type,
            category: type === 'income' ? 'other' : 'variable',
            selected: true,
            dateError: !date,
          }]
        } else if (colMap.mode === 'credit') {
          // Nubank crédito: positivo = despesa, negativo = pagamento/estorno (income)
          const rawAmt = colMap.amountCol >= 0 ? (row[colMap.amountCol] || '') : ''
          const amount = parseAmount(rawAmt)
          if (amount === 0) return []
          const isExpense = amount > 0
          return [{
            id: Math.random().toString(36).slice(2),
            date: date || format(new Date(), 'yyyy-MM-dd'),
            description: rawDesc,
            amount: Math.abs(amount),
            type: isExpense ? 'expense' : 'income',
            category: isExpense ? 'credit_card' : 'other',
            selected: isExpense, // pagamentos/estornos vêm desmarcados por padrão
            dateError: !date,
          }]
        } else {
          // single: negativo = despesa (extrato débito/corrente padrão)
          const rawAmt = colMap.amountCol >= 0 ? (row[colMap.amountCol] || '') : ''
          const amount = parseAmount(rawAmt)
          if (amount === 0) return []
          const isExpense = amount < 0
          return [{
            id: Math.random().toString(36).slice(2),
            date: date || format(new Date(), 'yyyy-MM-dd'),
            description: rawDesc,
            amount: Math.abs(amount),
            type: isExpense ? 'expense' : 'income',
            category: isExpense ? 'variable' : 'other',
            selected: true,
            dateError: !date,
            amountError: amount === 0,
          }]
        }
      })
  }

  const goPreview = () => { setEntries(buildEntries()); setStep('preview') }

  const updateEntry = (id, updates) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))

  const selectedCount = entries.filter(e => e.selected).length

  const handleImport = async () => {
    setSaving(true)
    let imported = 0, errors = 0
    for (const entry of entries.filter(e => e.selected)) {
      try {
        const d = new Date(entry.date + 'T12:00:00')
        const base = {
          user_id: user.id,
          description: entry.description || 'Importado',
          amount: entry.amount,
          date: entry.date,
          month: d.getMonth() + 1,
          year: d.getFullYear(),
        }
        if (entry.type === 'income') {
          await addIncome({ ...base, category: entry.category })
        } else {
          await addExpense({ ...base, category: entry.category, is_recurring: entry.category === 'fixed' })
        }
        imported++
      } catch { errors++ }
    }
    window.dispatchEvent(new Event('finance-updated'))
    setSaving(false)
    setDone({ imported, errors })
    setStep('upload')
    setRows([]); setEntries([]); setFileName('')
  }

  const colOptions = (label = '— Ignorar') => [
    <option key={-1} value={-1}>{label}</option>,
    ...Array.from({ length: numCols }, (_, i) => (
      <option key={i} value={i}>
        Col {i + 1}{headerRow[i] ? ` — ${String(headerRow[i]).slice(0, 20)}` : ''}
      </option>
    ))
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="page-title">Importar Extrato 📂</h1>
        </div>
        <p className="text-gray-500 text-sm">Importe o CSV do banco e lance tudo de uma vez</p>
      </div>

      {done && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
          <Check size={20} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-emerald-400 font-semibold text-sm">Importação concluída!</p>
            <p className="text-emerald-300/70 text-xs mt-0.5">
              {done.imported} lançamento(s) importado(s){done.errors > 0 && `, ${done.errors} com erro`}.
            </p>
          </div>
          <button onClick={() => setDone(null)} className="ml-auto text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
          >
            <Upload size={40} className="text-gray-500 mx-auto mb-3" />
            <p className="text-white font-semibold">Arraste o CSV aqui ou clique para selecionar</p>
            <p className="text-gray-500 text-sm mt-1">Arquivos .csv e .txt exportados pelo seu banco</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </div>

          <div className="card border border-blue-500/20 bg-blue-500/5">
            <p className="text-blue-400 font-semibold text-sm mb-2">💡 Como exportar o extrato?</p>
            <ul className="text-gray-400 text-xs space-y-1.5">
              <li>• <span className="text-white">Nubank:</span> Fatura → compartilhar → CSV</li>
              <li>• <span className="text-white">C6 Bank:</span> App → Extrato → compartilhar → CSV</li>
              <li>• <span className="text-white">Itaú / Bradesco / BB:</span> Internet Banking → Extrato → Exportar CSV</li>
              <li>• <span className="text-white">Banco Inter:</span> App → Extrato → Exportar</li>
              <li>• <span className="text-white">Caixa:</span> App → Extrato → Compartilhar → CSV</li>
              <li>• <span className="text-white">Santander / Neon / PicPay:</span> App → Extrato → Exportar CSV</li>
            </ul>
            <p className="text-gray-600 text-xs mt-2">Suportamos: Nubank, C6, Itaú, Bradesco, BB, Caixa, Santander, Inter, Sicoob, Neon, PicPay, Mercado Pago, XP, BTG e outros</p>
          </div>
        </div>
      )}

      {/* ── STEP 2: Map columns ── */}
      {/* ── STEP: Banco confirmado automaticamente ── */}
      {step === 'bank_confirm' && detectedBank && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <FileText size={16} className="text-emerald-400" />
            <span className="text-white font-medium">{fileName}</span>
            <span>— {rows.length} linhas</span>
          </div>

          <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/20 p-5 text-center">
            <span className="text-4xl">{detectedBank.logo}</span>
            <p className="text-white font-bold text-lg mt-2">{detectedBank.name}</p>
            <p className="text-gray-400 text-sm">{detectedBank.sub}</p>
            <p className="text-emerald-400 text-xs mt-1 font-medium">✓ Identificado automaticamente</p>
          </div>

          <p className="text-gray-400 text-sm text-center">
            Não é esse banco?{' '}
            <button onClick={() => setStep('bank_select')} className="text-emerald-400 hover:text-emerald-300 underline">
              Selecionar outro
            </button>
          </p>

          <button
            onClick={() => { setEntries(buildEntries()); setStep('preview') }}
            className="btn-primary w-full"
          >
            Continuar <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── STEP: Seleção manual de banco ── */}
      {step === 'bank_select' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <FileText size={16} className="text-emerald-400" />
            <span className="text-white font-medium">{fileName}</span>
          </div>

          <div className="card text-center py-2">
            <p className="text-white font-semibold text-sm mb-1">Qual é o seu banco?</p>
            <p className="text-gray-500 text-xs">Isso garante que o extrato seja lido corretamente</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {BANK_PROFILES.map(bank => (
              <button
                key={bank.id}
                onClick={() => {
                  setSelectedBank(bank)
                  const profileMap = bank.colMap
                  const autoMap    = autoDetectCols(rows, headerIdx)
                  setColMap(profileMap || autoMap || colMap)
                  setEntries(buildEntries())
                  setStep('preview')
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl border text-left
                           bg-dark-700 border-white/8 hover:border-emerald-500/30
                           hover:bg-emerald-500/8 transition-all active:scale-95"
              >
                <span className="text-2xl shrink-0">{bank.logo}</span>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{bank.name}</p>
                  <p className="text-gray-500 text-[10px] truncate">{bank.sub}</p>
                </div>
              </button>
            ))}
          </div>

          <button onClick={() => { setStep('upload'); setRows([]); setFileName('') }}
            className="w-full text-gray-500 text-sm py-2 hover:text-white transition-colors">
            ← Escolher outro arquivo
          </button>
        </div>
      )}


      {/* ── STEP 3: Preview & import ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-400 text-sm">
              {entries.length} linhas · <span className="text-white font-semibold">{selectedCount} selecionadas</span>
            </span>
            <button onClick={() => setEntries(e => e.map(x => ({ ...x, selected: true })))}
              className="btn-secondary text-xs">Selecionar todos</button>
            <button onClick={() => setEntries(e => e.map(x => ({ ...x, selected: false })))}
              className="btn-secondary text-xs">Desmarcar todos</button>
            <button onClick={() => setEntries(e => e.map(x => x.type === 'expense' ? { ...x, selected: true } : { ...x, selected: false }))}
              className="btn-secondary text-xs">Só despesas</button>
            <button onClick={() => setEntries(e => e.map(x => x.type === 'income' ? { ...x, selected: true } : { ...x, selected: false }))}
              className="btn-secondary text-xs">Só receitas</button>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead className="border-b border-white/5">
                <tr className="text-gray-500">
                  <th className="p-3 text-left w-8"></th>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Descrição</th>
                  <th className="p-3 text-left">Valor</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-left">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}
                    className={`border-t border-white/5 transition-colors ${!entry.selected ? 'opacity-35' : ''}`}>
                    <td className="p-3">
                      <input type="checkbox" checked={entry.selected}
                        onChange={e => updateEntry(entry.id, { selected: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-gray-600 bg-dark-600 text-emerald-500" />
                    </td>
                    <td className="p-3">
                      <input type="date" value={entry.date}
                        onChange={e => updateEntry(entry.id, { date: e.target.value, dateError: false })}
                        className={`bg-transparent border rounded px-1.5 py-0.5 text-xs ${
                          entry.dateError ? 'border-red-500 text-red-400' : 'border-white/10 text-white'
                        }`} />
                    </td>
                    <td className="p-3 min-w-[150px]">
                      <input type="text" value={entry.description}
                        onChange={e => updateEntry(entry.id, { description: e.target.value })}
                        className="bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-xs text-white w-full" />
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={entry.type === 'income' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                        {entry.type === 'income' ? '+' : '-'}{formatBRL(entry.amount)}
                      </span>
                    </td>
                    <td className="p-3">
                      <select value={entry.type}
                        onChange={e => updateEntry(entry.id, {
                          type: e.target.value,
                          category: e.target.value === 'income' ? 'other' : 'variable',
                        })}
                        className="bg-dark-600 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white">
                        <option value="expense">💸 Despesa</option>
                        <option value="income">💵 Receita</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <select value={entry.category}
                        onChange={e => updateEntry(entry.id, { category: e.target.value })}
                        className="bg-dark-600 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white">
                        {(entry.type === 'expense' ? EXPENSE_CATS : INCOME_CATS).map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('map')} className="btn-secondary flex items-center gap-2">
              <ChevronLeft size={16} /> Voltar
            </button>
            <button onClick={handleImport} disabled={saving || selectedCount === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Importando...</>
                : <><Check size={16} /> Importar {selectedCount} lançamento(s)</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
