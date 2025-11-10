import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

// Usage: set PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY env vars then run:
// node scripts/seed-crypto-rates.js

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const cryptoList = [
  { code: 'BTC', id: 'bitcoin' },
  { code: 'ETH', id: 'ethereum' },
  { code: 'LTC', id: 'litecoin' },
  { code: 'DOGE', id: 'dogecoin' },
  { code: 'XRP', id: 'ripple' },
  { code: 'ADA', id: 'cardano' },
  { code: 'SOL', id: 'solana' },
  { code: 'AVAX', id: 'avalanche-2' },
  { code: 'MATIC', id: 'matic-network' },
  { code: 'DOT', id: 'polkadot' },
  { code: 'LINK', id: 'chainlink' },
  { code: 'UNI', id: 'uniswap' },
  { code: 'AAVE', id: 'aave' },
  { code: 'USDC', id: 'usd-coin' },
  { code: 'USDT', id: 'tether' }
]

async function fetchCoinGeckoPrices(ids) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  return await res.json()
}

function buildPairsFromUsdPrices(usdMap) {
  // usdMap: CODE -> USD price (number)  (e.g., BTC: 60000)
  const codes = Object.keys(usdMap)
  const pairs = []
  for (const from of codes) {
    for (const to of codes) {
      if (from === to) continue
      const usdFrom = usdMap[from]
      const usdTo = usdMap[to]
      if (!isFinite(usdFrom) || !isFinite(usdTo) || usdFrom === 0) continue
      // compute rate: from -> to = usdTo / usdFrom (i.e., 1 FROM = (usdTo/usdFrom) TO)
      const rate = usdTo / usdFrom
      pairs.push({ from_currency: from, to_currency: to, rate })
    }
  }
  return pairs
}

async function upsertCryptoPairs(pairs) {
  if (!pairs || pairs.length === 0) return
  const chunkSize = 200
  for (let i = 0; i < pairs.length; i += chunkSize) {
    const chunk = pairs.slice(i, i + chunkSize).map(p => ({ ...p, updated_at: new Date().toISOString() }))
    const { data, error } = await supabase.from('cryptocurrency_rates').upsert(chunk, { onConflict: ['from_currency', 'to_currency'] })
    if (error) throw error
    console.log(`Upserted ${chunk.length} crypto pairs`)
  }
}

async function upsertCryptoMeta() {
  const rows = cryptoList.map(c => ({ code: c.code, name: c.id.replace(/-/g, ' '), coingecko_id: c.id }))
  const { data, error } = await supabase.from('cryptocurrencies').upsert(rows, { onConflict: ['code'] })
  if (error) throw error
  console.log('Upserted crypto metadata')
}

async function main() {
  console.log('Fetching CoinGecko prices...')
  const ids = cryptoList.map(c => c.id)
  const data = await fetchCoinGeckoPrices(ids)
  // build usdMap (CODE -> USD)
  const usdMap = {}
  for (const c of cryptoList) {
    const d = data[c.id]
    const usd = d && d.usd
    if (typeof usd === 'number' && isFinite(usd)) usdMap[c.code] = usd
  }

  // Ensure at least BTC present
  if (!usdMap['BTC']) throw new Error('No BTC price from CoinGecko')

  const pairs = buildPairsFromUsdPrices(usdMap)
  await upsertCryptoMeta()
  await upsertCryptoPairs(pairs)
  console.log('Done')
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
