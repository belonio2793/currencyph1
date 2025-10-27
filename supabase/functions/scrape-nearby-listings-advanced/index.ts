import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NearbyListing {
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

interface TripAdvisorLocation {
  location_id?: string;
  name?: string;
  address_obj?: {
    address_string?: string;
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
  };
  latitude?: number;
  longitude?: number;
  rating?: number;
  review_count?: number;
  num_reviews?: number;
  photo_count?: number;
  description?: string;
  website?: string;
  phone?: string;
  price_level?: number;
  subcategory?: string | string[];
  ranking?: string;
  ranking_data?: {
    position_in_type?: number;
    position_in_city?: number;
  };
  reviews?: any[];
  photos?: Array<{ photo: { images?: { medium?: { url?: string }; large?: { url?: string } } } }>;
  amenities?: any[];
  awards?: any[];
  hours?: any;
  open_now?: boolean;
}

const CITIES = [
  { name: "Manila", id: "298573" },
  { name: "Cebu", id: "298447" },
  { name: "Davao", id: "295426" },
  { name: "Quezon City", id: "315645" },
  { name: "Makati", id: "315641" }
];

const CATEGORIES = ["attractions", "hotels", "restaurants", "beaches"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateSlug(name: string, id: string): string {
  if (!name) return `listing-${id.slice(-6)}`;
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 150) + "-" + id.slice(-4);
}

function extractPhotos(location: TripAdvisorLocation): string[] {
  const photos: string[] = [];
  if (!location.photos || !Array.isArray(location.photos)) return photos;
  
  for (const photo of location.photos) {
    const url = photo?.photo?.images?.large?.url || 
                photo?.photo?.images?.medium?.url;
    if (url && !photos.includes(url)) {
      photos.push(url);
    }
  }
  return photos;
}

function extractReviews(location: TripAdvisorLocation): any[] {
  const reviews: any[] = [];
  if (!location.reviews || !Array.isArray(location.reviews)) return reviews;
  
  for (const review of location.reviews.slice(0, 15)) {
    reviews.push({
      author: review.reviewer?.username || "Reviewer",
      rating: review.rating || location.rating || 0,
      comment: review.text || review.title || "",
      date: review.review_datetime_utc || review.published_date,
      verified: !!review.is_traveler_reviewed,
      helpful_count: review.helpful_votes || 0
    });
  }
  return reviews;
}

function parseHours(hoursData: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!hoursData) return result;
  
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  if (Array.isArray(hoursData)) {
    for (const hour of hoursData) {
      const day = days[hour.day] || "Unknown";
      result[day] = {
        open: hour.open_time || "N/A",
        close: hour.close_time || "N/A",
        closed: hour.closed === true
      };
    }
  } else if (typeof hoursData === "object") {
    Object.entries(hoursData).forEach(([key, value]: [string, any]) => {
      if (typeof value === "string") {
        result[key] = value;
      } else if (value && typeof value === "object") {
        result[key] = {
          open: value.open || value.open_time || "N/A",
          close: value.close || value.close_time || "N/A",
          closed: value.closed === true
        };
      }
    });
  }
  
  return result;
}

function extractAmenities(location: TripAdvisorLocation): any[] {
  const amenities: any[] = [];
  if (!location.amenities || !Array.isArray(location.amenities)) return amenities;
  
  for (const amenity of location.amenities) {
    if (typeof amenity === "string") {
      amenities.push({ name: amenity, available: true });
    } else if (amenity && typeof amenity === "object") {
      amenities.push({
        name: amenity.name || amenity,
        available: amenity.available !== false
      });
    }
  }
  return amenities;
}

function buildAccessibilityInfo(): Record<string, any> {
  return {
    wheelchair_accessible: false,
    pet_friendly: false,
    elevator: false,
    accessible_parking: false,
    accessible_restroom: false
  };
}

