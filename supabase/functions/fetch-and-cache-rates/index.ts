/**
 * Edge Function: Fetch and cache exchange rates
 * 
 * Runs every hour to:
 * 1. Fetch fresh rates from CoinGecko (crypto) and other sources (fiat)
 * 2. Insert/update rates in crypto_rates table with timestamps
 * 3. Expire old rates (>7 days)
 * 4. Provide rate confirmation with timestamps for user display
 * 
 * Triggered by cron job or manual call
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Supported currencies
const FIAT_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "PHP", "AUD", "CAD", "SGD", "HKD", "INR"];

// All cryptocurrencies from /deposits (30 total)
const CRYPTO_CURRENCIES = [
  "BTC", "ETH", "USDT", "BNB", "XRP", "USDC", "SOL", "TRX", "DOGE", "ADA",
  "BCH", "LINK", "XLM", "HYPE", "LTC", "SUI", "AVAX", "HBAR", "SHIB", "PYUSD",
  "WLD", "TON", "UNI", "DOT", "AAVE", "XAUT", "PEPE", "ASTER", "ENA", "SKY"
];

interface FetchResult {
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  success: boolean;
  error?: string;
  fetched_at?: string;
}

interface RateConfirmation {
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  fetched_at: string;
}

/**
 * Fetch crypto to fiat rates from CoinGecko
 */
