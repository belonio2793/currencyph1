import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const COINS_PH_API_BASE = "https://api.pro.coins.ph"
const COINS_PH_API_KEY = Deno.env.get("COINSPH_API_KEY") || ""
const COINS_PH_API_SECRET = Deno.env.get("COINSPH_API_SECRET") || ""

/**
 * HMAC-SHA256 signing helper
 */
async function signRequest(params: Record<string, any>, secret: string): Promise<string> {
  const queryString = Object.entries(params)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")

  const encoder = new TextEncoder()
  const data = encoder.encode(queryString)

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign("HMAC", key, data)
  const hashArray = Array.from(new Uint8Array(signature))
  
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Main handler
 */
serve(async (req) => {
  // Validate environment variables
  if (!COINS_PH_API_KEY || !COINS_PH_API_SECRET) {
    console.error("[coinsph-proxy] Missing API credentials in environment")
    return new Response(
      JSON.stringify({ error: "Server configuration error: Missing API credentials" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  }
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Only POST requests are supported" }),
      { 
        status: 405,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    )
  }

  try {
    // Read and parse request body
    const rawBody = await req.text()
    console.log("[coinsph-proxy] Raw request body:", rawBody)

    if (!rawBody) {
      return new Response(
        JSON.stringify({ error: "Empty request body" }),
        { 
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      )
    }

    const body = JSON.parse(rawBody)
    const { method, path, params = {}, isPublic = false } = body

    console.log("[coinsph-proxy] Parsed request:", { method, path, isPublic, paramsKeys: Object.keys(params) })

    if (!method) {
      return new Response(
        JSON.stringify({ error: "Missing required field: method" }),
        { 
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      )
    }

    if (!path) {
      return new Response(
        JSON.stringify({ error: "Missing required field: path" }),
        { 
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      )
    }

    // Build the request
    let url = `${COINS_PH_API_BASE}${path}`
    let options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      } as Record<string, string>,
    }

    if (!isPublic) {
      // Add API key for authenticated endpoints
      (options.headers as Record<string, string>)["X-MBX-APIKEY"] = COINS_PH_API_KEY

      // Add timestamp and sign
      const timestamp = Math.floor(Date.now())
      const requestParams = {
        ...params,
        timestamp,
      }

      const signature = await signRequest(requestParams, COINS_PH_API_SECRET)
      requestParams.signature = signature

      console.log("[coinsph-proxy] Authenticated request - API Key present:", COINS_PH_API_KEY.substring(0, 10) + "...")

      if (method === "GET") {
        const queryString = new URLSearchParams(
          requestParams as Record<string, string>
        ).toString()
        url += `?${queryString}`
        console.log("[coinsph-proxy] GET URL:", url.substring(0, 150))
      } else {
        options.body = JSON.stringify(requestParams)
      }
    } else {
      // Public endpoints - no signing, no API key
      if (method === "GET") {
        const queryString = new URLSearchParams(
          params as Record<string, string>
        ).toString()
        if (queryString) {
          url += `?${queryString}`
        }
      } else {
        options.body = JSON.stringify(params)
      }
    }

    console.log("[coinsph-proxy] Making request to Coins.ph:", method, url.substring(0, 150))

    // Make the request to Coins.ph
    const response = await fetch(url, options)
    const responseData = await response.json()

    console.log("[coinsph-proxy] Response status:", response.status)

    if (!response.ok) {
      console.error("[coinsph-proxy] API Error:", response.status, responseData)
      return new Response(
        JSON.stringify({
          error: responseData.msg || responseData.error || `Coins.ph API error: ${response.status}`,
          details: responseData,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      )
    }

    // Success
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[coinsph-proxy] Error:", errorMessage)

    return new Response(
      JSON.stringify({
        error: errorMessage,
        type: "proxy_error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  }
})
