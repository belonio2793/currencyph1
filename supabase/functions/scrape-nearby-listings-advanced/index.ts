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
  category?: string;
  location_type?: string;
  source: string;
  web_url?: string;
  website?: string;
  phone_number?: string;
  description?: string;
  highlights?: string[];
  best_for?: string[];
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
  photo_count?: number;
  photo_urls?: string[];
  image_urls?: string[];
  image_url?: string;
  primary_image_url?: string;
  featured_image_url?: string;
  stored_image_path?: string | null;
  image_downloaded_at?: string | null;
  review_details?: any[];
  verified: boolean;
  last_verified_at: string;
  updated_at: string;
  fetch_status: string;
  fetch_error_message?: string | null;
  raw?: Record<string, any>;
}

const CITIES = [
  { name: "Manila", id: "298573" },
  { name: "Cebu", id: "298447" },
  { name: "Davao", id: "295426" },
  { name: "Quezon City", id: "315645" },
  { name: "Makati", id: "315641" }
];

const CATEGORIES = ["attractions", "hotels", "restaurants"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSlug(name: string, id: string): string {
  const base = name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base}-${id.slice(-4)}`.substring(0, 150);
}

function extractPhotos(location: any): string[] {
  const urls: string[] = [];
  
  if (location.photos?.length) {
    for (const p of location.photos) {
      const img = p?.photo?.images?.large?.url || p?.photo?.images?.medium?.url;
      if (img && !urls.includes(img)) urls.push(img);
    }
  }
  
  return urls;
}

function extractReviews(location: any): any[] {
  const reviews: any[] = [];
  
  if (!location.reviews?.length) return reviews;
  
  for (const r of location.reviews.slice(0, 15)) {
    reviews.push({
      author: r.reviewer?.username || "Reviewer",
      rating: r.rating || location.rating || 0,
      comment: r.text || r.title || "",
      date: r.review_datetime_utc || new Date().toISOString(),
      verified: !!r.is_traveler_reviewed,
      helpful_count: r.helpful_votes || 0
    });
  }
  
  return reviews;
}

function extractHours(hours: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!hours) return result;
  
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  if (Array.isArray(hours)) {
    for (const h of hours) {
      const day = days[h.day] || "Unknown";
      result[day] = { open: h.open_time || "N/A", close: h.close_time || "N/A", closed: h.closed === true };
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

function extractAwards(location: any): any[] {
  const list: any[] = [];
  
  if (!location.awards?.length) return list;
  
  for (const a of location.awards) {
    if (typeof a === "string") {
      list.push({ name: a });
    } else {
      list.push({ name: a.name, year: a.year });
    }
  }
  
  return list;
}

function buildHighlights(location: any, category: string): string[] {
  const h: string[] = [];
  
  if (location.description) h.push("Detailed info");
  if (location.photo_count && location.photo_count > 0) h.push(`${location.photo_count} photos`);
  if (location.amenities?.length) h.push(`${location.amenities.length} amenities`);
  if (location.awards?.length) h.push("Award winner");
  if (location.rating && location.rating >= 4.5) h.push("Highly rated");
  if (location.num_reviews || location.review_count) h.push("Verified reviews");
  
  return h.slice(0, 12);
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
    
    if (!res.ok) return null;
    
    const location = await res.json();
    
    if (!location?.name) return null;
    
    const id = String(location.location_id || locationId);
    const ts = new Date().toISOString();
    const photos = extractPhotos(location);
    const reviews = extractReviews(location);
    const hours = extractHours(location.hours);
    const amenities = extractAmenities(location);
    const awards = extractAwards(location);
    const highlights = buildHighlights(location, category);
    
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
      category: category,
      location_type: category === "attractions" ? "Attraction" : category === "hotels" ? "Hotel" : "Restaurant",
      source: "tripadvisor_api",
      web_url: location.web_url || `https://www.tripadvisor.com/Attraction_Review-g${cityId}-d${id}-Reviews.html`,
      website: location.website,
      phone_number: location.phone,
      description: location.description || `${location.name} in ${cityName}`,
      highlights: highlights,
      best_for: ["Visit"],
      best_for_type: "Experience",
      hours_of_operation: hours,
      amenities: amenities,
      accessibility_info: {
        wheelchair_accessible: false,
        pet_friendly: false,
        elevator: false,
        accessible_parking: false,
        accessible_restroom: false
      },
      nearby_attractions: [],
      awards: awards,
      price_level: location.price_level,
      price_range: location.price_level === 1 ? "$" : location.price_level === 2 ? "$$" : location.price_level === 3 ? "$$$" : "$$$$",
      duration: category === "attractions" ? "2-4 hours" : "1-2 hours",
      traveler_type: "Families",
      visibility_score: location.rating ? (location.rating / 5) * 100 : 0,
      ranking_in_city: location.ranking,
      rank_in_category: location.ranking,
      photo_count: location.photo_count || photos.length,
      photo_urls: photos,
      image_urls: photos.slice(0, 10),
      image_url: photos[0],
      primary_image_url: photos[0],
      featured_image_url: photos[0],
      stored_image_path: null,
      image_downloaded_at: null,
      review_details: reviews,
      verified: true,
      last_verified_at: ts,
      updated_at: ts,
      fetch_status: "success",
      raw: { city: cityName, category: category, api_response: location }
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
  apiKey: string
): Promise<ListingData[]> {
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations?location_id=${cityId}&category=${category}&key=${apiKey}`;
    const res = await fetch(url);
    
    if (!res.ok) return [];
    
    const data = await res.json();
    const items = data.data || [];
    
    if (!Array.isArray(items)) return [];
    
    const results: ListingData[] = [];
    
    for (const item of items.slice(0, 20)) {
      const lid = String(item.location_id || "");
      if (!lid) continue;
      
      const listing = await fetchListingDetails(lid, cityId, cityName, category, apiKey);
      if (listing) {
        results.push(listing);
      }
      
      await sleep(200);
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
  const batchSize = 15;
  
  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);
    
    try {
      const { error } = await supabase.from("nearby_listings").upsert(batch, { onConflict: "tripadvisor_id" });
      
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

async function executeScrap(supabase: any) {
  const apiKey = Deno.env.get("TRIPADVISOR");
  
  if (!apiKey) {
    return { success: false, error: "API key missing" };
  }
  
  console.log("Starting scrape...");
  
  const allListings: ListingData[] = [];
  
  for (const city of CITIES) {
    for (const category of CATEGORIES) {
      const listings = await fetchCityListings(city.id, city.name, category, apiKey);
      if (listings.length > 0) {
        allListings.push(...listings);
      }
      await sleep(500);
    }
  }
  
  const unique = Array.from(new Map(allListings.map(l => [l.tripadvisor_id, l])).values());
  
  console.log(`Fetched: ${allListings.length}, Unique: ${unique.length}`);
  
  const upserted = unique.length > 0 ? await upsertListings(supabase, unique) : 0;
  
  return {
    success: true,
    fetched: allListings.length,
    unique: unique.length,
    upserted: upserted,
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
    const result = await executeScrap(supabase);
    
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
