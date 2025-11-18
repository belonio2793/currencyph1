import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const COINS_PH_API_BASE = "https://api.pro.coins.ph"
const COINS_PH_API_KEY = "ST09VIZGxK1e7xxPlTYPs1oqtYNb6M9thDssZaDybWAqBbucpGV2NcmebGTWcqpD"
const COINS_PH_API_SECRET = "vtdLuUyRlJxaCImSXSQi7HHvLTpsm1fttAGiM5eys7enu63yrnqC0sivdXjFLVqI"

/**
 * HMAC-SHA256 signing helper using Web Crypto
 */
async function signRequest(params: Record<string, any>, secret: string): Promise<string> {
  // Sort params by key
  const queryString = Object.entries(params)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")

  console.log("[coinsph-proxy] Query String:", queryString)

  const encoder = new TextEncoder()
  const data = encoder.encode(queryString)

  // Import key
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  // Sign
  const signature = await crypto.subtle.sign("HMAC", key, data)

  // Convert to hex
  const hashArray = Array.from(new Uint8Array(signature))
  const signatureHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("")

  console.log("[coinsph-proxy] Signature:", signatureHex)

  return signatureHex
}

/**
 * Main handler
 */
serve(async (req) => {
  console.log("[coinsph-proxy] Received request:", req.method, req.url)

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  try {
    // Parse request body
    const body = await req.json()
    const { method, path, params = {}, isPublic = false } = body

    console.log("[coinsph-proxy] Request body:", { method, path, isPublic })

    if (!method || !path) {
      return new Response(
        JSON.stringify({ error: "Missing method or path" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      )
    }

    let url = `${COINS_PH_API_BASE}${path}`
    let options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      } as Record<string, string>,
    }

    if (!isPublic) {
      // Add timestamp
      const requestParams = {
        ...params,
        timestamp: Math.floor(Date.now()),
      }

      console.log("[coinsph-proxy] Signing request with params:", requestParams)

      // Sign request
      const signature = await signRequest(requestParams, COINS_PH_API_SECRET)
      requestParams.signature = signature

      // Set API key header
      options.headers["X-MBX-APIKEY"] = COINS_PH_API_KEY

      if (method === "GET") {
        const queryString = new URLSearchParams(
          requestParams as Record<string, string>
        ).toString()
        url += `?${queryString}`
        console.log("[coinsph-proxy] GET URL:", url)
      } else {
        options.body = JSON.stringify(requestParams)
        console.log("[coinsph-proxy] Request body:", options.body)
      }
    } else {
      // Public endpoints - no signing needed
      if (method === "GET") {
        const queryString = new URLSearchParams(
          params as Record<string, string>
        ).toString()
        if (queryString) {
          url += `?${queryString}`
        }
        console.log("[coinsph-proxy] Public GET URL:", url)
      } else {
        options.body = JSON.stringify(params)
      }
    }

    console.log("[coinsph-proxy] Making request to Coins.ph:", method, url)

    // Make the request to Coins.ph API
    const response = await fetch(url, options)
    const data = await response.json()

    console.log("[coinsph-proxy] Response status:", response.status)
    console.log("[coinsph-proxy] Response data:", data)

    if (!response.ok) {
      console.error("[coinsph-proxy] API Error:", response.status, data)
      return new Response(
        JSON.stringify({
          error: data.msg || data.error || `API Error: ${response.status}`,
          status: response.status,
          details: data,
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

    // Return successful response
    return new Response(JSON.stringify(data), {
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
        details: "Failed to proxy request to Coins.ph API",
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
