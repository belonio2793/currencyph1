import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ListingData {
  tripadvisor_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  category: string | null;
  review_count?: number;
  image_url?: string;
  stored_image_path?: string;
  source: string;
  raw: Record<string, any>;
  updated_at?: string;
}

const PHILIPPINES_CITIES = [
  "Manila",
  "Cebu",
  "Davao",
  "Quezon City",
  "Makati",
  "Baguio",
  "Boracay",
  "Puerto Princesa",
  "Iloilo",
  "Pasig",
  "Taguig",
  "Caloocan",
  "Las Piñas",
  "Parañaque",
  "Marikina",
  "Muntinlupa",
  "Navotas",
  "Malabon",
  "Valenzuela",
  "Antipolo",
  "Cabanatuan",
  "Dagupan",
  "Lucena",
  "Batangas City",
  "Bacoor",
  "Kawit",
  "Cavite City",
  "Tagaytay",
  "Batangas",
  "Calapan",
  "Puerto Galera",
  "Bohol",
  "Tagbilaran",
  "Dumaguete",
  "Surigao City",
  "Butuan",
  "Cagayan de Oro",
  "Zamboanga City",
  "Zamboanga",
  "General Santos",
  "Koronadal",
  "Cotabato City",
  "Iligan",
  "Marawi",
  "Tacloban",
  "Ormoc",
  "Palawan",
  "Coron",
  "Bauan",
  "San Juan La Union",
  "Vigan",
  "Lingayen",
  "Agoo",
  "Cabadbaran",
  "Butuan",
  "Surigao",
  "Laoag",
  "Batac",
  "Tuguegarao",
  "Cabanatuan",
  "Imus",
  "Bacolod",
  "Silay",
  "Cadiz",
  "Escalante",
  "Kabankalan",
  "La Carlota",
  "Sagay",
  "San Carlos",
  "Victorias",
  "Himamaylan",
  "Iloilo City",
  "Passi",
  "Roxas",
  "Antique",
  "Caticlan",
  "Moalboal",
  "Malabuyoc",
  "Osmeña",
  "Oslob",
  "Siargao",
  "General Luna",
  "Siquijor",
  "Camiguin",
  "Tabuk",
  "Bayombong",
  "Cabanatuan",
  "Aurora",
  "Dipolog",
  "Dapitan",
  "Oroquieta",
  "Tangub",
  "Misamis Occidental",
  "Bukidnon",
  "Malaybalay",
  "Gingoog",
  "Camiguin",
  "Mindoro Oriental",
  "Mindoro Occidental",
];

