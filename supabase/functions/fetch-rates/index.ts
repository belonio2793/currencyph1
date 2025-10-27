import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RatesResponse {
  exchangeRates: Record<string, number>;
  cryptoPrices: Record<string, Record<string, number>>;
  timestamp: string;
  success: boolean;
  error?: string;
}

async function fetchCurrencyRates(): Promise<Record<string, number> | null> {
  const endpoints = [
    { url: "https://api.exchangerate.host/latest?base=USD", ratesKey: "rates" },
    { url: "https://api.exchangerate-api.com/v4/latest/USD", ratesKey: "rates" },
    {
      url: "https://open.er-api.com/v6/latest/USD",
      ratesKey: "rates",
    },
  ];

  for (const { url, ratesKey } of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`Currency API ${url} returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data && data[ratesKey]) {
        console.log(`✓ Fetched exchange rates from ${url}`);
        return data[ratesKey];
      }
    } catch (err) {
      console.warn(`Failed to fetch from ${url}:`, (err as any).message);
      continue;
    }
  }

  console.warn("All currency endpoints failed");
  return null;
}

async function fetchCryptoPrices(): Promise<Record<string, Record<string, number>> | null> {
  try {
    const cryptoIds = [
      "bitcoin",
      "ethereum",
      "litecoin",
      "dogecoin",
      "ripple",
      "cardano",
      "solana",
      "avalanche-2",
      "matic-network",
      "polkadot",
      "chainlink",
      "uniswap",
      "aave",
      "usd-coin",
      "tether",
    ];

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds.join(
      ","
    )}&vs_currencies=usd`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`Crypto API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`✓ Fetched crypto prices from CoinGecko`);
    return data;
  } catch (err) {
    console.warn(`Failed to fetch crypto prices:`, (err as any).message);
    return null;
  }
}

async function cacheRates(
  supabase: any,
  exchangeRates: Record<string, number>,
  cryptoPrices: Record<string, Record<string, number>>
) {
  try {
    const timestamp = new Date().toISOString();

    // Store in database for fallback/analytics
    const { error } = await supabase.from("cached_rates").insert({
      exchange_rates: exchangeRates,
      crypto_prices: cryptoPrices,
      fetched_at: timestamp,
      source: "edge_function",
    });

    if (error) {
      console.warn("Failed to cache rates:", error.message);
    } else {
      console.log("✓ Cached rates to database");
    }
  } catch (err) {
    console.warn("Error caching rates:", (err as any).message);
  }
}

Deno.serve(async (req) => {
  // Enable CORS for browser requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Fetch rates in parallel
    const [exchangeRates, cryptoPrices] = await Promise.all([
      fetchCurrencyRates(),
      fetchCryptoPrices(),
    ]);

    const response: RatesResponse = {
      exchangeRates: exchangeRates || {},
      cryptoPrices: cryptoPrices || {},
      timestamp: new Date().toISOString(),
      success: Boolean(exchangeRates && cryptoPrices),
    };

    // Attempt to cache (don't fail if caching fails)
    if (exchangeRates && cryptoPrices && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await cacheRates(supabase, exchangeRates, cryptoPrices);
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes on CDN
      },
    });
  } catch (err) {
    console.error("Error fetching rates:", err);

    const errorResponse: RatesResponse = {
      exchangeRates: {},
      cryptoPrices: {},
      timestamp: new Date().toISOString(),
      success: false,
      error: (err as any).message || "Unknown error",
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
