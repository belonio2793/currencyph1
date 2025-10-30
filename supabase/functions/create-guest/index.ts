// Supabase Edge Function to create or update a guest user using the service role key
// Expects POST JSON: { email, password, full_name }

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
    if (!body || !body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'Missing email or password' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const email = body.email
    const password = body.password
    const full_name = body.full_name || 'Guest'

    // First try to find existing user via admin endpoint
    const listRes = await fetch(`${PROJECT_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    })

    if (listRes.ok) {
      const listJson = await listRes.json().catch(() => null)
      if (Array.isArray(listJson) && listJson.length > 0) {
        const existing = listJson[0]
        // Update password for existing user
        const uid = existing.id
        const patchRes = await fetch(`${PROJECT_URL}/auth/v1/admin/users/${uid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ password, email_confirm: true, user_metadata: { full_name } })
        })
        if (patchRes.ok) {
          const patched = await patchRes.json().catch(() => null)
          return new Response(JSON.stringify({ ok: true, user: patched }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
        } else {
          const errText = await patchRes.text().catch(() => '')
          console.error('Failed to update user:', patchRes.status, errText)
        }
      }
    } else {
      const errText = await listRes.text().catch(() => '')
      console.error('Failed to query users:', listRes.status, errText)
    }

    // Create new user
    const createRes = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } })
    })

    if (!createRes.ok) {
      const txt = await createRes.text().catch(()=>'')
      console.error('Admin create user failed:', createRes.status, txt)
      return new Response(JSON.stringify({ error: `Failed to create user: ${createRes.status}` }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const created = await createRes.json().catch(() => null)
    return new Response(JSON.stringify({ ok: true, user: created }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    console.error('create-guest error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }
})
