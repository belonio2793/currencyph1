import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SCRAPINGBEE_KEYS = [
  "OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS",
  "Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9",
];

let currentKeyIndex = 0;

function getNextKey(): string {
  const key = SCRAPINGBEE_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % SCRAPINGBEE_KEYS.length;
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function beeFetch(url: string): Promise<string> {
  const apiKey = getNextKey();
  const params = new URLSearchParams({
    url,
    render_js: "true",
    country_code: "ph",
    wait: "4000",
    block_resources: "false",
    premium_proxy: "true",
  });

  try {
    const resp = await fetch(
      `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(
        apiKey
      )}&${params.toString()}`,
      { signal: AbortSignal.timeout(60000) }
    );

    if (!resp.ok) {
      if (resp.status === 429) {
        await sleep(2000);
        return beeFetch(url);
      }
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    return await resp.text();
  } catch (e) {
    throw new Error(`Bee fetch failed: ${e.message}`);
  }
}

function extractPhotoUrls(html: string): string[] {
  const urls = new Set<string>();

  // Extract from img src attributes
  const imgRegex = /src=["']([^"']*tacdn\.com[^"']*)["']/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1].split("?")[0];
    if (url.startsWith("http")) {
      urls.add(url);
    }
  }

  // Extract from data-src
  const dataSrcRegex = /data-src=["']([^"']*tacdn\.com[^"']*)["']/g;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    const url = match[1].split("?")[0];
    if (url.startsWith("http")) {
      urls.add(url);
    }
  }

  // Extract from og:image
  const ogImageRegex = /property=["']og:image["']\s+content=["']([^"']+)["']/g;
  while ((match = ogImageRegex.exec(html)) !== null) {
    if (match[1].includes("tacdn.com")) {
      urls.add(match[1].split("?")[0]);
    }
  }

  // Extract from srcset
  const srcsetRegex = /srcset=["']([^"']*)["']/g;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    const urlMatches = srcset.match(/https?:\/\/[^\s,]+/g);
    if (urlMatches) {
      urlMatches.forEach((url) => {
        if (url.includes("tacdn.com")) {
          urls.add(url.split("?")[0]);
        }
      });
    }
  }

  // Extract from background-image URLs
  const bgRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
  while ((match = bgRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.includes("tacdn.com") && url.startsWith("http")) {
      urls.add(url.split("?")[0]);
    }
  }

  return Array.from(urls).slice(0, 100);
}

function mergePhotoUrls(
  existing: string[] | null,
  newUrls: string[]
): string[] {
  const combined = new Set([...(existing || []), ...newUrls]);
  return Array.from(combined);
}

async function scrapeListingPhotos(
  listing: any,
  supabase: any
): Promise<{ success: boolean; message: string }> {
  try {
    if (!listing.web_url) {
      return { success: false, message: `No web_url for ${listing.name}` };
    }

    const html = await beeFetch(listing.web_url);
    const photoUrls = extractPhotoUrls(html);

    if (!photoUrls.length) {
      return { success: false, message: `No photos found for ${listing.name}` };
    }

    const mergedPhotos = mergePhotoUrls(listing.photo_urls, photoUrls);
    const newCount = mergedPhotos.length - (listing.photo_urls?.length || 0);

    const { error } = await supabase
      .from("nearby_listings")
      .update({
        photo_urls: mergedPhotos,
        photo_count: mergedPhotos.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    if (error) {
      return {
        success: false,
        message: `DB error for ${listing.name}: ${error.message}`,
      };
    }

    return {
      success: true,
      message: `✓ ${listing.name}: ${photoUrls.length} photos (${newCount} new)`,
    };
  } catch (e) {
    return { success: false, message: `Error for ${listing.name}: ${e.message}` };
  }
}

serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get limit from request body
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 100;

    console.log(`Starting photo scrape for up to ${limit} listings...`);

    // Fetch listings
    const { data: listings, error: fetchError } = await supabase
      .from("nearby_listings")
      .select("id, name, web_url, photo_urls, city")
      .order("id", { ascending: true })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch listings: ${fetchError.message}`);
    }

    if (!listings || listings.length === 0) {
      return new Response(JSON.stringify({ error: "No listings found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = [];
    let processed = 0;
    let updated = 0;

    for (const listing of listings) {
      const result = await scrapeListingPhotos(listing, supabase);
      results.push(result);

      if (result.success) {
        updated++;
      }
      processed++;

      // Add delay between requests
      if (processed < listings.length) {
        await sleep(800);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        updated,
        results: results.slice(0, 20), // Return first 20 results
        total_results: results.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
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
