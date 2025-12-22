import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

// Read env
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_PROJECT_URL')
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY')
const EXCONVERT_KEY = Deno.env.get('EXCONVERT') || Deno.env.get('VITE_EXCONVERT')
const OPEN_EXCHANGE_KEY = Deno.env.get('OPEN_EXCHANGE_RATES_API') || Deno.env.get('VITE_OPEN_EXCHANGE_RATES_API')

console.log('[fetch-rates] Starting service with Supabase URL:', SUPABASE_URL ? 'configured' : 'MISSING')
console.log('[fetch-rates] ExConvert API:', EXCONVERT_KEY ? 'configured' : 'MISSING')

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

// List of major world currencies to fetch rates for
const WORLD_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD',
  'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR',
  'PHP', 'THB', 'MYR', 'IDR', 'VND', 'PKR', 'BDT', 'AED', 'SAR', 'QAR',
  'KWD', 'JOD', 'ILS', 'EGP', 'NGN', 'KES', 'GHS', 'CLP', 'PEN', 'COP',
  'UYU', 'ARS', 'VEF', 'CZK', 'HUF', 'PLN', 'RON', 'BGN', 'HRK', 'RSD'
]

// All 30 cryptocurrencies (by symbol for easier API queries)
const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'DOT', 'LINK',
  'UNI', 'AAVE', 'USDC', 'USDT', 'BNB', 'XLM', 'TRX', 'HBAR', 'TON', 'SUI',
  'BCH', 'SHIB', 'PYUSD', 'WLD', 'XAUT', 'PEPE', 'HYPE', 'ASTER', 'ENA', 'SKY'
]

async function fetchExConvertRates(fromCurrency: string, toCurrencies: string[]) {
  if (!EXCONVERT_KEY) return null

  const rates: Record<string, number> = {}

  try {
    // ExConvert API only accepts one target currency per request
    // Make individual requests for each target currency
    for (const toCurrency of toCurrencies) {
      try {
        const url = `https://api.exconvert.com/convert?access_key=${EXCONVERT_KEY}&from=${fromCurrency}&to=${toCurrency}&amount=1`

        const resp = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000)
        })

        if (!resp.ok) {
          console.warn(`[ExConvert] Failed for ${fromCurrency}→${toCurrency}: ${resp.status}`)
          continue
        }

        const json = await resp.json()

        // ExConvert returns: { base: "USD", amount: "1", result: { [currency]: rate }, ms: 2 }
        if (json.result && typeof json.result === 'object') {
          // Find the rate value from result object
          const rateValue = json.result[toCurrency] || json.result.rate
          if (typeof rateValue === 'number' && rateValue > 0) {
            rates[toCurrency] = rateValue
          }
        }
      } catch (e) {
        console.warn(`[ExConvert] Individual request failed for ${fromCurrency}→${toCurrency}:`, e?.message || e)
        continue
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return Object.keys(rates).length > 0 ? rates : null
  } catch (e) {
    console.warn(`[ExConvert] fetch failed for ${fromCurrency}:`, e?.message || e)
    return null
  }
}

async function fetchAllExConvertRates() {
  const allRates: Record<string, Record<string, number>> = {}

  // Since ExConvert charges per request and we make individual API calls,
  // we'll be selective about which currencies we fetch
  const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'PHP', 'SGD', 'HKD']
  const targetCurrencies = ['USD', 'PHP', 'EUR', 'GBP']

  console.log('[ExConvert] Fetching major currency pairs to minimize API calls')
  console.log('[ExConvert] From currencies:', majorCurrencies.length, 'To currencies:', targetCurrencies.length)

  // Fetch major currency pairs (limited scope for API efficiency)
  for (const fromCurrency of majorCurrencies) {
    const targetForThisCurrency = targetCurrencies.filter(c => c !== fromCurrency)
    if (targetForThisCurrency.length === 0) continue

    console.log(`[ExConvert] Fetching ${fromCurrency} to [${targetForThisCurrency.join(',')}]`)
    const rates = await fetchExConvertRates(fromCurrency, targetForThisCurrency)
    if (rates) {
      allRates[fromCurrency] = rates
    }
  }

  // Fetch cryptocurrencies to major currencies
  console.log('[ExConvert] Fetching', CRYPTO_SYMBOLS.length, 'cryptocurrencies')
  for (const cryptoSymbol of CRYPTO_SYMBOLS) {
    const rates = await fetchExConvertRates(cryptoSymbol, targetCurrencies)
    if (rates) {
      allRates[cryptoSymbol] = rates
    }
  }

  return Object.keys(allRates).length > 0 ? allRates : null
}

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

