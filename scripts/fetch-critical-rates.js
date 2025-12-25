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

// Only critical pairs - much faster
const CRITICAL_FIAT = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'HKD', 'INR', 'MYR', 'THB', 'VND', 'KRW', 'ZAR', 'BRL', 'MXN', 'NOK', 'DKK', 'AED']
const CRITICAL_CRYPTO = ['BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'AVAX', 'BCH', 'LTC', 'XLM', 'LINK', 'DOT', 'UNI', 'AAVE', 'TON', 'TRX', 'SHIB', 'WLD', 'HBAR', 'PYUSD', 'SUI', 'USDC', 'MATIC']
const BASE_FIAT = 'PHP'

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
  if (rates.length === 0) {
    console.log('⚠️  No rates to store')
    return 0
  }

  console.log(`\n💾 Storing ${rates.length} rates in database...`)

  try {
    const batchSize = 100
    let storedCount = 0

    for (let i = 0; i < rates.length; i += batchSize) {
      const batch = rates.slice(i, Math.min(i + batchSize, rates.length))

      const { error } = await supabase
        .from('pairs')
        .upsert(batch.map(r => ({
          from_currency: r.from_currency,
          to_currency: r.to_currency,
          rate: r.rate,
          source_table: 'exconvert',
          updated_at: new Date().toISOString()
        })), { onConflict: 'from_currency,to_currency' })

      if (error) {
        console.warn(`⚠️  Batch ${Math.floor(i / batchSize) + 1} warning:`, error.message)
        continue
      }

      storedCount += batch.length
      const percent = ((i + batch.length) / rates.length * 100).toFixed(1)
      console.log(`   ✅ Stored batch ${Math.floor(i / batchSize) + 1} - ${percent}% complete`)
    }

    return storedCount
  } catch (e) {
    console.error('❌ Storage failed:', e.message)
    return 0
  }
}

async function fetchCriticalRates() {
  const totalPairs = (CRITICAL_FIAT.length + CRITICAL_CRYPTO.length) + (CRITICAL_FIAT.length * CRITICAL_CRYPTO.length)

  console.log('\n🚀 Fetching Critical Rates from ExConvert\n')
  console.log(`📊 Configuration:`)
  console.log(`   Fiat currencies: ${CRITICAL_FIAT.length}`)
  console.log(`   Cryptocurrencies: ${CRITICAL_CRYPTO.length}`)
  console.log(`   Target: ${BASE_FIAT}`)
  console.log(`   Estimated pairs to fetch: ~${totalPairs}\n`)

  const startTime = Date.now()
  const rates = []
  let successCount = 0
  let failureCount = 0

  // Stage 1: Fetch fiat currencies to PHP
  console.log('📊 Stage 1: Fetching fiat → PHP rates...\n')
  for (let i = 0; i < CRITICAL_FIAT.length; i++) {
    const currency = CRITICAL_FIAT[i]
    const rate = await fetchSingleRate(currency, BASE_FIAT)

    if (rate !== null) {
      rates.push({
        from_currency: currency,
        to_currency: BASE_FIAT,
        rate: rate
      })
      successCount++
    } else {
      failureCount++
    }

    if ((i + 1) % 5 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`⏳ Fiat progress: ${i + 1}/${CRITICAL_FIAT.length} (${successCount} pairs, ${elapsed}s)`)
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Stage 2: Fetch cryptocurrencies to PHP
  console.log(`\n📊 Stage 2: Fetching crypto → PHP rates...\n`)
  for (let i = 0; i < CRITICAL_CRYPTO.length; i++) {
    const currency = CRITICAL_CRYPTO[i]
    const rate = await fetchSingleRate(currency, BASE_FIAT)

    if (rate !== null) {
      rates.push({
        from_currency: currency,
        to_currency: BASE_FIAT,
        rate: rate
      })
      successCount++
    } else {
      failureCount++
    }

    if ((i + 1) % 5 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`⏳ Crypto progress: ${i + 1}/${CRITICAL_CRYPTO.length} (${successCount} pairs, ${elapsed}s)`)
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const stored = await storeRatesInDatabase(rates)

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2)
  console.log(`\n✨ Fetch Complete!\n`)
  console.log(`📈 Results:`)
  console.log(`   Total time: ${totalTime} minutes`)
  console.log(`   Successful fetches: ${successCount}`)
  console.log(`   Failed fetches: ${failureCount}`)
  console.log(`   Success rate: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%`)
  console.log(`   Stored in database: ${stored}\n`)
  
  if (stored > 0) {
    console.log('✅ Critical rates updated successfully!')
    console.log('📡 All 45+ critical currency pairs should now have live rates.')
  }
}

fetchCriticalRates().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
