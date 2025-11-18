import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const coinsPhApiKey = Deno.env.get("COINSPH_API_KEY")
const coinsPhApiSecret = Deno.env.get("COINSPH_API_SECRET")

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * HMAC-SHA256 signing for Coins.ph API
 */
function signRequest(params: Record<string, any>, secret: string): string {
  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&")

  return crypto
    .subtle
    .sign("HMAC", new TextEncoder().encode(secret), new TextEncoder().encode(queryString))
    .then(sig => {
      const hex = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
      return hex
    })
}

/**
 * Fetch candles from Coins.ph API
 */
async function fetchCandles(symbol: string, interval: string, limit: number = 100) {
  try {
    const url = `https://api.pro.coins.ph/openapi/quote/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    const response = await fetch(url)
    return await response.json()
  } catch (error) {
    console.error(`Failed to fetch candles for ${symbol}:`, error)
    return []
  }
}

/**
 * Get current account info from Coins.ph
 */
async function getAccountInfo() {
  try {
    const timestamp = Math.floor(Date.now())
    const params: Record<string, any> = { timestamp }
    
    const signature = await signRequest(params, coinsPhApiSecret)
    params.signature = signature

    const queryString = new URLSearchParams(params).toString()
    const url = `https://api.pro.coins.ph/openapi/v3/account?${queryString}`

    const response = await fetch(url, {
      headers: {
        "X-MBX-APIKEY": coinsPhApiKey,
        "Content-Type": "application/json",
      },
    })

    return await response.json()
  } catch (error) {
    console.error("Failed to get account info:", error)
    return null
  }
}

/**
 * Place market buy order
 */
async function placeMarketBuyOrder(symbol: string, quoteOrderQty: number) {
  try {
    const timestamp = Math.floor(Date.now())
    const params: Record<string, any> = {
      symbol,
      side: "BUY",
      type: "MARKET",
      quoteOrderQty,
      timestamp,
    }

    const signature = await signRequest(params, coinsPhApiSecret)
    params.signature = signature

    const response = await fetch("https://api.pro.coins.ph/openapi/v3/order", {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": coinsPhApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })

    return await response.json()
  } catch (error) {
    console.error(`Failed to place BUY order for ${symbol}:`, error)
    return null
  }
}

/**
 * Execute all active trading strategies for a user
 */
async function executeStrategiesForUser(userId: string) {
  try {
    // Get active strategies
    const { data: strategies } = await supabase
      .from("trading_strategies")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true)

    if (!strategies || strategies.length === 0) {
      return { success: true, message: "No active strategies" }
    }

    const results = []

    for (const strategy of strategies) {
      try {
        const symbols = strategy.symbols || ["BTCPHP", "ETHPHP"]

        for (const symbol of symbols) {
          try {
            // Fetch latest candles
            const candles = await fetchCandles(symbol, strategy.timeframe || "1h", 200)

            if (!candles || candles.length === 0) {
              continue
            }

            // Simple strategy evaluation (in production, use more complex logic)
            const signal = evaluateSimpleStrategy(candles, strategy)

            if (signal && signal.action !== "HOLD") {
              // Log the signal
              await supabase.from("trading_signals").insert({
                user_id: userId,
                strategy_id: strategy.id,
                symbol,
                signal_type: signal.action,
                signal_strength: signal.strength || 0.7,
                price: signal.price,
                reasoning: signal.reasoning,
              })

              results.push({
                symbol,
                signal: signal.action,
                price: signal.price,
              })
            }
          } catch (error) {
            console.error(`Error processing ${symbol} for strategy ${strategy.id}:`, error)
          }
        }
      } catch (error) {
        console.error(`Error executing strategy ${strategy.id}:`, error)
      }
    }

    return {
      success: true,
      strategiesExecuted: strategies.length,
      signals: results,
    }
  } catch (error) {
    console.error("Failed to execute strategies:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Simple strategy evaluation (SMA crossover)
 */
function evaluateSimpleStrategy(candles: any[], strategy: any) {
  if (candles.length < 200) return null

  const closes = candles.map((c: any) => parseFloat(c[4]))

  // Calculate simple moving averages
  const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50
  const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200
  const currentPrice = closes[closes.length - 1]
  const prevPrice = closes[closes.length - 2]

  // Simple SMA crossover strategy
  if (currentPrice > sma50 && sma50 > sma200 && prevPrice <= sma50) {
    return {
      action: "BUY",
      price: currentPrice,
      strength: 0.8,
      reasoning: "Price crossed above 50-SMA with 50 above 200",
    }
  }

  if (currentPrice < sma50 && sma50 < sma200 && prevPrice >= sma50) {
    return {
      action: "SELL",
      price: currentPrice,
      strength: 0.8,
      reasoning: "Price crossed below 50-SMA with 50 below 200",
    }
  }

  return null
}

/**
 * Check and close positions that hit stop-loss or take-profit
 */
async function manageOpenPositions(userId: string) {
  try {
    // Get open positions
    const { data: trades } = await supabase
      .from("completed_trades")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "OPEN")

    if (!trades || trades.length === 0) {
      return { message: "No open positions" }
    }

    const results = []

    for (const trade of trades) {
      try {
        // Get current price
        const url = `https://api.pro.coins.ph/openapi/quote/v1/ticker/price?symbol=${trade.symbol}`
        const response = await fetch(url)
        const priceData = await response.json()
        const currentPrice = parseFloat(priceData.price)

        const pnl = (currentPrice - trade.entry_price) * trade.quantity
        const pnlPercent = (pnl / (trade.entry_price * trade.quantity)) * 100

        // Check stop-loss (1%)
        if (pnlPercent < -1) {
          await supabase
            .from("completed_trades")
            .update({
              exit_price: currentPrice,
              exit_time: new Date(),
              pnl_php: pnl,
              pnl_percent: pnlPercent,
              status: "STOP_LOSS_HIT",
            })
            .eq("id", trade.id)

          results.push({
            tradeId: trade.id,
            action: "CLOSED_STOP_LOSS",
            pnl,
          })
        }

        // Check take-profit (2%)
        if (pnlPercent > 2) {
          await supabase
            .from("completed_trades")
            .update({
              exit_price: currentPrice,
              exit_time: new Date(),
              pnl_php: pnl,
              pnl_percent: pnlPercent,
              status: "TAKE_PROFIT_HIT",
            })
            .eq("id", trade.id)

          results.push({
            tradeId: trade.id,
            action: "CLOSED_TAKE_PROFIT",
            pnl,
          })
        }
      } catch (error) {
        console.error(`Error managing position ${trade.id}:`, error)
      }
    }

    return { positionsManaged: trades.length, results }
  } catch (error) {
    console.error("Failed to manage positions:", error)
    return { error: error.message }
  }
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const { action, userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    let result

    switch (action) {
      case "execute_strategies":
        result = await executeStrategiesForUser(userId)
        break

      case "manage_positions":
        result = await manageOpenPositions(userId)
        break

      case "get_account":
        result = await getAccountInfo()
        break

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: CORS_HEADERS }
        )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
