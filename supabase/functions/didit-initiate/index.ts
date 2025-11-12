import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  try {
    const raw = await req.text();
    let body: any = {};
    try { body = raw ? JSON.parse(raw) : {} } catch (e) { body = {}; }

    const userId = body.userId || body.user_id || req.headers.get('x-user-id') || null;
    const sessionUrl = body.sessionUrl || body.didit_session_url || null;

    if (!userId) return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (!sessionUrl) return new Response(JSON.stringify({ error: 'sessionUrl is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    // extract session id from URL if possible
    let sessionId = null;
    try {
      const match = sessionUrl.match(/session\/([A-Za-z0-9_-]+)/i);
      if (match) sessionId = match[1];
    } catch (e) {}

    // envs
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || Deno.env.get('VITE_PROJECT_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY');
    const DIDIT_WORKFLOW_ID = Deno.env.get('DIDIT_WORKFLOW_ID') || null;

    const missing: string[] = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (missing.length > 0) return new Response(JSON.stringify({ error: 'Missing env vars', missing }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload: any = {
      user_id: userId,
      didit_session_id: sessionId,
      didit_session_url: sessionUrl,
      // required fields in your schema: id_type and id_number are NOT NULL
      id_type: body.id_type || 'external',
      id_number: body.id_number || '',
      id_image_url: body.id_image_url || null,
      status: 'pending',
      verification_method: 'didit',
      submitted_at: new Date(),
      updated_at: new Date()
    };

    if (DIDIT_WORKFLOW_ID) payload.didit_workflow_id = DIDIT_WORKFLOW_ID;

    const { data, error } = await supabase.from('user_verifications').upsert(payload, { onConflict: 'user_id' }).select().single();

    if (error) {
      console.error('didit-initiate: db error', error);
      return new Response(JSON.stringify({ error: 'DB upsert failed', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  } catch (err) {
    console.error('didit-initiate: unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
