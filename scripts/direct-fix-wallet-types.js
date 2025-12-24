#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixWallet(userId, currencyCode, expectedType) {
  const { data: wallet, error: fetchError } = await supabase
    .from('wallets')
    .select('id, type')
    .eq('user_id', userId)
    .eq('currency_code', currencyCode)
    .single()

  if (fetchError) {
    console.error(`  ❌ Error fetching ${currencyCode} wallet: ${fetchError.message}`)
    return false
  }

  if (!wallet) {
    console.log(`  ℹ️  ${currencyCode} wallet not found`)
    return false
  }

  if (wallet.type === expectedType) {
    console.log(`  ✓ ${currencyCode}: ${wallet.type} (already correct)`)
    return false
  }

  console.log(`  ⚠️  ${currencyCode}: ${wallet.type} → ${expectedType}`)

  const { error: updateError } = await supabase
    .from('wallets')
    .update({ type: expectedType })
    .eq('id', wallet.id)

  if (updateError) {
    console.error(`    ❌ Failed: ${updateError.message}`)
    return false
  }

  console.log(`    ✓ Fixed`)
  return true
}

async function main() {
  console.log('🔧 Direct wallet type fix\n')

  // Roger's user ID
  const rogerUserId = 'fd7fe70a-dd53-4ffb-a726-d648f92033de'

  console.log(`Fixing wallets for user: ${rogerUserId}\n`)

  let fixedCount = 0

  // Fix Bitcoin
  if (await fixWallet(rogerUserId, 'BTC', 'crypto')) fixedCount++

  // Fix Binance Coin
  if (await fixWallet(rogerUserId, 'BNB', 'crypto')) fixedCount++

  // Verify PHP is correct
  await fixWallet(rogerUserId, 'PHP', 'fiat')

  console.log(`\n✅ Fixed ${fixedCount} wallet(s)`)

  // Verify the fix
  console.log('\n🔍 Verifying...')
  const { data: wallets } = await supabase
    .from('wallets')
    .select('currency_code, type')
    .eq('user_id', rogerUserId)
    .order('currency_code')

  console.log('\nFinal wallet types:')
  for (const w of wallets) {
    console.log(`  ${w.currency_code}: ${w.type}`)
  }
}

main()
