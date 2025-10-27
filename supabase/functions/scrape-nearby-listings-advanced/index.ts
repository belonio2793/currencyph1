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
  address_obj?: any;
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
  ranking_data?: any;
  reviews?: any[];
  photos?: any[];
  amenities?: any[];
  awards?: any[];
  hours?: any;
  open_now?: boolean;
  parent_id?: string;
  parent_name?: string;
  level?: string;
  type?: string;
  timezone?: string;
  web_url?: string;
  write_review?: string;
  native_id?: string;
  establishment_types?: string[];
  see_all_address?: any;
  see_all_phone?: any;
  see_all_url?: any;
  cuisine?: any;
  special_hours?: any;
  claimed?: boolean;
  travel_guides?: any[];
  content?: any;
  detail_blocks?: any[];
  neighborhood_info?: any[];
  featured_image?: any;
  distance?: string;
  distance_string?: string;
  open_status_text?: string;
  brand?: string;
  review_aggregations?: any;
  [key: string]: any;
}

const CITIES = [
  { name: "Manila", id: "298573" },
  { name: "Cebu", id: "298447" },
  { name: "Davao", id: "295426" },
  { name: "Quezon City", id: "315645" },
  { name: "Makati", id: "315641" },
  { name: "Baguio", id: "311585" }
];

const CATEGORIES = ["attractions", "hotels", "restaurants", "beaches", "things to do"];

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
  
  if (location.photos && Array.isArray(location.photos)) {
    for (const photo of location.photos) {
      const urls = [
        photo?.photo?.images?.original?.url,
        photo?.photo?.images?.large?.url,
        photo?.photo?.images?.medium?.url,
        photo?.photo?.images?.small?.url
      ];
      
      for (const url of urls) {
        if (url && !photos.includes(url)) {
          photos.push(url);
          break;
        }
      }
    }
  }
  
  if (location.featured_image?.photo?.images) {
    const images = location.featured_image.photo.images;
    const url = images.original?.url || images.large?.url || images.medium?.url;
    if (url && !photos.includes(url)) {
      photos.unshift(url);
    }
  }
  
  return photos;
}

function extractReviews(location: TripAdvisorLocation): any[] {
  const reviews: any[] = [];
  
  if (!location.reviews || !Array.isArray(location.reviews)) return reviews;
  
  for (const review of location.reviews.slice(0, 20)) {
    reviews.push({
      author: review.reviewer?.username || review.author || "Reviewer",
      rating: review.rating || location.rating || 0,
      title: review.title,
      comment: review.text || review.comment || "",
      date: review.review_datetime_utc || review.published_date || review.submission_date,
      verified: !!review.is_traveler_reviewed || !!review.verified,
      helpful_count: review.helpful_votes || review.likes || 0,
      unhelpful_count: review.unhelpful_votes || 0,
      reviewer_id: review.reviewer?.user_id,
      reviewer_country: review.reviewer?.country,
      review_id: review.id || review.review_id,
      rating_image: review.rating_image_url,
      user_location: review.reviewer?.hometown,
      trip_type: review.trip_type,
      travel_date: review.travel_date
    });
  }
  
  return reviews;
}

