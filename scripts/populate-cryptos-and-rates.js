import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

// Usage:
// PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set.
// node scripts/populate-cryptos-and-rates.js

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function fetchTopMarkets(vs_currency = 'usd', per_page = 250) {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs_currency}&order=market_cap_desc&per_page=${per_page}&page=1&sparkline=false&price_change_percentage=24h`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko markets fetch ${res.status}`)
  return await res.json()
}

async function fetchCoinsList() {
  const url = 'https://api.coingecko.com/api/v3/coins/list'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko coins list ${res.status}`)
  return await res.json()
}

function sanitizeCodeRaw(str) {
  return (str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function chooseCode(symbol, counts, id, used) {
  const s = sanitizeCodeRaw(symbol)
  if (s && (counts[s] || 0) === 1 && s.length <= 10 && !used.has(s)) return s
  // fallback: sanitize id and truncate
  let cand = sanitizeCodeRaw(id)
  if (!cand) cand = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!cand) cand = 'CRYPTO'
  if (cand.length > 10) cand = cand.substring(0, 10)
  let unique = cand
  let idx = 1
  while (used.has(unique)) {
    const suffix = String(idx)
    const base = cand.substring(0, Math.max(0, 10 - suffix.length))
    unique = (base + suffix).toUpperCase()
    idx += 1
  }
  return unique
}

async function upsertCryptos(cryptos) {
  if (!cryptos || cryptos.length === 0) return
  const chunk = 200
  for (let i = 0; i < cryptos.length; i += chunk) {
    const slice = cryptos.slice(i, i + chunk)
    const { data, error } = await supabase.from('cryptocurrencies').upsert(slice, { onConflict: ['code'] })
    if (error) throw error
    console.log(`Upserted ${slice.length} cryptocurrencies`) 
  }
}

async function upsertCryptoRates(pairs) {
  if (!pairs || pairs.length === 0) return
  const chunk = 200
  for (let i = 0; i < pairs.length; i += chunk) {
    const slice = pairs.slice(i, i + chunk).map(p => ({ ...p, updated_at: new Date().toISOString() }))
    const { data, error } = await supabase.from('cryptocurrency_rates').upsert(slice, { onConflict: ['from_currency', 'to_currency'] })
    if (error) throw error
    console.log(`Upserted ${slice.length} crypto rate pairs`) 
  }
}

async function main() {
  console.log('Fetching top markets from CoinGecko...')
  const markets = await fetchTopMarkets('usd', 250)
  if (!Array.isArray(markets) || markets.length === 0) throw new Error('No markets returned')

  // Build symbol counts among markets to detect ambiguity
  const counts = {}
  markets.forEach(m => {
    const s = (m.symbol || '').toUpperCase()
    if (!s) return
    counts[s] = (counts[s] || 0) + 1
  })

  // Prepare cryptocurrencies rows and usd price map
  const cryptos = []
  const usdPrices = {}
  const usedCodes = new Set()
  for (const m of markets) {
    const id = m.id
    const symbol = (m.symbol || '').toUpperCase()
    const code = chooseCode(symbol, counts, id, usedCodes)
    usedCodes.add(code)
    cryptos.push({ code, name: m.name, coingecko_id: id })
    usdPrices[code] = Number(m.current_price)
  }

  // Upsert metadata
  await upsertCryptos(cryptos)

  // Build pairwise rates for these codes
  const codes = Object.keys(usdPrices)
  const pairs = []
  for (const a of codes) {
    for (const b of codes) {
      if (a === b) continue
      const pa = usdPrices[a]
      const pb = usdPrices[b]
      if (!isFinite(pa) || !isFinite(pb) || pa === 0) continue
      const rate = pb / pa
      pairs.push({ from_currency: a, to_currency: b, rate })
    }
  }

  console.log(`Prepared ${cryptos.length} cryptos and ${pairs.length} pairs`) 
  await upsertCryptoRates(pairs)
  console.log('Done')
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
