import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Extract sessionId from query params or request body
    let sessionId: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        sessionId = body.sessionId || body.session_id;
      } catch (e) {
        // ignore JSON parse errors
      }
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      sessionId = url.searchParams.get("sessionId") || url.searchParams.get("session_id");
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get DIDIT API key
    const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY");

    if (!DIDIT_API_KEY) {
      console.error("didit-check-status: DIDIT_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: "DIDIT API key not configured",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call DIDIT API to check session status
    const diditResponse = await fetch(
      `https://verification.didit.me/v2/session/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": DIDIT_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!diditResponse.ok) {
      const errorText = await diditResponse.text();
      console.error(
        "didit-check-status: DIDIT API error",
        diditResponse.status,
        errorText
      );
      return new Response(
        JSON.stringify({
          error: `DIDIT API error: ${diditResponse.status}`,
          details: errorText.slice(0, 500),
        }),
        {
          status: diditResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await diditResponse.json();

    // Also try to update the database if status changed
    if (data.status && ["Approved", "Declined", "Expired"].includes(data.status)) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL") || Deno.env.get("VITE_PROJECT_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");

        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

          // Map status
          let mappedStatus = "pending";
          if (data.status === "Approved") mappedStatus = "approved";
          else if (data.status === "Declined") mappedStatus = "rejected";
          else if (data.status === "Expired") mappedStatus = "rejected";

          // Try to find and update the verification record
          const { data: records, error: fetchErr } = await supabase
            .from("user_verifications")
            .select("user_id")
            .eq("didit_session_id", sessionId)
            .limit(1);

          if (!fetchErr && records && records.length > 0) {
            const userId = records[0].user_id;
            await supabase
              .from("user_verifications")
              .update({
                status: mappedStatus,
                didit_verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);
          }
        }
      } catch (dbErr) {
        console.warn("didit-check-status: Could not update database:", dbErr);
        // Continue anyway - we have the DIDIT status
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("didit-check-status: error", error);
    return new Response(
      JSON.stringify({
        error: "Failed to check session status",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
