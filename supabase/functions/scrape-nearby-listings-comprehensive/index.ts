import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ListingData {
  tripadvisor_id: string;
  name: string;
  slug: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  rating?: number;
  review_count?: number;
  num_reviews?: number;
  category?: string;
  location_type?: string;
  source: string;
  web_url?: string;
  website?: string;
  phone_number?: string;
  phone?: string;
  description?: string;
  highlights?: string[];
  best_for?: any[];
  best_for_type?: string;
  hours_of_operation?: Record<string, any>;
  amenities?: any[];
  accessibility_info?: Record<string, any>;
  nearby_attractions?: string[];
  awards?: any[];
  admission_fee?: string;
  price_level?: number;
  price_range?: string;
  duration?: string;
  traveler_type?: string;
  visibility_score?: number;
  ranking_in_city?: string;
  ranking_in_category?: number;
  rank_in_category?: string;
  ranking_position?: number;
  ranking_string?: string;
  ranking_geo?: string;
  ranking_data?: any;
  photo_count?: number;
  photo_urls?: string[];
  image_urls?: string[];
  image_url?: string;
  primary_image_url?: string;
  featured_image_url?: string;
  stored_image_path?: string | null;
  image_downloaded_at?: string | null;
  review_details?: any[];
  reviews_summary?: any;
  verified: boolean;
  last_verified_at: string;
  updated_at: string;
  fetch_status: string;
  fetch_error_message?: string | null;
  raw?: Record<string, any>;
  city?: string;
  country?: string;
  region_name?: string;
  currency?: string;
  timezone?: string;
  last_synced?: string;
  cuisine?: any;
  features?: any;
  subcategory?: any;
  tags?: any;
  email?: string;
}

const PHILIPPINE_CITIES = [
  { name: "Manila", id: "298573" },
  { name: "Cebu", id: "298447" },
  { name: "Davao", id: "295426" },
  { name: "Quezon City", id: "315645" },
  { name: "Makati", id: "315641" },
  { name: "Boracay", id: "296720" },
  { name: "Palawan", id: "298444" },
  { name: "El Nido", id: "296721" },
  { name: "Coron", id: "296722" },
  { name: "Siargao", id: "296735" },
  { name: "Baguio", id: "295411" },
  { name: "Iloilo", id: "296898" },
  { name: "Bacolod", id: "298352" },
  { name: "Puerto Princesa", id: "295421" },
  { name: "Dumaguete", id: "295436" },
  { name: "Vigan", id: "298496" },
  { name: "Subic Bay", id: "297631" },
  { name: "Tagaytay", id: "298563" },
  { name: "Taguig", id: "315654" },
  { name: "Antipolo", id: "315612" },
  { name: "Cavite City", id: "315616" },
  { name: "Bacoor", id: "315614" },
  { name: "Imus", id: "315635" },
  { name: "Dasmariñas", id: "315625" },
  { name: "Calamba", id: "315620" },
  { name: "Biñan", id: "315618" },
  { name: "Laguna", id: "298572" },
  { name: "Pampanga", id: "298571" },
  { name: "Batangas City", id: "298574" },
  { name: "Clark Freeport", id: "295413" },
  { name: "Olongapo", id: "298570" },
  { name: "Calapan", id: "298566" },
  { name: "Romblon", id: "298494" },
  { name: "Kalibo", id: "296897" },
  { name: "Caticlan", id: "296719" },
  { name: "Roxas", id: "298493" },
  { name: "Capiz", id: "298449" },
  { name: "Guimaras", id: "298450" },
  { name: "Antique", id: "298446" },
  { name: "Aklan", id: "298445" },
  { name: "Negros Occidental", id: "298352" },
  { name: "Negros Oriental", id: "298434" },
  { name: "Siquijor", id: "298435" },
  { name: "Bohol", id: "298441" },
  { name: "Camiguin", id: "298426" },
  { name: "Cagayan de Oro", id: "298425" },
  { name: "Butuan", id: "298428" },
  { name: "Surigao City", id: "298432" },
  { name: "Agusan", id: "298427" },
  { name: "Misamis Oriental", id: "298430" },
  { name: "Misamis Occidental", id: "298429" },
  { name: "Cotabato", id: "298458" },
  { name: "General Santos", id: "298459" },
  { name: "Sultan Kudarat", id: "298460" },
  { name: "South Cotabato", id: "298461" },
  { name: "Sarangani", id: "298462" },
  { name: "Davao del Sur", id: "295427" },
  { name: "Davao del Norte", id: "295425" },
  { name: "Davao Oriental", id: "295428" },
  { name: "Davao Occidental", id: "295429" },
  { name: "Zamboanga del Norte", id: "298464" },
  { name: "Zamboanga del Sur", id: "298465" },
  { name: "Zamboanga Sibugay", id: "298466" },
  { name: "Zamboanga City", id: "298467" }
];

