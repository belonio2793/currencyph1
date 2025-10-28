#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const PHILIPPINES_CITIES = [
  "Abuyog", "Alaminos", "Alcala", "Angeles", "Antipolo", "Aroroy", "Bacolod",
  "Bacoor", "Bago", "Bais", "Balanga", "Baliuag", "Bangued", "Bansalan",
  "Bantayan", "Bataan", "Batac", "Batangas City", "Bayambang", "Bayawan",
  "Baybay", "Bayugan", "Biñan", "Bislig", "Bocaue", "Bogo", "Boracay",
  "Borongan", "Butuan", "Cabadbaran", "Cabanatuan", "Cabuyao", "Cadiz",
  "Cagayan de Oro", "Calamba", "Calapan", "Calbayog", "Caloocan", "Camiling",
  "Canlaon", "Caoayan", "Capiz", "Caraga", "Carmona", "Catbalogan", "Cauayan",
  "Cavite City", "Cebu City", "Cotabato City", "Dagupan", "Danao", "Dapitan",
  "Daraga", "Dasmariñas", "Davao City", "Davao del Norte", "Davao del Sur",
  "Davao Oriental", "Dipolog", "Dumaguete", "General Santos", "General Trias",
  "Gingoog", "Guihulngan", "Himamaylan", "Ilagan", "Iligan", "Iloilo City",
  "Imus", "Isabela", "Isulan", "Kabankalan", "Kidapawan", "Koronadal",
  "La Carlota", "Laoag", "Lapu-Lapu", "Las Piñas", "Laoang", "Legazpi",
  "Ligao", "Limay", "Lucena", "Maasin", "Mabalacat", "Malabon", "Malaybalay",
  "Malolos", "Mandaluyong", "Mandaue", "Manila", "Marawi", "Marilao",
  "Masbate City", "Mati", "Meycauayan", "Muntinlupa", "Naga (Camarines Sur)",
  "Navotas", "Olongapo", "Ormoc", "Oroquieta", "Ozamiz", "Pagadian", "Palo",
  "Parañaque", "Pasay", "Pasig", "Passi", "Puerto Princesa", "Quezon City",
  "Roxas", "Sagay", "Samal", "San Carlos (Negros Occidental)",
  "San Carlos (Pangasinan)", "San Fernando (La Union)",
  "San Fernando (Pampanga)", "San Jose (Antique)", "San Jose del Monte",
  "San Juan", "San Pablo", "San Pedro", "Santiago", "Silay", "Sipalay",
  "Sorsogon City", "Surigao City", "Tabaco", "Tabuk", "Tacurong", "Tagaytay",
  "Tagbilaran", "Taguig", "Tacloban", "Talisay (Cebu)",
  "Talisay (Negros Occidental)", "Tanjay", "Tarlac City", "Tayabas", "Toledo",
  "Trece Martires", "Tuguegarao", "Urdaneta", "Valencia", "Valenzuela",
  "Victorias", "Vigan", "Virac", "Zamboanga City", "Baguio", "Bohol", "Coron",
  "El Nido", "Makati", "Palawan", "Siargao"
];

