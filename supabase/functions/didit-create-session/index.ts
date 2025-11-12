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

    // Extract userId flexibly: from parsed JSON body, query param, or headers
    let userId = body?.userId || body?.user_id;

    // Try query params
    try {
      const url = new URL(req.url);
      const q = url.searchParams.get('userId') || url.searchParams.get('user_id');
      if (q && !userId) userId = q;
    } catch (e) {
      // ignore
    }

    // Try common headers
    const headerUserId = req.headers.get('x-user-id') || req.headers.get('user-id') || req.headers.get('x-userid');
    if (headerUserId && !userId) userId = headerUserId;

    // If still missing, try to decode Authorization Bearer JWT (best-effort without verification)
    if (!userId) {
      try {
        const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
        const match = auth.match(/^Bearer\s+(.+)$/i);
        if (match) {
          const token = match[1];
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = parts[1];
            // Add padding if needed
            const pad = payload.length % 4 === 0 ? '' : '='.repeat(4 - (payload.length % 4));
            const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/') + pad);
            try {
              const obj = JSON.parse(decoded);
              if (obj && (obj.sub || obj.user_id || obj.id)) {
                userId = obj.sub || obj.user_id || obj.id;
                console.debug('didit-create-session: extracted userId from JWT payload', userId);
              }
            } catch (e) {
              // ignore JSON parse errors
            }
          }
        }
      } catch (e) {
        console.debug('didit-create-session: failed to decode Authorization token', e && e.message);
      }
    }

    if (!userId) {
      // Log everything helpful for debugging
      try {
        const headersObj = Object.fromEntries(req.headers);
        console.error("didit-create-session: userId missing. headers:", headersObj, "rawBody:", rawText);
      } catch (e) {
        console.error("didit-create-session: userId missing and failed to stringify headers", e);
      }

      return new Response(
        JSON.stringify({
          error: "userId is required",
          message: "No userId found in request body, query params, headers, or Authorization token",
          rawBody: rawText
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get credentials from environment (support multiple env var names used in different deploy contexts)
    const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY");
    const DIDIT_WORKFLOW_ID = Deno.env.get("DIDIT_WORKFLOW_ID");
    // Support SUPABASE_URL, PROJECT_URL, or VITE_PROJECT_URL depending on environment
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL") || Deno.env.get("VITE_PROJECT_URL");
    // Support SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");

    // Check all required environment variables
    const missingVars = [];
    if (!DIDIT_API_KEY) missingVars.push("DIDIT_API_KEY");
    if (!DIDIT_WORKFLOW_ID) missingVars.push("DIDIT_WORKFLOW_ID");
    if (!SUPABASE_URL) missingVars.push("SUPABASE_URL (or PROJECT_URL / VITE_PROJECT_URL)");
    if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push("SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)");

    if (missingVars.length > 0) {
      console.error("didit-create-session: Missing environment variables:", missingVars);
      return new Response(
        JSON.stringify({
          error: "Missing required environment variables",
          missing: missingVars
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call DIDIT API server-to-server (no CORS issues)
    const diditResponse = await fetch(
      "https://verification.didit.me/v2/session/",
      {
        method: "POST",
        headers: {
          "x-api-key": DIDIT_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow_id: DIDIT_WORKFLOW_ID,
        }),
      }
    );

    if (!diditResponse.ok) {
      const errorText = await diditResponse.text();
      console.error("didit-create-session: DIDIT API error:", diditResponse.status, errorText);
      // include text and truncated preview to help client debugging
      return new Response(
        JSON.stringify({
          error: `DIDIT API error: ${diditResponse.status}`,
          details: errorText,
          preview: (typeof errorText === 'string' && errorText.slice(0, 200)) || null
        }),
        { status: diditResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const sessionData = await diditResponse.json();
    const { session_id, url: sessionUrl } = sessionData;

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store session in database
    const { data, error } = await supabase
      .from("user_verifications")
      .upsert({
        user_id: userId,
        didit_workflow_id: DIDIT_WORKFLOW_ID,
        didit_session_id: session_id,
        didit_session_url: sessionUrl,
        status: "pending",
        verification_method: "didit",
        submitted_at: new Date(),
        updated_at: new Date(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error("didit-create-session: Database error:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to store session in database",
          details: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionUrl: sessionUrl,
        sessionId: session_id,
        data,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("didit-create-session: Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
