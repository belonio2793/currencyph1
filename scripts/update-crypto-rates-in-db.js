/**
 * Script to fetch crypto prices and store them in the database
 * Can be run periodically (e.g., via cron job or edge function scheduler)
 * 
 * Usage: node scripts/update-crypto-rates-in-db.js
 */

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

// Map CoinGecko IDs to crypto codes
const coingeckoIdToCryptoCode = {
  'bitcoin': 'BTC',
  'ethereum': 'ETH',
  'litecoin': 'LTC',
  'dogecoin': 'DOGE',
  'ripple': 'XRP',
  'cardano': 'ADA',
  'solana': 'SOL',
  'avalanche-2': 'AVAX',
  'matic-network': 'MATIC',
  'polkadot': 'DOT',
  'chainlink': 'LINK',
  'uniswap': 'UNI',
  'aave': 'AAVE',
  'usd-coin': 'USDC',
  'tether': 'USDT',
  'binancecoin': 'BNB',
  'stellar': 'XLM',
  'tron': 'TRX',
  'hedera-hashgraph': 'HBAR',
  'the-open-network': 'TON',
  'sui': 'SUI'
}

async function fetchWithRetry(url, maxRetries = 3) {
  let lastError
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await Promise.race([
        fetch(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), 15000)
        )
      ])
      
      if (!response.ok) {
        if (response.status >= 500 && attempt < maxRetries) {
          lastError = new Error(`HTTP ${response.status}`)
          const delay = 500 * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error(`HTTP ${response.status}`)
      }
      
      return response
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt) + Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

async function fetchCryptoPrices() {
  try {
    const cryptoIds = Object.keys(coingeckoIdToCryptoCode).join(',')
    
    console.log('📊 Fetching crypto prices from CoinGecko...')
    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=php,usd&precision=8`
    )
    
    const data = await response.json()
    console.log(`✓ Fetched prices for ${Object.keys(data).length} cryptocurrencies`)
    return data
  } catch (error) {
    console.error('❌ Failed to fetch crypto prices:', error.message)
    return null
  }
}

async function storePricesInDatabase(cryptoPrices) {
  try {
    const records = []
    
    for (const [coingeckoId, priceData] of Object.entries(cryptoPrices)) {
      const cryptoCode = coingeckoIdToCryptoCode[coingeckoId]
      if (!cryptoCode) continue
      
      // Store PHP rates
      if (priceData.php) {
        records.push({
          from_currency: cryptoCode,
          to_currency: 'PHP',
          rate: priceData.php.toString(),
          source: 'coingecko',
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
        })
      }
      
      // Store USD rates
      if (priceData.usd) {
        records.push({
          from_currency: cryptoCode,
          to_currency: 'USD',
          rate: priceData.usd.toString(),
          source: 'coingecko',
          expires_at: new Date(Date.now() + 3600000).toISOString()
        })
      }
    }
    
    if (records.length === 0) {
      console.warn('⚠️ No prices to store')
      return false
    }
    
    console.log(`📝 Storing ${records.length} rates in database...`)
    const { error } = await supabase
      .from('crypto_rates')
      .upsert(records, { onConflict: 'from_currency,to_currency' })
    
    if (error) {
      console.error('❌ Failed to store rates:', error)
      return false
    }
    
    console.log(`✓ Successfully stored ${records.length} crypto rates`)
    return true
  } catch (error) {
    console.error('❌ Error storing prices:', error.message)
    return false
  }
}

async function cleanupExpiredRates() {
  try {
    console.log('🧹 Cleaning up expired rates...')
    const { data, error } = await supabase.rpc('cleanup_expired_crypto_rates')
    
    if (error) {
      console.warn('⚠️ Cleanup error:', error.message)
      return
    }
    
    console.log(`✓ Removed ${data?.[0] || 0} expired rate entries`)
  } catch (error) {
    console.warn('⚠️ Cleanup failed:', error.message)
  }
}

async function main() {
  console.log('🚀 Starting crypto rates update...\n')
  
  const prices = await fetchCryptoPrices()
  if (!prices) {
    console.error('\n❌ Failed to fetch prices, aborting')
    process.exit(1)
  }
  
  const stored = await storePricesInDatabase(prices)
  if (!stored) {
    console.error('\n❌ Failed to store prices, aborting')
    process.exit(1)
  }
  
  await cleanupExpiredRates()
  
  console.log('\n✨ Crypto rates update completed successfully!')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
