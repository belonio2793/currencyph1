import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    )

    const { depositId, referenceNumber } = await req.json()

    if (!depositId || !referenceNumber) {
      return new Response(
        JSON.stringify({ error: "Missing depositId or referenceNumber" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get the deposit
    const { data: deposit, error: fetchError } = await supabaseAdmin
      .from("deposits")
      .select("*")
      .eq("id", depositId)
      .eq("deposit_method", "gcash")
      .single()

    if (fetchError || !deposit) {
      return new Response(
        JSON.stringify({
          error: "Deposit not found or not a GCash deposit",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    // Verify reference number matches
    if (deposit.reference_number !== referenceNumber.trim()) {
      return new Response(
        JSON.stringify({
          error: "Reference number does not match",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Check if deposit is still pending
    if (deposit.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: `Deposit is already ${deposit.status}, cannot change status`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Update deposit status to approved
    const { data: updatedDeposit, error: updateError } = await supabaseAdmin
      .from("deposits")
      .update({
        status: "approved",
        completed_at: new Date().toISOString(),
      })
      .eq("id", depositId)
      .select()
      .single()

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: "Failed to approve deposit",
          details: updateError,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Update wallet balance
    if (deposit.converted_amount) {
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("id", deposit.wallet_id)
        .single()

      if (!walletError && wallet) {
        const newBalance = wallet.balance + deposit.converted_amount

        await supabaseAdmin
          .from("wallets")
          .update({ balance: newBalance })
          .eq("id", deposit.wallet_id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "GCash deposit approved successfully",
        deposit: updatedDeposit,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
