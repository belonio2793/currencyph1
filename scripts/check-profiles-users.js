#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Njk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4'
)

async function main() {
  console.log('🔍 Checking profiles and users relationship...\n')

  // Get the roger profile
  const { data: rogerProfile } = await supabase
    .from('profiles')
    .select('id, user_id, username, full_name')
    .eq('username', 'roger')
    .single()

  if (rogerProfile) {
    console.log('Roger profile found:')
    console.log(`  Profile ID: ${rogerProfile.id}`)
    console.log(`  User ID: ${rogerProfile.user_id}`)
    console.log(`  Username: ${rogerProfile.username}`)
    console.log(`  Full name: ${rogerProfile.full_name}`)

    if (rogerProfile.user_id) {
      // Check for wallets with this user ID
      const { data: wallets } = await supabase
        .from('wallets')
        .select('id, currency_code, type, balance')
        .eq('user_id', rogerProfile.user_id)
        .order('currency_code')

      console.log(`\nWallets for user ${rogerProfile.user_id}:`)
      if (wallets && wallets.length > 0) {
        for (const w of wallets) {
          const shouldBeCrypto = ['BTC', 'BCH', 'ETH', 'USDT', 'USDC'].includes(w.currency_code)
          const isWrong = shouldBeCrypto && w.type === 'fiat'
          const status = isWrong ? '⚠️' : '✓'
          console.log(`  ${status} ${w.currency_code}: type=${w.type}`)
        }
      } else {
        console.log('  No wallets found')
      }

      // If there are wallet issues, provide fix command
      if (wallets && wallets.some(w => ['BTC', 'BCH', 'ETH'].includes(w.currency_code) && w.type === 'fiat')) {
        console.log(`\nFix command:`)
        console.log(`node scripts/fix-wallet-types-for-user.js ${rogerProfile.user_id}`)
      }
    }
  } else {
    console.log('Roger profile not found')

    // Show all profiles
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('username, user_id')
      .limit(10)

    if (allProfiles && allProfiles.length > 0) {
      console.log('\nAll profiles:')
      for (const p of allProfiles) {
        console.log(`  ${p.username} -> ${p.user_id}`)
      }
    }
  }
}

main()
