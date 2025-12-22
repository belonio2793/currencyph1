#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const EXCONVERT_KEY = process.env.EXCONVERT || process.env.VITE_EXCONVERT

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !EXCONVERT_KEY) {
  console.error('❌ Missing required environment variables')
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE ? '✓' : '✗')
  console.error('   EXCONVERT:', EXCONVERT_KEY ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

// All ~163 supported fiat currencies (ISO 4217)
const WORLD_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM',
  'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD',
  'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP',
  'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ETB',
  'EUR', 'FJD', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD',
  'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR',
  'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW',
  'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD',
  'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK',
  'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR',
  'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD',
  'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLL',
  'SOS', 'SRD', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND',
  'TOP', 'TRY', 'TTD', 'TVD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'USN',
  'UYU', 'UZS', 'VEF', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWL'
]

// All 31 supported cryptocurrencies on ExConvert
const CRYPTO_CURRENCIES = [
  'BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'DOT', 'LINK',
  'UNI', 'AAVE', 'USDC', 'BNB', 'XLM', 'TRX', 'HBAR', 'BCH', 'SHIB', 'OP',
  'NEAR', 'ICP', 'FIL', 'APT', 'ATOM', 'AUCTION', 'AVA', 'AXS', 'BAKE', 'BAND', 'BHD'
]

async function fetchSingleRate(fromCurrency, toCurrency) {
  try {
    const url = `https://api.exconvert.com/convert?access_key=${EXCONVERT_KEY}&from=${fromCurrency}&to=${toCurrency}&amount=1`
    
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    })

    if (!resp.ok) {
      return null
    }

    const json = await resp.json()
    if (json.result && typeof json.result === 'object') {
      const rateValue = json.result[toCurrency] || json.result.rate
      if (typeof rateValue === 'number' && rateValue > 0) {
        return rateValue
      }
    }
    return null
  } catch (e) {
    return null
  }
}

async function storeRatesInDatabase(rates) {
  if (rates.length === 0) return 0

  console.log(`💾 Storing ${rates.length} rates in database...`)

  try {
    // Split into batches to avoid large transactions
    const batchSize = 5000
    let storedCount = 0

    for (let i = 0; i < rates.length; i += batchSize) {
      const batch = rates.slice(i, Math.min(i + batchSize, rates.length))

      // Upsert to pairs table (for all pair conversions)
      const { error: pairsError } = await supabase
        .from('pairs')
        .upsert(batch.map(r => ({
          from_currency: r.from_currency,
          to_currency: r.to_currency,
          rate: r.rate,
          source_table: 'exconvert',
          updated_at: new Date().toISOString()
        })), { onConflict: 'from_currency,to_currency' })

      if (pairsError) {
        console.warn(`❌ Batch ${Math.floor(i / batchSize) + 1} failed (pairs):`, pairsError.message)
        continue
      }

      // Also store in crypto_rates for compatibility
      const { error: cryptoError } = await supabase
        .from('crypto_rates')
        .upsert(batch.map(r => ({
          from_currency: r.from_currency,
          to_currency: r.to_currency,
          rate: r.rate.toString(),
          source: 'exconvert',
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString()
        })), { onConflict: 'from_currency,to_currency' })

      if (cryptoError) {
        console.warn(`❌ Batch ${Math.floor(i / batchSize) + 1} failed (crypto_rates):`, cryptoError.message)
        continue
      }

      storedCount += batch.length
      console.log(`   ✅ Stored batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`)
    }

    return storedCount
  } catch (e) {
    console.error('❌ Storage failed:', e.message)
    return 0
  }
}

