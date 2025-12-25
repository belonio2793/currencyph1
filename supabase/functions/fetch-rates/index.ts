import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

// Read env
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_PROJECT_URL')
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY')
const OPEN_EXCHANGE_KEY = Deno.env.get('OPEN_EXCHANGE_RATES_API') || Deno.env.get('VITE_OPEN_EXCHANGE_RATES_API')

console.log('[fetch-rates] Starting service with Supabase URL:', SUPABASE_URL ? 'configured' : 'MISSING')
console.log('[fetch-rates] OpenExchangeRates API:', OPEN_EXCHANGE_KEY ? 'configured' : 'MISSING')

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

// Complete list of all supported fiat currencies from ExConvert (ISO 4217)
// ExConvert supports ~163 fiat currencies
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

// All 31 cryptocurrencies supported by ExConvert
const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'DOT', 'LINK',
  'UNI', 'AAVE', 'USDC', 'BNB', 'XLM', 'TRX', 'HBAR', 'BCH', 'SHIB', 'OP',
  'NEAR', 'ICP', 'FIL', 'APT', 'ATOM', 'AUCTION', 'AVA', 'AXS', 'BAKE', 'BAND', 'BHD'
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

async function fetchAllRatesFromDatabase() {
  try {
    console.log('[Database] Fetching all pairs from database...')

    const { data, error } = await supabase
      .from('pairs')
      .select('from_currency,to_currency,rate')
      .limit(100000)

    if (error) {
      console.warn('[Database] Error fetching pairs:', error)
      return null
    }

    if (!data || data.length === 0) {
      console.log('[Database] No pairs found in database')
      return null
    }

    const allRates: Record<string, Record<string, number>> = {}
    for (const row of data) {
      if (!allRates[row.from_currency]) {
        allRates[row.from_currency] = {}
      }
      allRates[row.from_currency][row.to_currency] = parseFloat(row.rate)
    }

    console.log(`[Database] Loaded ${data.length} rates from database`)
    return Object.keys(allRates).length > 0 ? allRates : null
  } catch (e) {
    console.warn('[Database] Failed to fetch rates:', e?.message || e)
    return null
  }
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
    const invalidRates: { pair: string; rate: number }[] = []

    for (const [fromCurrency, ratesMap] of Object.entries(allRates)) {
      for (const [toCurrency, rate] of Object.entries(ratesMap)) {
        const numRate = typeof rate === 'number' ? rate : parseFloat(rate as unknown as string)

        // Validate rate is a valid number and > 0 (not 0.00 or NaN)
        if (typeof numRate === 'number' && isFinite(numRate) && numRate > 0) {
          const fromUpper = fromCurrency.toUpperCase()
          const toUpper = toCurrency.toUpperCase()
          const rateStr = numRate.toString()

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
            rate: numRate,
            source_table: source,
            updated_at: updatedAt
          })
        } else {
          // Track invalid rates for logging
          const fromUpper = fromCurrency.toUpperCase()
          const toUpper = toCurrency.toUpperCase()
          invalidRates.push({
            pair: `${fromUpper}/${toUpper}`,
            rate: numRate
          })
        }
      }
    }

    if (invalidRates.length > 0) {
      console.warn(`[Database] Filtered out ${invalidRates.length} invalid rates (0.00 or NaN):`,
        invalidRates.map(r => `${r.pair}=${r.rate}`).join(', '))
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

  // Try to fetch from database first
  try {
    console.log('[fetch-rates] Fetching rates from database...')

    let allRates: Record<string, Record<string, number>> | null = null
    let source = 'database'

    // Primary source: fetch from database (populated by external script)
    allRates = await fetchAllRatesFromDatabase()

    if (allRates && Object.keys(allRates).length > 0) {
      console.log('[fetch-rates] Database fetch succeeded, loaded', Object.keys(allRates).length, 'currencies')

      // Also fetch crypto prices from CoinGecko for supplementary data
      const [cryptoPricesUSD, cryptoPricesPHP] = await Promise.all([
        fetchCoinGecko('usd'),
        fetchCoinGecko('php')
      ])

      const cryptoPrices = { ...cryptoPricesUSD, ...cryptoPricesPHP }
      if (Object.keys(cryptoPrices).length > 0) {
        console.log('[fetch-rates] CoinGecko succeeded with', Object.keys(cryptoPrices).length, 'cryptos')
      }

      // Return database rates + crypto prices
      return jsonResponse({
        success: true,
        cached: false,
        fetched_at: new Date().toISOString(),
        source: 'database',
        total_fiat_pairs: Object.values(allRates).reduce((sum, rates) => sum + Object.keys(rates).length, 0),
        total_currencies: Object.keys(allRates).length,
        cryptocurrencies: Object.keys(cryptoPrices).length,
        message: 'Rates loaded from database'
      })
    }

    // Fallback if database is empty
    console.warn('[fetch-rates] Database is empty, falling back to OpenExchangeRates + CoinGecko...')

    // Use OpenExchangeRates + CoinGecko (do NOT use EXCONVERT)
    const [exchangeRates, cryptoPricesUSD, cryptoPricesPHP] = await Promise.all([
      fetchOpenExchangeRates(),
      fetchCoinGecko('usd'),
      fetchCoinGecko('php')
    ])

    const fallbackRates: Record<string, Record<string, number>> = {}

    // Add fiat currency rates from OpenExchangeRates
    if (exchangeRates) {
      fallbackRates['USD'] = exchangeRates
      console.log('[fetch-rates] OpenExchangeRates succeeded')
    } else {
      console.warn('[fetch-rates] OpenExchangeRates failed')
    }

    // Add crypto rates from CoinGecko
    const cryptoPrices = { ...cryptoPricesUSD, ...cryptoPricesPHP }
    if (Object.keys(cryptoPrices).length > 0) {
      // Convert CoinGecko format to our format
      for (const [coingeckoId, priceData] of Object.entries(cryptoPrices)) {
        const cryptoCode = coingeckoIdToCryptoCode[coingeckoId as string] || (coingeckoId as string).toUpperCase()
        fallbackRates[cryptoCode] = priceData as Record<string, number>
      }
      console.log('[fetch-rates] CoinGecko succeeded with', Object.keys(cryptoPrices).length, 'cryptos')
      source = 'openexchange_coingecko'
    } else {
      console.warn('[fetch-rates] CoinGecko failed')
    }

    allRates = fallbackRates

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
          warning: 'Using stale cached data - APIs currently unavailable',
          service_status: 'degraded',
          message: 'Service temporarily unavailable - using cached rates'
        })
      }
      // fallback to empty - service is unavailable
      await upsertCachedRates({}, {}, 'fallback')
      return jsonResponse({
        exchangeRates: {},
        cryptoPrices: {},
        cached: false,
        error: 'Service is temporarily unavailable - please try again later',
        service_status: 'unavailable',
        message: 'Rate conversion service unavailable'
      }, 503)
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
