#!/usr/bin/env node
/**
 * Seed script to ensure all crypto currencies from wallets_house are in the currencies table
 */

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// List of crypto currencies to ensure exist
const cryptoCurrencies = [
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', decimals: 8 },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimals: 8 },
  { code: 'USDT', name: 'Tether USD', symbol: 'USDT', decimals: 6 },
  { code: 'BNB', name: 'Binance Coin', symbol: 'BNB', decimals: 8 },
  { code: 'SOL', name: 'Solana', symbol: 'SOL', decimals: 8 },
  { code: 'XRP', name: 'XRP', symbol: 'XRP', decimals: 8 },
  { code: 'USDC', name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  { code: 'LTC', name: 'Litecoin', symbol: 'Ł', decimals: 8 }
]

async function seedCurrencies() {
  try {
    console.log('Seeding crypto currencies...')

    for (const crypto of cryptoCurrencies) {
      const { data, error } = await supabase
        .from('currencies')
        .upsert({
          code: crypto.code,
          name: crypto.name,
          type: 'crypto',
          symbol: crypto.symbol,
          decimals: crypto.decimals,
          active: true
        }, {
          onConflict: 'code'
        })
        .select()
        .single()

      if (error) {
        console.error(`Error upserting ${crypto.code}:`, error)
      } else {
        console.log(`✓ ${crypto.code} - ${crypto.name}`)
      }
    }

    console.log('\n✅ Crypto currencies seeded successfully')
  } catch (error) {
    console.error('Error seeding currencies:', error)
    process.exit(1)
  }
}

seedCurrencies()
