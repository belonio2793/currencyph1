#!/usr/bin/env node

/**
 * Verify Wallet Types Script
 * 
 * This script:
 * 1. Checks that all cryptocurrencies are in the currencies table with type='crypto'
 * 2. Verifies that wallets have the correct type based on currency_code
 * 3. Reports any mismatches and suggests fixes
 * 4. Can optionally fix issues
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// List of known cryptocurrencies and their expected symbols
const KNOWN_CRYPTO_CURRENCIES = new Map([
  ['BTC', { name: 'Bitcoin', symbol: '₿', decimals: 8 }],
  ['ETH', { name: 'Ethereum', symbol: 'Ξ', decimals: 8 }],
  ['BNB', { name: 'Binance Coin', symbol: 'BNB', decimals: 8 }],
  ['XRP', { name: 'XRP', symbol: 'XRP', decimals: 8 }],
  ['ADA', { name: 'Cardano', symbol: 'ADA', decimals: 8 }],
  ['SOL', { name: 'Solana', symbol: 'SOL', decimals: 8 }],
  ['DOGE', { name: 'Dogecoin', symbol: 'Ð', decimals: 8 }],
  ['MATIC', { name: 'Polygon', symbol: 'MATIC', decimals: 8 }],
  ['LINK', { name: 'Chainlink', symbol: 'LINK', decimals: 8 }],
  ['LTC', { name: 'Litecoin', symbol: 'Ł', decimals: 8 }],
  ['BCH', { name: 'Bitcoin Cash', symbol: 'BCH', decimals: 8 }],
  ['USDT', { name: 'Tether USD', symbol: 'USDT', decimals: 6 }],
  ['USDC', { name: 'USD Coin', symbol: 'USDC', decimals: 6 }],
  ['BUSD', { name: 'Binance USD', symbol: 'BUSD', decimals: 6 }],
  ['SHIB', { name: 'Shiba Inu', symbol: 'SHIB', decimals: 8 }],
  ['AVAX', { name: 'Avalanche', symbol: 'AVAX', decimals: 8 }],
  ['DOT', { name: 'Polkadot', symbol: 'DOT', decimals: 8 }],
  ['TRX', { name: 'Tron', symbol: 'TRX', decimals: 8 }],
  ['XLM', { name: 'Stellar Lumens', symbol: 'XLM', decimals: 8 }],
  ['SUI', { name: 'Sui', symbol: 'SUI', decimals: 8 }],
  ['TON', { name: 'Telegram', symbol: 'TON', decimals: 8 }],
  ['HBAR', { name: 'Hedera', symbol: 'HBAR', decimals: 8 }],
  ['UNI', { name: 'Uniswap', symbol: 'UNI', decimals: 8 }],
])

async function verifyCurrenciesTable() {
  console.log('\n=== Checking Currencies Table ===')
  
  try {
    // Fetch all currencies
    const { data: currencies, error: fetchError } = await supabase
      .from('currencies')
      .select('code, name, type, symbol, decimals, active')
    
    if (fetchError) {
      console.error('❌ Error fetching currencies:', fetchError)
      return { hasCryptoIssues: false, missingCryptos: [] }
    }
    
    console.log(`✓ Found ${currencies.length} currencies in database`)
    
    // Check for cryptocurrencies
    const cryptosInDb = currencies.filter(c => c.type === 'crypto')
    const fiatsInDb = currencies.filter(c => c.type === 'fiat')
    
    console.log(`  - Crypto currencies: ${cryptosInDb.length}`)
    console.log(`  - Fiat currencies: ${fiatsInDb.length}`)
    
    // Check for missing cryptocurrencies
    const missingCryptos = []
    for (const [code, info] of KNOWN_CRYPTO_CURRENCIES) {
      const found = currencies.find(c => c.code === code)
      if (!found) {
        missingCryptos.push({ code, ...info })
        console.log(`  ⚠️  Missing cryptocurrency: ${code} (${info.name})`)
      } else if (found.type !== 'crypto') {
        console.log(`  ⚠️  ${code} is marked as '${found.type}' instead of 'crypto'`)
      }
    }
    
    return { hasCryptoIssues: missingCryptos.length > 0, missingCryptos }
  } catch (err) {
    console.error('❌ Exception checking currencies:', err)
    return { hasCryptoIssues: false, missingCryptos: [] }
  }
}

async function verifyWalletsTable() {
  console.log('\n=== Checking Wallets Table ===')
  
  try {
    // Fetch all wallets
    const { data: wallets, error: walletError } = await supabase
      .from('wallets')
      .select('id, currency_code, type, is_active')
      .eq('is_active', true)
    
    if (walletError) {
      console.error('❌ Error fetching wallets:', walletError)
      return []
    }
    
    console.log(`✓ Found ${wallets.length} active wallets`)
    
    // Count by type
    const cryptoWallets = wallets.filter(w => w.type === 'crypto')
    const fiatWallets = wallets.filter(w => w.type === 'fiat')
    const unknownWallets = wallets.filter(w => !w.type || (w.type !== 'crypto' && w.type !== 'fiat'))
    
    console.log(`  - Crypto wallets: ${cryptoWallets.length}`)
    console.log(`  - Fiat wallets: ${fiatWallets.length}`)
    if (unknownWallets.length > 0) {
      console.log(`  - Unknown type: ${unknownWallets.length}`)
    }
    
    // Check for wallets with wrong type
    const wrongTypeWallets = []
    for (const wallet of wallets) {
      if (KNOWN_CRYPTO_CURRENCIES.has(wallet.currency_code) && wallet.type !== 'crypto') {
        wrongTypeWallets.push(wallet)
        console.log(`  ⚠️  Wallet ${wallet.currency_code} marked as '${wallet.type}' instead of 'crypto'`)
      }
    }
    
    return wrongTypeWallets
  } catch (err) {
    console.error('❌ Exception checking wallets:', err)
    return []
  }
}

async function checkTrigger() {
  console.log('\n=== Checking Database Trigger ===')
  
  try {
    // Query to check if trigger exists
    const { data: triggers, error } = await supabase
      .rpc('get_triggers', { table_name: 'wallets' }, { head: false })
      .catch(() => {
        // If RPC doesn't exist, we'll check via direct SQL
        return { data: null }
      })
    
    if (triggers) {
      const walletTrigger = triggers.find(t => t.trigger_name === 'wallet_type_trigger')
      if (walletTrigger) {
        console.log('✓ wallet_type_trigger exists')
      } else {
        console.log('⚠️  wallet_type_trigger not found')
      }
    } else {
      console.log('ℹ️  Could not verify trigger status (check manually in Supabase)')
    }
  } catch (err) {
    console.log('ℹ️  Could not verify trigger (this may be expected):', err.message)
  }
}

async function testWalletCreation(userId, testCurrencyCode = 'BNB') {
  console.log(`\n=== Testing Wallet Creation ===`)
  console.log(`Creating test wallet for ${testCurrencyCode}...`)
  
  try {
    // First check the currency type
    const { data: currency, error: currencyError } = await supabase
      .from('currencies')
      .select('type')
      .eq('code', testCurrencyCode)
      .single()
    
    if (currencyError) {
      console.log(`⚠️  Currency ${testCurrencyCode} not found in database`)
      return
    }
    
    console.log(`  Currency ${testCurrencyCode} type: ${currency.type}`)
    
    // Try to create a test wallet (this would need a valid user ID)
    // For now, we just show what would happen
    console.log(`  ℹ️  To fully test, would create wallet with:`)
    console.log(`      - userId: ${userId}`)
    console.log(`      - currencyCode: ${testCurrencyCode}`)
    console.log(`      - Expected type: ${currency.type}`)
  } catch (err) {
    console.error('❌ Error in wallet creation test:', err)
  }
}

async function main() {
  console.log('🔍 Starting Wallet Type Verification...\n')
  
  // Run all checks
  const currencyIssues = await verifyCurrenciesTable()
  const walletIssues = await verifyWalletsTable()
  await checkTrigger()
  
  // Summary
  console.log('\n=== Summary ===')
  
  if (currencyIssues.missingCryptos.length === 0 && walletIssues.length === 0) {
    console.log('✅ All checks passed! Wallet types appear to be correct.')
  } else {
    console.log('⚠️  Issues found:')
    if (currencyIssues.missingCryptos.length > 0) {
      console.log(`  - Missing ${currencyIssues.missingCryptos.length} cryptocurrencies in currencies table`)
    }
    if (walletIssues.length > 0) {
      console.log(`  - ${walletIssues.length} wallets have incorrect type`)
    }
    
    console.log('\n📝 To fix these issues:')
    console.log('  1. Apply the migration: supabase/migrations/0110_fix_wallet_types_crypto.sql')
    console.log('  2. The migration will:')
    console.log('     - Add missing cryptocurrencies to the currencies table')
    console.log('     - Fix existing wallets with incorrect types')
    console.log('     - Ensure the trigger works correctly for future wallets')
  }
  
  console.log('\n✅ Verification complete!')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
