/**
 * Edge Function: Fetch and cache exchange rates
 * 
 * Runs every hour to:
 * 1. Fetch fresh rates from CoinGecko (crypto) and other sources (fiat)
 * 2. Insert/update rates in crypto_rates table
 * 3. Expire old rates (>7 days)
 * 
 * Triggered by cron job or manual call
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Supported currencies
const FIAT_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "PHP", "AUD", "CAD", "SGD", "HKD", "INR"];
const CRYPTO_CURRENCIES = [
  "BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "XRP", "ADA", "DOGE", "DOT",
  "LTC", "BCH", "MATIC", "LINK", "AVAX", "UNI", "SHIB", "ATOM", "VET", "FIL"
];

interface FetchResult {
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  success: boolean;
  error?: string;
}

/**
 * Fetch crypto to fiat rates from CoinGecko
 */
async function fetchCryptoRates(cryptos: string[], fiats: string[]): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  
  try {
    // Build market data query
    const cryptoIds = {
      "BTC": "bitcoin",
      "ETH": "ethereum",
      "USDT": "tether",
      "USDC": "usd-coin",
      "BNB": "binancecoin",
      "SOL": "solana",
      "XRP": "ripple",
      "ADA": "cardano",
      "DOGE": "dogecoin",
      "DOT": "polkadot",
      "LTC": "litecoin",
      "BCH": "bitcoin-cash",
      "MATIC": "matic-network",
      "LINK": "chainlink",
      "AVAX": "avalanche-2",
      "UNI": "uniswap",
      "SHIB": "shiba-inu",
      "ATOM": "cosmos",
      "VET": "vechain",
      "FIL": "filecoin"
    };
    
    const ids = cryptos
      .map(c => cryptoIds[c as keyof typeof cryptoIds] || c.toLowerCase())
      .join(",");
    
    const vsCurrencies = fiats.map(f => f.toLowerCase()).join(",");
    
    const url = `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}&include_market_cap=false&include_24hr_vol=false&include_1hr_change=false`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse response into rate pairs
    for (const [cryptoId, rates] of Object.entries(data)) {
      const cryptoCode = Object.entries(cryptoIds).find(([, id]) => id === cryptoId)?.[0];
      
      if (!cryptoCode) continue;
      
      const ratesObj = rates as Record<string, number>;
      
      for (const [fiatLower, rate] of Object.entries(ratesObj)) {
        const fiatCode = fiatLower.toUpperCase();
        
        results.push({
          from_currency: cryptoCode,
          to_currency: fiatCode,
          rate: rate,
          source: "coingecko",
          success: true
        });
      }
    }
  } catch (error) {
    console.error("Error fetching crypto rates:", error);
    results.push({
      from_currency: "ERROR",
      to_currency: "ALL",
      rate: 0,
      source: "coingecko",
      success: false,
      error: String(error)
    });
  }
  
  return results;
}

/**
 * Fetch fiat to fiat rates (USD as base)
 * Using Open Exchange Rates API or fallback
 */
async function fetchFiatRates(fiats: string[]): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  
  try {
    // For now, using hardcoded rates as fallback
    // In production, use Open Exchange Rates API or similar
    const fiatRates: Record<string, number> = {
      "PHP": 56.5,
      "EUR": 0.92,
      "GBP": 0.79,
      "JPY": 149.5,
      "AUD": 1.54,
      "CAD": 1.36,
      "SGD": 1.34,
      "HKD": 7.82,
      "INR": 83.2
    };
    
    // Create pairs: USD as base
    for (const fiat of fiats) {
      if (fiat === "USD") continue; // Skip USD to USD
      
      const rate = fiatRates[fiat] || 1;
      
      results.push({
        from_currency: fiat,
        to_currency: "USD",
        rate: 1 / rate, // Reverse if needed
        source: "fallback",
        success: true
      });
      
      // Also add reverse (e.g., PHP to USD)
      results.push({
        from_currency: "USD",
        to_currency: fiat,
        rate: rate,
        source: "fallback",
        success: true
      });
    }
  } catch (error) {
    console.error("Error fetching fiat rates:", error);
    results.push({
      from_currency: "ERROR",
      to_currency: "FIAT",
      rate: 0,
      source: "fallback",
      success: false,
      error: String(error)
    });
  }
  
  return results;
}

/**
 * Store rates in database
 */
async function storeRates(supabase: any, rates: FetchResult[]): Promise<{ stored: number; failed: number }> {
  let stored = 0;
  let failed = 0;
  
  for (const rate of rates) {
    if (!rate.success) continue;
    
    try {
      const { error } = await supabase
        .from("crypto_rates")
        .upsert({
          from_currency: rate.from_currency,
          to_currency: rate.to_currency,
          rate: rate.rate.toString(),
          source: rate.source,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Expire in 7 days
        }, {
          onConflict: "from_currency,to_currency"
        });
      
      if (error) {
        console.error(`Failed to store rate ${rate.from_currency}→${rate.to_currency}:`, error);
        failed++;
      } else {
        stored++;
      }
    } catch (error) {
      console.error(`Error storing rate:`, error);
      failed++;
    }
  }
  
  return { stored, failed };
}

/**
 * Main handler
 */
export async function handler(req: Request): Promise<Response> {
  try {
    // Verify authorization (check header or secret)
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("FUNCTION_SECRET");
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log("🔄 Starting hourly rate fetch...");
    
    // Fetch rates
    const [cryptoRates, fiatRates] = await Promise.all([
      fetchCryptoRates(CRYPTO_CURRENCIES, FIAT_CURRENCIES),
      fetchFiatRates(FIAT_CURRENCIES)
    ]);
    
    const allRates = [...cryptoRates, ...fiatRates];
    console.log(`📊 Fetched ${allRates.length} rates`);
    
    // Store in database
    const { stored, failed } = await storeRates(supabase, allRates);
    console.log(`✅ Stored: ${stored}, Failed: ${failed}`);
    
    // Clean up expired rates
    const { data: deleted } = await supabase
      .from("crypto_rates")
      .delete()
      .lt("expires_at", new Date().toISOString());
    
    console.log(`🗑️ Cleaned up expired rates`);
    
    return new Response(
      JSON.stringify({
        success: true,
        fetched: allRates.length,
        stored: stored,
        failed: failed,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        timestamp: new Date().toISOString()
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    );
  }
}
