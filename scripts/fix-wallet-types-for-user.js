#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  try {
    console.log('🔧 Starting wallet type fix...\n')

    // Step 1: Ensure cryptocurrencies are in the currencies table with correct type
    console.log('Step 1: Ensuring cryptocurrencies are properly configured...')
    
    const cryptoCurrencies = [
      { code: 'BTC', name: 'Bitcoin', symbol: '₿', decimals: 8 },
      { code: 'BCH', name: 'Bitcoin Cash', symbol: 'BCH', decimals: 8 },
      { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimals: 8 },
      { code: 'USDT', name: 'Tether USD', symbol: 'USDT', decimals: 6 },
      { code: 'USDC', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
      { code: 'XRP', name: 'XRP', symbol: 'XRP', decimals: 8 },
      { code: 'ADA', name: 'Cardano', symbol: 'ADA', decimals: 8 },
      { code: 'SOL', name: 'Solana', symbol: 'SOL', decimals: 8 },
      { code: 'DOGE', name: 'Dogecoin', symbol: 'Ð', decimals: 8 },
      { code: 'MATIC', name: 'Polygon', symbol: 'MATIC', decimals: 8 },
      { code: 'LINK', name: 'Chainlink', symbol: 'LINK', decimals: 8 },
      { code: 'LTC', name: 'Litecoin', symbol: 'Ł', decimals: 8 }
    ]

    for (const crypto of cryptoCurrencies) {
      const { error } = await supabase
        .from('currencies')
        .upsert({
          code: crypto.code,
          name: crypto.name,
          type: 'crypto',
          symbol: crypto.symbol,
          decimals: crypto.decimals,
          active: true,
          is_default: false
        }, {
          onConflict: 'code'
        })

      if (error) {
        console.warn(`⚠️  Error upserting ${crypto.code}:`, error.message)
      } else {
        console.log(`✓ ${crypto.code} - ${crypto.name} (crypto)`)
      }
    }

    console.log('\nStep 2: Finding user "roger"...')
    
    // Get user with email or username "roger"
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .or('full_name.ilike.%roger%,email.ilike.%roger%')

    if (userError) {
      console.error('❌ Error fetching users:', userError)
      return
    }

    if (!users || users.length === 0) {
      console.log('⚠️  No user found with "roger" in name or email')
      console.log('\nAvailable options:')
      console.log('1. Check the actual username/email in the database')
      console.log('2. Run with specific user ID: node fix-wallet-types-for-user.js <user_id>')
      return
    }

    for (const user of users) {
      console.log(`\nFound user: ${user.full_name} (${user.email}) - ID: ${user.id}`)

      // Get user's wallets with incorrect type
      const { data: wallets, error: walletError } = await supabase
        .from('wallets')
        .select('id, currency_code, type')
        .eq('user_id', user.id)
        .order('currency_code')

      if (walletError) {
        console.error('❌ Error fetching wallets:', walletError)
        continue
      }

      console.log(`\nUser has ${wallets?.length || 0} wallet(s):`)

      if (!wallets || wallets.length === 0) {
        console.log('  - No wallets found')
        continue
      }

      // Check each wallet and fix if needed
      let fixedCount = 0
      for (const wallet of wallets) {
        // Check if this currency should be crypto
        const { data: currency } = await supabase
          .from('currencies')
          .select('type')
          .eq('code', wallet.currency_code)
          .single()

        const correctType = currency?.type || 'fiat'
        const isIncorrect = wallet.type !== correctType

        if (isIncorrect) {
          console.log(`  ⚠️  ${wallet.currency_code}: currently '${wallet.type}', should be '${correctType}'`)

          // Fix the wallet type
          const { error: updateError } = await supabase
            .from('wallets')
            .update({ type: correctType })
            .eq('id', wallet.id)

          if (updateError) {
            console.error(`    ❌ Failed to fix: ${updateError.message}`)
          } else {
            console.log(`    ✓ Fixed to '${correctType}'`)
            fixedCount++
          }
        } else {
          console.log(`  ✓ ${wallet.currency_code}: '${wallet.type}' (correct)`)
        }
      }

      console.log(`\n📊 Summary: Fixed ${fixedCount} wallet(s)`)
    }

    console.log('\n✅ Wallet type fix completed!')

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

// Run the script
main()
