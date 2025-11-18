import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * This function is triggered by Supabase scheduled tasks / pg_cron
 * Run every hour to execute all trading strategies
 */
async function runBotCycle() {
  console.log("[Bot Scheduler] Starting bot cycle...")

  try {
    // Get all users with enabled trading
    const { data: settings } = await supabase
      .from("trading_settings")
      .select("user_id")
      .eq("trading_enabled", true)

    if (!settings || settings.length === 0) {
      console.log("[Bot Scheduler] No users with trading enabled")
      return { message: "No active traders" }
    }

    const results = []

    for (const { user_id } of settings) {
      try {
        // Call the main bot executor function
        const response = await fetch(
          `${supabaseUrl}/functions/v1/trading-bot-executor`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              action: "execute_strategies",
              userId: user_id,
            }),
          }
        )

        const result = await response.json()
        results.push({ user_id, ...result })

        // Also manage open positions
        const posResponse = await fetch(
          `${supabaseUrl}/functions/v1/trading-bot-executor`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              action: "manage_positions",
              userId: user_id,
            }),
          }
        )

        const posResult = await posResponse.json()
        results.push({ user_id, action: "manage_positions", ...posResult })
      } catch (error) {
        console.error(`[Bot Scheduler] Error processing user ${user_id}:`, error)
        results.push({
          user_id,
          success: false,
          error: error.message,
        })
      }
    }

    console.log("[Bot Scheduler] Bot cycle complete")
    return {
      success: true,
      usersProcessed: settings.length,
      results,
    }
  } catch (error) {
    console.error("[Bot Scheduler] Fatal error:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Handle cron trigger (Supabase Edge Functions with scheduling)
Deno.serve(async (req: Request) => {
  // Verify request is from Supabase (optional security check)
  const authHeader = req.headers.get("authorization")

  const result = await runBotCycle()

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  })
})
