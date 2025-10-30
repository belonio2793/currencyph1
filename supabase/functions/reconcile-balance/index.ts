import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('VITE_PROJECT_URL') || Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '')

async function reconcileUser(userId: string) {
  // Basic reconciliation implemented server-side: sum transactions per currency and compare to wallets
  const { data: txs } = await supabase.from('transactions').select('id,transaction_type,amount,currency_code').eq('user_id', userId)
  const { data: wallets } = await supabase.from('wallets').select('currency_code,balance').eq('user_id', userId)

  const byCurrency: Record<string, { computed: number }>= {}
  const isDebit = (type: string) => {
    if (!type) return false
    const t = type.toLowerCase()
    return t.includes('sent') || t.includes('withdrawal') || t === 'bill_payment' || t.includes('debit')
  }

  (txs || []).forEach((tx: any) => {
    const curr = tx.currency_code || 'PHP'
    const sign = isDebit(tx.transaction_type) ? -1 : 1
    if (!byCurrency[curr]) byCurrency[curr] = { computed: 0 }
    byCurrency[curr].computed += (Number(tx.amount) || 0) * sign
  })

  const report: any = { userId, perCurrency: {}, totalInBase: null }

  ;(wallets || []).forEach((w: any) => {
    const curr = w.currency_code
    const stored = Number(w.balance) || 0
    const computed = byCurrency[curr]?.computed || 0
    report.perCurrency[curr] = { computed, stored, diff: computed - stored }
  })

  return report
}

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      // run for first 100 users
      const { data: users } = await supabase.from('users').select('id').limit(100)
      const out = []
      for (const u of (users || [])) {
        out.push(await reconcileUser(u.id))
      }
      return new Response(JSON.stringify({ results: out }), { headers: { 'content-type': 'application/json' } })
    }

    const report = await reconcileUser(userId)
    return new Response(JSON.stringify(report), { headers: { 'content-type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
