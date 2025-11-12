// Supabase Edge Function: fetch-token-balances
// POST { address, chain_id, tokenAddresses: [tokenAddr1, tokenAddr2], wallet_id? }
// Fetches ERC20 balances for the provided tokens and upserts into wallets_tokens

import { createClient } from 'https://cdn.jsdelivr.net/gh/supabase/supabase-js@1.35.6/dist/module/index.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_PROJECT_URL')
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) console.warn('Supabase service role key missing')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
  })
}

function getRpcUrl(chainId: number) {
  const envKey = `RPC_URL_${chainId}`
  return Deno.env.get(envKey) || null
}

const ERC20_BALANCE_OF_DATA_PREFIX = '0x70a08231' // method id for balanceOf(address)

async function fetchTokenBalance(rpcUrl: string, tokenAddress: string, ownerAddress: string) {
  try {
    // data = methodId + padded address
    const addr = ownerAddress.replace(/^0x/i, '').padStart(64, '0')
    const data = ERC20_BALANCE_OF_DATA_PREFIX + addr
    const body = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: tokenAddress, data }, 'latest'] }
    const resp = await fetch(rpcUrl, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    if (!resp.ok) throw new Error('RPC error')
    const j = await resp.json()
    if (j && j.result) {
      const val = BigInt(j.result)
      // return as decimal string (raw token units)
      return val.toString()
    }
    return '0'
  } catch (e) {
    console.warn('fetchTokenBalance failed', e?.message || e)
    return null
  }
}

addEventListener('fetch', (event) => {
  event.respondWith(handle(event.request))
})

async function handle(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  try {
    const body = await req.json()
    const address = String(body.address || '').trim()
    const chainId = Number(body.chain_id || body.chainId || 1)
    const tokenAddresses = Array.isArray(body.tokenAddresses) ? body.tokenAddresses : []
    const walletId = body.wallet_id || body.walletId || null

    if (!address || tokenAddresses.length === 0) return jsonResponse({ error: 'Missing address or tokenAddresses' }, 400)

    const rpc = getRpcUrl(chainId)
    if (!rpc) return jsonResponse({ error: 'No RPC configured for chain' }, 400)

    const results = []
    for (const tokenAddr of tokenAddresses) {
      const token = String(tokenAddr).trim()
      if (!token) continue
      const bal = await fetchTokenBalance(rpc, token, address)
      if (bal === null) {
        results.push({ token, error: 'Failed to fetch' })
        continue
      }

      // Upsert into wallets_tokens table
      try {
        // If wallet_id provided, upsert by wallet_id+token_address
        if (walletId) {
          const existing = await supabase.from('wallets_tokens').select('id').eq('wallet_id', walletId).eq('token_address', token).limit(1)
          if (existing && existing.data && existing.data.length > 0) {
            await supabase.from('wallets_tokens').update({ balance: bal, updated_at: new Date().toISOString() }).eq('id', existing.data[0].id)
          } else {
            await supabase.from('wallets_tokens').insert([{ wallet_id: walletId, token_address: token, balance: bal }])
          }
        } else {
          // Try to find wallet by address and chain_id in wallets_crypto
          const existingWallet = await supabase.from('wallets_crypto').select('id').eq('address', address).eq('chain_id', chainId).limit(1)
          if (existingWallet && existingWallet.data && existingWallet.data.length > 0) {
            const wid = existingWallet.data[0].id
            const existing = await supabase.from('wallets_tokens').select('id').eq('wallet_id', wid).eq('token_address', token).limit(1)
            if (existing && existing.data && existing.data.length > 0) {
              await supabase.from('wallets_tokens').update({ balance: bal, updated_at: new Date().toISOString() }).eq('id', existing.data[0].id)
            } else {
              await supabase.from('wallets_tokens').insert([{ wallet_id: wid, token_address: token, balance: bal }])
            }
          } else {
            // no wallet found, skip persisting
          }
        }

        results.push({ token, balance: bal })
      } catch (e) {
        console.warn('Failed to persist token balance', e)
        results.push({ token, error: 'Failed to persist' })
      }
    }

    return jsonResponse({ results })
  } catch (e) {
    console.error('fetch-token-balances error', e)
    return jsonResponse({ error: String(e) }, 500)
  }
}
