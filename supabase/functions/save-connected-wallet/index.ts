import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

Deno.serve(async (req) => {
  const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!PROJECT_URL || !SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => null)
    if (!body || !body.user_id || !body.chain_id || !body.address) return new Response(JSON.stringify({ error: 'Missing user_id, chain_id or address' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const user_id = body.user_id
    const chain_id = Number(body.chain_id)
    const address = String(body.address)
    const provider = body.provider || (body.providerName || 'external')
    const metadata = body.metadata || {}

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    const chainName = (body.chainName || null) || null
    const chainForDb = chainName ? String(chainName).toUpperCase() : (body.chain || null)

    const payload = {
      user_id,
      chain: chainForDb || ('' + chain_id),
      chain_id,
      address,
      provider,
      balance: 0,
      metadata: { ...metadata, connected_at: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }

    const { data: upserted, error: upsertErr } = await supabase
      .from('wallets_crypto')
      .upsert([payload], { onConflict: 'user_id,chain,address' })
      .select()
      .single()

    if (upsertErr) {
      console.error('save-connected-wallet upsertErr', upsertErr)
      return new Response(JSON.stringify({ error: upsertErr.message || JSON.stringify(upsertErr) }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true, wallet: { id: upserted.id, address: upserted.address, chain_id: upserted.chain_id, chain: upserted.chain, provider: upserted.provider } }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('save-connected-wallet error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
