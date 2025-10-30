// Expects POST JSON: { email }

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
  }

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
      console.error('Missing env vars - SUPABASE_URL:', !!PROJECT_URL, 'SERVICE_ROLE_KEY:', !!SERVICE_ROLE_KEY)
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const email = String(body.email).trim()
    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    // Try to use GoTrue admin generate_link endpoint to create a signup verification link.
    // GoTrue exposes an admin generate_link endpoint in some deployments. If unavailable, this may fail.
    // We'll attempt to call it; if it fails, return a generic error so client can surface it.

    const linkRes = await fetch(`${PROJECT_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ type: 'signup', email }),
    })

    if (!linkRes.ok) {
      const txt = await linkRes.text().catch(()=>'')
      console.error('generate_link failed', linkRes.status, txt)
      return new Response(JSON.stringify({ error: 'Failed to generate confirmation link' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const json = await linkRes.json().catch(() => null)
    return new Response(JSON.stringify({ ok: true, data: json }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    console.error('resend-confirmation error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }
})
