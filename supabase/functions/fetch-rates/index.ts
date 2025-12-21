import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

// Read env
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_PROJECT_URL')
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY')
const OPEN_EXCHANGE_KEY = Deno.env.get('OPEN_EXCHANGE_RATES_API') || Deno.env.get('VITE_OPEN_EXCHANGE_RATES_API')

console.log('[fetch-rates] Starting service with Supabase URL:', SUPABASE_URL ? 'configured' : 'MISSING')

const CACHED_TTL_MS = 1000 * 60 * 60 // 1 hour

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=300'
    }
  })
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn('Supabase config missing in function environment')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

async function fetchOpenExchangeRates() {
  if (!OPEN_EXCHANGE_KEY) return null
  try {
    const url = `https://openexchangerates.org/api/latest.json?app_id=${OPEN_EXCHANGE_KEY}`
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!resp.ok) {
      console.warn('OpenExchangeRates returned', resp.status)
      return null
    }
    const json = await resp.json()
    return json.rates || null
  } catch (e) {
    console.warn('OpenExchangeRates fetch failed', e?.message || e)
    return null
  }
}

async function fetchCoinGecko(toCurrency = 'php') {
  try {
    // All 30 cryptocurrencies from /deposits
    const cryptoIds = [
      'bitcoin','ethereum','litecoin','dogecoin','ripple','cardano','solana','avalanche-2','polkadot','chainlink','uniswap','aave','usd-coin','tether','binancecoin','stellar','tron','hedera-hashgraph','the-open-network','sui',
      'bitcoin-cash','shiba-inu','paypal-usd','world-coin','tether-gold','pepe','hyperliquid','asterzk','ethena','sky'
    ].join(',')
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=${toCurrency}&precision=8&include_market_cap=true&include_24hr_vol=true`

    // Retry logic
    let lastError
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await Promise.race([
          fetch(url, { headers: { Accept: 'application/json' } }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ])

        if (!resp.ok) {
          if (resp.status >= 500) {
            // Server error, retry
            lastError = new Error(`CoinGecko ${resp.status}`)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
            continue
          }
          return null
        }

        const json = await resp.json()
        return json
      } catch (e) {
        lastError = e
        if (attempt < 2) {
          const delay = 500 * Math.pow(2, attempt) + Math.random() * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    console.warn('CoinGecko fetch failed after retries:', lastError?.message || lastError)
    return null
  } catch (e) {
    console.warn('CoinGecko fetch failed', e?.message || e)
    return null
  }
}

async function getCachedLatest() {
  try {
    const { data, error } = await supabase
      .from('cached_rates')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(1)

    if (error) {
      console.warn('cached_rates select error', error)
      return null
    }
    return (data && data[0]) || null
  } catch (e) {
    console.warn('getCachedLatest failed', e)
    return null
  }
}

async function upsertCachedRates(exchangeRates, cryptoPrices, source = 'openexchangerates') {
  try {
    const payload = {
      exchange_rates: exchangeRates || {},
      crypto_prices: cryptoPrices || {},
      fetched_at: new Date().toISOString(),
      source
    }
    const { error } = await supabase.from('cached_rates').insert([payload])
    if (error) console.warn('Failed to insert cached_rates', error)
  } catch (e) {
    console.warn('upsertCachedRates failed', e)
  }
}

// Map CoinGecko IDs to crypto codes for storage
// All 30 cryptocurrencies from /deposits
const coingeckoIdToCryptoCode = {
  'bitcoin': 'BTC',
  'ethereum': 'ETH',
  'litecoin': 'LTC',
  'dogecoin': 'DOGE',
  'ripple': 'XRP',
  'cardano': 'ADA',
  'solana': 'SOL',
  'avalanche-2': 'AVAX',
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
  'sui': 'SUI',
  'bitcoin-cash': 'BCH',
  'shiba-inu': 'SHIB',
  'paypal-usd': 'PYUSD',
  'world-coin': 'WLD',
  'tether-gold': 'XAUT',
  'pepe': 'PEPE',
  'hyperliquid': 'HYPE',
  'asterzk': 'ASTER',
  'ethena': 'ENA',
  'sky': 'SKY'
}

async function storeCryptoPricesInDatabase(cryptoPrices, toCurrency = 'php') {
  try {
    const toCurrencyUpper = toCurrency.toUpperCase()
    const records = []
    const updatedAt = new Date().toISOString()

    for (const [coingeckoId, priceData] of Object.entries(cryptoPrices)) {
      const cryptoCode = coingeckoIdToCryptoCode[coingeckoId] || coingeckoId.toUpperCase()
      const price = priceData[toCurrency] || priceData['php'] || priceData['usd']

      if (price) {
        records.push({
          from_currency: cryptoCode,
          to_currency: toCurrencyUpper,
          rate: price.toString(),
          source: 'coingecko',
          updated_at: updatedAt,
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
        })
      }
    }

    if (records.length > 0) {
      const { error } = await supabase
        .from('crypto_rates')
        .upsert(records, { onConflict: 'from_currency,to_currency' })

      if (error) {
        console.warn('Failed to store crypto prices in database:', error)
      } else {
        console.log(`Stored ${records.length} crypto rates in database`)
      }
    }

    return records
  } catch (e) {
    console.warn('storeCryptoPricesInDatabase failed:', e?.message || e)
    return []
  }
}

// Get rate confirmations for user display
async function getRateConfirmations(cryptoPrices, toCurrency = 'php') {
  try {
    const toCurrencyUpper = toCurrency.toUpperCase()
    const confirmations = []
    const now = new Date()

    for (const [coingeckoId, priceData] of Object.entries(cryptoPrices)) {
      const cryptoCode = coingeckoIdToCryptoCode[coingeckoId] || coingeckoId.toUpperCase()
      const price = priceData[toCurrency] || priceData['php'] || priceData['usd']

      if (price) {
        confirmations.push({
          from_currency: cryptoCode,
          to_currency: toCurrencyUpper,
          rate: price,
          rate_formatted: `${price.toFixed(2)} ${toCurrencyUpper}`,
          source: 'coingecko',
          fetched_at: now.toISOString(),
          timestamp: {
            readable: `today at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} UTC`,
            date: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          },
          confirmation_message: `${cryptoCode} rate confirmed at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} UTC`
        })
      }
    }

    return confirmations
  } catch (e) {
    console.warn('getRateConfirmations failed:', e?.message || e)
    return []
  }
}

// Main handler
async function handle(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Only GET/POST requests allowed' }, 405)
  }

  // First try to return cached entry if fresh
  try {
    const cached = await getCachedLatest()
    if (cached && cached.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime()
      if (age < CACHED_TTL_MS) {
        console.log('[fetch-rates] Returning fresh cached rates, age:', Math.round(age / 1000), 'seconds')
        // Build confirmations from cached crypto prices
        const cachedConfirmations = await getRateConfirmations(cached.crypto_prices || {}, 'php')
        return jsonResponse({
          exchangeRates: cached.exchange_rates || {},
          cryptoPrices: cached.crypto_prices || {},
          cached: true,
          fetched_at: cached.fetched_at,
          age: Math.round(age / 1000),
          rate_confirmations: cachedConfirmations.slice(0, 10),
          total_confirmations: cachedConfirmations.length,
          cryptocurrencies_processed: Object.keys(cached.crypto_prices || {}).length
        })
      }
    }
  } catch (e) {
    console.warn('[fetch-rates] Cache check failed:', e)
  }

  // Not fresh - fetch new from primary sources
  try {
    console.log('[fetch-rates] Fetching fresh rates for 30 cryptocurrencies from APIs...')
    const [exchangeRates, cryptoPricesUSD, cryptoPricesPHP] = await Promise.all([
      fetchOpenExchangeRates(),
      fetchCoinGecko('usd'),
      fetchCoinGecko('php')
    ])

    // Combine crypto prices (PHP takes priority)
    const cryptoPrices = { ...cryptoPricesUSD, ...cryptoPricesPHP }
    console.log(`[fetch-rates] Processing ${Object.keys(cryptoPricesPHP || {}).length} cryptocurrency prices`)

    // If exchangeRates not available, try last cached (even if stale)
    if (!exchangeRates && !cryptoPrices) {
      console.warn('[fetch-rates] Both APIs failed, falling back to cache')
      const last = await getCachedLatest()
      if (last) {
        const staleConfirmations = await getRateConfirmations(last.crypto_prices || {}, 'php')
        return jsonResponse({
          exchangeRates: last.exchange_rates || {},
          cryptoPrices: last.crypto_prices || {},
          cached: true,
          fetched_at: last.fetched_at,
          rate_confirmations: staleConfirmations.slice(0, 10),
          total_confirmations: staleConfirmations.length,
          warning: 'Using stale cached data - APIs currently unavailable'
        })
      }
      // fallback to empty
      await upsertCachedRates({}, {}, 'fallback')
      return jsonResponse({
        exchangeRates: {},
        cryptoPrices: {},
        cached: false,
        error: 'All APIs failed and no cached data available'
      }, 500)
    }

    // Store and return
    console.log('[fetch-rates] Successfully fetched rates, storing cache')
    const [_, rateConfirmations] = await Promise.all([
      Promise.all([
        upsertCachedRates(exchangeRates || {}, cryptoPrices || {}, 'mixed'),
        storeCryptoPricesInDatabase(cryptoPricesPHP || {}, 'php')
      ]),
      getRateConfirmations(cryptoPricesPHP || {}, 'php')
    ])

    return jsonResponse({
      exchangeRates: exchangeRates || {},
      cryptoPrices: cryptoPrices || {},
      cached: false,
      fetched_at: new Date().toISOString(),
      rate_confirmations: rateConfirmations.slice(0, 10), // Return first 10 for UI
      total_confirmations: rateConfirmations.length,
      message: 'All rates updated with timestamps for user confirmation'
    })
  } catch (err) {
    console.error('[fetch-rates] Handler error:', err)
    // Try to return last known good rates
    try {
      const last = await getCachedLatest()
      if (last) {
        console.log('[fetch-rates] Returning stale cached rates as fallback')
        const fallbackConfirmations = await getRateConfirmations(last.crypto_prices || {}, 'php')
        return jsonResponse({
          exchangeRates: last.exchange_rates || {},
          cryptoPrices: last.crypto_prices || {},
          cached: true,
          fetched_at: last.fetched_at,
          rate_confirmations: fallbackConfirmations.slice(0, 10),
          total_confirmations: fallbackConfirmations.length,
          warning: 'Returning stale cache due to error - rates may be outdated'
        })
      }
    } catch (cacheErr) {
      console.error('[fetch-rates] Cache fallback also failed:', cacheErr)
    }

    return jsonResponse({
      exchangeRates: {},
      cryptoPrices: {},
      cached: false,
      error: String(err),
      fetched_at: new Date().toISOString()
    }, 500)
  }
}

// Start the service
serve(handle, { hostname: '0.0.0.0', port: 8000 })