function parseHours(hoursData: any): Record<string, any> {
  const result: Record<string, any> = {};
  
  if (!hoursData) return result;
  
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  if (Array.isArray(hoursData)) {
    for (const hour of hoursData) {
      const day = days[hour.day] || `Day ${hour.day}`;
      result[day] = {
        open: hour.open_time || hour.start_time || "N/A",
        close: hour.close_time || hour.end_time || "N/A",
        closed: hour.closed === true,
        periods: hour.periods
      };
    }
  } else if (typeof hoursData === "object") {
    Object.entries(hoursData).forEach(([key, value]: [string, any]) => {
      if (typeof value === "string") {
        result[key] = value;
      } else if (value && typeof value === "object") {
        result[key] = {
          open: value.open || value.open_time || value.start_time || "N/A",
          close: value.close || value.close_time || value.end_time || "N/A",
          closed: value.closed === true,
          periods: value.periods,
          all_day: value.all_day || false
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
        name: amenity.name || String(amenity),
        available: amenity.available !== false,
        icon: amenity.icon,
        category: amenity.category
      });
    }
  }
  
  return amenities;
}

function extractAwards(location: TripAdvisorLocation): any[] {
  const awards: any[] = [];
  
  if (!location.awards || !Array.isArray(location.awards)) return awards;
  
  for (const award of location.awards) {
    if (typeof award === "string") {
      awards.push({ name: award });
    } else if (award && typeof award === "object") {
      awards.push({
        name: award.name || award.award_name,
        year: award.year || award.award_year,
        icon: award.icon || award.award_icon,
        display_name: award.display_name,
        category: award.award_category
      });
    }
  }
  
  return awards;
}

function extractCuisines(location: TripAdvisorLocation): string[] {
  const cuisines: string[] = [];
  
  if (location.cuisine && Array.isArray(location.cuisine)) {
    for (const cuisine of location.cuisine) {
      const name = cuisine.name || cuisine;
      if (typeof name === "string" && !cuisines.includes(name)) {
        cuisines.push(name);
      }
    }
  }
  
  return cuisines;
}

function buildBestFor(category: string, cuisines?: string[]): string[] {
  const mapping: Record<string, string[]> = {
    attractions: ["History", "Culture", "Sightseeing", "Photography"],
    hotels: ["Accommodation", "Business", "Leisure", "Groups"],
    restaurants: ["Dining", "Food", "Experience", ...(cuisines || [])],
    beaches: ["Relaxation", "Water Activities", "Swimming", "Sunbathing"],
    "things to do": ["Adventure", "Fun", "Exploration", "Recreation"]
  };
  
  return mapping[category] || ["Visit"];
}

function buildHighlights(location: TripAdvisorLocation, category: string): string[] {
  const highlights: string[] = [];
  
  if (location.description && location.description.length > 50) {
    highlights.push("Detailed information");
  }
  
  if (location.photo_count && location.photo_count > 0) {
    highlights.push(`${location.photo_count} photos`);
  }
  
  if (location.amenities && location.amenities.length > 0) {
    highlights.push(`${location.amenities.length} amenities`);
  }
  
  if (location.awards && location.awards.length > 0) {
    highlights.push(`${location.awards.length} awards`);
  }
  
  if (location.rating && location.rating >= 4.5) {
    highlights.push("Highly rated");
  } else if (location.rating && location.rating >= 4.0) {
    highlights.push("Well reviewed");
  }
  
  if (location.review_count || location.num_reviews) {
    const count = location.review_count || location.num_reviews;
    highlights.push(`${count} verified reviews`);
  }
  
  if (location.open_now === true) {
    highlights.push("Open now");
  }
  
  if (location.claimed === true) {
    highlights.push("Claimed & verified");
  }
  
  if (location.special_hours) {
    highlights.push("Special hours available");
  }
  
  return highlights.filter((h, i, a) => a.indexOf(h) === i).slice(0, 15);
}

async function fetchFullListingData(
  locationId: string,
  cityId: string,
  cityName: string,
  category: string,
  apiKey: string
): Promise<NearbyListing | null> {
  try {
    const params = [
      "location_id",
      "name",
      "latitude",
      "longitude",
      "rating",
      "review_count",
      "num_reviews",
      "photo_count",
      "description",
      "website",
      "phone",
      "address_obj",
      "price_level",
      "ranking",
      "ranking_data",
      "reviews",
      "photos",
      "amenities",
      "awards",
      "hours",
      "open_now",
      "parent_id",
      "parent_name",
      "level",
      "type",
      "timezone",
      "web_url",
      "write_review",
      "native_id",
      "establishment_types",
      "cuisine",
      "special_hours",
      "claimed",
      "travel_guides",
      "content",
      "detail_blocks",
      "neighborhood_info",
      "featured_image",
      "distance",
      "distance_string",
      "open_status_text",
      "brand",
      "review_aggregations"
    ].join(",");
    
    const url = `https://api.tripadvisor.com/api/private/2.1/locations/${locationId}?key=${apiKey}&fields=${params}`;
    
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
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
    const awards = extractAwards(location);
    const cuisines = extractCuisines(location);
    const bestFor = buildBestFor(category, cuisines);
    const highlights = buildHighlights(location, category);
    
    const address = location.address_obj?.address_string || 
                   location.address_obj?.street1 ||
                   `${cityName}, Philippines`;
    
    const locationTypeMap: Record<string, string> = {
      attractions: "Attraction",
      hotels: "Hotel",
      restaurants: "Restaurant",
      beaches: "Beach",
      "things to do": "Activity"
    };
    
    let durationType = "";
    if (category === "attractions") {
      durationType = location.rating && location.rating >= 4.5 ? "3-5 hours" : "2-4 hours";
    } else if (category === "restaurants") {
      durationType = "1-2 hours";
    } else if (category === "hotels") {
      durationType = "Multi-day";
    }
    
    const listing: NearbyListing = {
      tripadvisor_id: locId,
      name: location.name,
      slug: generateSlug(location.name, locId),
      address: address,
      latitude: location.latitude,
      longitude: location.longitude,
      lat: location.latitude,
      lng: location.longitude,
      rating: location.rating,
      review_count: location.num_reviews || location.review_count || 0,
      category: category,
      location_type: locationTypeMap[category] || "Location",
      source: "tripadvisor_api_comprehensive",
      web_url: location.web_url || 
               `https://www.tripadvisor.com/Attraction_Review-g${cityId}-d${locId}-Reviews.html`,
      website: location.website,
      phone_number: location.phone,
      description: location.description || 
                  `${location.name} is a ${locationTypeMap[category].toLowerCase()} in ${cityName}. ${location.open_status_text || ""}`.trim(),
      highlights: highlights,
      best_for: bestFor,
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
      admission_fee: location.price_level ? 
        (location.price_level === 1 ? "Budget" :
         location.price_level === 2 ? "Moderate" :
         location.price_level === 3 ? "Expensive" : "Very Expensive") 
        : undefined,
      price_level: location.price_level,
      price_range: location.price_level ? 
        (location.price_level === 1 ? "$" :
         location.price_level === 2 ? "$$" :
         location.price_level === 3 ? "$$$" : "$$$$")
        : undefined,
      duration: durationType,
      traveler_type: location.establishment_types?.join(", ") || "Families",
      visibility_score: location.rating ? (location.rating / 5) * 100 : 0,
      ranking_in_city: location.ranking,
      ranking_in_category: location.ranking_data?.position_in_type,
      rank_in_category: location.ranking,
      photo_count: location.photo_count || photos.length,
      photo_urls: photos,
      image_urls: photos.slice(0, 12),
      image_url: photos[0],
      primary_image_url: photos[0],
      featured_image_url: photos[0],
      stored_image_path: null,
      image_downloaded_at: null,
      review_details: reviews,
      verified: location.claimed === true,
      last_verified_at: timestamp,
      updated_at: timestamp,
      fetch_status: "success",
      raw: {
        city: cityName,
        category: category,
        api_version: "2.1",
        full_api_response: location,
        extracted_cuisines: cuisines,
        timezone: location.timezone,
        parent_id: location.parent_id,
        parent_name: location.parent_name,
        level: location.level,
        type: location.type,
        brand: location.brand,
        claimed: location.claimed,
        open_now: location.open_now,
        open_status_text: location.open_status_text,
        travel_guides: location.travel_guides,
        content: location.content,
        detail_blocks: location.detail_blocks,
        neighborhood_info: location.neighborhood_info,
        review_aggregations: location.review_aggregations,
        extraction_timestamp: timestamp
      }
    };
    
    console.log(`✓ ${listing.name} (${photos.length} photos, ${reviews.length} reviews)`);
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
    const searchUrl = `https://api.tripadvisor.com/api/private/2.1/locations?location_id=${cityId}&category=${category}&key=${apiKey}`;
    
    console.log(`🔍 ${cityName}/${category}`);
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.warn(`Search error ${response.status}`);
      return [];
    }
    
    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      console.warn(`JSON parse error`);
      return [];
    }
    
    if (!data?.data || !Array.isArray(data.data)) return [];
    
    const results: NearbyListing[] = [];
    
    for (const item of data.data.slice(0, 25)) {
      const locationId = String(item.location_id || "");
      if (!locationId) continue;
      
      const listing = await fetchFullListingData(
        locationId,
        cityId,
        cityName,
        category,
        apiKey
      );
      
      if (listing) {
        results.push(listing);
      }
      
      await sleep(300);
    }
    
    console.log(`✓ ${results.length} listings`);
    return results;
  } catch (err) {
    console.error(`Error in fetchCityListings:`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

async function upsertToDatabase(supabase: any, listings: NearbyListing[]): Promise<number> {
  if (!listings || listings.length === 0) return 0;
  
  let upserted = 0;
  const chunkSize = 15;
  
  for (let i = 0; i < listings.length; i += chunkSize) {
    const chunk = listings.slice(i, i + chunkSize);
    
    try {
      const { error } = await supabase
        .from("nearby_listings")
        .upsert(chunk, { onConflict: "tripadvisor_id" });
      
      if (error) {
        console.error(`Chunk error:`, error);
      } else {
        upserted += chunk.length;
        console.log(`✓ Upserted: ${chunk.length}`);
      }
    } catch (err) {
      console.error(`Exception:`, err instanceof Error ? err.message : String(err));
    }
    
    await sleep(100);
  }
  
  return upserted;
}

async function main(supabase: any) {
  const apiKey = Deno.env.get("TRIPADVISOR");
  
  if (!apiKey) {
    return { success: false, error: "TRIPADVISOR API key missing" };
  }
  
  console.log(`\n========== COMPREHENSIVE TripAdvisor Scraper ==========\n`);
  
  const allListings: NearbyListing[] = [];
  
  for (const city of CITIES) {
    for (const category of CATEGORIES) {
      const listings = await fetchCityListings(city.id, city.name, category, apiKey);
      if (listings.length > 0) {
        allListings.push(...listings);
      }
      await sleep(1000);
    }
  }
  
  const uniqueListings = Array.from(
    new Map(allListings.map(l => [l.tripadvisor_id, l])).values()
  );
  
  console.log(`\nTotal: ${uniqueListings.length} unique listings`);
  
  const upsertedCount = uniqueListings.length > 0 
    ? await upsertToDatabase(supabase, uniqueListings)
    : 0;
  
  return {
    success: true,
    fetched: allListings.length,
    unique: uniqueListings.length,
    upserted: upsertedCount,
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
    console.error("Error:", message);
    
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
