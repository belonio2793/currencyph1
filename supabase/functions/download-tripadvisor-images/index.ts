import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface DownloadResult {
  listingId: number;
  listingName: string;
  city: string;
  downloaded: number;
  failed: number;
  storedPaths: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error(`Failed to download ${url}: HTTP ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      console.error(`Empty response for ${url}`);
      return null;
    }

    return buffer;
  } catch (error) {
    console.error(`Download error for ${url}:`, error.message);
    return null;
  }
}

function getFileExtension(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();

    if (path.includes(".jpg") || path.includes(".jpeg")) return "jpg";
    if (path.includes(".png")) return "png";
    if (path.includes(".webp")) return "webp";
    if (path.includes(".gif")) return "gif";

    // Check Content-Type from URL parameters
    if (path.includes("photo-")) return "jpg"; // TripAdvisor default

    return "jpg"; // Default
  } catch {
    return "jpg";
  }
}

function generateStoragePath(
  listingId: number,
  fileName: string,
  extension: string
): string {
  // Path format: listings/{listingId}/{timestamp}-{filename}.{ext}
  const timestamp = Date.now();
  const cleanName = fileName
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .substring(0, 50);
  return `listings/${listingId}/${timestamp}-${cleanName}.${extension}`;
}

async function uploadImageToStorage(
  supabase: any,
  imageBuffer: ArrayBuffer,
  storagePath: string,
  contentType: string
): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from("nearby_listings")
      .upload(storagePath, imageBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error(`Upload error for ${storagePath}:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Upload exception for ${storagePath}:`, error.message);
    return false;
  }
}

async function processListing(
  listing: any,
  supabase: any
): Promise<DownloadResult> {
  const result: DownloadResult = {
    listingId: listing.id,
    listingName: listing.name,
    city: listing.city,
    downloaded: 0,
    failed: 0,
    storedPaths: [],
  };

  // Skip if no photo URLs
  if (!listing.photo_urls || !Array.isArray(listing.photo_urls)) {
    console.log(
      `⏭️  ${listing.name}: No photo URLs available (skipping)`
    );
    return result;
  }

  console.log(
    `\n📍 Processing ${listing.name} (${listing.city}) - ${listing.photo_urls.length} photos`
  );

  for (let i = 0; i < listing.photo_urls.length; i++) {
    const photoUrl = listing.photo_urls[i];

    if (!photoUrl || !photoUrl.startsWith("http")) {
      result.failed++;
      continue;
    }

    try {
      // Download image
      const imageBuffer = await downloadImage(photoUrl);
      if (!imageBuffer) {
        result.failed++;
        continue;
      }

      // Determine file extension
      const extension = getFileExtension(photoUrl);
      const contentType =
        extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : extension === "gif"
              ? "image/gif"
              : "image/jpeg";

      // Generate storage path
      const fileName = `photo-${i + 1}`;
      const storagePath = generateStoragePath(listing.id, fileName, extension);

      // Upload to storage
      const uploaded = await uploadImageToStorage(
        supabase,
        imageBuffer,
        storagePath,
        contentType
      );

      if (uploaded) {
        result.storedPaths.push(storagePath);
        result.downloaded++;
        console.log(`  ✅ Downloaded & stored: photo-${i + 1}`);
      } else {
        result.failed++;
        console.log(`  ❌ Failed to store: photo-${i + 1}`);
      }

      // Rate limiting: 200-500ms between downloads
      await sleep(300);
    } catch (error) {
      result.failed++;
      console.error(`  ❌ Error processing photo ${i + 1}:`, error.message);
      await sleep(300);
    }
  }

  // Update database with stored paths if successful
  if (result.storedPaths.length > 0) {
    try {
      // Get existing stored_image_paths
      const { data: currentData } = await supabase
        .from("nearby_listings")
        .select("stored_image_paths")
        .eq("id", listing.id)
        .single();

      const existingPaths = currentData?.stored_image_paths || [];
      const allPaths = [...existingPaths, ...result.storedPaths];

      const { error: updateError } = await supabase
        .from("nearby_listings")
        .update({
          stored_image_paths: allPaths,
          image_downloaded_at: new Date().toISOString(),
        })
        .eq("id", listing.id);

      if (!updateError) {
        console.log(
          `  💾 Database updated with ${result.storedPaths.length} paths`
        );
      }
    } catch (error) {
      console.error(`  ⚠️  Failed to update DB for ${listing.name}:`, error.message);
    }
  }

  console.log(
    `  Summary: ✅ ${result.downloaded} | ❌ ${result.failed} | 📍 ${listing.name}`
  );
  return result;
}

serve(async (req: Request) => {
  // Allow GET and POST
  if (req.method === "OPTIONS") {
    return new Response("ok");
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get parameters from request body or URL
    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = body.limit || 20;
    const city = body.city || null;

    console.log(`\n🚀 Starting TripAdvisor image downloader`);
    console.log(`📊 Limit: ${limit} listings`);
    if (city) console.log(`📍 City filter: ${city}`);
    console.log("=".repeat(70) + "\n");

    // Build query
    let query = supabase
      .from("nearby_listings")
      .select(
        "id, name, city, photo_urls, stored_image_paths, tripadvisor_id"
      )
      .not("photo_urls", "is", null)
      .order("updated_at", { ascending: true });

    if (city) {
      query = query.eq("city", city);
    }

    const { data: listings, error: fetchError } = await query.limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch listings: ${fetchError.message}`);
    }

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No listings found with photo URLs",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📦 Found ${listings.length} listings to process\n`);

    const allResults: DownloadResult[] = [];
    let totalDownloaded = 0;
    let totalFailed = 0;
    let processedListings = 0;

    // Process each listing
    for (const listing of listings) {
      const result = await processListing(listing, supabase);
      allResults.push(result);
      totalDownloaded += result.downloaded;
      totalFailed += result.failed;
      processedListings++;

      // Delay between listings
      if (processedListings < listings.length) {
        await sleep(1000);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("📊 COMPLETION REPORT");
    console.log("=".repeat(70));
    console.log(`\n  Listings processed: ${processedListings}`);
    console.log(`  ✅ Images downloaded: ${totalDownloaded}`);
    console.log(`  ❌ Images failed: ${totalFailed}`);
    console.log(`  📸 Success rate: ${((totalDownloaded / (totalDownloaded + totalFailed)) * 100).toFixed(1)}%`);
    console.log("\n" + "=".repeat(70) + "\n");

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedListings,
        downloaded: totalDownloaded,
        failed: totalFailed,
        results: allResults,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Fatal error:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
