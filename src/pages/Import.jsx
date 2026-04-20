import { useState, useRef } from 'react'
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

  const [step, setStep] = useState('upload')
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [headerIdx, setHeaderIdx] = useState(0)
  const [colMap, setColMap] = useState({ dateCol: 0, descCol: 1, amountCol: 2, inCol: -1, outCol: -1, mode: 'single' })
  const [entries, setEntries] = useState([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const [dragOver, setDragOver] = useState(false)

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
      const det = autoDetectCols(parsed, hIdx)
      if (det) setColMap(det)
      setStep('map')
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
        <h1 className="page-title">Importar Extrato 📂</h1>
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
            <p className="text-blue-400 font-semibold text-sm mb-2">💡 Como exportar do seu banco?</p>
            <ul className="text-gray-400 text-xs space-y-1.5">
              <li>• <span className="text-white">C6 Bank:</span> App → Extrato → ícone de compartilhar → Exportar CSV</li>
              <li>• <span className="text-white">Nubank crédito:</span> Fatura → ícone de compartilhar → CSV (use modo 💳 Crédito)</li>
              <li>• <span className="text-white">Itaú:</span> Internet Banking → Extrato → Exportar CSV</li>
              <li>• <span className="text-white">Bradesco:</span> Internet Banking → Extrato → Download CSV</li>
              <li>• <span className="text-white">Caixa:</span> App → Extrato → Compartilhar → CSV</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── STEP 2: Map columns ── */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <FileText size={16} className="text-emerald-400" />
            <span className="text-white font-medium">{fileName}</span>
            <span>— {rows.length} linhas</span>
          </div>

          {/* Header row control */}
          <div className="card">
            <p className="text-white font-semibold text-sm mb-3">Cabeçalho detectado</p>
            <div className="flex items-center gap-3">
              <label className="text-gray-400 text-sm shrink-0">Linha do cabeçalho:</label>
              <input
                type="number" min={0} max={rows.length - 1}
                value={headerIdx}
                onChange={e => {
                  const v = Number(e.target.value)
                  setHeaderIdx(v)
                  const det = autoDetectCols(rows, v)
                  if (det) setColMap(det)
                }}
                className="input-field w-20 text-center"
              />
              <span className="text-gray-500 text-xs">
                {headerRow.length > 0
                  ? `"${headerRow.slice(0, 3).join(' | ')}..."`
                  : 'nenhuma'}
              </span>
            </div>
          </div>

          {/* Amount mode */}
          <div className="card">
            <p className="text-white font-semibold text-sm mb-3">Formato do valor</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'single', label: '📊 Valor único', sub: 'Negativo = despesa' },
                { value: 'dual', label: '📊 Entrada / Saída', sub: 'C6 Bank, Bradesco' },
                { value: 'credit', label: '💳 Crédito', sub: 'Nubank, positivo = despesa' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setColMap(c => ({ ...c, mode: opt.value }))}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    colMap.mode === opt.value
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/10 bg-dark-600 text-gray-400'
                  }`}>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Column mapping */}
          <div className="card">
            <p className="text-white font-semibold text-sm mb-3">Mapeamento de colunas</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-blue-400 text-xs font-semibold block mb-1">📅 Data</label>
                  <select className="input-field text-sm" value={colMap.dateCol}
                    onChange={e => setColMap(c => ({ ...c, dateCol: Number(e.target.value) }))}>
                    {colOptions('— Ignorar')}
                  </select>
                </div>
                <div>
                  <label className="text-yellow-400 text-xs font-semibold block mb-1">📝 Descrição</label>
                  <select className="input-field text-sm" value={colMap.descCol}
                    onChange={e => setColMap(c => ({ ...c, descCol: Number(e.target.value) }))}>
                    {colOptions('— Ignorar')}
                  </select>
                </div>
              </div>

              {colMap.mode === 'single' ? (
                <div>
                  <label className="text-emerald-400 text-xs font-semibold block mb-1">💰 Valor (positivo = receita, negativo = despesa)</label>
                  <select className="input-field text-sm" value={colMap.amountCol}
                    onChange={e => setColMap(c => ({ ...c, amountCol: Number(e.target.value) }))}>
                    {colOptions()}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-emerald-400 text-xs font-semibold block mb-1">💚 Entrada / Crédito (receita)</label>
                    <select className="input-field text-sm" value={colMap.inCol}
                      onChange={e => setColMap(c => ({ ...c, inCol: Number(e.target.value) }))}>
                      {colOptions()}
                    </select>
                  </div>
                  <div>
                    <label className="text-red-400 text-xs font-semibold block mb-1">🔴 Saída / Débito (despesa)</label>
                    <select className="input-field text-sm" value={colMap.outCol}
                      onChange={e => setColMap(c => ({ ...c, outCol: Number(e.target.value) }))}>
                      {colOptions()}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="card overflow-x-auto">
            <p className="text-white font-semibold text-sm mb-3">Prévia — primeiras linhas de dados</p>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {headerRow.map((h, i) => (
                    <th key={i} className={`text-left pb-2 pr-4 font-medium ${
                      colMap.dateCol === i ? 'text-blue-400' :
                      colMap.descCol === i ? 'text-yellow-400' :
                      colMap.amountCol === i || colMap.inCol === i ? 'text-emerald-400' :
                      colMap.outCol === i ? 'text-red-400' : 'text-gray-600'
                    }`}>{h.slice(0, 18)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, ri) => (
                  <tr key={ri} className="border-t border-white/5">
                    {row.map((cell, ci) => (
                      <td key={ci} className={`py-1.5 pr-4 truncate max-w-[120px] ${
                        colMap.dateCol === ci ? 'text-blue-300' :
                        colMap.descCol === ci ? 'text-white' :
                        colMap.amountCol === ci || colMap.inCol === ci ? 'text-emerald-300' :
                        colMap.outCol === ci ? 'text-red-300' : 'text-gray-600'
                      }`}>{cell || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('upload')} className="btn-secondary flex items-center gap-2">
              <ChevronLeft size={16} /> Voltar
            </button>
            <button onClick={goPreview} className="btn-primary flex-1 flex items-center justify-center gap-2">
              Ver lançamentos <ChevronRight size={16} />
            </button>
          </div>
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
