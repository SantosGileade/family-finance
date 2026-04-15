import { useState } from 'react'
import { Lightbulb, BookOpen, Globe, ChevronDown, ChevronUp, Target, TrendingUp } from 'lucide-react'

const FINANCIAL_VOCAB = [
  { pt: 'Renda', en: 'Income', def: 'Dinheiro que você recebe', enDef: 'Money you receive' },
  { pt: 'Despesa', en: 'Expense', def: 'Dinheiro que você gasta', enDef: 'Money you spend' },
  { pt: 'Poupança', en: 'Savings', def: 'Dinheiro guardado', enDef: 'Money saved' },
  { pt: 'Orçamento', en: 'Budget', def: 'Plano de gastos', enDef: 'Spending plan' },
  { pt: 'Investimento', en: 'Investment', def: 'Dinheiro que trabalha por você', enDef: 'Money working for you' },
  { pt: 'Juros', en: 'Interest', def: 'Custo do dinheiro emprestado', enDef: 'Cost of borrowed money' },
  { pt: 'Dívida', en: 'Debt', def: 'Dinheiro que você deve', enDef: 'Money you owe' },
  { pt: 'Cartão de crédito', en: 'Credit Card', def: 'Compra agora, paga depois', enDef: 'Buy now, pay later' },
  { pt: 'Fluxo de caixa', en: 'Cash Flow', def: 'Entrada e saída de dinheiro', enDef: 'Money coming in and going out' },
  { pt: 'Reserva de emergência', en: 'Emergency Fund', def: 'Dinheiro guardado para imprevistos', enDef: 'Money saved for unexpected events' },
  { pt: 'Rendimento', en: 'Yield/Return', def: 'Quanto seu investimento ganhou', enDef: 'How much your investment earned' },
  { pt: 'Desconto', en: 'Discount', def: 'Redução no preço', enDef: 'Reduction in price' },
  { pt: 'Parcelamento', en: 'Installment', def: 'Pagamento dividido em partes', enDef: 'Payment split into parts' },
  { pt: 'Imposto', en: 'Tax', def: 'Valor pago ao governo', enDef: 'Money paid to the government' },
  { pt: 'Salário', en: 'Salary', def: 'Pagamento mensal pelo trabalho', enDef: 'Monthly payment for work' },
  { pt: 'Fatura', en: 'Invoice / Bill', def: 'Cobrança por serviço', enDef: 'Charge for a service' },
  { pt: 'Meta financeira', en: 'Financial Goal', def: 'Objetivo que você quer alcançar', enDef: 'Objective you want to achieve' },
  { pt: 'Patrimônio', en: 'Net Worth', def: 'Tudo que você tem menos o que deve', enDef: 'Everything you own minus what you owe' },
]

const TIPS = [
  {
    title: 'Regra 50/30/20',
    en: 'The 50/30/20 Rule',
    icon: '📊',
    color: 'border-blue-500/30 bg-blue-500/5',
    headerColor: 'text-blue-400',
    content: `Divida sua renda em 3 partes:
• 50% para necessidades (aluguel, mercado, contas)
• 30% para desejos (lazer, roupas, restaurante)
• 20% para poupança e investimentos

Com R$ 4.000:
→ R$ 2.000 para necessidades
→ R$ 1.200 para desejos
→ R$ 800 para guardar`,
    en_content: `Divide your income into 3 parts:
• 50% for needs (rent, groceries, bills)
• 30% for wants (fun, clothes, restaurants)
• 20% for savings and investments`,
  },
  {
    title: 'Sair do Cartão de Crédito',
    en: 'Getting Off the Credit Card',
    icon: '💳',
    color: 'border-red-500/30 bg-red-500/5',
    headerColor: 'text-red-400',
    content: `O cartão de crédito é a armadilha número 1 nas finanças.

Plano para se livrar:
1. Pare de usar o cartão AGORA
2. Calcule a fatura total
3. Separe dinheiro para pagar
4. Use só dinheiro ou débito por 3 meses
5. Sinta a liberdade!

Lembre: cartão não é dinheiro extra, é dívida antecipada.`,
    en_content: `Credit card is the #1 financial trap.
Stop using it, pay the balance, then use only cash or debit.`,
  },
  {
    title: 'Controle os Gastos Diários',
    en: 'Control Daily Spending',
    icon: '📅',
    color: 'border-yellow-500/30 bg-yellow-500/5',
    headerColor: 'text-yellow-400',
    content: `Com R$ 60/dia você gasta R$ 1.800/mês fora das contas fixas.

Com R$ 30/dia você gasta R$ 900/mês.

A diferença: R$ 900 por mês = R$ 10.800 por ano!

Estratégias para reduzir:
• Leve lanche de casa
• Evite delivery
• Planeje compras no mercado
• Questione: preciso ou quero?`,
    en_content: `At R$30/day instead of R$60/day, you save R$900/month = R$10,800/year!`,
  },
  {
    title: 'Reserve de Emergência',
    en: 'Emergency Fund First',
    icon: '🛡️',
    color: 'border-emerald-500/30 bg-emerald-500/5',
    headerColor: 'text-emerald-400',
    content: `Antes de qualquer investimento, tenha uma reserva de emergência.

Meta: 3 a 6 meses de despesas.

Para vocês:
→ Mínimo: R$ 3.000 (3 meses de despesas básicas)
→ Ideal: R$ 6.000 a R$ 8.000

Onde guardar: poupança ou Tesouro Selic (rende mais).

Não toque nela a não ser em EMERGÊNCIA real.`,
    en_content: `Build an emergency fund of 3-6 months of expenses before investing. Keep it in a savings account.`,
  },
  {
    title: 'Efeito Latte (Gastos Invisíveis)',
    en: 'The Latte Effect (Hidden Spending)',
    icon: '☕',
    color: 'border-purple-500/30 bg-purple-500/5',
    headerColor: 'text-purple-400',
    content: `Pequenos gastos diários somam muito no final do mês.

Exemplos:
• Café fora todos os dias: R$ 6 × 30 = R$ 180
• Delivery 3x semana: R$ 40 × 12 = R$ 480
• Assinaturas esquecidas: R$ 50+

Total "invisível": R$ 700/mês = R$ 8.400/ano!

Não precisa cortar tudo, mas fique atento!`,
    en_content: `Small daily purchases add up. A daily coffee = R$180/month. Audit your invisible spending!`,
  },
  {
    title: 'Pague-se Primeiro',
    en: 'Pay Yourself First',
    icon: '💰',
    color: 'border-green-500/30 bg-green-500/5',
    headerColor: 'text-green-400',
    content: `Assim que o salário cair, separe a poupança ANTES de pagar qualquer conta.

Ordem ideal:
1. Salário entra na conta
2. Você transfere X para poupança (mesmo que seja R$ 50)
3. Paga as contas fixas
4. Usa o restante no mês

Se sobrar, você gasta. Se separar antes, você guarda.

"Don't save what's left after spending; spend what's left after saving."
— Warren Buffett`,
    en_content: `"Don't save what's left after spending; spend what's left after saving." — Warren Buffett`,
  },
]