async function storeAllRatesInDatabase(allRates: Record<string, Record<string, number>>, source = 'exconvert') {
  try {
    const cryptoRatesRecords: any[] = []
    const pairsRecords: any[] = []
    const updatedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 3600000).toISOString() // 1 hour

    for (const [fromCurrency, ratesMap] of Object.entries(allRates)) {
      for (const [toCurrency, rate] of Object.entries(ratesMap)) {
        if (typeof rate === 'number' && rate > 0) {
          const fromUpper = fromCurrency.toUpperCase()
          const toUpper = toCurrency.toUpperCase()
          const rateStr = rate.toString()

          // Record for crypto_rates table
          cryptoRatesRecords.push({
            from_currency: fromUpper,
            to_currency: toUpper,
            rate: rateStr,
            source,
            updated_at: updatedAt,
            expires_at: expiresAt
          })

          // Record for pairs table
          pairsRecords.push({
            from_currency: fromUpper,
            to_currency: toUpper,
            rate: rate,
            source_table: source,
            updated_at: updatedAt
          })
        }
      }
    }

    if (cryptoRatesRecords.length === 0) {
      return 0
    }

    console.log(`[Database] Storing ${cryptoRatesRecords.length} rate records in crypto_rates...`)
    console.log(`[Database] Storing ${pairsRecords.length} rate records in pairs...`)

    // Insert into crypto_rates
    const { error: cryptoError } = await supabase
      .from('crypto_rates')
      .upsert(cryptoRatesRecords, { onConflict: 'from_currency,to_currency' })

    if (cryptoError) {
      console.warn('[Database] Failed to store rates in crypto_rates:', cryptoError)
      return 0
    } else {
      console.log(`[Database] Successfully stored ${cryptoRatesRecords.length} rates in crypto_rates`)
    }

    // Insert into pairs
    const { error: pairsError } = await supabase
      .from('pairs')
      .upsert(pairsRecords, { onConflict: 'from_currency,to_currency' })

    if (pairsError) {
      console.warn('[Database] Failed to store rates in pairs:', pairsError)
      return 0
    } else {
      console.log(`[Database] Successfully stored ${pairsRecords.length} rates in pairs`)
    }

    return cryptoRatesRecords.length
  } catch (e) {
    console.warn('[Database] storeAllRatesInDatabase failed:', e?.message || e)
    return 0
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
    console.log('[fetch-rates] Fetching fresh rates from primary source (ExConvert)...')

    let allRates: Record<string, Record<string, number>> | null = null
    let source = 'exconvert'

    // Try ExConvert first (primary - unlimited free requests)
    if (EXCONVERT_KEY) {
      console.log('[fetch-rates] Attempting ExConvert API...')
      allRates = await fetchAllExConvertRates()
      if (allRates) {
        console.log('[fetch-rates] ExConvert succeeded, fetched', Object.keys(allRates).length, 'currencies')
        source = 'exconvert'
      }
    }

    // Fallback to OpenExchangeRates + CoinGecko if ExConvert fails
    if (!allRates) {
      console.warn('[fetch-rates] ExConvert failed or unavailable, falling back to secondary sources...')
      const [exchangeRates, cryptoPricesUSD, cryptoPricesPHP] = await Promise.all([
        fetchOpenExchangeRates(),
        fetchCoinGecko('usd'),
        fetchCoinGecko('php')
      ])

      allRates = {}

      // Add fiat currency rates from OpenExchangeRates
      if (exchangeRates) {
        allRates['USD'] = exchangeRates
        console.log('[fetch-rates] OpenExchangeRates succeeded')
      }

      // Add crypto rates from CoinGecko
      const cryptoPrices = { ...cryptoPricesUSD, ...cryptoPricesPHP }
      if (Object.keys(cryptoPrices).length > 0) {
        // Convert CoinGecko format to our format
        for (const [coingeckoId, priceData] of Object.entries(cryptoPrices)) {
          const cryptoCode = coingeckoIdToCryptoCode[coingeckoId as string] || (coingeckoId as string).toUpperCase()
          allRates[cryptoCode] = priceData as Record<string, number>
        }
        console.log('[fetch-rates] CoinGecko succeeded with', Object.keys(cryptoPrices).length, 'cryptos')
        source = 'fallback_openexchange_coingecko'
      }
    }

    // If still no rates, try last cached (even if stale)
    if (!allRates || Object.keys(allRates).length === 0) {
      console.warn('[fetch-rates] All primary APIs failed, falling back to cache')
      const last = await getCachedLatest()
      if (last) {
        return jsonResponse({
          exchangeRates: last.exchange_rates || {},
          cryptoPrices: last.crypto_prices || {},
          cached: true,
          fetched_at: last.fetched_at,
          total_rates: Object.keys(last.exchange_rates || {}).length + Object.keys(last.crypto_prices || {}).length,
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

    // Store all rates in database
    console.log('[fetch-rates] Storing all rates in database...')
    const storedCount = await storeAllRatesInDatabase(allRates, source)

    // Also update cache for backward compatibility
    await upsertCachedRates({}, allRates, source)

    return jsonResponse({
      success: true,
      cached: false,
      fetched_at: new Date().toISOString(),
      source,
      total_rates_stored: storedCount,
      currency_pairs: Object.keys(allRates).length,
      message: `Successfully fetched and stored rates from ${source}`
    })
  } catch (err) {
    console.error('[fetch-rates] Handler error:', err)
    // Try to return last known good rates
    try {
      const last = await getCachedLatest()
      if (last) {
        console.log('[fetch-rates] Returning stale cached rates as fallback')
        return jsonResponse({
          exchangeRates: last.exchange_rates || {},
          cryptoPrices: last.crypto_prices || {},
          cached: true,
          fetched_at: last.fetched_at,
          total_rates: Object.keys(last.exchange_rates || {}).length + Object.keys(last.crypto_prices || {}).length,
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
