#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4'
)

async function main() {
  console.log('🔍 Checking wallets for user "roger"...\n')

  const rogerUserId = '5f15fc8a-5fc8-433e-be6f-5b75303f3219'

  // Check for wallets with this user ID
  const { data: wallets, error: walletError } = await supabase
    .from('wallets')
    .select('id, currency_code, type, balance, created_at')
    .eq('user_id', rogerUserId)
    .order('currency_code')

  if (walletError) {
    console.error('Error fetching wallets:', walletError)
    return
  }

  console.log(`Found ${wallets?.length || 0} wallet(s) for roger:\n`)

  if (!wallets || wallets.length === 0) {
    console.log('No wallets found for this user ID')
    return
  }

  // Check currency types to identify issues
  let issues = []
  for (const wallet of wallets) {
    // Bitcoin-like currencies should be crypto
    const shouldBeCrypto = ['BTC', 'BCH', 'ETH', 'USDT', 'USDC', 'XRP', 'ADA', 'SOL', 'DOGE', 'MATIC', 'LINK', 'LTC'].includes(wallet.currency_code)
    const isWrong = shouldBeCrypto && wallet.type === 'fiat'

    const status = isWrong ? '⚠️ WRONG' : '✓ OK'
    console.log(`${status} ${wallet.currency_code.padEnd(6)} | type=${wallet.type.padEnd(6)} | balance=${wallet.balance} | created=${new Date(wallet.created_at).toLocaleDateString()}`)

    if (isWrong) {
      issues.push({ id: wallet.id, code: wallet.currency_code })
    }
  }

  if (issues.length > 0) {
    console.log(`\n⚠️ Found ${issues.length} wallet(s) with incorrect type!`)
    console.log('\nTo fix them, run:')
    console.log(`node scripts/fix-wallet-types-for-user.js ${rogerUserId}`)
  } else {
    console.log('\n✅ All wallets have correct types!')
  }
}

main()
