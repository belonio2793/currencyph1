#!/usr/bin/env node
// Creates house/network wallets by invoking Supabase Edge Function `create-wallet-pairs` with create_house=true
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-house-wallets.js

import fetch from 'node-fetch'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const CHAINS = [
  { chainId: 1, name: 'ethereum', symbol: 'ETH' },
  { chainId: 137, name: 'polygon', symbol: 'MATIC' },
  { chainId: 42161, name: 'arbitrum', symbol: 'ARB' },
  { chainId: 10, name: 'optimism', symbol: 'OP' },
  { chainId: 8453, name: 'base', symbol: 'BASE' },
  { chainId: 43114, name: 'avalanche', symbol: 'AVAX' },
  { chainId: 250, name: 'fantom', symbol: 'FTM' },
  { chainId: 56, name: 'bsc', symbol: 'BNB' },
  { chainId: 100, name: 'gnosis', symbol: 'GNO' },
  { chainId: 42220, name: 'celo', symbol: 'CELO' },
  { chainId: 324, name: 'zksync', symbol: 'ZK' },
  { chainId: 59144, name: 'linea', symbol: 'LINEA' },
  { chainId: 5000, name: 'mantle', symbol: 'MNT' },
  { chainId: 1284, name: 'moonbeam', symbol: 'GLMR' },
  { chainId: 1285, name: 'moonriver', symbol: 'MOVR' },
  { chainId: 25, name: 'cronos', symbol: 'CRO' },
  { chainId: 1088, name: 'metis', symbol: 'METIS' },
  { chainId: 288, name: 'boba', symbol: 'BOBA' },
  { chainId: 66, name: 'okc', symbol: 'OKT' },
  { chainId: 1313161554, name: 'aurora', symbol: 'AURORA' },
  { chainId: 9001, name: 'evmos', symbol: 'EVMOS' },
  { chainId: 245022926, name: 'solana', symbol: 'SOL' }
]

async function createHouseForChain(chain) {
  const url = `${PROJECT_URL.replace(/\/$/, '')}/functions/v1/create-wallet-pairs`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ create_house: true, chain_id: chain.chainId })
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch (e) {
    return { ok: false, status: 0, error: String(e) }
  }
}

async function main() {
  const results = { success: [], failed: [] }
  console.log('Creating house/network wallets via Supabase Edge Function create-wallet-pairs...')
  for (const chain of CHAINS) {
    process.stdout.write(`- ${chain.name.padEnd(12)} `)
    const r = await createHouseForChain(chain)
    if (r.ok) {
      console.log('✅')
      results.success.push({ chain: chain.name, chainId: chain.chainId, resp: r.data })
    } else {
      console.log('❌', r.status || '', r.error || JSON.stringify(r.data))
      results.failed.push({ chain: chain.name, chainId: chain.chainId, resp: r })
    }
  }

  console.log('\nSummary:')
  console.log('  Success:', results.success.length)
  console.log('  Failed:', results.failed.length)
  if (results.failed.length > 0) console.log('\nFailures:\n', JSON.stringify(results.failed, null, 2))
  if (results.success.length > 0) console.log('\nSuccess details (sample):\n', JSON.stringify(results.success.slice(0,5), null, 2))
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