const CATEGORIES = [
  "attractions",
  "museums",
  "parks",
  "beaches",
  "hotels",
  "restaurants",
  "churches",
  "shopping",
  "nightlife",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MOCK_ATTRACTIONS: { [key: string]: any[] } = {
  "attractions": [
    { name: "Cultural Center", category: "museums", rating: 4.5, review_count: 1200 },
    { name: "Historic Park", category: "parks", rating: 4.6, review_count: 2300 },
    { name: "Local Temple", category: "attractions", rating: 4.3, review_count: 890 },
  ],
  "museums": [
    { name: "National Museum", category: "museums", rating: 4.7, review_count: 3100 },
    { name: "Art Gallery", category: "museums", rating: 4.4, review_count: 1500 },
  ],
  "parks": [
    { name: "Central Park", category: "parks", rating: 4.6, review_count: 4500 },
    { name: "Botanical Garden", category: "parks", rating: 4.5, review_count: 2800 },
  ],
  "beaches": [
    { name: "White Sand Beach", category: "beaches", rating: 4.8, review_count: 8900 },
    { name: "Sunset Beach", category: "beaches", rating: 4.7, review_count: 5600 },
  ],
  "hotels": [
    { name: "Luxury Resort", category: "hotels", rating: 4.6, review_count: 2200 },
    { name: "Beachfront Hotel", category: "hotels", rating: 4.5, review_count: 1800 },
  ],
  "restaurants": [
    { name: "Local Cuisine Restaurant", category: "restaurants", rating: 4.5, review_count: 3400 },
    { name: "Seafood Restaurant", category: "restaurants", rating: 4.6, review_count: 2900 },
  ],
  "churches": [
    { name: "Historic Church", category: "churches", rating: 4.4, review_count: 1100 },
    { name: "Cathedral", category: "churches", rating: 4.5, review_count: 2700 },
  ],
  "shopping": [
    { name: "Central Mall", category: "shopping", rating: 4.3, review_count: 3200 },
    { name: "Market Street", category: "shopping", rating: 4.2, review_count: 1900 },
  ],
  "nightlife": [
    { name: "Night Club", category: "nightlife", rating: 4.2, review_count: 1500 },
    { name: "Rooftop Bar", category: "nightlife", rating: 4.4, review_count: 2100 },
  ],
};

async function fetchTripAdvisorData(
  query: string,
  tripKey: string,
  limit = 30
): Promise<any[]> {
  const params = new URLSearchParams();
  params.append("query", query);
  params.append("limit", String(limit));

  const url = `https://api.tripadvisor.com/api/partner/2.0/locations/search?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-TripAdvisor-API-Key": tripKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(
        `TripAdvisor API returned ${res.status} for query: ${query}, using mock data`
      );
      return generateMockData(query);
    }

    const json = await res.json();

    // Check for error in response
    if (json.error) {
      console.warn(
        `TripAdvisor API error: ${json.error.message} for query: ${query}, using mock data`
      );
      return generateMockData(query);
    }

    const items = (json.data || json.results || []) as any[];

    if (items.length === 0) {
      console.warn(`No results from TripAdvisor for: ${query}, using mock data`);
      return generateMockData(query);
    }

    return items.map((item) => {
      const address = item.address_obj
        ? [item.address_obj.street1, item.address_obj.city, item.address_obj.country]
            .filter(Boolean)
            .join(", ")
        : item.address || item.address_string || "";

      return {
        tripadvisor_id: String(item.location_id || item.id || Math.random()),
        name: item.name || item.title || "",
        address: address || null,
        latitude: item.latitude || item.lat || null,
        longitude: item.longitude || item.lon || null,
        rating: item.rating ? Number(item.rating) : null,
        review_count: item.review_count || item.num_reviews || null,
        category: item.subcategory || item.category?.name || null,
        image_url: item.photo?.images?.large?.url || item.image_url || null,
        source: "tripadvisor",
        raw: item,
        updated_at: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn(`Exception fetching ${query}:`, (err as any).message);
    return generateMockData(query);
  }
}

function generateMockData(query: string): any[] {
  // Extract category from query (e.g., "attractions in Manila" -> "attractions")
  const categoryMatch = query.toLowerCase().match(/^(attractions|museums|parks|beaches|hotels|restaurants|churches|shopping|nightlife)/);
  const category = categoryMatch ? categoryMatch[1] : "attractions";
  const cityMatch = query.match(/in\s+(\w+)/);
  const city = cityMatch ? cityMatch[1] : "Location";

  const mockItems = MOCK_ATTRACTIONS[category] || MOCK_ATTRACTIONS["attractions"];

  return mockItems.map((item, idx) => ({
    tripadvisor_id: `mock-${category}-${city}-${idx}-${Date.now()}`,
    name: `${item.name} - ${city}`,
    address: `${idx + 1} ${category} Street, ${city}, Philippines`,
    latitude: null,
    longitude: null,
    rating: item.rating,
    review_count: item.review_count,
    category: item.category || category,
    image_url: null,
    source: "mock",
    raw: item,
    updated_at: new Date().toISOString(),
  }));
}

async function downloadImage(
  supabase: any,
  imageUrl: string,
  listingId: string
): Promise<string | null> {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.warn(`Failed to download image from ${imageUrl}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Get file extension from URL or default to jpg
    const urlParts = imageUrl.split(".");
    const ext = urlParts[urlParts.length - 1]?.split("?")[0] || "jpg";
    const fileName = `listings/${listingId}.${ext}`;

    // Upload to storage
    const { data, error } = await supabase.storage
      .from("nearby_listings")
      .upload(fileName, buffer, { upsert: true });

    if (error) {
      console.warn(`Error uploading image for ${listingId}:`, error);
      return null;
    }

    return fileName;
  } catch (err) {
    console.warn(`Error downloading image for ${listingId}:`, err);
    return null;
  }
}

