#!/usr/bin/env node
// Local script to sync wallets_house balances and fetch recent Solana txs, upsert to network_transactions

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

const CHAIN_RPC = {
  1: { name: 'ethereum', type: 'evm', rpc: 'https://cloudflare-eth.com', decimals: 18 },
  137: { name: 'polygon', type: 'evm', rpc: 'https://polygon-rpc.com', decimals: 18 },
  42161: { name: 'arbitrum', type: 'evm', rpc: 'https://arb1.arbitrum.io/rpc', decimals: 18 },
  10: { name: 'optimism', type: 'evm', rpc: 'https://mainnet.optimism.io', decimals: 18 },
  56: { name: 'bsc', type: 'evm', rpc: 'https://bsc-dataseed.binance.org', decimals: 18 },
  245022926: { name: 'solana', type: 'solana', rpc: 'https://api.mainnet-beta.solana.com', decimals: 9 }
}

function weiToDecimal(weiHex, decimals = 18) {
  if (!weiHex) return 0
  const v = BigInt(weiHex.toString())
  const denom = BigInt(10) ** BigInt(decimals)
  const whole = v / denom
  const frac = v % denom
  const fracStr = frac.toString().padStart(Number(decimals), '0').replace(/0+$/, '')
  return Number(whole.toString() + (fracStr ? '.' + fracStr : ''))
}

async function run() {
  const { data: networks, error } = await supabase.from('wallets_house').select('*')
  if (error) { console.error('Failed loading wallets_house', error); process.exit(1) }

  for (const nw of networks) {
    const addr = nw.metadata?.address || nw.address
    if (!addr) continue
    const chainName = nw.network
    const chainEntry = Object.values(CHAIN_RPC).find(c => c.name === chainName)
    let balance = null

    try {
      if (chainEntry && chainEntry.type === 'evm') {
        const rpc = chainEntry.rpc
        const resp = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [addr, 'latest'] }) })
        const j = await resp.json().catch(() => null)
        if (j && j.result) balance = weiToDecimal(j.result, chainEntry.decimals)
      } else if (chainEntry && chainEntry.type === 'solana') {
        const rpc = chainEntry.rpc
        const resp = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [addr] }) })
        const j = await resp.json().catch(() => null)
        if (j && j.result && typeof j.result.value !== 'undefined') {
          balance = Number(j.result.value) / Math.pow(10, chainEntry.decimals)

          const sigResp = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [addr, { limit: 5 }] }) })
          const sigJson = await sigResp.json().catch(() => null)
          if (sigJson && sigJson.result) {
            for (const s of sigJson.result) {
              const txHash = s.signature
              const { data: existing } = await supabase.from('network_transactions').select('id').eq('tx_hash', txHash).maybeSingle()
              if (existing) continue
              const txResp = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [txHash, 'jsonParsed'] }) })
              const txJson = await txResp.json().catch(() => null)
              await supabase.from('network_transactions').insert([{ wallet_house_id: nw.id, chain_id: nw.chain_id || null, tx_hash: txHash, from_address: null, to_address: null, value: null, raw: txJson }])
            }
          }
        }
      }

      if (balance !== null) {
        await supabase.from('wallets_house').update({ balance, updated_at: new Date().toISOString() }).eq('id', nw.id)
        await supabase.from('wallets_crypto').update({ balance, updated_at: new Date().toISOString() }).eq('address', addr)
        console.log(`Updated ${nw.network} ${addr} -> ${balance}`)
      } else {
        console.log(`Skipped ${nw.network} ${addr} (no rpc/balance)`)
      }
    } catch (e) {
      console.warn('Error syncing', nw.network, e)
    }
  }
}

run().catch(e => { console.error(e); process.exit(1) })
