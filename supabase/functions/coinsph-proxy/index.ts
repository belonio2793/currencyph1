import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const COINS_PH_API_BASE = "https://api.pro.coins.ph"
const COINS_PH_API_KEY = "ST09VIZGxK1e7xxPlTYPs1oqtYNb6M9thDssZaDybWAqBbucpGV2NcmebGTWcqpD"
const COINS_PH_API_SECRET = "vtdLuUyRlJxaCImSXSQi7HHvLTpsm1fttAGiM5eys7enu63yrnqC0sivdXjFLVqI"

/**
 * HMAC-SHA256 signing helper
 */
async function signRequest(params: Record<string, any>, secret: string): Promise<string> {
  try {
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
  } catch (e) {
    console.error("[signRequest] Error:", e)
    throw e
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  console.log("[coinsph-proxy] New request:", {
    method: req.method,
    url: req.url,
    contentType: req.headers.get("content-type"),
  })

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[coinsph-proxy] Handling OPTIONS request")
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  try {
    // Parse request body
    let body: any
    try {
      const text = await req.text()
      console.log("[coinsph-proxy] Raw body:", text)
      body = text ? JSON.parse(text) : {}
    } catch (parseError) {
      console.error("[coinsph-proxy] Failed to parse JSON:", parseError)
      return new Response(
        JSON.stringify({ 
          error: "Invalid JSON in request body",
          received: await req.text(),
        }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      )
    }

    const { method, path, params = {}, isPublic = false } = body

    console.log("[coinsph-proxy] Parsed request:", { method, path, isPublic })

    // Validate required fields
    if (!method) {
      console.error("[coinsph-proxy] Missing method")
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
      console.error("[coinsph-proxy] Missing path")
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

      try {
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
        } else {
          options.body = JSON.stringify(requestParams)
        }
      } catch (signError) {
        console.error("[coinsph-proxy] Signing failed:", signError)
        return new Response(
          JSON.stringify({ 
            error: "Failed to sign request",
            details: signError instanceof Error ? signError.message : String(signError),
          }),
          { 
            status: 500, 
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            } 
          }
        )
      }
    } else {
      // Public endpoints
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

    console.log("[coinsph-proxy] Making request:", { 
      method, 
      url: url.substring(0, 100),
      hasBody: !!options.body,
    })

    // Make the request to Coins.ph API
    const response = await fetch(url, options)
    const responseData = await response.json()

    console.log("[coinsph-proxy] Response:", { 
      status: response.status,
      hasData: !!responseData,
    })

    if (!response.ok) {
      console.error("[coinsph-proxy] API Error:", { 
        status: response.status, 
        data: responseData 
      })
      return new Response(
        JSON.stringify({
          error: responseData.msg || responseData.error || `API Error: ${response.status}`,
          status: response.status,
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

    console.log("[coinsph-proxy] Success")
    // Return successful response
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[coinsph-proxy] Unhandled error:", errorMessage, error)

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: "Unhandled error in proxy function",
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
