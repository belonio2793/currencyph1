import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts"

const COINS_PH_API_BASE = "https://api.pro.coins.ph"

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, PUT",
        "Access-Control-Allow-Headers": "Content-Type, X-API-Key, X-API-Secret",
      },
    })
  }

  try {
    // Extract API credentials from request headers
    const apiKey = req.headers.get("X-API-Key")
    const apiSecret = req.headers.get("X-API-Secret")

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: "Missing API credentials (X-API-Key or X-API-Secret)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Parse the request body
    const body = await req.json()
    const { method, path, params = {}, isPublic = false } = body

    if (!method || !path) {
      return new Response(
        JSON.stringify({ error: "Missing method or path" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    let url = `${COINS_PH_API_BASE}${path}`
    let options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    }

    if (!isPublic) {
      // Add timestamp and sign request for authenticated endpoints
      const requestParams = {
        ...params,
        timestamp: Math.floor(Date.now()),
      }

      const signature = await signRequest(requestParams, apiSecret)
      requestParams.signature = signature

      // Set API key header
      ;(options.headers as Record<string, string>)["X-MBX-APIKEY"] = apiKey

      if (method === "GET") {
        const queryString = new URLSearchParams(
          requestParams as Record<string, string>
        ).toString()
        url += `?${queryString}`
      } else {
        options.body = JSON.stringify(requestParams)
      }
    } else {
      // Public endpoints don't need signing
      if (method === "GET") {
        const queryString = new URLSearchParams(
          params as Record<string, string>
        ).toString()
        url += `?${queryString}`
      } else {
        options.body = JSON.stringify(params)
      }
    }

    // Make the request to Coins.ph API
    const response = await fetch(url, options)
    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data.msg || `API Error: ${response.status}`,
          status: response.status,
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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
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
