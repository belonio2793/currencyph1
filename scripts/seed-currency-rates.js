import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

// Usage: set environment variables and run:
//   node scripts/seed-currency-rates.js
// Required env vars (from project):
// PROJECT_URL or VITE_PROJECT_URL
// SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE url or service role key. Set PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function callFetchRates() {
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/fetch-rates`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    })
    if (!res.ok) {
      throw new Error(`fetch-rates responded ${res.status}`)
    }
    return await res.json()
  } catch (err) {
    console.error('Failed calling fetch-rates edge function:', err.message || err)
    return null
  }
}

function normalizeToUsdMap(payload) {
  // Try multiple payload shapes and return a map: code -> USD price (number)
  // 1) payload.rates = array of { from_currency, to_currency, rate }
  if (!payload) return null

  const usdMap = {}

  if (Array.isArray(payload.rates) && payload.rates.length) {
    for (const r of payload.rates) {
      const from = r.from_currency || r.from || r.base_currency
      const to = r.to_currency || r.to || r.quote_currency
      const rate = Number(r.rate)
      if (!isFinite(rate)) continue
      // if from is USD -> to rate
      if (from === 'USD') usdMap[to] = rate
      // if to is USD -> from rate, then USD->from = 1/rate
      if (to === 'USD') usdMap[from] = 1 / rate
    }
  }

  // 2) payload.exchangeRates or payload.currencyRates object mapping CODE -> { rate } or number
  const candidateObjects = ['exchangeRates','currencyRates','ratesMap','rates_map','ratesMapObj','exchange_rates']
  for (const key of candidateObjects) {
    const obj = payload[key]
    if (obj && typeof obj === 'object' && Object.keys(obj).length) {
      for (const k of Object.keys(obj)) {
        const val = obj[k]
        let num = null
        if (typeof val === 'number') num = val
        else if (val && typeof val.rate === 'number') num = val.rate
        else if (val && typeof val.value === 'number') num = val.value
        if (num != null && isFinite(num)) {
          // Assume this represents USD -> k
          usdMap[k] = num
        }
      }
    }
  }

  // 3) payload.cryptoPrices may provide crypto prices in USD
  if (payload.cryptoPrices && typeof payload.cryptoPrices === 'object') {
    for (const [key, obj] of Object.entries(payload.cryptoPrices)) {
      const codeMap = {
        bitcoin: 'BTC', ethereum: 'ETH', litecoin: 'LTC', dogecoin: 'DOGE', ripple: 'XRP', cardano: 'ADA', solana: 'SOL', 'avalanche-2': 'AVAX', 'matic-network': 'MATIC', polkadot: 'DOT', chainlink: 'LINK', uniswap: 'UNI', aave: 'AAVE', 'usd-coin': 'USDC', tether: 'USDT'
      }
      const code = codeMap[key] || key.toUpperCase()
      const usd = obj && obj.usd
      if (typeof usd === 'number' && isFinite(usd)) usdMap[code] = usd
    }
  }

  // 4) fallback: if payload itself is a flat map like { USD_PHP: 56 }
  if (typeof payload === 'object') {
    for (const k of Object.keys(payload)) {
      if (/^USD_/.test(k)) {
        const code = k.replace(/^USD_/, '')
        const val = Number(payload[k])
        if (isFinite(val)) usdMap[code] = val
      }
    }
  }

  // Always set USD -> USD = 1
  usdMap['USD'] = 1

  // If map is empty, return null
  return Object.keys(usdMap).length ? usdMap : null
}

function buildPairwiseFromUsdMap(usdMap) {
  // usdMap: CODE -> USD per CODE (i.e., 1 USD = usdMap[CODE] ??? Wait: our earlier code expects USD->CODE (USD_X = rate), but different formats exist.
  // We interpret usdMap[CODE] as USD -> CODE (how many CODE per 1 USD). Eg USD_PHP = 56 means 1 USD = 56 PHP.

  const codes = Object.keys(usdMap)
  const pairs = []
  for (const from of codes) {
    for (const to of codes) {
      // compute rate: from -> to
      // USD->from = usdMap[from]
      // USD->to = usdMap[to]
      const usdToFrom = usdMap[from]
      const usdToTo = usdMap[to]
      if (!isFinite(usdToFrom) || !isFinite(usdToTo) || usdToFrom === 0) continue
      const rate = usdToTo / usdToFrom
      pairs.push({ from_currency: from, to_currency: to, rate: Number(rate) })
    }
  }
  return pairs
}

async function upsertPairs(pairs) {
  if (!pairs || pairs.length === 0) {
    console.log('No pairs to upsert')
    return
  }
  const chunkSize = 500
  for (let i = 0; i < pairs.length; i += chunkSize) {
    // Filter pairs to codes that are 3-letter uppercase (safest for fiat currency_rates schema)
    const block = pairs.slice(i, i + chunkSize).filter(p => {
      const a = typeof p.from_currency === 'string' && /^[A-Z]{3}$/.test(p.from_currency)
      const b = typeof p.to_currency === 'string' && /^[A-Z]{3}$/.test(p.to_currency)
      return a && b
    })
    if (block.length === 0) continue

    let chunk = block.map(p => ({ ...p, updated_at: new Date().toISOString() }))
    let res
    try {
      res = await supabase.from('currency_rates').upsert(chunk, { onConflict: ['from_currency', 'to_currency'] })
    } catch (err) {
      // If updated_at doesn't exist in schema, retry without it
      const msg = (err && err.message) || JSON.stringify(err)
      if (msg && msg.includes('updated_at')) {
        chunk = block.map(p => ({ ...p }))
        const { data, error } = await supabase.from('currency_rates').upsert(chunk, { onConflict: ['from_currency', 'to_currency'] })
        if (error) {
          console.error('Upsert error after retry without updated_at:', error)
          throw error
        }
        console.log(`Upserted ${chunk.length} pairs (batch ${i / chunkSize + 1}) [no updated_at]`)
        continue
      }
      throw err
    }

    if (res && res.error) {
      // check for missing column in schema cache
      const errMsg = (res.error && res.error.message) || ''
      if (errMsg.includes('updated_at')) {
        // retry without updated_at
        chunk = block.map(p => ({ ...p }))
        const { data, error } = await supabase.from('currency_rates').upsert(chunk, { onConflict: ['from_currency', 'to_currency'] })
        if (error) {
          console.error('Upsert error after retry without updated_at:', error)
          throw error
        }
        console.log(`Upserted ${chunk.length} pairs (batch ${i / chunkSize + 1}) [no updated_at]`)
        continue
      }
      console.error('Upsert error:', res.error)
      throw res.error
    }

    console.log(`Upserted ${chunk.length} pairs (batch ${i / chunkSize + 1})`)
  }
}

async function main() {
  console.log('Calling fetch-rates...')
  let payload = await callFetchRates()
  if (!payload) {
    console.warn('fetch-rates returned no data; falling back to public APIs (exchangerate.host + CoinGecko)')
    try {
      // 1) fetch fiat rates from exchangerate.host (base=USD)
      const er = await (await fetch('https://api.exchangerate.host/latest?base=USD')).json()
      // er.rates: map code -> rate (1 USD = rate * CODE)
      const exchangeRates = {}
      if (er && er.rates) {
        for (const k of Object.keys(er.rates)) {
          const v = er.rates[k]
          if (isFinite(v)) exchangeRates[k] = v
        }
      }

      // 2) fetch crypto prices from CoinGecko (USD)
      const coinIds = ['bitcoin','ethereum','litecoin','dogecoin','ripple','cardano','solana','avalanche-2','matic-network','polkadot','chainlink','uniswap','aave','usd-coin','tether']
      const cgResp = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`)).json()
      const cryptoPrices = cgResp || null

      payload = { exchangeRates, cryptoPrices }
    } catch (fallbackErr) {
      console.error('Fallback public API fetch failed:', fallbackErr)
      process.exit(1)
    }
  }

  // Normalize USD map
  const usdMap = normalizeToUsdMap(payload) || {}

  // If fetch-rates returned direct pair array, include that too
  const directPairs = []
  if (Array.isArray(payload.rates) && payload.rates.length) {
    for (const r of payload.rates) {
      const from = r.from_currency || r.from
      const to = r.to_currency || r.to
      const rate = Number(r.rate)
      if (from && to && isFinite(rate)) directPairs.push({ from_currency: from, to_currency: to, rate })
    }
  }

  // If payload contains a flat map of pairs like { 'USD_PHP': 56 }
  if (payload && typeof payload === 'object') {
    for (const k of Object.keys(payload)) {
      if (/^[A-Z]{3}_[A-Z]{3}$/.test(k) && isFinite(Number(payload[k]))) {
        const [from, to] = k.split('_')
        directPairs.push({ from_currency: from, to_currency: to, rate: Number(payload[k]) })
      }
    }
  }

  let pairs = []
  if (usdMap && Object.keys(usdMap).length > 0) {
    // build pairwise from usdMap
    pairs = buildPairwiseFromUsdMap(usdMap)
  }

  // merge in direct pairs (override computed ones)
  const map = new Map()
  for (const p of pairs) map.set(`${p.from_currency}_${p.to_currency}`, p)
  for (const p of directPairs) map.set(`${p.from_currency}_${p.to_currency}`, p)

  const merged = Array.from(map.values())

  // ensure there is at least identity pairs
  const codes = new Set()
  merged.forEach(p => { codes.add(p.from_currency); codes.add(p.to_currency) })
  for (const c of codes) {
    map.set(`${c}_${c}`, { from_currency: c, to_currency: c, rate: 1 })
  }

  const finalPairs = Array.from(map.values())
  console.log(`Prepared ${finalPairs.length} pairs to upsert`) 

  await upsertPairs(finalPairs)
  console.log('Done')
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