function buildBestFor(category: string): string[] {
  const mapping: Record<string, string[]> = {
    attractions: ["History", "Culture", "Sightseeing"],
    hotels: ["Accommodation", "Business", "Luxury"],
    restaurants: ["Dining", "Food", "Experience"],
    beaches: ["Relaxation", "Water Activities", "Swimming"]
  };
  return mapping[category] || ["Visit"];
}

function buildHighlights(location: TripAdvisorLocation, category: string): string[] {
  const highlights: string[] = [];
  
  if (location.description) highlights.push("Detailed information available");
  if (location.photo_count && location.photo_count > 50) highlights.push("Photo gallery");
  if (location.amenities && location.amenities.length > 0) highlights.push("Multiple amenities");
  if (location.awards && location.awards.length > 0) highlights.push("Award winner");
  if (location.rating && location.rating >= 4.5) highlights.push("Highly rated");
  if (location.review_count || location.num_reviews) highlights.push("Verified reviews");
  
  return highlights.filter((h, i, a) => a.indexOf(h) === i).slice(0, 12);
}

async function fetchListingDetails(
  locationId: string,
  cityId: string,
  cityName: string,
  category: string,
  apiKey: string
): Promise<NearbyListing | null> {
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations/${locationId}?key=${apiKey}`;
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      console.warn(`API Error ${response.status} for location ${locationId}`);
      return null;
    }
    
    let location: TripAdvisorLocation;
    try {
      location = await response.json();
    } catch (e) {
      console.warn(`JSON parse error for location ${locationId}`);
      return null;
    }
    
    if (!location || !location.name || !location.location_id) {
      console.warn(`Invalid location data for ${locationId}`);
      return null;
    }
    
    const locId = String(location.location_id);
    const timestamp = new Date().toISOString();
    
    const photos = extractPhotos(location);
    const reviews = extractReviews(location);
    const hours = parseHours(location.hours);
    const amenities = extractAmenities(location);
    const accessibility = buildAccessibilityInfo();
    const bestFor = buildBestFor(category);
    const highlights = buildHighlights(location, category);
    
    const listing: NearbyListing = {
      tripadvisor_id: locId,
      name: location.name,
      slug: generateSlug(location.name, locId),
      address: location.address_obj?.address_string || `${cityName}, Philippines`,
      latitude: location.latitude,
      longitude: location.longitude,
      lat: location.latitude,
      lng: location.longitude,
      rating: location.rating,
      review_count: location.num_reviews || location.review_count || 0,
      category: category,
      location_type: category === "attractions" ? "Attraction" :
                     category === "hotels" ? "Hotel" :
                     category === "restaurants" ? "Restaurant" :
                     "Beach",
      source: "tripadvisor_api",
      web_url: `https://www.tripadvisor.com/Attraction_Review-g${cityId}-d${locId}-Reviews.html`,
      website: location.website,
      phone_number: location.phone,
      description: location.description || `${location.name} in ${cityName}, Philippines`,
      highlights: highlights,
      best_for: bestFor,
      best_for_type: "Experience",
      hours_of_operation: hours,
      amenities: amenities,
      accessibility_info: accessibility,
      nearby_attractions: [],
      awards: location.awards || [],
      admission_fee: undefined,
      price_level: location.price_level,
      price_range: location.price_level ? 
        location.price_level === 1 ? "$" :
        location.price_level === 2 ? "$$" :
        location.price_level === 3 ? "$$$" : "$$$$"
        : undefined,
      duration: category === "attractions" ? "2-4 hours" : undefined,
      traveler_type: "Families",
      visibility_score: location.rating ? (location.rating / 5) * 100 : 0,
      ranking_in_city: location.ranking || undefined,
      ranking_in_category: location.ranking_data?.position_in_type,
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
      last_verified_at: timestamp,
      updated_at: timestamp,
      fetch_status: "success",
      raw: {
        city: cityName,
        category: category,
        api_version: "2.1",
        raw_location: location
      }
    };
    
    console.log(`✓ Fetched: ${listing.name}`);
    return listing;
  } catch (err) {
    console.error(`Error fetching ${locationId}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function fetchCityListings(
  cityId: string,
  cityName: string,
  category: string,
  apiKey: string
): Promise<NearbyListing[]> {
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations?location_id=${cityId}&category=${category}&key=${apiKey}`;
    
    console.log(`🔍 Fetching ${category} in ${cityName}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Search error ${response.status} for ${cityName}/${category}`);
      return [];
    }
    
    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      console.warn(`JSON parse error for ${cityName}/${category}`);
      return [];
    }
    
    if (!data || !data.data || !Array.isArray(data.data)) {
      console.warn(`No data for ${cityName}/${category}`);
      return [];
    }
    
    const results: NearbyListing[] = [];
    
    for (const item of data.data) {
      const locationId = String(item.location_id || "");
      if (!locationId) continue;
      
      const listing = await fetchListingDetails(
        locationId,
        cityId,
        cityName,
        category,
        apiKey
      );
      
      if (listing) {
        results.push(listing);
      }
      
      await sleep(200);
    }
    
    console.log(`✓ ${results.length} listings from ${cityName}/${category}`);
    return results;
  } catch (err) {
    console.error(`Error in fetchCityListings:`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

async function upsertToDatabase(supabase: any, listings: NearbyListing[]): Promise<number> {
  if (!listings || listings.length === 0) return 0;
  
  let upserted = 0;
  const chunkSize = 20;
  
  for (let i = 0; i < listings.length; i += chunkSize) {
    const chunk = listings.slice(i, i + chunkSize);
    
    try {
      const { data, error } = await supabase
        .from("nearby_listings")
        .upsert(chunk, { onConflict: "tripadvisor_id" });
      
      if (error) {
        console.error(`Upsert chunk ${i / chunkSize + 1} error:`, error);
      } else {
        upserted += chunk.length;
        console.log(`✓ Upserted chunk: ${chunk.length} listings`);
      }
    } catch (err) {
      console.error(`Exception upserting chunk:`, err instanceof Error ? err.message : String(err));
    }
    
    await sleep(100);
  }
  
  return upserted;
}

async function main(supabase: any) {
  const apiKey = Deno.env.get("TRIPADVISOR");
  
  if (!apiKey) {
    return {
      success: false,
      error: "TRIPADVISOR API key missing",
      listings: 0,
      upserted: 0
    };
  }
  
  console.log(`\n========== TripAdvisor Scraper Started ==========\n`);
  
  const allListings: NearbyListing[] = [];
  let fetchedCount = 0;
  
  for (const city of CITIES) {
    for (const category of CATEGORIES) {
      const listings = await fetchCityListings(
        city.id,
        city.name,
        category,
        apiKey
      );
      
      if (listings && listings.length > 0) {
        allListings.push(...listings);
        fetchedCount += listings.length;
      }
      
      await sleep(500);
    }
  }
  
  const uniqueListings = Array.from(
    new Map(allListings.map(l => [l.tripadvisor_id, l])).values()
  );
  
  console.log(`\n========== Results ==========`);
  console.log(`Total fetched: ${fetchedCount}`);
  console.log(`Unique listings: ${uniqueListings.length}`);
  
  let upsertedCount = 0;
  if (uniqueListings.length > 0) {
    console.log(`Upserting to database...`);
    upsertedCount = await upsertToDatabase(supabase, uniqueListings);
    console.log(`Successfully upserted: ${upsertedCount}`);
  }
  
  return {
    success: true,
    fetched: fetchedCount,
    unique: uniqueListings.length,
    upserted: upsertedCount,
    message: `Completed: fetched ${fetchedCount}, unique ${uniqueListings.length}, upserted ${upsertedCount}`,
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
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const supabase = createClient(supabaseUrl, serviceKey);
    const result = await main(supabase);
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Handler error:", message);
    
    return new Response(JSON.stringify({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
