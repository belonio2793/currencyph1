import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SCRAPINGBEE_API_KEY = "IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP";
const UNSPLASH_MOUNTAIN = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4";

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

async function removeUnsplashFromDatabase(supabase: any): Promise<number> {
  const { data: listings, error: fetchError } = await supabase
    .from("nearby_listings")
    .select("id, name, photo_urls")
    .order("id", { ascending: true });

  if (fetchError || !listings) {
    throw new Error(`Failed to fetch listings: ${fetchError?.message || "Unknown"}`);
  }

  let updated = 0;

  for (const listing of listings) {
    if (listing.photo_urls && Array.isArray(listing.photo_urls)) {
      const filtered = listing.photo_urls.filter(
        (url: string) => !url.includes(UNSPLASH_MOUNTAIN)
      );

      if (filtered.length !== listing.photo_urls.length) {
        const { error } = await supabase
          .from("nearby_listings")
          .update({
            photo_urls: filtered,
            photo_count: filtered.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", listing.id);

        if (!error) {
          updated++;
        }
      }
    }
  }

  return updated;
}

async function fillEmptyPhotos(
  supabase: any,
  limit: number
): Promise<{ success: number; failed: number; results: any[] }> {
  const { data: listings, error: fetchError } = await supabase
    .from("nearby_listings")
    .select("id, name, city, web_url, photo_urls")
    .or("photo_urls.is.null,photo_urls.eq.{}")
    .limit(limit);

  if (fetchError) {
    throw new Error(`Failed to fetch listings: ${fetchError.message}`);
  }

  if (!listings || listings.length === 0) {
    return { success: 0, failed: 0, results: [] };
  }

  const results = [];
  let success = 0;
  let failed = 0;

  for (const listing of listings) {
    try {
      if (!listing.web_url) {
        results.push({
          name: listing.name,
          city: listing.city,
          success: false,
          error: "no_url",
        });
        failed++;
        continue;
      }

      const html = await beeFetch(listing.web_url);
      const photoUrls = extractImageUrls(html);

      if (!photoUrls.length) {
        results.push({
          name: listing.name,
          city: listing.city,
          success: false,
          error: "no_photos",
        });
        failed++;
      } else {
        const { error } = await supabase
          .from("nearby_listings")
          .update({
            photo_urls: photoUrls,
            photo_count: photoUrls.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", listing.id);

        if (error) {
          results.push({
            name: listing.name,
            city: listing.city,
            success: false,
            error: error.message,
          });
          failed++;
        } else {
          results.push({
            name: listing.name,
            city: listing.city,
            success: true,
            count: photoUrls.length,
          });
          success++;
        }
      }
    } catch (e) {
      results.push({
        name: listing.name,
        city: listing.city,
        success: false,
        error: e.message,
      });
      failed++;
    }

    await sleep(1200);
  }

  return { success, failed, results };
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

    console.log("Step 1: Removing unsplash mountain images...");
    const cleanedCount = await removeUnsplashFromDatabase(supabase);
    console.log(`Cleaned ${cleanedCount} listings`);

    console.log(`Step 2: Filling empty photo_urls (limit: ${limit})`);
    const fillResults = await fillEmptyPhotos(supabase, limit);

    return new Response(
      JSON.stringify({
        success: true,
        steps: {
          cleanup: {
            cleaned: cleanedCount,
          },
          fill: {
            processed: fillResults.success + fillResults.failed,
            updated: fillResults.success,
            failed: fillResults.failed,
          },
        },
        results: fillResults.results,
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
