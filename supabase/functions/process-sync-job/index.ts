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
  245022926: { name: 'solana', type: 'solana', rpc: 'https://api.mainnet-beta.solana.com', decimals: 9 }
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

// Helper: fetch with timeout using AbortController
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 4000 } = options as any
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const resp = await fetch(resource, { ...options, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(id)
  }
}

Deno.serve(async (req) => {
  const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!PROJECT_URL || !SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => ({}))
    const perTxLimit = Number(body.limit_per_wallet || 3)

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    // Pick one pending job (oldest) that is available
    const { data: jobs } = await supabase.from('wallet_sync_jobs').select('*').eq('status', 'pending').lte('available_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(1)
    if (!jobs || jobs.length === 0) return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const job = jobs[0]

    // Attempt to claim the job (update status -> processing)
    const { data: claimed, error: claimErr } = await supabase.from('wallet_sync_jobs').update({ status: 'processing', attempts: (job.attempts || 0) + 1, started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id).select().single()
    if (claimErr || !claimed) {
      return new Response(JSON.stringify({ ok: false, error: 'Could not claim job' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    // Load wallet_house for this job
    const { data: rows, error: hwErr } = await supabase.from('wallets_house').select('*').eq('id', job.wallet_house_id).limit(1).maybeSingle()
    if (hwErr || !rows) {
      await supabase.from('wallet_sync_jobs').update({ status: 'failed', last_error: 'wallet_house missing', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id)
      return new Response(JSON.stringify({ ok: false, error: 'wallet_house missing' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    const nw = rows
    const addr = nw.metadata?.address || nw.address
    const chainName = nw.network
    const chainEntry = Object.values(CHAIN_RPC).find(c => String(c.name).toLowerCase() === String(chainName).toLowerCase()) || null
    let balance: number | null = null

    try {
      if (!addr) throw new Error('no address')

      if (chainEntry && chainEntry.type === 'evm') {
        const rpc = chainEntry.rpc
        const resp = await fetchWithTimeout(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [addr, 'latest'] }), timeout: 3500 })
        const j = resp ? await resp.json().catch(() => null) : null
        if (j && j.result) balance = weiToDecimal(j.result, chainEntry.decimals || 18)
      } else if (chainEntry && chainEntry.type === 'solana') {
        const rpc = chainEntry.rpc
        const resp = await fetchWithTimeout(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [addr] }), timeout: 3500 })
        const j = resp ? await resp.json().catch(() => null) : null
        if (j && j.result && typeof j.result.value !== 'undefined') {
          balance = Number(j.result.value) / Math.pow(10, chainEntry.decimals || 9)

          // fetch recent signatures (limited)
          const sigResp = await fetchWithTimeout(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [addr, { limit: perTxLimit }] }), timeout: 3500 })
          const sigJson = sigResp ? await sigResp.json().catch(() => null) : null
          if (sigJson && sigJson.result) {
            for (const s of sigJson.result) {
              try {
                const txHash = s.signature
                const { data: existing } = await supabase.from('network_transactions').select('id').eq('tx_hash', txHash).maybeSingle()
                if (existing) continue
                const txResp = await fetchWithTimeout(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [txHash, 'jsonParsed'] }), timeout: 3500 })
                const txJson = txResp ? await txResp.json().catch(() => null) : null
                const raw = txJson || null
                let fromAddr = null
                let toAddr = null
                let value = null
                if (raw && raw.result && raw.result.transaction) {
                  const tx = raw.result.transaction
                  const message = tx.message
                  fromAddr = message.accountKeys && message.accountKeys[0] && message.accountKeys[0].pubkey
                  toAddr = message.accountKeys && message.accountKeys[1] && message.accountKeys[1].pubkey
                }
                await supabase.from('network_transactions').insert([{ wallet_house_id: nw.id, chain_id: nw.chain_id || null, tx_hash: txHash, from_address: fromAddr, to_address: toAddr, value: value, raw: raw }])
              } catch (e) {
                // ignore per-tx errors
              }
            }
          }
        }
      } else {
        // no rpc; mark and exit
        await supabase.from('wallet_sync_jobs').update({ status: 'failed', last_error: 'no rpc for chain', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id)
        return new Response(JSON.stringify({ ok: false, error: 'no rpc for chain' }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
      }

      if (balance !== null) {
        await supabase.from('wallets_house').update({ balance: balance, updated_at: new Date().toISOString() }).eq('id', nw.id)
        await supabase.from('wallets_crypto').update({ balance: balance, updated_at: new Date().toISOString() }).eq('address', addr)
      }

      await supabase.from('wallet_sync_jobs').update({ status: 'done', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id)

      return new Response(JSON.stringify({ ok: true, processed: 1, wallet_house_id: nw.id, balance }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    } catch (e) {
      console.error('process-sync-job error', e)
      await supabase.from('wallet_sync_jobs').update({ status: 'failed', last_error: String(e), finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id)
      return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

  } catch (err) {
    console.error('process-sync-job outer error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
