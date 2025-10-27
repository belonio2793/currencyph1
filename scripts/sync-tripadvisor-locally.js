#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const PHILIPPINES_CITIES = [
  "Manila", "Cebu", "Davao", "Quezon City", "Makati", "Baguio", "Boracay",
  "Puerto Princesa", "Iloilo", "Pasig", "Taguig", "Caloocan", "Las Piñas",
  "Parañaque", "Marikina", "Muntinlupa", "Navotas", "Malabon", "Valenzuela",
  "Antipolo", "Cabanatuan", "Dagupan", "Lucena", "Batangas City", "Bacoor",
  "Cavite City", "Tagaytay", "Calapan", "Tagbilaran", "Dumaguete"
];

const CATEGORIES = [
  "attractions", "museums", "parks", "beaches", "hotels",
  "restaurants", "churches", "shopping", "nightlife"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTripAdvisorData(query, tripKey, limit = 30) {
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
    const items = (json.data || json.results || []);

    return items.map((item) => {
      const address = item.address_obj
        ? [item.address_obj.street1, item.address_obj.city, item.address_obj.country]
            .filter(Boolean)
            .join(", ")
        : item.address || item.address_string || "";

      const name = item.name || item.title || "";
      const locationType = item.type || item.location_type || (item.subcategory || item.category?.name || "Attraction");

      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      return {
        tripadvisor_id: String(item.location_id || item.id || Math.random()),
        name: name,
        address: address || null,
        latitude: item.latitude || item.lat || null,
        longitude: item.longitude || item.lon || null,
        rating: item.rating ? Number(item.rating) : null,
        review_count: item.review_count || item.num_reviews || null,
        category: item.subcategory || item.category?.name || null,
        image_url: item.photo?.images?.large?.url || item.image_url || null,
        web_url: item.web_url || `https://www.tripadvisor.com/Attraction_Review-g298573-d${item.location_id || "0"}`,
        location_type: locationType,
        phone_number: item.phone || item.phone_number || null,
        website: item.website || item.web_url || null,
        description: item.description || item.about || null,
        hours_of_operation: {},
        photo_count: item.photo_count || item.num_photos || null,
        slug: slug,
        source: "tripadvisor",
        raw: item,
        updated_at: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error(`Error fetching ${query}:`, err.message);
    return [];
  }
}

async function upsertListings(supabase, listings) {
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
      console.log(`✓ Upserted ${chunk.length} listings (${upsertedCount}/${listings.length} total)`);
    }

    await sleep(100);
  }

  return upsertedCount;
}

async function main() {
  const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tripKey = process.env.VITE_TRIPADVISOR || process.env.TRIPADVISOR;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase environment variables");
    process.exit(1);
  }

  if (!tripKey) {
    console.error("❌ Missing TripAdvisor API key");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`📍 Starting sync for ${PHILIPPINES_CITIES.length} cities × ${CATEGORIES.length} categories`);
  console.log(`Total queries: ${PHILIPPINES_CITIES.length * CATEGORIES.length}\n`);

  const allListings = [];
  let totalFetched = 0;
  let successCount = 0;
  let errorCount = 0;
  let queryCount = 0;

  for (const city of PHILIPPINES_CITIES) {
    for (const category of CATEGORIES) {
      try {
        queryCount++;
        const query = `${category} in ${city} Philippines`;
        process.stdout.write(`[${queryCount}/${PHILIPPINES_CITIES.length * CATEGORIES.length}] Fetching ${query}... `);

        const listings = await fetchTripAdvisorData(query, tripKey, 30);

        if (listings.length > 0) {
          allListings.push(...listings);
          totalFetched += listings.length;
          successCount++;
          console.log(`✓ ${listings.length} items`);
        } else {
          console.log("(no results)");
        }

        await sleep(300);
      } catch (err) {
        errorCount++;
        console.log(`✗ Error: ${err.message}`);
      }
    }
  }

  console.log(`\n📊 Results:\n`);
  console.log(`  Total fetched: ${totalFetched}`);
  console.log(`  Successful queries: ${successCount}`);
  console.log(`  Failed queries: ${errorCount}`);

  const uniqueMap = new Map();
  for (const listing of allListings) {
    if (!uniqueMap.has(listing.tripadvisor_id)) {
      uniqueMap.set(listing.tripadvisor_id, listing);
    }
  }

  const uniqueListings = Array.from(uniqueMap.values());
  console.log(`  Unique listings: ${uniqueListings.length}`);

  if (uniqueListings.length > 0) {
    console.log(`\n💾 Upserting to database...`);
    const upsertedCount = await upsertListings(supabase, uniqueListings);
    console.log(`\n✅ Sync complete! Upserted ${upsertedCount} listings.\n`);
  } else {
    console.log(`\n⚠️  No listings found. Check TripAdvisor API key.\n`);
  }
}

main().catch((err) => {
  console.error("❌ Sync failed:", err.message);
  process.exit(1);
});
