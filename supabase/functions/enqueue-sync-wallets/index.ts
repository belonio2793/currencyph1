import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

// Lightweight enqueue function: inserts wallet_sync_jobs for house wallets that have an address
// Avoids enqueuing if a recent job exists for the wallet (within recent_window_minutes)

Deno.serve(async (req) => {
  const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!PROJECT_URL || !SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => ({}))
    const maxEnqueue = Number(body.max || 20)
    const recentWindowMinutes = Number(body.recent_window_minutes || 5)

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    // Find candidate house wallets with an address
    const { data: networks, error: hwError } = await supabase.from('wallets_house').select('id,network,currency,metadata,updated_at').limit(500)
    if (hwError) throw hwError

    // For each, ensure not recently enqueued
    const now = new Date()
    const cutoff = new Date(now.getTime() - recentWindowMinutes * 60000).toISOString()

    const toEnqueue = []
    for (const nw of networks || []) {
      try {
        const addr = nw.metadata?.address || nw.address
        if (!addr) continue
        // Only enqueue supported networks to avoid worker failures
        const supported = [
          'ethereum','polygon','arbitrum','optimism','bsc','avalanche','fantom','gnosis','celo','base','zksync','linea','okc','moonbeam','moonriver','cronos','aurora','metis','evmos','boba','solana'
        ]
        if (!supported.map(s => s.toLowerCase()).includes(String(nw.network).toLowerCase())) continue
        // Check recent job
        const { data: recentJobs, error: rErr } = await supabase.from('wallet_sync_jobs').select('id,created_at,status').eq('wallet_house_id', nw.id).order('created_at', { ascending: false }).limit(1)
        if (rErr) continue
        if (recentJobs && recentJobs.length > 0) {
          const last = recentJobs[0]
          if (last.created_at && new Date(last.created_at) > new Date(cutoff)) {
            continue // recently enqueued/processed
          }
        }
        toEnqueue.push({ wallet_house_id: nw.id, payload: { network: nw.network, currency: nw.currency, address: addr }, scheduled_at: new Date().toISOString() })
        if (toEnqueue.length >= maxEnqueue) break
      } catch (e) {
        // ignore per-network errors
      }
    }

    if (toEnqueue.length === 0) return new Response(JSON.stringify({ ok: true, enqueued: 0 }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const { data: inserted, error: insErr } = await supabase.from('wallet_sync_jobs').insert(toEnqueue).select()
    if (insErr) throw insErr

    return new Response(JSON.stringify({ ok: true, enqueued: (inserted || []).length }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('enqueue-sync-wallets error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
