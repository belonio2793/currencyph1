// Supabase Edge Function: sync-wallets
// Accepts POST { addresses: [{ address, chain_id, wallet_id? }], force?: boolean }
// Fetches native balances via RPC and updates wallets table

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

// Map chain_id to RPC URL via env variables, e.g. RPC_URL_1, RPC_URL_42161
function getRpcUrl(chainId: number) {
  const envKey = `RPC_URL_${chainId}`
  return Deno.env.get(envKey) || null
}

async function fetchEthBalance(rpcUrl: string, address: string) {
  try {
    const body = { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }
    const resp = await fetch(rpcUrl, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    if (!resp.ok) throw new Error('RPC error')
    const j = await resp.json()
    if (j && j.result) {
      const val = BigInt(j.result)
      // Convert wei to ether as decimal string with 18 decimals
      const ether = Number(val) / 1e18
      return ether
    }
    return 0
  } catch (e) {
    console.warn('fetchEthBalance failed', e?.message || e)
    return null
  }
}

// Fetch ERC20 token balance via eth_call balanceOf
const ERC20_BALANCE_OF_DATA_PREFIX = '0x70a08231'
async function fetchErc20Balance(rpcUrl: string, tokenAddress: string, ownerAddress: string) {
  try {
    const addr = ownerAddress.replace(/^0x/i, '').padStart(64, '0')
    const data = ERC20_BALANCE_OF_DATA_PREFIX + addr
    const body = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: tokenAddress, data }, 'latest'] }
    const resp = await fetch(rpcUrl, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    if (!resp.ok) throw new Error('RPC error')
    const j = await resp.json()
    if (j && j.result) {
      const val = BigInt(j.result)
      return val.toString()
    }
    return '0'
  } catch (e) {
    console.warn('fetchErc20Balance failed', e?.message || e)
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
    const addresses = body.addresses || []
    if (!Array.isArray(addresses) || addresses.length === 0) return jsonResponse({ error: 'No addresses provided' }, 400)

    const results = []
    for (const entry of addresses) {
      const address = String(entry.address || '').trim()
      const chainId = Number(entry.chain_id || entry.chainId || 1)
      const walletId = entry.wallet_id || entry.walletId || null
      if (!address) continue

      const rpc = getRpcUrl(chainId)
      if (!rpc) {
        results.push({ address, chainId, error: 'No RPC configured for chain' })
        continue
      }

      const nativeBalance = await fetchEthBalance(rpc, address)
      if (nativeBalance === null) {
        results.push({ address, chainId, error: 'Failed to fetch balance' })
        continue
      }

      // Persist to Supabase wallets table (match by walletId or address+chain)
      try {
        if (walletId) {
          // try updating wallets_crypto first (frontend reads wallets_crypto)
          await supabase.from('wallets_crypto').update({ balance: nativeBalance, last_synced_at: new Date().toISOString() }).eq('id', walletId)
          // also update generic wallets table for compatibility
          await supabase.from('wallets').update({ balance: nativeBalance, last_synced_at: new Date().toISOString() }).eq('id', walletId)
        } else {
          // upsert by address + chain into wallets_crypto (preferred)
          const existingCrypto = await supabase.from('wallets_crypto').select('id').eq('address', address).eq('chain_id', chainId).limit(1)
          if (existingCrypto && existingCrypto.data && existingCrypto.data.length > 0) {
            await supabase.from('wallets_crypto').update({ balance: nativeBalance, last_synced_at: new Date().toISOString() }).eq('id', existingCrypto.data[0].id)
            // also update wallets if present
            await supabase.from('wallets').update({ balance: nativeBalance, last_synced_at: new Date().toISOString() }).eq('address', address).eq('chain_id', chainId)
          } else {
            // insert into wallets_crypto and also into wallets for backwards compatibility
            await supabase.from('wallets_crypto').insert([{ address, chain_id: chainId, balance: nativeBalance, last_synced_at: new Date().toISOString() }])
            await supabase.from('wallets').insert([{ address, chain_id: chainId, balance: nativeBalance, last_synced_at: new Date().toISOString() }])
          }
        }

        results.push({ address, chainId, balance: nativeBalance })
      } catch (e) {
        console.warn('Supabase write failed', e)
        results.push({ address, chainId, error: 'Failed to persist' })
      }
    }

    return jsonResponse({ results })
  } catch (e) {
    console.error('sync-wallets handler error', e)
    return jsonResponse({ error: String(e) }, 500)
  }
}