const CATEGORIES = [
  "attractions",
  "hotels",
  "restaurants",
  "things_to_do",
  "tours",
  "vacation_rentals"
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSlug(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${id.slice(-4)}`.substring(0, 150);
}

function extractPhotos(location: any): string[] {
  const urls: string[] = [];

  if (location.photos?.length) {
    for (const p of location.photos) {
      const img =
        p?.photo?.images?.large?.url ||
        p?.photo?.images?.medium?.url ||
        p?.photo?.images?.small?.url;
      if (img && !urls.includes(img)) urls.push(img);
    }
  }

  return urls;
}

function extractReviews(location: any): any[] {
  const reviews: any[] = [];

  if (!location.reviews?.length) return reviews;

  for (const r of location.reviews.slice(0, 20)) {
    reviews.push({
      author: r.reviewer?.username || "Reviewer",
      rating: r.rating || location.rating || 0,
      comment: r.text || r.title || "",
      date: r.review_datetime_utc || new Date().toISOString(),
      verified: !!r.is_traveler_reviewed,
      helpful_count: r.helpful_votes || 0,
      review_language: r.language || "en"
    });
  }

  return reviews;
}

function buildReviewsSummary(location: any): any {
  if (!location.reviews?.length) {
    return {
      total_reviews: location.num_reviews || 0,
      average_rating: location.rating || 0,
      review_breakdown: {
        excellent: 0,
        very_good: 0,
        good: 0,
        okay: 0,
        poor: 0
      }
    };
  }

  return {
    total_reviews: location.num_reviews || location.reviews.length || 0,
    average_rating: location.rating || 0,
    most_recent_review: location.reviews[0]?.review_datetime_utc || null,
    review_breakdown: {
      excellent: location.reviews.filter((r: any) => r.rating >= 5).length,
      very_good: location.reviews.filter((r: any) => r.rating === 4).length,
      good: location.reviews.filter((r: any) => r.rating === 3).length,
      okay: location.reviews.filter((r: any) => r.rating === 2).length,
      poor: location.reviews.filter((r: any) => r.rating === 1).length
    }
  };
}

function extractHours(hours: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!hours) return result;

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (Array.isArray(hours)) {
    for (const h of hours) {
      const day = days[h.day] || "Unknown";
      result[day] = {
        open: h.open_time || "N/A",
        close: h.close_time || "N/A",
        closed: h.closed === true
      };
    }
  }

  return result;
}

function extractAmenities(location: any): any[] {
  const items: any[] = [];

  if (!location.amenities?.length) return items;

  for (const a of location.amenities) {
    if (typeof a === "string") {
      items.push({ name: a, available: true });
    } else {
      items.push({ name: a.name || String(a), available: a.available !== false });
    }
  }

  return items;
}

function extractAccessibility(location: any): Record<string, any> {
  const accessibility = location.accessibility || {};
  return {
    wheelchair_accessible: accessibility.wheelchair_accessible || false,
    pet_friendly: accessibility.pet_friendly || false,
    elevator: accessibility.elevator || false,
    accessible_parking: accessibility.accessible_parking || false,
    accessible_restroom: accessibility.accessible_restroom || false,
    hearing_accessible: accessibility.hearing_accessible || false,
    mobility_accessible: accessibility.mobility_accessible || false,
    visual_accessible: accessibility.visual_accessible || false
  };
}

function extractAwards(location: any): any[] {
  const list: any[] = [];

  if (!location.awards?.length) return list;

  for (const a of location.awards) {
    if (typeof a === "string") {
      list.push({ name: a });
    } else {
      list.push({
        name: a.name || a.display_name || "",
        year: a.year || new Date().getFullYear(),
        award_type: a.award_type || "recognition"
      });
    }
  }

  return list;
}

function extractCuisine(location: any): any {
  if (location.cuisine && Array.isArray(location.cuisine)) {
    return location.cuisine.map((c: any) => ({
      name: typeof c === "string" ? c : c.name || "",
      localized_name: c.localized_name || c.name || ""
    }));
  }
  return null;
}

function buildHighlights(location: any, category: string): string[] {
  const h: string[] = [];

  if (location.description) h.push("Detailed description");
  if (location.photo_count && location.photo_count > 0)
    h.push(`${location.photo_count} photos`);
  if (location.amenities?.length) h.push(`${location.amenities.length} amenities`);
  if (location.awards?.length) h.push("Award winner");
  if (location.rating && location.rating >= 4.5) h.push("Highly rated");
  if (location.num_reviews || location.review_count) h.push("Verified reviews");
  if (location.price_level) h.push("Price info");
  if (location.website) h.push("Has website");
  if (location.phone) h.push("Contact available");
  if (location.hours) h.push("Hours listed");

  return h.slice(0, 12);
}

function buildBestFor(location: any): any[] {
  const bestFor: any[] = [];

  if (location.best_for?.length) {
    for (const b of location.best_for) {
      bestFor.push({
        category: typeof b === "string" ? b : b.name || "",
        count: typeof b === "string" ? null : b.count || null
      });
    }
  }

  return bestFor.length > 0
    ? bestFor
    : [{ category: "Experience", count: null }];
}

async function fetchListingDetails(
  locationId: string,
  cityId: string,
  cityName: string,
  category: string,
  apiKey: string
): Promise<ListingData | null> {
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations/${locationId}?key=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`API returned ${res.status}`);
    }

    const location = await res.json();

    if (!location?.name) return null;

    const id = String(location.location_id || locationId);
    const ts = new Date().toISOString();
    const photos = extractPhotos(location);
    const reviews = extractReviews(location);
    const hours = extractHours(location.hours);
    const amenities = extractAmenities(location);
    const awards = extractAwards(location);
    const accessibility = extractAccessibility(location);
    const highlights = buildHighlights(location, category);
    const bestFor = buildBestFor(location);
    const cuisine = extractCuisine(location);
    const reviewsSummary = buildReviewsSummary(location);

    const typeMap: Record<string, string> = {
      attractions: "Attraction",
      hotels: "Hotel",
      restaurants: "Restaurant",
      things_to_do: "Activity",
      tours: "Tour",
      vacation_rentals: "Vacation Rental"
    };

    const listing: ListingData = {
      tripadvisor_id: id,
      name: location.name,
      slug: createSlug(location.name, id),
      address: location.address_obj?.address_string || cityName,
      latitude: location.latitude,
      longitude: location.longitude,
      lat: location.latitude,
      lng: location.longitude,
      rating: location.rating,
      review_count: location.num_reviews || location.review_count || 0,
      num_reviews: location.num_reviews || location.review_count || 0,
      category: category,
      location_type: typeMap[category] || "Location",
      source: "tripadvisor_api",
      web_url:
        location.web_url ||
        `https://www.tripadvisor.com/Attraction_Review-g${cityId}-d${id}-Reviews.html`,
      website: location.website,
      phone_number: location.phone,
      phone: location.phone,
      description:
        location.description || `${location.name} - ${location.location_string || cityName}`,
      highlights: highlights,
      best_for: bestFor,
      best_for_type: category === "restaurants" ? "Cuisine" : "Experience",
      hours_of_operation: hours,
      amenities: amenities,
      accessibility_info: accessibility,
      nearby_attractions: location.nearby_attractions || [],
      awards: awards,
      admission_fee: location.admission_fee,
      price_level: location.price_level,
      price_range:
        location.price_level === 1
          ? "$"
          : location.price_level === 2
            ? "$$"
            : location.price_level === 3
              ? "$$$"
              : location.price_level === 4
                ? "$$$$"
                : null,
      duration:
        category === "attractions" || category === "things_to_do"
          ? "2-4 hours"
          : category === "tours"
            ? "3-8 hours"
            : "1-2 hours",
      traveler_type: location.traveler_type || "Families",
      visibility_score: location.rating ? (location.rating / 5) * 100 : 0,
      ranking_in_city: location.ranking,
      ranking_in_category: location.ranking_in_category,
      rank_in_category: location.ranking,
      ranking_position: location.ranking_position,
      ranking_string: location.ranking_string,
      ranking_geo: location.ranking_geo,
      ranking_data: {
        overall_rank: location.ranking,
        category_rank: location.ranking_in_category,
        city_rank: location.ranking
      },
      photo_count: location.photo_count || photos.length,
      photo_urls: photos,
      image_urls: photos.slice(0, 20),
      image_url: photos[0],
      primary_image_url: photos[0],
      featured_image_url: photos[0],
      stored_image_path: null,
      image_downloaded_at: null,
      review_details: reviews,
      reviews_summary: reviewsSummary,
      verified: true,
      last_verified_at: ts,
      updated_at: ts,
      fetch_status: "success",
      city: cityName,
      country: "Philippines",
      region_name: location.region_name || cityName,
      currency: "PHP",
      timezone: "Asia/Manila",
      last_synced: ts,
      cuisine: cuisine,
      features: location.features || [],
      subcategory: location.subcategory,
      tags: location.tags || [],
      email: location.email,
      raw: {
        city: cityName,
        category: category,
        api_response: location,
        fetch_timestamp: ts
      }
    };

    console.log(`✓ ${listing.name}`);
    return listing;
  } catch (err) {
    console.error(`Error: ${locationId}`, (err as any).message);
    return null;
  }
}

