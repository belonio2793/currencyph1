import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

// DIDIT webhook signature verification
const DIDIT_WEBHOOK_SECRET = Deno.env.get("DIDIT_WEBHOOK_SECRET") || "";

async function verifyDiditSignature(
  signature: string,
  body: string
): Promise<boolean> {
  if (!DIDIT_WEBHOOK_SECRET) {
    console.warn("DIDIT_WEBHOOK_SECRET not configured");
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(body + DIDIT_WEBHOOK_SECRET);
    const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedSignature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return signature === computedSignature;
  } catch (error) {
    console.error("Error verifying DIDIT signature:", error);
    return false;
  }
}

interface DiditDecision {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string;
  age?: number;
  gender?: string;
  address?: string;
  document_type?: string;
  document_number?: string;
  personal_number?: string;
  issuing_state?: string;
  issuing_state_name?: string;
  expiration_date?: string;
  date_of_issue?: string;
  portrait_image?: string;
  front_image?: string;
  back_image?: string;
  front_video?: string;
  back_video?: string;
  full_front_image?: string;
  full_back_image?: string;
}

interface DiditWebhookPayload {
  session_id: string;
  status: "Approved" | "Declined" | "Expired";
  decision?: DiditDecision;
  workflow_id: string;
  timestamp: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, x-signature",
      },
    });
  }

  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    const signature = req.headers.get("x-signature") || "";

    // Verify DIDIT signature
    const isValidSignature = await verifyDiditSignature(signature, body);
    if (!isValidSignature) {
      console.warn("Invalid DIDIT webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const payload: DiditWebhookPayload = JSON.parse(body);
    console.log("Received DIDIT webhook for session:", payload.session_id);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Map DIDIT status to our status
    let verificationStatus: "approved" | "rejected" | "pending";
    switch (payload.status) {
      case "Approved":
        verificationStatus = "approved";
        break;
      case "Declined":
        verificationStatus = "rejected";
        break;
      default:
        verificationStatus = "pending";
    }

    // Prepare decision object for storage (encrypted in frontend if needed)
    const decision = payload.decision || {};

    // Call the update_verification_from_didit function
    const { data, error } = await supabase.rpc(
      "update_verification_from_didit",
      {
        p_didit_session_id: payload.session_id,
        p_status: verificationStatus,
        p_decision: decision,
      }
    );

    if (error) {
      console.error("Error updating verification:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to update verification",
          details: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      "Verification updated successfully for session:",
      payload.session_id
    );

    // Return success response to DIDIT
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("DIDIT webhook error:", error);
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
