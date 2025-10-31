// Supabase Edge Function: create-wallet-batch
// POST /functions/v1/create-wallet-batch
// Body: { create_house?: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

// CHAIN_CONFIGS (subset mirrored from other functions)
const CHAIN_CONFIGS = {
  1: { name: 'ethereum', chainId: 1, symbol: 'ETH' },
  10: { name: 'optimism', chainId: 10, symbol: 'OP' },
  25: { name: 'cronos', chainId: 25, symbol: 'CRO' },
  56: { name: 'bsc', chainId: 56, symbol: 'BNB' },
  100: { name: 'gnosis', chainId: 100, symbol: 'GNO' },
  137: { name: 'polygon', chainId: 137, symbol: 'MATIC' },
  250: { name: 'fantom', chainId: 250, symbol: 'FTM' },
  42161: { name: 'arbitrum', chainId: 42161, symbol: 'ARB' },
  42170: { name: 'arbitrum-nova', chainId: 42170, symbol: 'ARB' },
  8453: { name: 'base', chainId: 8453, symbol: 'BASE' },
  43114: { name: 'avalanche', chainId: 43114, symbol: 'AVAX' },
  42220: { name: 'celo', chainId: 42220, symbol: 'CELO' },
  324: { name: 'zksync', chainId: 324, symbol: 'ZK' },
  59144: { name: 'linea', chainId: 59144, symbol: 'LINEA' },
  5000: { name: 'mantle', chainId: 5000, symbol: 'MNT' },
  9001: { name: 'evmos', chainId: 9001, symbol: 'EVMOS' },
  288: { name: 'boba', chainId: 288, symbol: 'BOBA' },
  1088: { name: 'metis', chainId: 1088, symbol: 'METIS' },
  1284: { name: 'moonbeam', chainId: 1284, symbol: 'GLMR' },
  1285: { name: 'moonriver', chainId: 1285, symbol: 'MOVR' },
  245022926: { name: 'solana', chainId: 245022926, symbol: 'SOL' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const THIRDWEB_KEY = Deno.env.get('THIRDWEB_SECRET_KEY')
    if (!PROJECT_URL || !SERVICE_ROLE_KEY || !THIRDWEB_KEY) {
      return new Response(JSON.stringify({ error: 'Missing configuration (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, THIRDWEB_SECRET_KEY are required)' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const body = await req.json().catch(() => ({}))
    const createHouse = !!body.create_house

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    const results = []

    for (const key of Object.keys(CHAIN_CONFIGS)) {
      const chain = CHAIN_CONFIGS[key]
      try {
        // Create wallet on ThirdWeb
        const twRes = await fetch('https://api.thirdweb.com/v1/wallets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${THIRDWEB_KEY}` },
          body: JSON.stringify({ chain_id: chain.chainId, chain: chain.name })
        })
        const twJson = await twRes.json()
        if (!twRes.ok) {
          results.push({ chain: chain.name, ok: false, error: twJson })
          continue
        }

        const address = twJson.address || twJson.wallet?.address || twJson.data?.address
        const thirdwebWalletId = twJson.walletId || twJson.id || twJson.wallet?.id || null

        // Upsert into wallets_house
        const metadata = { chainName: chain.name, chainSymbol: chain.symbol, created_at: new Date().toISOString(), thirdweb: twJson }

        // find existing
        const { data: existing } = await supabase.from('wallets_house').select('*').eq('network', chain.name).eq('currency', chain.symbol).maybeSingle()
        let row = null
        if (existing) {
          const { data: updated } = await supabase.from('wallets_house').update({ metadata, address: address || null, thirdweb_wallet_id: thirdwebWalletId, provider: 'thirdweb', updated_at: new Date().toISOString() }).eq('id', existing.id).select().single()
          row = updated
        } else {
          const { data: inserted } = await supabase.from('wallets_house').insert([{ wallet_type: 'crypto', currency: chain.symbol, network: chain.name, address: address || null, thirdweb_wallet_id: thirdwebWalletId, provider: 'thirdweb', balance: 0, metadata, updated_at: new Date().toISOString() }]).select().single()
          row = inserted
        }

        results.push({ chain: chain.name, ok: true, row, thirdweb: twJson })
      } catch (e) {
        results.push({ chain: CHAIN_CONFIGS[key].name, ok: false, error: String(e) })
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    console.error('create-wallet-batch error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }
})