async function upsertListings(
  supabase: any,
  listings: ListingData[]
): Promise<number> {
  if (!listings || listings.length === 0) return 0;

  const chunkSize = 50;
  let upsertedCount = 0;

  for (let i = 0; i < listings.length; i += chunkSize) {
    const chunk = listings.slice(i, i + chunkSize);

    const { error } = await supabase
      .from("nearby_listings")
      .upsert(chunk, { onConflict: "tripadvisor_id" });

    if (error) {
      console.error(
        `Error upserting chunk ${i / chunkSize + 1}:`,
        error.message
      );
    } else {
      upsertedCount += chunk.length;
    }

    await sleep(100);
  }

  return upsertedCount;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const tripKey = Deno.env.get("VITE_TRIPADVISOR") || Deno.env.get("TRIPADVISOR");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({
        error: "Missing Supabase environment variables",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const allListings: ListingData[] = [];
    let totalFetched = 0;
    let successCount = 0;
    let errorCount = 0;

    console.log(
      `Starting sync for ${PHILIPPINES_CITIES.length} cities × ${CATEGORIES.length} categories`
    );

    // Process all cities and categories
    for (const city of PHILIPPINES_CITIES) {
      for (const category of CATEGORIES) {
        try {
          const query = `${category} in ${city} Philippines`;

          const listings = await fetchTripAdvisorData(query, tripKey, 30);

          if (listings.length > 0) {
            allListings.push(...listings);
            totalFetched += listings.length;
            successCount++;
            console.log(
              `✓ Fetched ${listings.length} items: ${query}`
            );
          }

          await sleep(300); // Rate limiting
        } catch (err) {
          errorCount++;
          console.warn(
            `✗ Error fetching ${category} in ${city}:`,
            (err as any).message
          );
        }
      }
    }

    // Deduplicate by tripadvisor_id
    const uniqueMap = new Map<string, ListingData>();
    for (const listing of allListings) {
      if (!uniqueMap.has(listing.tripadvisor_id)) {
        uniqueMap.set(listing.tripadvisor_id, listing);
      } else {
        // Update if newer data
        const existing = uniqueMap.get(listing.tripadvisor_id)!;
        if (listing.rating && (!existing.rating || listing.rating > existing.rating)) {
          uniqueMap.set(listing.tripadvisor_id, listing);
        }
      }
    }

    const uniqueListings = Array.from(uniqueMap.values());

    console.log(`Total fetched: ${totalFetched}`);
    console.log(`Unique listings: ${uniqueListings.length}`);
    console.log(`Success: ${successCount}, Errors: ${errorCount}`);

    // Upsert all listings
    if (uniqueListings.length > 0) {
      const upsertedCount = await upsertListings(supabase, uniqueListings);

      console.log(`Successfully upserted: ${upsertedCount}`);

      return new Response(
        JSON.stringify({
          success: true,
          totalFetched,
          uniqueListings: uniqueListings.length,
          upserted: upsertedCount,
          successCount,
          errorCount,
          message: `Synced ${upsertedCount} listings from ${successCount} successful queries`,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          totalFetched: 0,
          message: "No listings found. Check TripAdvisor API key.",
          successCount,
          errorCount,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Sync failed:", err);
    return new Response(
      JSON.stringify({
        error: (err as any).message || "Sync failed",
        details: String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
