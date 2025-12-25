#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function seedRates() {
  try {
    console.log('🌱 Starting quick seed...')
    
    // NOTE: Currency pair rates are now fetched from live APIs
    // This is deprecated - use fetch-all-exconvert-rates.js instead
    console.warn('⚠️  WARNING: This script uses old hardcoded rates.')
    console.warn('     Please use: npm run fetch-rates')
    console.warn('     Or run: node scripts/fetch-all-exconvert-rates.js\n')

    const currencyPairs = []  // Intentionally empty - rates should come from fetch-rates

    console.log(`📝 Seeding ${currencyPairs.length} currency pairs...`)
    const { error: fiatError } = await supabase
      .from('currency_rates')
      .upsert(currencyPairs, { onConflict: 'from_currency,to_currency' })

    if (fiatError) {
      console.error('❌ Error seeding currency_rates:', fiatError)
      throw fiatError
    }
    console.log('✅ Currency rates seeded successfully')

    // Popular cryptocurrencies with PHP base (rate = units of crypto per 1 PHP)
    const cryptoPairs = [
      { from_currency: 'PHP', to_currency: 'BTC', rate: 0.00000315 },
      { from_currency: 'PHP', to_currency: 'ETH', rate: 0.0000465 },
      { from_currency: 'PHP', to_currency: 'USDT', rate: 0.0175 },
      { from_currency: 'PHP', to_currency: 'BNB', rate: 0.0000275 },
      { from_currency: 'PHP', to_currency: 'SOL', rate: 0.0000563 },
      { from_currency: 'PHP', to_currency: 'XRP', rate: 0.0169 },
      { from_currency: 'PHP', to_currency: 'ADA', rate: 0.0229 },
      { from_currency: 'PHP', to_currency: 'DOGE', rate: 0.0463 },
      { from_currency: 'PHP', to_currency: 'LINK', rate: 0.000109 },
      { from_currency: 'PHP', to_currency: 'MATIC', rate: 0.00447 },
      { from_currency: 'BTC', to_currency: 'PHP', rate: 318000 },
      { from_currency: 'ETH', to_currency: 'PHP', rate: 21500 }
    ]

    console.log(`📝 Seeding ${cryptoPairs.length} cryptocurrency pairs...`)
    const { error: cryptoError } = await supabase
      .from('cryptocurrency_rates')
      .upsert(cryptoPairs, { onConflict: 'from_currency,to_currency' })

    if (cryptoError) {
      console.error('❌ Error seeding cryptocurrency_rates:', cryptoError)
      throw cryptoError
    }
    console.log('✅ Cryptocurrency rates seeded successfully')

    // Seed some cryptocurrencies metadata
    const cryptoMetadata = [
      { code: 'BTC', name: 'Bitcoin', coingecko_id: 'bitcoin' },
      { code: 'ETH', name: 'Ethereum', coingecko_id: 'ethereum' },
      { code: 'USDT', name: 'Tether', coingecko_id: 'tether' },
      { code: 'BNB', name: 'Binance Coin', coingecko_id: 'binancecoin' },
      { code: 'SOL', name: 'Solana', coingecko_id: 'solana' },
      { code: 'XRP', name: 'XRP', coingecko_id: 'ripple' },
      { code: 'ADA', name: 'Cardano', coingecko_id: 'cardano' },
      { code: 'DOGE', name: 'Dogecoin', coingecko_id: 'dogecoin' },
      { code: 'LINK', name: 'Chainlink', coingecko_id: 'chainlink' },
      { code: 'MATIC', name: 'Polygon', coingecko_id: 'matic-network' }
    ]

    console.log(`📝 Seeding ${cryptoMetadata.length} cryptocurrency metadata...`)
    const { error: metaError } = await supabase
      .from('cryptocurrencies')
      .upsert(cryptoMetadata, { onConflict: 'code' })

    if (metaError) {
      console.error('❌ Error seeding cryptocurrencies:', metaError)
      throw metaError
    }
    console.log('✅ Cryptocurrency metadata seeded successfully')

    // Seed currencies metadata for PHP
    const currencyMetadata = [
      { code: 'PHP', name: 'Philippine Peso', symbol: '₱', type: 'currency', decimals: 2, is_default: true, active: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'EUR', name: 'Euro', symbol: '€', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'GBP', name: 'British Pound', symbol: '£', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', type: 'currency', decimals: 0, is_default: false, active: true },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'THB', name: 'Thai Baht', symbol: '฿', type: 'currency', decimals: 2, is_default: false, active: true },
      { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', type: 'currency', decimals: 0, is_default: false, active: true },
      { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', type: 'currency', decimals: 0, is_default: false, active: true },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩', type: 'currency', decimals: 0, is_default: false, active: true }
    ]

    console.log(`📝 Seeding ${currencyMetadata.length} currency metadata...`)
    const { error: currError } = await supabase
      .from('currencies')
      .upsert(currencyMetadata, { onConflict: 'code' })

    if (currError) {
      console.error('❌ Error seeding currencies:', currError)
      throw currError
    }
    console.log('✅ Currency metadata seeded successfully')

    console.log('✅ All rates seeded successfully!')
    console.log('')
    console.log('📊 Summary:')
    console.log(`   ✓ ${currencyPairs.length} currency pairs`)
    console.log(`   ✓ ${cryptoPairs.length} cryptocurrency pairs`)
    console.log(`   ✓ ${cryptoMetadata.length} cryptocurrencies`)
    console.log(`   ✓ ${currencyMetadata.length} currencies`)
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

seedRates()