async function fetchAllRates() {
  const allCurrencies = [...WORLD_CURRENCIES, ...CRYPTO_CURRENCIES]
  const totalPairs = allCurrencies.length * (allCurrencies.length - 1)

  console.log('\n🚀 Starting Comprehensive ExConvert Rate Fetch\n')
  console.log(`📊 Configuration:`)
  console.log(`   Fiat currencies: ${WORLD_CURRENCIES.length}`)
  console.log(`   Cryptocurrencies: ${CRYPTO_CURRENCIES.length}`)
  console.log(`   Total symbols: ${allCurrencies.length}`)
  console.log(`   Total pairs to fetch: ${totalPairs.toLocaleString()}`)
  console.log(`   Estimated time: ${Math.round(totalPairs * 0.15 / 60)} minutes (at 150ms per request)\n`)

  const startTime = Date.now()
  const rates = []
  let successCount = 0
  let failureCount = 0
  let fiatCount = 0
  let cryptoCount = 0

  // Fetch all fiat-to-fiat rates
  console.log('📊 Stage 1: Fetching fiat currency pairs...\n')
  for (let i = 0; i < WORLD_CURRENCIES.length; i++) {
    const fromCurrency = WORLD_CURRENCIES[i]

    for (let j = 0; j < WORLD_CURRENCIES.length; j++) {
      if (i === j) continue

      const toCurrency = WORLD_CURRENCIES[j]
      const rate = await fetchSingleRate(fromCurrency, toCurrency)

      if (rate !== null) {
        rates.push({
          from_currency: fromCurrency,
          to_currency: toCurrency,
          rate: rate
        })
        successCount++
        fiatCount++
      } else {
        failureCount++
      }

      await new Promise(resolve => setTimeout(resolve, 150))
    }

    if ((i + 1) % 20 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`⏳ Fiat progress: ${i + 1}/${WORLD_CURRENCIES.length} (${successCount} pairs, ${elapsed}s)`)
    }
  }

  // Fetch crypto-to-fiat and crypto-to-crypto rates
  console.log(`\n📊 Stage 2: Fetching cryptocurrency pairs...\n`)
  for (let i = 0; i < CRYPTO_CURRENCIES.length; i++) {
    const fromCrypto = CRYPTO_CURRENCIES[i]

    // Crypto to all major fiats
    const majorFiats = ['USD', 'EUR', 'GBP', 'JPY', 'PHP', 'SGD', 'HKD', 'CAD', 'AUD', 'NZD', 'CHF', 'CNY', 'INR', 'BRL', 'MXN']

    for (const toFiat of majorFiats) {
      const rate = await fetchSingleRate(fromCrypto, toFiat)

      if (rate !== null) {
        rates.push({
          from_currency: fromCrypto,
          to_currency: toFiat,
          rate: rate
        })
        successCount++
        cryptoCount++
      } else {
        failureCount++
      }

      await new Promise(resolve => setTimeout(resolve, 150))
    }

    // Crypto to other cryptos
    for (const toCrypto of CRYPTO_CURRENCIES) {
      if (fromCrypto === toCrypto) continue

      const rate = await fetchSingleRate(fromCrypto, toCrypto)

      if (rate !== null) {
        rates.push({
          from_currency: fromCrypto,
          to_currency: toCrypto,
          rate: rate
        })
        successCount++
        cryptoCount++
      } else {
        failureCount++
      }

      await new Promise(resolve => setTimeout(resolve, 150))
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`⏳ Crypto progress: ${i + 1}/${CRYPTO_CURRENCIES.length} (${cryptoCount} pairs, ${elapsed}s)`)
  }

  const stored = await storeRatesInDatabase(rates)

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2)
  console.log(`\n✨ Fetch Complete!\n`)
  console.log(`📈 Results:`)
  console.log(`   Total time: ${totalTime} minutes`)
  console.log(`   Fiat pairs fetched: ${fiatCount}`)
  console.log(`   Crypto pairs fetched: ${cryptoCount}`)
  console.log(`   Successful fetches: ${successCount}`)
  console.log(`   Failed fetches: ${failureCount}`)
  console.log(`   Success rate: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%`)
  console.log(`   Stored in database: ${stored}`)
}

fetchAllRates().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
