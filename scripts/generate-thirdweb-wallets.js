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
  // Try multiple ThirdWeb endpoints with different header styles
  const endpoints = [
    { url: 'https://api.thirdweb.com/v1/embedded-wallets', headers: { 'x-secret-key': THIRDWEB_SECRET_KEY } },
    { url: 'https://api.thirdweb.com/v1/wallets', headers: { 'x-secret-key': THIRDWEB_SECRET_KEY } },
    { url: 'https://api.thirdweb.com/v1/wallets', headers: { 'Authorization': `Bearer ${THIRDWEB_SECRET_KEY}` } }
  ]

  let data = null
  let lastErr = null
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(ep.headers || {}) },
        body: JSON.stringify({ chainId: chain.chainId, chain_id: chain.chainId, chain: chain.name })
      })
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`
        const txt = await res.text().catch(() => '')
        lastErr += ` ${txt}`
        continue
      }
      data = await res.json().catch(() => null)
      if (data) break
    } catch (e) {
      lastErr = String(e)
      continue
    }
  }

  if (!data) throw new Error(`Thirdweb create wallet failed for ${chain.name}: ${lastErr}`)
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

  // Try to find existing row
  const { data: existing, error: selErr } = await supabase.from('wallets_house').select('*').eq('network', chain.name).eq('currency', chain.symbol).maybeSingle()
  if (selErr) throw selErr

  if (existing) {
    const { data: updated, error: updErr } = await supabase.from('wallets_house').update({ metadata, address: walletData.address || null, thirdweb_wallet_id: walletData.walletId || walletData.id || null, provider: 'thirdweb', updated_at: new Date().toISOString() }).eq('id', existing.id).select().single()
    if (updErr) throw updErr
    return updated
  } else {
    const { data: inserted, error: insErr } = await supabase.from('wallets_house').insert([{
      wallet_type: 'crypto',
      currency: chain.symbol,
      network: chain.name,
      address: walletData.address || null,
      thirdweb_wallet_id: walletData.walletId || walletData.id || null,
      provider: 'thirdweb',
      balance: 0,
      metadata,
      updated_at: new Date().toISOString()
    }]).select().single()
    if (insErr) throw insErr
    return inserted
  }
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
