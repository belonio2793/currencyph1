import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CATEGORIES = [
  "hotels",
  "restaurants",
  "attractions",
  "things-to-do"
];

const CITIES = [
  "Manila",
  "Cebu City",
  "Davao City",
  "Quezon City",
  "Makati",
  "Baguio",
  "Boracay",
  "Puerto Princesa",
  "Iloilo City",
  "Pasig"
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlacesFor(query: string, tripKey: string, limit = 50) {
  const params = new URLSearchParams();
  params.append("query", query);
  params.append("limit", String(limit));

  const url = `https://api.tripadvisor.com/api/partner/2.0/search?${params.toString()}`;
  
  console.log(`Fetching: ${url}`);
  
  const res = await fetch(url, {
    headers: {
      "X-TripAdvisor-API-Key": tripKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`API Error ${res.status}: ${text}`);
    throw new Error(`TripAdvisor API error: ${res.status}`);
  }

  const json = await res.json();
  console.log(`Response keys: ${Object.keys(json)}`);
  console.log(`Full response:`, JSON.stringify(json, null, 2));
  
  const items = (json.data || json.results || []) as any[];
  console.log(`Found ${items.length} items`);

  return (items || []).map((it) => {
    const addr = it.address_obj
      ? [it.address_obj.street1, it.address_obj.city, it.address_obj.country]
          .filter(Boolean)
          .join(", ")
      : it.address || it.address_string || "";
    const id = it.location_id || it.id || it.place_id;
    return {
      tripadvisor_id: id ? String(id) : `tmp-${Math.random().toString(36).slice(2, 10)}`,
      name: it.name || it.title || it.poi_name || "",
      address: addr || null,
      latitude: it.latitude || it.lat || (it.address_obj && it.address_obj.latitude) || null,
      longitude: it.longitude || it.lon || (it.address_obj && it.address_obj.longitude) || null,
      rating: it.rating ? Number(it.rating) : null,
      category: it.subcategory || (it.category && it.category.name) || null,
      source: "tripadvisor",
      raw: it,
    };
  });
}

async function upsertBatch(supabase: any, rows: any[]) {
  if (!rows || rows.length === 0) return 0;

  const chunkSize = 50;
  let upsertedCount = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    
    console.log(`Upserting chunk ${i / chunkSize + 1}/${Math.ceil(rows.length / chunkSize)} (${chunk.length} rows)`);
    
    const { error } = await supabase
      .from("nearby_listings")
      .upsert(chunk, { onConflict: "tripadvisor_id" });

    if (error) {
      console.error("Upsert error:", error);
      throw error;
    } else {
      upsertedCount += chunk.length;
      console.log(`Upserted ${chunk.length} rows (total: ${upsertedCount})`);
    }

    await sleep(200);
  }

  return upsertedCount;
}

Deno.serve(async (req) => {
  // Allow both POST and GET for testing
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const tripKey = Deno.env.get("VITE_TRIPADVISOR") || Deno.env.get("TRIPADVISOR");

  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Trip Key exists: ${!!tripKey}`);
  console.log(`Service Key exists: ${!!supabaseServiceKey}`);

  if (!supabaseUrl || !supabaseServiceKey || !tripKey) {
    return new Response(
      JSON.stringify({
        error: "Missing environment variables",
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        tripKey: !!tripKey,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const allRows: any[] = [];
    let totalFetched = 0;

    // Start with Manila only for testing
    const testCities = ["Manila"];

    for (const city of testCities) {
      console.log(`\n========== Processing ${city} ==========`);
      
      for (const category of CATEGORIES) {
        try {
          const query = `${category} in ${city} Philippines`;
          console.log(`\nFetching: ${query}`);
          
          const rows = await fetchPlacesFor(query, tripKey, 50);
          totalFetched += rows.length;
          allRows.push(...rows);
          
          console.log(`✓ Fetched ${rows.length} items for "${query}"`);
        } catch (err) {
          console.error(`✗ Failed for "${category} in ${city}":`, (err as any).message);
        }

        await sleep(2000); // Rate limiting
      }
    }

    // Dedupe by tripadvisor_id
    const dedup: any = {};
    for (const r of allRows) {
      dedup[r.tripadvisor_id] = r;
    }
    const unique = Object.values(dedup);

    console.log(`\n========== Results ==========`);
    console.log(`Total items fetched: ${totalFetched}`);
    console.log(`Unique items: ${unique.length}`);

    if (unique.length > 0) {
      const upserted = await upsertBatch(supabase, unique);
      console.log(`Successfully upserted: ${upserted}`);

      return new Response(
        JSON.stringify({
          success: true,
          totalFetched,
          uniqueSaved: upserted,
          message: `Fetched ${totalFetched} total, saved ${upserted} unique listings to database`,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          totalFetched: 0,
          uniqueSaved: 0,
          message: "No listings found. Check TripAdvisor API key and response.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Populate failed:", err);
    return new Response(
      JSON.stringify({
        error: (err as any).message || "Failed to populate",
        details: String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
