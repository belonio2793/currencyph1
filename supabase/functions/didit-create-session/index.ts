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
    let body: any;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userId = body?.userId;

    if (!userId) {
      console.error("userId missing from request body. Received:", body);
      return new Response(
        JSON.stringify({
          error: "userId is required",
          receivedBody: body
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get credentials from environment
    const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY");
    const DIDIT_WORKFLOW_ID = Deno.env.get("DIDIT_WORKFLOW_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Check all required environment variables
    const missingVars = [];
    if (!DIDIT_API_KEY) missingVars.push("DIDIT_API_KEY");
    if (!DIDIT_WORKFLOW_ID) missingVars.push("DIDIT_WORKFLOW_ID");
    if (!SUPABASE_URL) missingVars.push("SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missingVars.length > 0) {
      console.error("Missing environment variables:", missingVars);
      return new Response(
        JSON.stringify({
          error: "Missing required environment variables",
          missing: missingVars
        }),
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
