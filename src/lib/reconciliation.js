import { supabase } from './supabaseClient'
import { wisegcashAPI } from './payments'

// Sign mapping for transaction types: negative for outflows, positive for inflows
const isDebitType = (type) => {
  if (!type) return false
  const t = type.toLowerCase()
  return t.includes('sent') || t.includes('withdrawal') || t === 'bill_payment' || t === 'payment' || t.includes('debit')
}

function toNumber(v) {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function aggregateTransactionsByCurrency(userId) {
  if (!userId) return {}
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const byCurrency = {}
  ;(transactions || []).forEach(tx => {
    const curr = tx.currency_code || 'PHP'
    const sign = isDebitType(tx.transaction_type) ? -1 : 1
    const amt = toNumber(tx.amount) * sign
    if (!byCurrency[curr]) byCurrency[curr] = { computed: 0, entries: [] }
    byCurrency[curr].computed += amt
    byCurrency[curr].entries.push({ id: tx.id, type: tx.transaction_type, amount: toNumber(tx.amount), sign })
  })

  return byCurrency
}

export async function getWalletBalances(userId) {
  if (!userId) return {}
  const { data, error } = await supabase
    .from('wallets')
    .select('currency_code, balance')
    .eq('user_id', userId)

  if (error) throw error
  const map = {}
  ;(data || []).forEach(w => { map[w.currency_code] = toNumber(w.balance) })
  return map
}

export async function fetchRatesMap() {
  // prefer existing internal table, fallback to API method
  try {
    const rows = await wisegcashAPI.getAllExchangeRates()
    const map = {}
    ;(rows || []).forEach(r => {
      if (r.from_currency && r.to_currency) map[`${r.from_currency}_${r.to_currency}`] = Number(r.rate)
    })
    return map
  } catch (e) {
    console.warn('Could not fetch rates via API, falling back to empty rates', e)
    return {}
  }
}

export function convertAmount(amount, from, to, ratesMap) {
  if (from === to) return amount
  const key = `${from}_${to}`
  const direct = ratesMap[key]
  if (direct && direct > 0) return amount * direct

  // Fallback pivot via USD if available
  const viaUSD = ratesMap[`${from}_USD`] && ratesMap[`USD_${to}`]
  if (viaUSD) return amount * ratesMap[`${from}_USD`] * ratesMap[`USD_${to}`]

  // Last resort: return null to indicate unknown conversion
  return null
}

export async function reconcileUser(userId, options = {}) {
  const baseCurrency = options.baseCurrency || 'PHP'

  if (!userId) throw new Error('userId required')

  // Aggregate transactions
  const txByCurrency = await aggregateTransactionsByCurrency(userId)

  // Current wallet balances
  const stored = await getWalletBalances(userId)

  // Rates map
  const ratesMap = await fetchRatesMap()

  // Build report
  const perCurrency = {}
  let totalInBase = 0
  const issues = []

  const currencies = new Set([...Object.keys(txByCurrency), ...Object.keys(stored)])

  for (const curr of currencies) {
    const computed = toNumber(txByCurrency[curr]?.computed)
    const storedBal = toNumber(stored[curr])
    const diff = Number((computed - storedBal).toFixed(8))

    // convert computed to base currency
    const converted = (() => {
      const c = convertAmount(computed, curr, baseCurrency, ratesMap)
      return c == null ? null : Number(c)
    })()

    if (converted == null) issues.push(`Missing rate ${curr}->${baseCurrency}`)
    else totalInBase += converted

    perCurrency[curr] = { computed, stored: storedBal, diff, convertedToBase: converted }
  }

  return {
    userId,
    baseCurrency,
    totalInBase: Number(totalInBase.toFixed(8)),
    perCurrency,
    issues
  }
}

export async function reconcileAllUsers(batchSize = 100) {
  const { data: users, error } = await supabase.from('users').select('id').limit(batchSize)
  if (error) throw error
  const results = []
  for (const u of users || []) {
    try {
      const r = await reconcileUser(u.id)
      results.push(r)
    } catch (e) {
      results.push({ userId: u.id, error: e.message || String(e) })
    }
  }
  return results
}
