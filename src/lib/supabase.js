import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis do Supabase não configuradas! Crie o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── INCOME ───────────────────────────────────────────────────────────────────

export const getIncome = async (userId, month, year) => {
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const addIncome = async (income) => {
  const { data, error } = await supabase.from('income').insert([income]).select()
  return { data, error }
}

export const updateIncome = async (id, income) => {
  const { data, error } = await supabase.from('income').update(income).eq('id', id).select()
  return { data, error }
}

export const deleteIncome = async (id) => {
  const { error } = await supabase.from('income').delete().eq('id', id)
  return { error }
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

export const getExpenses = async (userId, month, year) => {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const addExpense = async (expense) => {
  const { data, error } = await supabase.from('expenses').insert([expense]).select()
  return { data, error }
}

export const updateExpense = async (id, expense) => {
  const { data, error } = await supabase.from('expenses').update(expense).eq('id', id).select()
  return { data, error }
}

export const deleteExpense = async (id) => {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  return { error }
}

// Apaga todas as receitas de um mês
export const deleteAllIncome = async (userId, month, year) => {
  const { error } = await supabase
    .from('income').delete()
    .eq('user_id', userId).eq('month', month).eq('year', year)
  return { error }
}

// Apaga todas as despesas NÃO-cartão (fixas + variáveis) + gastos diários de débito/dinheiro
export const deleteAllNonCreditExpenses = async (userId, month, year) => {
  // Despesas fixas e variáveis (expenses table)
  const { error: e1 } = await supabase
    .from('expenses').delete()
    .eq('user_id', userId).eq('month', month).eq('year', year)
    .neq('category', 'credit_card')

  // Gastos diários de débito/dinheiro (daily_spending table)
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { error: e2 } = await supabase
    .from('daily_spending').delete()
    .eq('user_id', userId).gte('date', startDate).lte('date', endDate)
    .neq('payment_method', 'credit_card')

  return { error: e1 || e2 }
}

// Apaga apenas despesas de cartão de crédito + gastos diários de cartão
export const deleteAllCreditExpenses = async (userId, month, year) => {
  // Parcelas/compras de cartão (expenses table)
  const { error: e1 } = await supabase
    .from('expenses').delete()
    .eq('user_id', userId).eq('month', month).eq('year', year)
    .eq('category', 'credit_card')

  // Gastos diários de cartão (daily_spending table)
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { error: e2 } = await supabase
    .from('daily_spending').delete()
    .eq('user_id', userId).gte('date', startDate).lte('date', endDate)
    .eq('payment_method', 'credit_card')

  return { error: e1 || e2 }
}

export const payExpense = async (id) => {
  const { data, error } = await supabase
    .from('expenses')
    .update({ status: 'pago' })
    .eq('id', id)
    .select()
  return { data, error }
}

// ─── DAILY SPENDING ───────────────────────────────────────────────────────────

export const getDailySpending = async (userId, month, year) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  // Calcula o último dia real do mês (evita datas inválidas como 31 de abril)
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('daily_spending')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
  return { data, error }
}

export const addDailySpending = async (spending) => {
  const { data, error } = await supabase.from('daily_spending').insert([spending]).select()
  return { data, error }
}

export const updateDailySpending = async (id, spending) => {
  const { data, error } = await supabase.from('daily_spending').update(spending).eq('id', id).select()
  return { data, error }
}

export const deleteDailySpending = async (id) => {
  const { error } = await supabase.from('daily_spending').delete().eq('id', id)
  return { error }
}

// ─── SAVINGS ─────────────────────────────────────────────────────────────────

export const getSavings = async (userId) => {
  const { data, error } = await supabase
    .from('savings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const addSaving = async (saving) => {
  const { data, error } = await supabase.from('savings').insert([saving]).select()
  return { data, error }
}

export const deleteSaving = async (id) => {
  const { error } = await supabase.from('savings').delete().eq('id', id)
  return { error }
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export const upsertProfile = async (profile) => {
  const { data, error } = await supabase
    .from('profiles')
    .upsert([profile], { onConflict: 'id' })
    .select()
  return { data, error }
}

export const updateHiddenCategories = async (userId, hiddenLabels) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ hidden_categories: hiddenLabels })
    .eq('id', userId)
    .select()
  return { data, error }
}

// ─── CATEGORY LIMITS ─────────────────────────────────────────────────────────

export const getCategoryLimits = async (userId) => {
  const { data, error } = await supabase
    .from('user_category_limits')
    .select('*')
    .eq('user_id', userId)
  return { data, error }
}

export const upsertCategoryLimit = async (userId, categoryLabel, limitType, limitValue) => {
  const { data, error } = await supabase
    .from('user_category_limits')
    .upsert([{ user_id: userId, category_label: categoryLabel, limit_type: limitType, limit_value: limitValue }],
            { onConflict: 'user_id,category_label' })
    .select()
  return { data, error }
}

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────

export const getAccounts = async (userId) => {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('is_principal', { ascending: false })
    .order('created_at', { ascending: true })
  return { data, error }
}

export const addAccount = async (account) => {
  const { data, error } = await supabase.from('accounts').insert([account]).select()
  return { data, error }
}

export const updateAccount = async (id, updates) => {
  const { data, error } = await supabase.from('accounts').update(updates).eq('id', id).select()
  return { data, error }
}

export const deleteAccount = async (id) => {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  return { error }
}

export const setPrincipalAccount = async (userId, accountId) => {
  // Remove principal de todas, depois marca a nova
  await supabase.from('accounts').update({ is_principal: false }).eq('user_id', userId)
  const { data, error } = await supabase
    .from('accounts').update({ is_principal: true }).eq('id', accountId).select()
  return { data, error }
}

// ─── USER CATEGORIES ─────────────────────────────────────────────────────────

export const getUserCategories = async (userId) => {
  const { data, error } = await supabase
    .from('user_categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { data, error }
}

export const addUserCategory = async (category) => {
  const { data, error } = await supabase
    .from('user_categories')
    .insert([category])
    .select()
  return { data, error }
}

export const updateUserCategory = async (id, updates) => {
  const { data, error } = await supabase
    .from('user_categories')
    .update(updates)
    .eq('id', id)
    .select()
  return { data, error }
}

export const deleteUserCategory = async (id) => {
  const { error } = await supabase
    .from('user_categories')
    .delete()
    .eq('id', id)
  return { error }
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

export const getAllProfiles = async () => {
  const { data, error } = await supabase.rpc('admin_get_all_profiles')
  return { data, error }
}

export const updateUserPlan = async (userId, updates) => {
  const { data, error } = await supabase.rpc('admin_update_user_plan', {
    p_user_id: userId,
    p_plano_ativo: updates.plano_ativo ?? null,
    p_data_expiracao: updates.data_expiracao ?? null
  })
  return { data: data ? [data] : null, error }
}


// ─── MULTI-MONTH DATA (for charts) ────────────────────────────────────────────

export const getMonthlyTotals = async (userId, year) => {
  const { data: incomeData } = await supabase
    .from('income')
    .select('month, amount')
    .eq('user_id', userId)
    .eq('year', year)

  const { data: expenseData } = await supabase
    .from('expenses')
    .select('month, amount')
    .eq('user_id', userId)
    .eq('year', year)

  // Daily spending: group by month using the date field
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`
  const { data: dailyData } = await supabase
    .from('daily_spending')
    .select('date, amount')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)

  const result = []
  for (let m = 1; m <= 12; m++) {
    const inc = (incomeData || [])
      .filter(r => r.month === m)
      .reduce((s, r) => s + Number(r.amount), 0)

    const exp = (expenseData || [])
      .filter(r => r.month === m)
      .reduce((s, r) => s + Number(r.amount), 0)

    const daily = (dailyData || [])
      .filter(r => new Date(r.date).getMonth() + 1 === m)
      .reduce((s, r) => s + Number(r.amount), 0)

    result.push({ month: m, income: inc, expenses: exp + daily })
  }

  return result
}
    