const CHALLENGES = [
  { id: 1, emoji: '💪', title: 'Desafio da Semana', en: 'Weekly Challenge', desc: 'Gaste menos de R$ 30 por dia durante 7 dias seguidos!', reward: 'Guarde os R$ que economizou!' },
  { id: 2, emoji: '🎯', title: 'Desafio do Mês', en: 'Monthly Challenge', desc: 'Não use o cartão de crédito em nada por 30 dias!', reward: 'Comemore sabendo que você pode!' },
  { id: 3, emoji: '💡', title: 'Desafio Inteligente', en: 'Smart Challenge', desc: 'Antes de cada compra acima de R$ 50, espere 24h e decida depois.', reward: 'Você vai economizar muito!' },
  { id: 4, emoji: '🌱', title: 'Desafio do Real por Dia', en: 'R$1 a Day Challenge', desc: 'Guarde pelo menos R$ 1 por dia na poupança do app. R$ 1 hoje, R$ 1 amanhã...', reward: 'R$ 365 no final do ano!' },
]

export default function Tips() {
  const [expandedTip, setExpandedTip] = useState(null)
  const [vocabFilter, setVocabFilter] = useState('')
  const [flippedCard, setFlippedCard] = useState(null)
  const [tab, setTab] = useState('tips') // 'tips' | 'vocab' | 'challenges'

  const filteredVocab = FINANCIAL_VOCAB.filter(v =>
    v.pt.toLowerCase().includes(vocabFilter.toLowerCase()) ||
    v.en.toLowerCase().includes(vocabFilter.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Dicas & Aprendizado 💡</h1>
        <p className="text-gray-500 text-sm">Tips & Learning · Inglês + Finanças</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-dark-700 p-1 rounded-xl">
        {[
          { key: 'tips', label: '💡 Dicas', en: 'Tips' },
          { key: 'vocab', label: '🇺🇸 Inglês', en: 'English' },
          { key: 'challenges', label: '🎯 Desafios', en: 'Challenges' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tips tab */}
      {tab === 'tips' && (
        <div className="space-y-3">
          {TIPS.map((tip, i) => (
            <div key={i} className={`card border ${tip.color} transition-all duration-200`}>
              <button
                onClick={() => setExpandedTip(expandedTip === i ? null : i)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{tip.icon}</span>
                  <div className="text-left">
                    <p className={`font-semibold ${tip.headerColor}`}>{tip.title}</p>
                    <p className="text-gray-500 text-xs">{tip.en}</p>
                  </div>
                </div>
                {expandedTip === i
                  ? <ChevronUp size={18} className="text-gray-400 shrink-0" />
                  : <ChevronDown size={18} className="text-gray-400 shrink-0" />
                }
              </button>

              {expandedTip === i && (
                <div className="mt-4 pt-4 border-t border-white/5 animate-fade-in">
                  <p className="text-gray-300 text-sm whitespace-pre-line leading-relaxed">
                    {tip.content}
                  </p>
                  <div className="mt-4 p-3 bg-dark-600 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">🇺🇸 In English:</p>
                    <p className="text-gray-400 text-sm italic leading-relaxed">{tip.en_content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vocabulary tab */}
      {tab === 'vocab' && (
        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-sm mb-3">
              Aprenda os termos financeiros em inglês! Toque em um cartão para ver a definição.
            </p>
            <input
              className="input-field"
              placeholder="🔍 Buscar em português ou inglês..."
              value={vocabFilter}
              onChange={e => setVocabFilter(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {filteredVocab.map((word, i) => (
              <button
                key={i}
                onClick={() => setFlippedCard(flippedCard === i ? null : i)}
                className={`card border transition-all duration-200 text-left ${
                  flippedCard === i
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-white/5 hover:border-white/10'
                }`}
              >
                {flippedCard === i ? (
                  <div className="animate-fade-in">
                    <p className="text-gray-400 text-xs mb-1">Significado:</p>
                    <p className="text-white text-sm font-medium">{word.def}</p>
                    <p className="text-gray-500 text-xs mt-1 italic">{word.enDef}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-white font-semibold text-sm">{word.pt}</p>
                    <p className="text-emerald-400 text-xs font-medium mt-0.5">{word.en}</p>
                    <p className="text-gray-600 text-xs mt-2 italic">toque para ver →</p>
                  </>
                )}
              </button>
            ))}
          </div>

          {filteredVocab.length === 0 && (
            <p className="text-center text-gray-500 py-8">Nenhum resultado · No results</p>
          )}

          {/* English phrases */}
          <div className="card border border-blue-500/20 bg-blue-500/5">
            <p className="text-blue-400 font-semibold text-sm mb-3">
              🗣️ Frases úteis em inglês · Useful English phrases
            </p>
            <div className="space-y-3">
              {[
                { pt: 'Quanto custa?', en: 'How much does it cost?' },
                { pt: 'Eu não tenho dinheiro agora', en: 'I don\'t have money right now' },
                { pt: 'Estou economizando', en: 'I\'m saving money' },
                { pt: 'Isso está fora do meu orçamento', en: 'That\'s out of my budget' },
                { pt: 'Quanto você ganha?', en: 'How much do you earn?' },
                { pt: 'Vou pagar em dinheiro', en: 'I\'ll pay in cash' },
                { pt: 'Você tem desconto?', en: 'Do you have a discount?' },
                { pt: 'Estou sem dívidas!', en: 'I\'m debt-free!' },
              ].map(({ pt, en }) => (
                <div key={pt} className="flex gap-3 items-start">
                  <span className="text-blue-400 font-semibold text-xs shrink-0 mt-0.5">🇧🇷</span>
                  <div>
                    <p className="text-gray-300 text-sm">{pt}</p>
                    <p className="text-blue-300 text-xs font-medium mt-0.5">🇺🇸 {en}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Challenges tab */}
      {tab === 'challenges' && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Desafios práticos para melhorar suas finanças. Um de cada vez!
          </p>

          {CHALLENGES.map((c) => (
            <div key={c.id} className="card border border-white/8 hover:border-emerald-500/20 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{c.emoji}</div>
                <div className="flex-1">
                  <p className="text-white font-semibold">{c.title}</p>
                  <p className="text-gray-500 text-xs mb-2">{c.en}</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{c.desc}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs">🏆</span>
                    <p className="text-emerald-400 text-xs font-medium">{c.reward}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Motivational quotes */}
          <div className="card border border-purple-500/20 bg-purple-500/5">
            <p className="text-purple-400 font-semibold text-sm mb-3">
              💬 Frases que motivam · Motivational Quotes
            </p>
            <div className="space-y-4">
              {[
                {
                  quote: '"Do not save what is left after spending, but spend what is left after saving."',
                  author: 'Warren Buffett',
                  pt: '"Não guarde o que sobra depois de gastar; gaste o que sobra depois de guardar."'
                },
                {
                  quote: '"A budget is telling your money where to go instead of wondering where it went."',
                  author: 'Dave Ramsey',
                  pt: '"Um orçamento é dizer ao seu dinheiro para onde ir, em vez de se perguntar para onde foi."'
                },
                {
                  quote: '"Financial peace isn\'t the acquisition of stuff. It\'s learning to live on less than you make."',
                  author: 'Dave Ramsey',
                  pt: '"Paz financeira não é acumular coisas. É aprender a viver com menos do que você ganha."'
                },
              ].map(({ quote, author, pt }) => (
                <div key={author} className="border-l-2 border-purple-500/30 pl-3">
                  <p className="text-white text-sm italic leading-relaxed">{quote}</p>
                  <p className="text-purple-400 text-xs mt-1">— {author}</p>
                  <p className="text-gray-600 text-xs mt-1 italic">{pt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
