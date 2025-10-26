import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PHILIPPINE_CITIES = [
  "Manila",
  "Cebu",
  "Davao",
  "Baguio",
  "Iloilo",
  "Bacolod",
  "Cagayan de Oro",
  "Zamboanga",
  "Boracay",
  "Puerto Princesa",
  "El Nido",
  "Tagbilaran",
  "General Luna",
  "Olongapo",
  "San Juan La Union",
  "Vigan",
  "Legazpi",
  "Tagaytay",
  "Bohol",
  "Coron",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlacesFor(query: string, tripKey: string, limit = 50) {
  const params = new URLSearchParams();
  params.append("query", query);
  params.append("limit", String(limit));

  const url = `https://api.tripadvisor.com/api/partner/2.0/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "X-TripAdvisor-API-Key": tripKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TripAdvisor API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  const items = (json.data || json.results || json || []) as any[];

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

  const chunkSize = 100;
  let upsertedCount = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("nearby_listings")
      .upsert(chunk, { onConflict: "tripadvisor_id" });

    if (error) {
      console.error("Upsert error:", error);
      throw error;
    } else {
      upsertedCount += chunk.length;
    }

    await sleep(100);
  }

  return upsertedCount;
}

Deno.serve(async (req) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const tripKey = Deno.env.get("VITE_TRIPADVISOR") || Deno.env.get("TRIPADVISOR");

  if (!supabaseUrl || !supabaseServiceKey || !tripKey) {
    return new Response(
      JSON.stringify({
        error: "Missing environment variables",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const allRows: any[] = [];
    let totalFetched = 0;

    for (const city of PHILIPPINE_CITIES) {
      try {
        console.log(`Fetching for ${city}...`);
        const rows = await fetchPlacesFor(`${city} Philippines`, tripKey, 50);
        totalFetched += rows.length;
        allRows.push(...rows);
        console.log(`Fetched ${rows.length} items for ${city}`);
      } catch (err) {
        console.error(`Failed fetch for ${city}:`, (err as any).message);
      }

      await sleep(1000);
    }

    // Dedupe by tripadvisor_id
    const dedup: any = {};
    for (const r of allRows) {
      dedup[r.tripadvisor_id] = r;
    }
    const unique = Object.values(dedup);

    console.log(`Total unique items to upsert: ${unique.length}`);

    const upserted = await upsertBatch(supabase, unique);

    return new Response(
      JSON.stringify({
        success: true,
        totalFetched,
        uniqueSaved: upserted,
        message: `Fetched ${totalFetched} total, saved ${upserted} unique listings`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Populate failed:", err);
    return new Response(
      JSON.stringify({
        error: (err as any).message || "Failed to populate",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