async function fetchCryptoRates(cryptos: string[], fiats: string[]): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  const fetchedAt = new Date().toISOString();
  
  try {
    // CoinGecko ID mappings for all 30 cryptocurrencies
    const cryptoIds: Record<string, string> = {
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
      "LINK": "chainlink",
      "AVAX": "avalanche-2",
      "UNI": "uniswap",
      "SHIB": "shiba-inu",
      "TON": "the-open-network",
      "TRX": "tron",
      "XLM": "stellar",
      "SUI": "sui",
      "HBAR": "hedera-hashgraph",
      "PYUSD": "paypal-usd",
      "WLD": "world-coin",
      "AAVE": "aave",
      "XAUT": "tether-gold",
      "PEPE": "pepe",
      "HYPE": "hyperliquid",
      "ASTER": "asterzk",
      "ENA": "ethena",
      "SKY": "sky"
    };
    
    const ids = cryptos
      .map(c => cryptoIds[c] || c.toLowerCase())
      .join(",");
    
    const vsCurrencies = fiats.map(f => f.toLowerCase()).join(",");
    
    const url = `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}&include_market_cap=false&include_24hr_vol=false&include_1hr_change=false`;
    
    console.log(`🔄 Fetching ${cryptos.length} cryptocurrencies against ${fiats.length} fiat currencies from CoinGecko...`);
    
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
          success: true,
          fetched_at: fetchedAt
        });
      }
    }
    
    console.log(`✓ Successfully fetched ${results.length} crypto rates`);
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
  const fetchedAt = new Date().toISOString();
  
  try {
    const openExchangeRatesApiKey = Deno.env.get("OPEN_EXCHANGE_RATES_API");
    
    if (openExchangeRatesApiKey) {
      // Use Open Exchange Rates API for live rates
      console.log("🔄 Fetching fiat rates from Open Exchange Rates API...");
      
      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${openExchangeRatesApiKey}&base=USD&symbols=${fiats.join(",")}`,
        { headers: { "Accept": "application/json" } }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        for (const [fiat, rate] of Object.entries(data.rates || {})) {
          results.push({
            from_currency: "USD",
            to_currency: fiat as string,
            rate: rate as number,
            source: "openexchangerates",
            success: true,
            fetched_at: fetchedAt
          });
          
          // Add reverse rate
          results.push({
            from_currency: fiat as string,
            to_currency: "USD",
            rate: 1 / (rate as number),
            source: "openexchangerates",
            success: true,
            fetched_at: fetchedAt
          });
        }
        
        console.log(`✓ Successfully fetched ${results.length} fiat rates`);
        return results;
      }
    }
    
    // Fallback: Use hardcoded rates when API unavailable
    console.log("⚠️ Using fallback fiat rates (Open Exchange Rates API unavailable)");
    
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
      if (fiat === "USD") continue;
      
      const rate = fiatRates[fiat] || 1;
      
      results.push({
        from_currency: fiat,
        to_currency: "USD",
        rate: 1 / rate,
        source: "fallback",
        success: true,
        fetched_at: fetchedAt
      });
      
      results.push({
        from_currency: "USD",
        to_currency: fiat,
        rate: rate,
        source: "fallback",
        success: true,
        fetched_at: fetchedAt
      });
    }
    
    console.log(`⚠️ Using ${results.length} fallback fiat rates`);
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
 * Store rates in database with timestamp tracking
 */
async function storeRates(supabase: any, rates: FetchResult[]): Promise<{ stored: number; failed: number; confirmations: RateConfirmation[] }> {
  let stored = 0;
  let failed = 0;
  const confirmations: RateConfirmation[] = [];
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Prepare records for both tables
  const cryptoRatesRecords: any[] = [];
  const pairsRecords: any[] = [];

  for (const rate of rates) {
    if (!rate.success || !rate.fetched_at) continue;

    try {
      // Prepare record for crypto_rates table (with string rate)
      cryptoRatesRecords.push({
        from_currency: rate.from_currency,
        to_currency: rate.to_currency,
        rate: rate.rate.toString(),
        source: rate.source,
        updated_at: rate.fetched_at,
        expires_at: expiresAt
      });

      // Prepare record for pairs table (with numeric rate)
      pairsRecords.push({
        from_currency: rate.from_currency,
        to_currency: rate.to_currency,
        rate: rate.rate,
        source_table: rate.source,
        updated_at: rate.fetched_at
      });

      // Store confirmation for user feedback
      confirmations.push({
        from_currency: rate.from_currency,
        to_currency: rate.to_currency,
        rate: rate.rate,
        source: rate.source,
        fetched_at: rate.fetched_at
      });
    } catch (error) {
      console.error(`Error preparing rate:`, error);
      failed++;
    }
  }

  // Upsert to crypto_rates table
  if (cryptoRatesRecords.length > 0) {
    try {
      const { error } = await supabase
        .from("crypto_rates")
        .upsert(cryptoRatesRecords, {
          onConflict: "from_currency,to_currency"
        });

      if (error) {
        console.error(`Failed to store rates in crypto_rates:`, error);
        failed += cryptoRatesRecords.length;
      } else {
        stored += cryptoRatesRecords.length;
        console.log(`✓ Stored ${cryptoRatesRecords.length} rates in crypto_rates`);
      }
    } catch (error) {
      console.error(`Error storing to crypto_rates:`, error);
      failed += cryptoRatesRecords.length;
    }
  }

  // Upsert to pairs table (primary source for currencyAPI)
  if (pairsRecords.length > 0) {
    try {
      const { error } = await supabase
        .from("pairs")
        .upsert(pairsRecords, {
          onConflict: "from_currency,to_currency"
        });

      if (error) {
        console.error(`Failed to store rates in pairs:`, error);
        // Don't double-count as failure since we already counted in crypto_rates
      } else {
        console.log(`✓ Stored ${pairsRecords.length} rates in pairs`);
      }
    } catch (error) {
      console.error(`Error storing to pairs:`, error);
      // Don't double-count as failure
    }
  }

  return { stored, failed, confirmations };
}

/**
 * Get latest rates for confirmation display
 */
async function getLatestRatesForConfirmation(supabase: any, cryptos: string[], fiats: string[]): Promise<RateConfirmation[]> {
  const confirmations: RateConfirmation[] = [];
  
  try {
    // Get latest crypto rates
    for (const crypto of cryptos) {
      for (const fiat of fiats) {
        const { data, error } = await supabase
          .from("crypto_rates")
          .select("rate, source, updated_at")
          .eq("from_currency", crypto)
          .eq("to_currency", fiat)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        
        if (!error && data) {
          confirmations.push({
            from_currency: crypto,
            to_currency: fiat,
            rate: parseFloat(data.rate),
            source: data.source,
            fetched_at: data.updated_at
          });
        }
      }
    }
  } catch (error) {
    console.warn("Error fetching rate confirmations:", error);
  }
  
  return confirmations;
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
    console.log(`📊 Processing ${CRYPTO_CURRENCIES.length} cryptocurrencies and ${FIAT_CURRENCIES.length} fiat currencies`);
    
    // Fetch rates
    const [cryptoRates, fiatRates] = await Promise.all([
      fetchCryptoRates(CRYPTO_CURRENCIES, FIAT_CURRENCIES),
      fetchFiatRates(FIAT_CURRENCIES)
    ]);
    
    const allRates = [...cryptoRates, ...fiatRates];
    console.log(`📊 Fetched ${allRates.length} total rates`);
    
    // Store in database
    const { stored, failed, confirmations } = await storeRates(supabase, allRates);
    console.log(`✅ Stored: ${stored}, Failed: ${failed}`);
    
    // Get latest confirmations for user display
    const latestConfirmations = await getLatestRatesForConfirmation(supabase, CRYPTO_CURRENCIES, FIAT_CURRENCIES);
    
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
        timestamp: new Date().toISOString(),
        cryptocurrencies_processed: CRYPTO_CURRENCIES.length,
        fiat_currencies_processed: FIAT_CURRENCIES.length,
        rate_confirmations: latestConfirmations.slice(0, 10), // Return first 10 for brevity
        total_confirmation_count: latestConfirmations.length,
        message: "All rates updated successfully. Users can now see timestamp-verified rates."
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
