// Supabase Edge Function: sync-wallet-balances
// POST /functions/v1/sync-wallet-balances
// Optionally accept { limit_per_wallet: 10 }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

const CHAIN_RPC: Record<number, { name: string; type: 'evm' | 'solana' | 'other'; rpc?: string; decimals?: number }> = {
  1: { name: 'ethereum', type: 'evm', rpc: 'https://cloudflare-eth.com', decimals: 18 },
  137: { name: 'polygon', type: 'evm', rpc: 'https://polygon-rpc.com', decimals: 18 },
  42161: { name: 'arbitrum', type: 'evm', rpc: 'https://arb1.arbitrum.io/rpc', decimals: 18 },
  10: { name: 'optimism', type: 'evm', rpc: 'https://mainnet.optimism.io', decimals: 18 },
  56: { name: 'bsc', type: 'evm', rpc: 'https://bsc-dataseed.binance.org', decimals: 18 },
  43114: { name: 'avalanche', type: 'evm', rpc: 'https://api.avax.network/ext/bc/C/rpc', decimals: 18 },
  250: { name: 'fantom', type: 'evm', rpc: 'https://rpc.ftm.tools', decimals: 18 },
  100: { name: 'gnosis', type: 'evm', rpc: 'https://rpc.gnosischain.com', decimals: 18 },
  42220: { name: 'celo', type: 'evm', rpc: 'https://forno.celo.org', decimals: 18 },
  8453: { name: 'base', type: 'evm', rpc: 'https://mainnet.base.org', decimals: 18 },
  324: { name: 'zksync', type: 'evm', rpc: 'https://mainnet.era.zksync.io', decimals: 18 },
  59140: { name: 'linea', type: 'evm', rpc: 'https://rpc.linea.build', decimals: 18 },
  66: { name: 'okc', type: 'evm', rpc: 'https://exchainrpc.okex.org', decimals: 18 },
  1284: { name: 'moonbeam', type: 'evm', rpc: 'https://rpc.api.moonbeam.network', decimals: 18 },
  1285: { name: 'moonriver', type: 'evm', rpc: 'https://rpc.moonriver.moonbeam.network', decimals: 18 },
  25: { name: 'cronos', type: 'evm', rpc: 'https://evm-cronos.crypto.org', decimals: 18 },
  1313161554: { name: 'aurora', type: 'evm', rpc: 'https://mainnet.aurora.dev', decimals: 18 },
  1088: { name: 'metis', type: 'evm', rpc: 'https://andromeda.metis.io/?owner=1088', decimals: 18 },
  9001: { name: 'evmos', type: 'evm', rpc: 'https://evm.evmos.org:8545', decimals: 18 },
  288: { name: 'boba', type: 'evm', rpc: 'https://mainnet.boba.network', decimals: 18 },
  245022926: { name: 'solana', type: 'solana', rpc: 'https://api.mainnet-beta.solana.com', decimals: 9 },
  5000: { name: 'mantle', type: 'evm', rpc: 'https://rpc.mantle.xyz', decimals: 18 }
}

function weiToDecimal(weiHex: string, decimals = 18) {
  if (!weiHex) return 0
  const v = BigInt(weiHex.toString())
  const denom = BigInt(10) ** BigInt(decimals)
  const whole = v / denom
  const frac = v % denom
  const fracStr = frac.toString().padStart(Number(decimals), '0').replace(/0+$/, '')
  return Number(whole.toString() + (fracStr ? '.' + fracStr : ''))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!PROJECT_URL || !SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500, headers: { 'Content-Type': 'application/json' } })

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    const body = await req.json().catch(() => ({}))
    const limitPerWallet = Number(body.limit_per_wallet || 10)

    // Load network wallets
    const { data: networks, error: hwError } = await supabase.from('wallets_house').select('*').limit(500)
    if (hwError) throw hwError

    const results: any[] = []

    for (const nw of networks || []) {
      try {
        const addr = nw.metadata?.address || nw.address
        const chainSymbol = nw.currency
        const chainName = nw.network
        const chainEntry = Object.values(CHAIN_RPC).find(c => String(c.name).toLowerCase() === String(chainName).toLowerCase()) || null
        let balance = null

        if (!addr) {
          results.push({ network: chainName, ok: false, reason: 'no address' })
          continue
        }

        if (chainEntry && chainEntry.type === 'evm') {
          // eth_getBalance
          const rpc = chainEntry.rpc
          const resp = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [addr, 'latest'] }) })
          const j = await resp.json().catch(() => null)
          if (j && j.result) {
            balance = weiToDecimal(j.result, chainEntry.decimals || 18)
          }
        } else if (chainEntry && chainEntry.type === 'solana') {
          // solana getBalance
          const rpc = chainEntry.rpc
          const resp = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [addr] }) })
          const j = await resp.json().catch(() => null)
          if (j && j.result && typeof j.result.value !== 'undefined') {
            balance = Number(j.result.value) / Math.pow(10, chainEntry.decimals || 9)

            // fetch recent signatures and transactions
            const sigResp = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [addr, { limit: limitPerWallet }] }) })
            const sigJson = await sigResp.json().catch(() => null)
            if (sigJson && sigJson.result) {
              for (const s of sigJson.result) {
                try {
                  const txHash = s.signature
                  // Check if already recorded
                  const { data: existing } = await supabase.from('network_transactions').select('id').eq('tx_hash', txHash).maybeSingle()
                  if (existing) continue

                  const txResp = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [txHash, 'jsonParsed'] }) })
                  const txJson = await txResp.json().catch(() => null)
                  const raw = txJson || null
                  // Parse basic from/to/amount from parsed transaction if available
                  let fromAddr = null
                  let toAddr = null
                  let value = null
                  if (raw && raw.result && raw.result.transaction) {
                    const tx = raw.result.transaction
                    const message = tx.message
                    // For simplicity, take first account keys
                    fromAddr = message.accountKeys && message.accountKeys[0] && message.accountKeys[0].pubkey
                    toAddr = message.accountKeys && message.accountKeys[1] && message.accountKeys[1].pubkey
                    // amount parsing is complex; set null and store raw
                  }

                  await supabase.from('network_transactions').insert([{ wallet_house_id: nw.id, chain_id: nw.network ? nw.chain_id || null : null, tx_hash: txHash, from_address: fromAddr, to_address: toAddr, value: value, raw: raw }])
                } catch (e) {
                  // ignore per-tx errors
                }
              }
            }
          }
        } else {
          results.push({ network: chainName, ok: false, reason: 'no rpc for chain' })
          continue
        }

        // Update balances in wallets_house and wallets_crypto where address matches
        if (balance !== null) {
          try {
            // Update wallets_house
            await supabase.from('wallets_house').update({ balance: balance, updated_at: new Date().toISOString() }).eq('id', nw.id)
            // Update wallets_crypto rows that have this address
            await supabase.from('wallets_crypto').update({ balance: balance, updated_at: new Date().toISOString() }).eq('address', addr)
          } catch (e) {
            // ignore
          }
        }

        results.push({ network: chainName, ok: true, address: addr, balance })
      } catch (e) {
        results.push({ network: nw.network, ok: false, error: String(e) })
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('sync-wallet-balances error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
