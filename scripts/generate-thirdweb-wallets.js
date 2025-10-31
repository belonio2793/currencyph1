#!/usr/bin/env node
// Generates ThirdWeb smart wallets for supported chains and upserts to wallets_house
// Usage: THIRDWEB_SECRET_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/generate-thirdweb-wallets.js

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!THIRDWEB_SECRET_KEY) throw new Error('THIRDWEB_SECRET_KEY env var required')
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Minimal chain list. Expand as needed.
const CHAINS = [
  { chainId: 1, name: 'ethereum', symbol: 'ETH' },
  { chainId: 137, name: 'polygon', symbol: 'MATIC' },
  { chainId: 42161, name: 'arbitrum', symbol: 'ARB' },
  { chainId: 10, name: 'optimism', symbol: 'OP' },
  { chainId: 8453, name: 'base', symbol: 'BASE' },
  { chainId: 43114, name: 'avalanche', symbol: 'AVAX' },
  { chainId: 250, name: 'fantom', symbol: 'FTM' }
]

async function createThirdwebWallet(chain) {
  // ThirdWeb REST: use server key to create a smart wallet. This endpoint may differ depending on ThirdWeb plans.
  // We'll call the ThirdWeb REST admin 'create wallet' endpoint. Adjust if your ThirdWeb account uses a different path.
  const url = 'https://api.thirdweb.com/v1/wallets'
  const body = { chainId: chain.chainId }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${THIRDWEB_SECRET_KEY}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Thirdweb create wallet failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  // Expected: data.walletId, data.address, etc. Adjust based on actual ThirdWeb response shape
  return data
}

async function upsertHouseRow(chain, walletData) {
  const metadata = {
    chainName: chain.name,
    chainSymbol: chain.symbol,
    created_at: new Date().toISOString(),
    thirdweb: walletData
  }

  const { data, error } = await supabase
    .from('wallets_house')
    .upsert([
      {
        wallet_type: 'crypto',
        currency: chain.symbol,
        network: chain.name,
        address: walletData.address || null,
        thirdweb_wallet_id: walletData.walletId || walletData.id || null,
        provider: 'thirdweb',
        balance: 0,
        metadata,
        updated_at: new Date().toISOString()
      }
    ], { onConflict: 'network,currency' })
    .select()
    .single()

  if (error) throw error
  return data
}

async function run() {
  for (const chain of CHAINS) {
    try {
      console.log('Creating wallet for', chain.name)
      const walletData = await createThirdwebWallet(chain)
      console.log('Created:', walletData)
      const row = await upsertHouseRow(chain, walletData)
      console.log('Upserted house row for', chain.name, 'id=', row.id)
    } catch (err) {
      console.error('Error for chain', chain.name, err)
    }
  }
}

run().then(() => console.log('Done')).catch(e => { console.error(e); process.exit(1) })
