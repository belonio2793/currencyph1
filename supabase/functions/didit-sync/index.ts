import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

Deno.serve(async (req) => {
  // Allow GET/POST and CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL") || Deno.env.get("VITE_PROJECT_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
    const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY");

    const missing: string[] = [];
    if (!SUPABASE_URL) missing.push("SUPABASE_URL (or PROJECT_URL / VITE_PROJECT_URL)");
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)");
    if (!DIDIT_API_KEY) missing.push("DIDIT_API_KEY");
    if (missing.length > 0) {
      console.error("didit-sync: missing env vars", missing);
      return new Response(JSON.stringify({ error: "Missing env vars", missing }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch pending sessions to sync
    const { data: rows, error: fetchErr } = await supabase
      .from("user_verifications")
      .select("didit_session_id, user_id")
      .in("status", ["pending"])
      .not("didit_session_id", "is", null)
      .limit(100);

    if (fetchErr) {
      console.error("didit-sync: failed to fetch pending rows", fetchErr);
      return new Response(JSON.stringify({ error: "Failed to fetch pending rows", details: fetchErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No pending sessions to sync" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const results: any[] = [];

    // helper to pause between requests to respect rate limits
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    for (const r of rows) {
      const sessionId = r.didit_session_id;
      if (!sessionId) continue;

      try {
        const url = `https://verification.didit.me/v2/session/${encodeURIComponent(sessionId)}`;
        const resp = await fetch(url, {
          method: "GET",
          headers: { "x-api-key": DIDIT_API_KEY, "Content-Type": "application/json" },
        });

        if (!resp.ok) {
          const txt = await resp.text();
          console.warn("didit-sync: DIDIT API returned non-ok for", sessionId, resp.status, txt.substring(0, 500));
          results.push({ sessionId, ok: false, status: resp.status, detail: txt });
          // small backoff
          await sleep(250);
          continue;
        }

        const payload = await resp.json();
        // DIDIT v2 uses status like Approved, Declined, Expired, Pending (best-effort)
        const remoteStatus: string = (payload.status || "").toString();
        let mapped: string = "pending";
        if (/approved/i.test(remoteStatus) || remoteStatus === "Approved") mapped = "approved";
        else if (/declined|rejected/i.test(remoteStatus) || remoteStatus === "Declined") mapped = "rejected";
        else if (/expired/i.test(remoteStatus) || remoteStatus === "Expired") mapped = "expired";
        else mapped = "pending";

        const decision = payload.decision || {};

        // Use RPC if available (same as webhook): update_verification_from_didit
        const { data: rpcData, error: rpcErr } = await supabase.rpc("update_verification_from_didit", {
          p_didit_session_id: sessionId,
          p_status: mapped,
          p_decision: decision,
        });

        if (rpcErr) {
          console.error("didit-sync: rpc error for", sessionId, rpcErr);
          // fallback: try to upsert row directly
          const { data: upData, error: upErr } = await supabase.from("user_verifications").upsert({ didit_session_id: sessionId, status: mapped, decision: decision, updated_at: new Date() }, { onConflict: "didit_session_id" }).select().single();
          if (upErr) {
            console.error("didit-sync: fallback upsert failed for", sessionId, upErr);
            results.push({ sessionId, ok: false, error: rpcErr.message, fallbackError: upErr.message });
          } else {
            results.push({ sessionId, ok: true, source: "fallback_upsert", data: upData });
          }
        } else {
          results.push({ sessionId, ok: true, source: "rpc", data: rpcData });
        }

        // gentle rate limit
        await sleep(150);
      } catch (err) {
        console.error("didit-sync: error processing session", r.didit_session_id, err);
        results.push({ sessionId: r.didit_session_id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    console.error("didit-sync: unexpected error", error);
    return new Response(JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
