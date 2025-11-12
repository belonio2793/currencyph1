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
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    const { userId } = (await req.json()) as RequestBody;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get credentials from environment
    const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY");
    const DIDIT_WORKFLOW_ID = Deno.env.get("DIDIT_WORKFLOW_ID");

    if (!DIDIT_API_KEY || !DIDIT_WORKFLOW_ID) {
      console.error("Missing DIDIT credentials in environment");
      return new Response(
        JSON.stringify({ error: "DIDIT credentials not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
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
      console.error("DIDIT API error:", diditResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: `DIDIT API error: ${diditResponse.status}`,
          details: errorText,
        }),
        {
          status: diditResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const sessionData = await diditResponse.json();
    const { session_id, url: sessionUrl } = sessionData;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to store session in database",
          details: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
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
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
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