async function fetchCityListings(
  cityId: string,
  cityName: string,
  category: string,
  apiKey: string,
  limit: number = 30
): Promise<ListingData[]> {
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations?location_id=${cityId}&category=${category}&key=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`City fetch failed: ${cityName}/${category} (${res.status})`);
      return [];
    }

    const data = await res.json();
    const items = data.data || [];

    if (!Array.isArray(items)) {
      console.warn(`Invalid response format for ${cityName}/${category}`);
      return [];
    }

    const results: ListingData[] = [];

    for (const item of items.slice(0, limit)) {
      const lid = String(item.location_id || "");
      if (!lid) continue;

      const listing = await fetchListingDetails(lid, cityId, cityName, category, apiKey);
      if (listing) {
        results.push(listing);
      }

      await sleep(150);
    }

    return results;
  } catch (err) {
    console.error(`Fetch error: ${cityName}/${category}`, (err as any).message);
    return [];
  }
}

async function upsertListings(supabase: any, listings: ListingData[]): Promise<number> {
  if (!listings?.length) return 0;

  let count = 0;
  const batchSize = 10;

  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from("nearby_listings")
        .upsert(batch, { onConflict: "tripadvisor_id" });

      if (error) {
        console.error(`Upsert error:`, error);
      } else {
        count += batch.length;
      }
    } catch (e) {
      console.error(`Exception:`, (e as any).message);
    }

    await sleep(100);
  }

  return count;
}

