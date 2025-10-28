import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SCRAPINGBEE_API_KEY = "IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function beeFetch(url: string): Promise<string> {
  const params = new URLSearchParams({
    url,
    render_js: "true",
    country_code: "ph",
    wait: "3000",
    block_resources: "false",
    premium_proxy: "true",
  });

  try {
    const resp = await fetch(
      `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(
        SCRAPINGBEE_API_KEY
      )}&${params.toString()}`,
      { signal: AbortSignal.timeout(60000) }
    );

    if (!resp.ok) {
      if (resp.status === 429) {
        await sleep(3000);
        return beeFetch(url);
      }
      throw new Error(`HTTP ${resp.status}`);
    }

    return await resp.text();
  } catch (e) {
    throw new Error(`Bee fetch failed: ${e.message}`);
  }
}

function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();

  // Match all tacdn.com image URLs
  const imgRegex = /(https:\/\/[a-z0-9\-.]*tacdn\.com[^\s"'<>)]*)/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1].trim();
    url = url.replace(/[,;)\]]*$/, "");
    url = url.split("?")[0];
    url = url.split("#")[0];
    if (url.startsWith("https://") && url.length > 20) {
      urls.add(url);
    }
  }

  return Array.from(urls).slice(0, 50);
}

async function scrapeListingPhotos(
  listing: any,
  supabase: any
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    if (!listing.web_url) {
      return { success: false, error: "no_url" };
    }

    const html = await beeFetch(listing.web_url);
    const photoUrls = extractImageUrls(html);

    if (!photoUrls.length) {
      return { success: false, error: "no_photos" };
    }

    const { error } = await supabase
      .from("nearby_listings")
      .update({
        photo_urls: photoUrls,
        photo_count: photoUrls.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, count: photoUrls.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 50;

    console.log(`Fetching listings with empty photo_urls (limit: ${limit})`);

    const { data: listings, error: fetchError } = await supabase
      .from("nearby_listings")
      .select("id, name, city, web_url, photo_urls")
      .or("photo_urls.is.null,photo_urls.eq.{}")
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch listings: ${fetchError.message}`);
    }

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No listings with empty photo_urls found",
          processed: 0,
          updated: 0,
          results: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${listings.length} listings to process`);

    const results = [];
    let processed = 0;
    let updated = 0;

    for (const listing of listings) {
      const result = await scrapeListingPhotos(listing, supabase);
      results.push({
        name: listing.name,
        city: listing.city,
        success: result.success,
        count: result.count || 0,
        error: result.error || null,
      });

      if (result.success) {
        updated++;
      }
      processed++;

      if (processed < listings.length) {
        await sleep(1200);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        updated,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
