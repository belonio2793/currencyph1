import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PHILIPPINES_CITIES = [
  "Manila", "Cebu", "Davao", "Quezon City", "Makati", "Baguio", "Boracay",
  "Puerto Princesa", "Iloilo", "Pasig", "Taguig", "Caloocan", "Las Piñas",
  "Parañaque", "Marikina", "Muntinlupa", "Navotas", "Malabon", "Valenzuela",
  "Antipolo", "Cabanatuan", "Dagupan", "Lucena", "Batangas City", "Bacoor",
  "Kawit", "Cavite City", "Tagaytay", "Batangas", "Calapan", "Puerto Galera",
  "Bohol", "Tagbilaran", "Dumaguete", "Surigao City", "Butuan", "Cagayan de Oro",
  "Zamboanga City", "Zamboanga", "General Santos", "Koronadal", "Cotabato City",
  "Iligan", "Marawi", "Tacloban", "Ormoc", "Palawan", "Coron", "Bauan",
  "San Juan La Union", "Vigan", "Lingayen", "Agoo", "Cabadbaran", "Surigao",
  "Laoag", "Batac", "Tuguegarao", "Imus", "Bacolod", "Silay", "Cadiz",
  "Escalante", "Kabankalan", "La Carlota", "Sagay", "San Carlos", "Victorias",
  "Himamaylan", "Iloilo City", "Passi", "Roxas", "Antique", "Caticlan",
  "Moalboal", "Malabuyoc", "Osmeña", "Oslob", "Siargao", "General Luna",
  "Siquijor", "Camiguin", "Tabuk", "Bayombong", "Aurora", "Dipolog", "Dapitan",
  "Oroquieta", "Tangub", "Misamis Occidental", "Bukidnon", "Malaybalay", "Gingoog"
];

const CATEGORIES = [
  "attractions", "museums", "parks", "beaches", "hotels",
  "restaurants", "churches", "shopping", "nightlife"
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateSlug(name: string, tripadvisorId: string): string {
  if (!name) {
    return `listing-${tripadvisorId.slice(-6)}`.toLowerCase();
  }
  
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  
  // Append last 6 characters of tripadvisor_id for uniqueness
  const idSuffix = tripadvisorId.slice(-6).toLowerCase();
  return `${baseSlug}-${idSuffix}`.substring(0, 200);
}

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
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`TripAdvisor API returned ${res.status} for query: ${query}`);
      return [];
    }

    const json = await res.json();
    const items = (json.data || json.results || []) as any[];

    return items.map((item) => {
      const address = item.address_obj
        ? [item.address_obj.street1, item.address_obj.city, item.address_obj.country]
            .filter(Boolean)
            .join(", ")
        : item.address || item.address_string || "";

      const name = item.name || item.title || "";
      const tripadvisorId = String(item.location_id || item.id || Math.random());

      return {
        tripadvisor_id: tripadvisorId,
        name: name,
        address: address || null,
        latitude: item.latitude || item.lat || null,
        longitude: item.longitude || item.lon || null,
        rating: item.rating ? Number(item.rating) : null,
        review_count: item.review_count || item.num_reviews || null,
        category: item.subcategory || item.category?.name || null,
        image_url: item.photo?.images?.large?.url || item.image_url || null,
        web_url: item.web_url || `https://www.tripadvisor.com/Attraction_Review-g298573-d${item.location_id || "0"}`,
        location_type: item.type || item.location_type || "Attraction",
        phone_number: item.phone || item.phone_number || null,
        website: item.website || item.web_url || null,
        description: item.description || item.about || null,
        hours_of_operation: item.hours || {},
        photo_count: item.photo_count || item.num_photos || null,
        ranking_in_city: item.ranking || null,
        awards: item.awards || item.award_types || [],
        price_level: item.price_range ? parseInt(item.price_range) : null,
        slug: generateSlug(name, tripadvisorId),
        source: "tripadvisor",
        verified: true,
        raw: item,
        updated_at: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error(`Error fetching ${query}:`, err);
    return [];
  }
}

async function upsertListings(supabase: any, listings: any[]): Promise<number> {
  if (!listings || listings.length === 0) return 0;

  const chunkSize = 50;
  let upsertedCount = 0;

  for (let i = 0; i < listings.length; i += chunkSize) {
    const chunk = listings.slice(i, i + chunkSize);

    const { error } = await supabase
      .from("nearby_listings")
      .upsert(chunk, { onConflict: "tripadvisor_id" });

    if (error) {
      console.error(`Error upserting chunk ${i / chunkSize + 1}:`, error.message);
    } else {
      upsertedCount += chunk.length;
    }

    await sleep(100);
  }

  return upsertedCount;
}

async function performSync(supabase: any, tripKey: string, cityLimit: number | null = null) {
  const allListings: any[] = [];
  let totalFetched = 0;
  let successCount = 0;
  let errorCount = 0;

  const citiesToProcess = cityLimit 
    ? PHILIPPINES_CITIES.slice(0, cityLimit)
    : PHILIPPINES_CITIES;

  console.log(
    `Starting sync for ${citiesToProcess.length} cities × ${CATEGORIES.length} categories = ${citiesToProcess.length * CATEGORIES.length} queries`
  );

  for (const city of citiesToProcess) {
    for (const category of CATEGORIES) {
      try {
        const query = `${category} in ${city} Philippines`;
        const listings = await fetchTripAdvisorData(query, tripKey, 30);

        if (listings.length > 0) {
          allListings.push(...listings);
          totalFetched += listings.length;
          successCount++;
          console.log(`✓ Fetched ${listings.length} items: ${query}`);
        }

        // Rate limiting: wait 300ms between requests
        await sleep(300);
      } catch (err) {
        errorCount++;
        console.warn(`✗ Error fetching ${category} in ${city}:`, (err as any).message);
      }
    }
  }

  // Deduplicate by tripadvisor_id, keeping better ratings
  const uniqueMap = new Map();
  for (const listing of allListings) {
    if (!uniqueMap.has(listing.tripadvisor_id)) {
      uniqueMap.set(listing.tripadvisor_id, listing);
    } else {
      const existing = uniqueMap.get(listing.tripadvisor_id);
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
  let upsertedCount = 0;
  if (uniqueListings.length > 0) {
    upsertedCount = await upsertListings(supabase, uniqueListings);
    console.log(`Successfully upserted: ${upsertedCount}`);
  }

  return {
    success: true,
    totalFetched,
    uniqueListings: uniqueListings.length,
    upserted: upsertedCount,
    successCount,
    errorCount,
    message: `Synced ${upsertedCount} listings from ${successCount} successful queries`,
    timestamp: new Date().toISOString(),
  };
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

  if (!tripKey) {
    return new Response(
      JSON.stringify({
        error: "Missing TripAdvisor API key",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse request body for custom parameters
    let cityLimit: number | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        cityLimit = body.cityLimit || null;
      } catch {
        // Ignore parse errors, use defaults
      }
    }

    const result = await performSync(supabase, tripKey, cityLimit);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
