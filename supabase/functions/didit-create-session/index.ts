import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

interface RequestBody {
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
      },
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Read raw request body first, then parse JSON from it to avoid stream consumption issues
    let body: any = null;
    let rawText = '';
    try {
      rawText = await req.text();
      if (rawText) {
        try {
          body = JSON.parse(rawText);
        } catch (e) {
          console.debug('didit-create-session: request body is not valid JSON:', e && e.message);
        }
      }
    } catch (e) {
      console.debug('didit-create-session: failed to read request body text:', e && e.message);
    }

    // Extract userId flexibly: deep search parsed JSON body, query param, headers, or JWT
    let userId: string | null = null;

    const trySet = (val: any) => {
      if (!userId && val) userId = String(val);
    };

    // shallow checks first
    trySet(body?.userId);
    trySet(body?.user_id);

    try {
      const url = new URL(req.url);
      const q = url.searchParams.get('userId') || url.searchParams.get('user_id');
      trySet(q);
    } catch (e) {}

    const headerUserId = req.headers.get('x-user-id') || req.headers.get('user-id') || req.headers.get('x-userid');
    trySet(headerUserId);

    // deep search in body
    const deepFindUserId = (obj: any): string | null => {
      if (!obj) return null;
      if (typeof obj === 'string') {
        try { const parsed = JSON.parse(obj); return deepFindUserId(parsed); } catch (e) { return null }
      }
      if (typeof obj !== 'object') return null;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (['userId','user_id','userid','id','sub'].includes(k.toLowerCase())) {
          if (typeof v === 'string' && v.trim()) return v;
        }
        if (typeof v === 'string') {
          try { const parsed = JSON.parse(v); const r = deepFindUserId(parsed); if (r) return r } catch (e) {}
        }
        if (typeof v === 'object') {
          const r = deepFindUserId(v); if (r) return r
        }
      }
      return null;
    }

    if (!userId) trySet(deepFindUserId(body));

    // Try to decode Authorization Bearer JWT (best-effort without verification)
    if (!userId) {
      try {
        const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
        const match = auth.match(/^Bearer\s+(.+)$/i);
        if (match) {
          const token = match[1];
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = parts[1];
            const pad = payload.length % 4 === 0 ? '' : '='.repeat(4 - (payload.length % 4));
            const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/') + pad);
            try {
              const obj = JSON.parse(decoded);
              trySet(obj.sub || obj.user_id || obj.id);
              if (obj?.role === 'service_role') {
                console.debug('didit-create-session: Service role token detected; userId must be provided explicitly in body/query/headers');
              }
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (e) {
        console.debug('didit-create-session: failed to decode Authorization token', e && (e as Error).message);
      }
    }

    // last-ditch UUID scan
    if (!userId && rawText) {
      try {
        const uuidMatch = rawText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
        if (uuidMatch) trySet(uuidMatch[0]);
      } catch (e) {}
    }

    if (!userId) {
      try {
        const headersObj = Object.fromEntries(req.headers);
        console.error("didit-create-session: userId missing. headers:", headersObj, "rawBody:", rawText);
      } catch (e) {
        console.error("didit-create-session: userId missing and failed to stringify headers", e);
      }
      return new Response(JSON.stringify({ error: "userId is required", message: "No userId found in request body, query params, headers, or Authorization token", rawBody: rawText }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Get credentials from environment
    const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY");
    const DIDIT_WORKFLOW_ID = Deno.env.get("DIDIT_WORKFLOW_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL") || Deno.env.get("VITE_PROJECT_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");

    const missingVars: string[] = [];
    if (!DIDIT_API_KEY) missingVars.push("DIDIT_API_KEY");
    if (!DIDIT_WORKFLOW_ID) missingVars.push("DIDIT_WORKFLOW_ID");
    if (!SUPABASE_URL) missingVars.push("SUPABASE_URL (or PROJECT_URL / VITE_PROJECT_URL)");
    if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push("SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)");

    if (missingVars.length > 0) {
      console.error("didit-create-session: Missing environment variables:", missingVars);
      return new Response(JSON.stringify({ error: "Missing required environment variables", missing: missingVars }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // Call DIDIT API server-to-server
    const DIDIT_APP_ID = Deno.env.get("DIDIT_APP_ID") || Deno.env.get("VITE_DIDIT_APP_ID") || null

    const diditBody: any = { workflow_id: DIDIT_WORKFLOW_ID }
    if (DIDIT_APP_ID) diditBody.app_id = DIDIT_APP_ID

    const diditResponse = await fetch("https://verification.didit.me/v2/session/", {
      method: "POST",
      headers: { "x-api-key": DIDIT_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(diditBody),
    });

    if (!diditResponse.ok) {
      const errorText = await diditResponse.text();
      console.error("didit-create-session: DIDIT API error:", diditResponse.status, errorText);
      return new Response(JSON.stringify({ error: `DIDIT API error: ${diditResponse.status}`, details: errorText, preview: (typeof errorText === 'string' && errorText.slice(0,200)) || null }), { status: diditResponse.status, headers: { "Content-Type": "application/json" } });
    }

    const sessionData = await diditResponse.json();
    const { session_id, url: sessionUrl } = sessionData;

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store session in database
    // Include placeholder values for required fields (id_type, id_number) - will be updated from DIDIT response
    const { data, error } = await supabase.from("user_verifications").upsert({
      user_id: userId,
      id_type: "national_id",  // Placeholder - will be updated from DIDIT webhook with actual document type
      id_number: session_id,   // Placeholder - will be updated from DIDIT webhook with actual ID number
      didit_workflow_id: DIDIT_WORKFLOW_ID,
      didit_session_id: session_id,
      didit_session_url: sessionUrl,
      status: "pending",
      verification_method: "didit",
      submitted_at: new Date(),
      updated_at: new Date()
    }, { onConflict: "user_id" }).select().single();

    if (error) {
      console.error("didit-create-session: Database error:", error);
      return new Response(JSON.stringify({ error: "Failed to store session in database", details: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, sessionUrl: sessionUrl, sessionId: session_id, data }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    console.error("didit-create-session: Edge function error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
