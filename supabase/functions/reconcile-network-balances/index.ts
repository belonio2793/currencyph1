import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('VITE_PROJECT_URL') || Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '')

interface TransactionRow {
  id: string
  user_id: string
  transaction_type: string
  amount: number
  currency_code: string
  created_at: string
}

interface WalletRow {
  id: string
  user_id: string
  currency_code: string
  balance: number
}

interface WalletTransaction {
  id: string
  user_id: string
  type: string
  amount: number
  currency_code: string
}

const isDebitType = (type: string): boolean => {
  if (!type) return false
  const t = type.toLowerCase()
  return (
    t.includes('sent') ||
    t.includes('withdrawal') ||
    t === 'bill_payment' ||
    t.includes('payment') ||
    t.includes('debit')
  )
}

const toNumber = (v: any): number => {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function reconcileUserBalances(userId: string) {
  try {
    // Fetch all transactions for the user
    const { data: transactions, error: txError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)

    if (txError) throw txError

    // Fetch all wallets for the user
    const { data: wallets, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)

    if (walletError) throw walletError

    // Calculate balances by currency from transactions
    const computedByCurrency: Record<
      string,
      { computed: number; deposits: number; withdrawals: number; count: number }
    > = {}

    ;(transactions || []).forEach((tx: WalletTransaction) => {
      const curr = tx.currency_code || 'PHP'
      const isDebit = isDebitType(tx.type)
      const amount = toNumber(tx.amount)

      if (!computedByCurrency[curr]) {
        computedByCurrency[curr] = {
          computed: 0,
          deposits: 0,
          withdrawals: 0,
          count: 0
        }
      }

      if (isDebit) {
        computedByCurrency[curr].computed -= amount
        computedByCurrency[curr].withdrawals += amount
      } else {
        computedByCurrency[curr].computed += amount
        computedByCurrency[curr].deposits += amount
      }
      computedByCurrency[curr].count += 1
    })

    // Get wallet balances
    const walletByCurrency: Record<string, number> = {}
    ;(wallets || []).forEach((w: WalletRow) => {
      walletByCurrency[w.currency_code] = toNumber(w.balance)
    })

    // Get all currencies referenced
    const currencies = new Set([
      ...Object.keys(computedByCurrency),
      ...Object.keys(walletByCurrency)
    ])

    const results = []

    // Insert network balance records for each currency
    for (const curr of currencies) {
      const computed = toNumber(computedByCurrency[curr]?.computed) || 0
      const walletBal = toNumber(walletByCurrency[curr]) || 0
      const difference = walletBal - computed
      const isReconciled = Math.abs(difference) < 0.01 // Allow small floating-point differences
      const txCount = computedByCurrency[curr]?.count || 0
      const deposits = toNumber(computedByCurrency[curr]?.deposits) || 0
      const withdrawals = toNumber(computedByCurrency[curr]?.withdrawals) || 0

      const record = {
        entity_type: 'user',
        entity_id: userId,
        currency_code: curr,
        wallet_balance: walletBal,
        computed_balance: computed,
        balance_difference: difference,
        total_transactions: txCount,
        total_deposits: deposits,
        total_withdrawals: withdrawals,
        status: isReconciled ? 'reconciled' : 'discrepancy',
        reconciliation_date: new Date().toISOString(),
        notes: isReconciled
          ? 'Automatically reconciled'
          : `Discrepancy of ${Math.abs(difference)} detected`,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('network_balances')
        .upsert(record, { onConflict: 'entity_type,entity_id,currency_code' })
        .select()

      if (error) {
        console.error(`Failed to upsert balance for user ${userId}:`, error)
      } else {
        results.push(data)
      }
    }

    return {
      userId,
      currenciesProcessed: Array.from(currencies),
      success: true
    }
  } catch (error) {
    console.error(`Error reconciling user ${userId}:`, error)
    return { userId, error: String(error), success: false }
  }
}

async function reconcileHouseBalances() {
  try {
    // Sum all user balances by currency
    const { data: userBalances, error: balanceError } = await supabase
      .from('wallets')
      .select('currency_code, balance')

    if (balanceError) throw balanceError

    const houseByurrency: Record<string, number> = {}
    ;(userBalances || []).forEach((w: any) => {
      const curr = w.currency_code || 'PHP'
      houseByurrency[curr] = (houseByurrency[curr] || 0) + toNumber(w.balance)
    })

    // Get house wallet if it exists
    const { data: houseWallets } = await supabase
      .from('wallets_house')
      .select('currency, balance')

    const actualHouseByurrency: Record<string, number> = {}
    ;(houseWallets || []).forEach((w: any) => {
      actualHouseByurrency[w.currency] = toNumber(w.balance)
    })

    const results = []

    // Insert house balance records
    const currencies = new Set([
      ...Object.keys(houseByurrency),
      ...Object.keys(actualHouseByurrency)
    ])

    for (const curr of currencies) {
      const computed = toNumber(houseByurrency[curr]) || 0
      const walletBal = toNumber(actualHouseByurrency[curr]) || 0
      const difference = walletBal - computed
      const isReconciled = Math.abs(difference) < 0.01

      const record = {
        entity_type: 'house',
        entity_id: null,
        currency_code: curr,
        wallet_balance: walletBal,
        computed_balance: computed,
        balance_difference: difference,
        status: isReconciled ? 'reconciled' : 'discrepancy',
        reconciliation_date: new Date().toISOString(),
        notes: isReconciled
          ? 'House balance automatically reconciled'
          : `House discrepancy of ${Math.abs(difference)} detected`
      }

      const { data, error } = await supabase
        .from('network_balances')
        .insert([record])
        .select()

      if (error) {
        console.error('Failed to insert house balance:', error)
      } else {
        results.push(data)
      }
    }

    return {
      entity: 'house',
      currenciesProcessed: Array.from(currencies),
      success: true
    }
  } catch (error) {
    console.error('Error reconciling house balances:', error)
    return { entity: 'house', error: String(error), success: false }
  }
}

serve(async (req) => {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'all'
  const userId = url.searchParams.get('userId')

  try {
    const results = {
      timestamp: new Date().toISOString(),
      type,
      data: []
    }

    if (type === 'user' && userId) {
      const userResult = await reconcileUserBalances(userId)
      results.data.push(userResult)
    } else if (type === 'house') {
      const houseResult = await reconcileHouseBalances()
      results.data.push(houseResult)
    } else if (type === 'all') {
      // Reconcile house first
      const houseResult = await reconcileHouseBalances()
      results.data.push(houseResult)

      // Then reconcile all users
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')

      if (userError) throw userError

      const userResults = []
      for (const u of users || []) {
        const result = await reconcileUserBalances(u.id)
        userResults.push(result)
      }

      results.data.push({
        type: 'users',
        count: userResults.length,
        results: userResults
      })
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return new Response(
      JSON.stringify({
        error: String(error),
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
})