const CATEGORIES = [
  "attractions", "museums", "parks", "beaches", "hotels",
  "restaurants", "churches", "shopping", "nightlife"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTripAdvisorData(query, tripKey, limit = 30, city = null) {
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
      // Extract address components
      let address = "";
      let apiCity = city;
      let apiCountry = "Philippines";

      if (item.address_obj) {
        address = [item.address_obj.street1, item.address_obj.city, item.address_obj.country]
          .filter(Boolean)
          .join(", ");
        if (item.address_obj.city) apiCity = item.address_obj.city;
        if (item.address_obj.country) apiCountry = item.address_obj.country;
      } else {
        address = item.address || item.address_string || "";
      }

      const name = item.name || item.title || "";
      const locationType = item.type || item.location_type || (item.subcategory || item.category?.name || "Attraction");

      const baseSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      const tripadvisorId = item.location_id ? String(item.location_id) : `php_${Math.random().toString(36).slice(2,10)}`;
      const idSuffix = tripadvisorId.slice(-6).toLowerCase();
      const slug = baseSlug ? `${baseSlug}-${idSuffix}` : `listing-${idSuffix}`;

      // Extract photo URLs
      let photoUrls = [];
      if (Array.isArray(item.photos)) {
        photoUrls = item.photos.map(p => p.url).filter(Boolean).slice(0, 20);
      }

      // Extract amenities, awards, highlights
      const amenities = Array.isArray(item.amenities) ? item.amenities : [];
      const awards = Array.isArray(item.awards) ? item.awards : [];
      const highlights = Array.isArray(item.highlights) ? item.highlights : [];

      // Extract accessibility info
      const accessibilityInfo = item.accessibility_info && typeof item.accessibility_info === 'object'
        ? item.accessibility_info
        : {};

      // Extract hours of operation
      const hoursOfOperation = item.hours_of_operation && typeof item.hours_of_operation === 'object'
        ? item.hours_of_operation
        : {};

      // Extract nearby attractions
      const nearbyAttractions = Array.isArray(item.nearby_attractions) ? item.nearby_attractions : [];

      // Extract best_for
      const bestFor = Array.isArray(item.best_for) ? item.best_for : [];

      // Extract price information
      let priceLevel = null;
      if (item.price_level) {
        try {
          priceLevel = parseInt(item.price_level, 10);
        } catch (e) {
          priceLevel = null;
        }
      }

      const priceRange = item.price_range || null;
      const duration = item.duration || null;

      // Extract ranking information
      const rankingInCity = item.ranking_in_city || null;
      let rankingInCategory = null;
      if (item.ranking_in_category) {
        try {
          rankingInCategory = parseInt(item.ranking_in_category, 10);
        } catch (e) {
          rankingInCategory = null;
        }
      }

      // Calculate visibility score (0-100)
      let visibilityScore = 0;
      if (item.rating) {
        visibilityScore += (Number(item.rating) / 5.0) * 40;
      }
      if (item.review_count || item.num_reviews) {
        const reviews = item.review_count || item.num_reviews;
        visibilityScore += Math.min((reviews / 1000.0) * 40, 40);
      }
      if (item.photo?.images?.large?.url || item.image_url) {
        visibilityScore += 10;
      }
      if (item.verified) {
        visibilityScore += 10;
      }

      const now = new Date().toISOString();
      const imageUrl = item.photo?.images?.large?.url || item.image_url || null;

      return {
        // Core identification
        tripadvisor_id: tripadvisorId,
        slug: slug,
        source: "tripadvisor",

        // Basic information
        name: name,
        address: address || null,
        city: apiCity,
        country: apiCountry,
        location_type: locationType,
        category: item.subcategory || item.category?.name || null,
        description: item.description || item.about || null,

        // Geographic data
        latitude: item.latitude || item.lat || null,
        longitude: item.longitude || item.lon || null,
        lat: item.latitude || item.lat || null,
        lng: item.longitude || item.lon || null,

        // Rating & review data
        rating: item.rating ? Number(item.rating) : null,
        review_count: item.review_count || item.num_reviews || null,
        review_details: Array.isArray(item.review_details) ? item.review_details : [],

        // Images & media
        image_url: imageUrl,
        featured_image_url: imageUrl,
        primary_image_url: imageUrl,
        photo_urls: photoUrls,
        photo_count: item.photo_count || item.num_photos || null,

        // Contact & website
        website: item.website || item.web_url || null,
        web_url: item.web_url || `https://www.tripadvisor.com/Attraction_Review-g298573-d${item.location_id || "0"}`,
        phone_number: item.phone || item.phone_number || null,

        // Details & features
        highlights: highlights,
        amenities: amenities,
        awards: awards,
        hours_of_operation: hoursOfOperation,
        accessibility_info: accessibilityInfo,
        nearby_attractions: nearbyAttractions,
        best_for: bestFor,

        // Pricing & duration
        price_level: priceLevel,
        price_range: priceRange,
        duration: duration,

        // Rankings & visibility
        ranking_in_city: rankingInCity,
        ranking_in_category: rankingInCategory,
        visibility_score: Math.round(visibilityScore * 100) / 100,
        verified: Boolean(item.verified),

        // Data status
        fetch_status: "success",
        fetch_error_message: null,
        last_verified_at: now,
        updated_at: now,

        // Raw data
        raw: item,
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
    console.log(`\n��️  No listings found. Check TripAdvisor API key.\n`);
  }
}

main().catch((err) => {
  console.error("❌ Sync failed:", err.message);
  process.exit(1);
});