async function executeComprehensiveScrape(supabase: any, limit: number = 30) {
  const apiKey = Deno.env.get("TRIPADVISOR");

  if (!apiKey) {
    return {
      success: false,
      error: "API key missing",
      totalCities: PHILIPPINE_CITIES.length,
      totalCategories: CATEGORIES.length
    };
  }

  console.log(
    `Starting comprehensive scrape: ${PHILIPPINE_CITIES.length} cities × ${CATEGORIES.length} categories`
  );

  const allListings: ListingData[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const city of PHILIPPINE_CITIES) {
    console.log(`\n📍 ${city.name} (${city.id})`);

    for (const category of CATEGORIES) {
      try {
        const listings = await fetchCityListings(
          city.id,
          city.name,
          category,
          apiKey,
          limit
        );
        if (listings.length > 0) {
          allListings.push(...listings);
          successCount += listings.length;
        }
        await sleep(300);
      } catch (err) {
        console.error(`Error fetching ${city.name}/${category}:`, (err as any).message);
        errorCount++;
      }
    }
  }

  console.log(`\nDeduplicating listings...`);
  const unique = Array.from(
    new Map(allListings.map((l) => [l.tripadvisor_id, l])).values()
  );

  console.log(
    `\nFetched: ${allListings.length}, Unique: ${unique.length}, Errors: ${errorCount}`
  );

  console.log(`\nUpserting to database...`);
  const upserted = unique.length > 0 ? await upsertListings(supabase, unique) : 0;

  return {
    success: true,
    totalCities: PHILIPPINE_CITIES.length,
    totalCategories: CATEGORIES.length,
    totalCombinations: PHILIPPINE_CITIES.length * CATEGORIES.length,
    totalScraped: allListings.length,
    uniqueListings: unique.length,
    upserted: upserted,
    successCount: successCount,
    errorCount: errorCount,
    timestamp: new Date().toISOString()
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !key) {
      return new Response(JSON.stringify({ error: "Missing config" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(url, key);

    let limit = 30;
    try {
      const body = await req.json();
      if (body?.limit) limit = parseInt(body.limit, 10);
    } catch {
      // Use default limit
    }

    const result = await executeComprehensiveScrape(supabase, limit);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const msg = (err as any)?.message || String(err);
    console.error(msg);

    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
