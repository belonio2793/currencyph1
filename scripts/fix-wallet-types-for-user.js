#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixWalletTypesForUser(userId) {
  try {
    console.log(`\n🔧 Fixing wallet types for user: ${userId}\n`)

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error(`❌ User not found: ${userId}`)
      return false
    }

    console.log(`Found user: ${user.full_name} (${user.email})`)

    // Get user's wallets
    const { data: wallets, error: walletError } = await supabase
      .from('wallets')
      .select('id, currency_code, type')
      .eq('user_id', userId)
      .order('currency_code')

    if (walletError) {
      console.error('❌ Error fetching wallets:', walletError)
      return false
    }

    console.log(`\nUser has ${wallets?.length || 0} wallet(s):`)

    if (!wallets || wallets.length === 0) {
      console.log('  - No wallets found')
      return true
    }

    // Check each wallet and fix if needed
    let fixedCount = 0
    const issues = []

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
        issues.push({ walletId: wallet.id, code: wallet.currency_code, currentType: wallet.type, correctType })

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

    console.log(`\n📊 Summary: Fixed ${fixedCount}/${wallets.length} wallet(s)`)
    
    if (issues.length > 0) {
      console.log('\nIssues fixed:')
      for (const issue of issues) {
        console.log(`  - ${issue.code}: ${issue.currentType} → ${issue.correctType}`)
      }
    }

    return true

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    return false
  }
}

async function listUsersWithWallets() {
  try {
    console.log('\n📋 Searching for users with wallets...\n')

    // Get all users with wallets
    const { data: wallets, error } = await supabase
      .from('wallets')
      .select('user_id')
      .order('user_id')

    if (error) {
      console.error('Error fetching wallets:', error)
      return
    }

    if (!wallets || wallets.length === 0) {
      console.log('No wallets found in database')
      return
    }

    // Get unique user IDs
    const userIds = [...new Set(wallets.map(w => w.user_id))]
    console.log(`Found ${userIds.length} user(s) with wallets\n`)

    // Get user details
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds)
      .order('full_name')

    if (userError) {
      console.error('Error fetching users:', userError)
      return
    }

    console.log('Users:')
    for (const user of users) {
      console.log(`  ID: ${user.id}`)
      console.log(`     Name: ${user.full_name}`)
      console.log(`     Email: ${user.email}`)
      console.log('')
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

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
        console.log(`✓ ${crypto.code} - ${crypto.name}`)
      }
    }

    console.log('\nStep 2: Checking for user argument...')
    
    // Check if user ID is provided as argument
    const userIdArg = process.argv[2]

    if (userIdArg) {
      const success = await fixWalletTypesForUser(userIdArg)
      if (!success) {
        process.exit(1)
      }
    } else {
      // List users with wallets
      await listUsersWithWallets()
      console.log('\n📝 Usage: node fix-wallet-types-for-user.js <user_id>')
      console.log('   Example: node fix-wallet-types-for-user.js 550e8400-e29b-41d4-a716-446655440000\n')
    }

    console.log('\n✅ Complete!')

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

// Run the script
main()
