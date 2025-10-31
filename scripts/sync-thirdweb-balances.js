#!/usr/bin/env node
// Sync balances for wallets_house rows that are provider='thirdweb' or have addresses
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-thirdweb-balances.js

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import { CHAIN_IDS } from '../src/lib/thirdwebClient.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function getEvmBalance(rpcUrl, address) {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
    })
    const j = await res.json()
    if (j && j.result) {
      const balanceWei = BigInt(j.result)
      return Number(balanceWei) / 1e18
    }
  } catch (e) {
    console.warn('RPC balance fetch failed', e)
  }
  return 0
}

async function run() {
  const { data: rows, error } = await supabase.from('wallets_house').select('*').in('provider', ['thirdweb','house'])
  if (error) throw error
  for (const row of rows) {
    const addr = row.address || row.metadata?.address
    const network = (row.network || '').toLowerCase()
    let chainConfig = null
    for (const k in CHAIN_IDS) {
      const c = CHAIN_IDS[k]
      if (c.name.toLowerCase() === network) { chainConfig = c; break }
    }
    if (!addr || !chainConfig) continue
    if (!chainConfig.rpcUrl) continue
    const balance = await getEvmBalance(chainConfig.rpcUrl, addr)
    const { error: updErr } = await supabase.from('wallets_house').update({ balance, synced_at: new Date() }).eq('id', row.id)
    if (updErr) console.warn('Failed updating balance for', row.id, updErr)
    else console.log('Updated', row.network, row.id, 'balance', balance)
  }
}

run().then(() => console.log('Sync done')).catch(e => { console.error(e); process.exit(1) })
