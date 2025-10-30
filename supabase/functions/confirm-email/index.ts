// Expects POST JSON: { email }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
  }

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
      console.error('Missing env vars - SUPABASE_URL:', !!PROJECT_URL, 'SERVICE_ROLE_KEY:', !!SERVICE_ROLE_KEY)
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
    }

    const email = String(body.email).trim().toLowerCase()
    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
    }

    // Find user by email using admin endpoint
    const listRes = await fetch(`${PROJECT_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    })

    if (!listRes.ok) {
      const txt = await listRes.text().catch(()=>'')
      console.error('Failed to query users:', listRes.status, txt)
      return new Response(JSON.stringify({ error: 'Failed to query users' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
    }

    const listJson = await listRes.json().catch(() => null)
    if (!Array.isArray(listJson) || listJson.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
    }

    const user = listJson[0]
    const uid = user.id

    // Patch user to set email_confirm to true
    const patchRes = await fetch(`${PROJECT_URL}/auth/v1/admin/users/${uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ email_confirm: true })
    })

    if (!patchRes.ok) {
      const txt = await patchRes.text().catch(()=>'')
      console.error('Failed to update user:', patchRes.status, txt)
      return new Response(JSON.stringify({ error: 'Failed to update user' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
    }

    const patched = await patchRes.json().catch(() => null)
    return new Response(JSON.stringify({ ok: true, user: patched }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
  } catch (err) {
    console.error('confirm-email error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey' } })
  }
})
