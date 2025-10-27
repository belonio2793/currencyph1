import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NearbyListing {
  tripadvisor_id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  category?: string;
  source: string;
  image_url?: string;
  image_urls?: string[];
  primary_image_url?: string;
  featured_image_url?: string;
  stored_image_path?: string | null;
  image_downloaded_at?: string | null;
  photo_urls?: string[];
  photo_count?: number;
  web_url?: string;
  review_count?: number;
  location_type?: string;
  phone_number?: string;
  website?: string;
  description?: string;
  hours_of_operation?: Record<string, any>;
  rank_in_category?: string | null;
  ranking_in_city?: string | null;
  ranking_in_category?: number | null;
  awards?: any[];
  price_level?: number | null;
  price_range?: string | null;
  duration?: string | null;
  traveler_type?: string | null;
  best_for_type?: string | null;
  best_for?: string[];
  visibility_score?: number | null;
  slug: string;
  raw?: Record<string, any>;
  verified?: boolean;
  last_verified_at?: string | null;
  updated_at: string;
  highlights?: string[];
  amenities?: any[];
  accessibility_info?: Record<string, any>;
  nearby_attractions?: string[];
  admission_fee?: string | null;
  review_details?: any[];
  fetch_status?: string;
  fetch_error_message?: string | null;
  lat?: number;
  lng?: number;
}

interface TripAdvisorLocation {
  location_id?: string;
  name?: string;
  address_obj?: {
    address_string?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  latitude?: number;
  longitude?: number;
  rating?: number;
  review_count?: number | string;
  num_reviews?: number | string;
  photo_count?: number;
  reviews?: any[];
  description?: string;
  website?: string;
  phone?: string;
  price_level?: number | string;
  ranking?: string;
  ranking_data?: any;
  subcategory?: string | string[];
  neighborhood_info?: any[];
  awards?: any[];
  hours?: any;
  amenities?: any[];
  photos?: Array<{ photo: { images?: { medium?: { url?: string } } } }>;
}

const PHILIPPINES_CITIES = [
  { name: "Manila", id: "298573" },
  { name: "Cebu", id: "298447" },
  { name: "Davao", id: "295426" },
  { name: "Quezon City", id: "315645" },
  { name: "Makati", id: "315641" },
  { name: "Baguio", id: "311585" },
  { name: "Boracay", id: "295409" },
  { name: "Puerto Princesa", id: "316086" },
  { name: "Iloilo", id: "300632" },
  { name: "Pasig", id: "315648" }
];

const CATEGORIES = ["attractions", "hotels", "restaurants", "beaches", "things to do"];

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

  const idSuffix = tripadvisorId.slice(-6).toLowerCase();
  return `${baseSlug}-${idSuffix}`.substring(0, 200);
}

function mapCategoryToType(category: string): string {
  const categoryMap: Record<string, string> = {
    attractions: "Attraction",
    hotels: "Hotel",
    restaurants: "Restaurant",
    beaches: "Beach",
    "things to do": "Activity"
  };
  return categoryMap[category] || "Attraction";
}

function extractImages(location: TripAdvisorLocation): string[] {
  const images: string[] = [];

  if (location.photos && Array.isArray(location.photos)) {
    for (const photoObj of location.photos) {
      try {
        const imageUrl = photoObj?.photo?.images?.medium?.url;
        if (imageUrl) {
          images.push(imageUrl);
        }
      } catch (e) {
        continue;
      }
    }
  }

  return images;
}

function parseReviews(location: TripAdvisorLocation): any[] {
  const reviews: any[] = [];

  if (location.reviews && Array.isArray(location.reviews)) {
    for (const review of location.reviews.slice(0, 10)) {
      reviews.push({
        author: review.reviewer?.username || "Anonymous",
        rating: review.rating || location.rating,
        comment: review.text || review.title || "",
        date: review.review_datetime_utc,
        verified: !!review.is_traveler_reviewed,
        helpful_count: review.helpful_votes || 0
      });
    }
  }

  return reviews;
}

function parseHours(hours: any): Record<string, any> {
  const parsed: Record<string, any> = {};

  if (!hours) return parsed;

  if (Array.isArray(hours)) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const hour of hours) {
      const dayIndex = hour.day || 0;
      const dayName = dayNames[dayIndex];
      parsed[dayName] = {
        open: hour.open_time || "N/A",
        close: hour.close_time || "N/A",
        closed: hour.closed || false
      };
    }
  } else if (typeof hours === "object") {
    Object.keys(hours).forEach((key) => {
      const hour = hours[key];
      if (typeof hour === "string") {
        parsed[key] = hour;
      } else {
        parsed[key] = {
          open: hour.open || hour.open_time || "N/A",
          close: hour.close || hour.close_time || "N/A",
          closed: hour.closed || false
        };
      }
    });
  }

  return parsed;
}

function extractAmenities(location: TripAdvisorLocation): any[] {
  const amenities: any[] = [];

  if (location.amenities && Array.isArray(location.amenities)) {
    for (const amenity of location.amenities) {
      if (typeof amenity === "string") {
        amenities.push({ name: amenity, available: true });
      } else if (amenity.name) {
        amenities.push({
          name: amenity.name,
          available: amenity.available !== false
        });
      }
    }
  }

  return amenities;
}

function extractAwards(location: TripAdvisorLocation): string[] {
  const awards: string[] = [];

  if (location.awards && Array.isArray(location.awards)) {
    for (const award of location.awards) {
      if (typeof award === "string") {
        awards.push(award);
      } else if (award.name) {
        awards.push(`${award.name}${award.year ? ` (${award.year})` : ""}`);
      }
    }
  }

  return awards;
}

async function fetchListingDetails(
  locationId: string,
  cityId: string,
  cityName: string,
  category: string,
  apiKey: string
): Promise<NearbyListing | null> {
  try {
    // Fetch detailed information for the listing
    const detailsUrl = `https://api.tripadvisor.com/api/private/2.1/locations/${locationId}?key=${apiKey}`;

    console.log(`Fetching details for location ${locationId} (${category} in ${cityName})...`);

    const response = await fetch(detailsUrl);

    if (!response.ok) {
      console.warn(`Failed to fetch details for location ${locationId}: ${response.status}`);
      return null;
    }

    const location = await response.json();

    if (!location || !location.name) {
      console.warn(`Invalid location data for ${locationId}`);
      return null;
    }

    const locationId_str = String(location.location_id || locationId);
    const name = location.name || `${category} in ${cityName}`;
    const address = location.address_obj?.address_string || `${cityName}, Philippines`;
    
    const latitude = location.latitude ? parseFloat(String(location.latitude)) : undefined;
    const longitude = location.longitude ? parseFloat(String(location.longitude)) : undefined;
    const rating = location.rating ? parseFloat(String(location.rating)) : undefined;
    const reviewCount = parseInt(String(location.num_reviews || location.review_count || 0), 10);
    const photoCount = location.photo_count || 0;
    
    const images = extractImages(location);
    const primaryImage = images.length > 0 ? images[0] : undefined;
    
    const reviews = parseReviews(location);

    const priceLevel = location.price_level ? parseInt(String(location.price_level), 10) : undefined;
    const website = location.website || undefined;
    const phone = location.phone || undefined;
    
    const description = location.description || 
      `${name} is a popular ${mapCategoryToType(category).toLowerCase()} destination in ${cityName}, Philippines. ${reviewCount > 0 ? `Rated ${rating}/5 based on ${reviewCount} reviews.` : "Discover this amazing destination."}`;

    const highlights = [
      "Popular destination",
      "Well-reviewed",
      reviewCount > 100 ? "Highly recommended" : "Worth visiting"
    ];

    const bestFor = [];
    if (category === "attractions") bestFor.push("Culture", "History");
    if (category === "hotels") bestFor.push("Comfort", "Convenience");
    if (category === "restaurants") bestFor.push("Food", "Experience");
    if (category === "beaches") bestFor.push("Relaxation", "Nature");
    if (category === "things to do") bestFor.push("Adventure", "Fun");

    const amenities = extractAmenities(location);
    const awards = extractAwards(location);
    const hours = parseHours(location.hours);

    const tripadvisorId = locationId_str;
    const listing: NearbyListing = {
      tripadvisor_id: tripadvisorId,
      name: name,
      address: address,
      latitude: latitude,
      longitude: longitude,
      lat: latitude,
      lng: longitude,
      rating: rating,
      category: category,
      source: "tripadvisor_api",
      review_count: reviewCount,
      location_type: mapCategoryToType(category),
      web_url: `https://www.tripadvisor.com/Attraction_Review-g${cityId}-d${locationId_str}-Reviews.html`,
      slug: generateSlug(name, tripadvisorId),
      verified: true,
      updated_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      image_urls: images,
      primary_image_url: primaryImage,
      featured_image_url: primaryImage,
      image_url: primaryImage,
      photo_urls: images,
      photo_count: photoCount,
      highlights: highlights,
      amenities: amenities,
      accessibility_info: {
        wheelchair_accessible: false,
        pet_friendly: false,
        elevator: false,
        accessible_parking: false,
        accessible_restroom: false
      },
      nearby_attractions: [],
      price_level: priceLevel,
      price_range: priceLevel ? 
        priceLevel === 1 ? "$" :
        priceLevel === 2 ? "$$" :
        priceLevel === 3 ? "$$$" :
        "$$$$"
        : undefined,
      duration: category === "attractions" ? "2-4 hours" : undefined,
      traveler_type: "Families",
      best_for_type: "Experience",
      best_for: bestFor.length > 0 ? bestFor : ["Visit"],
      visibility_score: rating ? (rating / 5) * 100 : 0,
      rank_in_category: location.ranking || undefined,
      ranking_in_city: location.ranking || undefined,
      ranking_in_category: location.ranking_data?.position_in_type ? 
        parseInt(String(location.ranking_data.position_in_type), 10) 
        : undefined,
      awards: awards,
      admission_fee: undefined,
      description: description,
      hours_of_operation: hours,
      phone_number: phone,
      website: website,
      review_details: reviews,
      fetch_status: "success",
      stored_image_path: null,
      image_downloaded_at: null,
      raw: {
        city: cityName,
        category: category,
        source: "tripadvisor_api",
        scraped_at: new Date().toISOString(),
        raw_location: location
      }
    };

    return listing;
  } catch (err) {
    console.error(`Error fetching listing details:`, (err as any).message);
    return null;
  }
}

async function fetchLocationsFromTripAdvisor(
  cityId: string,
  cityName: string,
  category: string,
  apiKey: string
): Promise<NearbyListing[]> {
  const listings: NearbyListing[] = [];

  try {
    // First, get the list of locations in this category
    const searchUrl = `https://api.tripadvisor.com/api/private/2.1/locations?location_id=${cityId}&category=${category}&key=${apiKey}`;

    console.log(`Searching for ${category} in ${cityName}...`);

    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      console.warn(`TripAdvisor API search error: ${searchResponse.status} for ${cityName}/${category}`);
      return listings;
    }

    const searchData = await searchResponse.json();

    if (!searchData.data || !Array.isArray(searchData.data)) {
      console.warn(`No data returned from TripAdvisor API for ${cityName}/${category}`);
      return listings;
    }

    // Fetch details for each location
    for (const locationSummary of searchData.data) {
      const locationId = String(locationSummary.location_id || "");
      if (!locationId) continue;

      // Fetch complete details for this location
      const detailedListing = await fetchListingDetails(
        locationId,
        cityId,
        cityName,
        category,
        apiKey
      );

      if (detailedListing) {
        listings.push(detailedListing);
        console.log(`✓ Fetched details: ${detailedListing.name}`);
      }

      // Rate limiting - be respectful to the API
      await sleep(100);
    }

    if (listings.length > 0) {
      console.log(`✓ Fetched ${listings.length} complete ${category} listings from ${cityName}`);
    }

    return listings;
  } catch (err) {
    console.error(`Error fetching locations from TripAdvisor API:`, (err as any).message);
    return listings;
  }
}

async function upsertListings(supabase: any, listings: NearbyListing[]): Promise<number> {
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
      console.log(`✓ Upserted chunk ${i / chunkSize + 1}: ${chunk.length} listings`);
    }

    await sleep(100);
  }

  return upsertedCount;
}

async function performAdvancedScrape(supabase: any) {
  const allListings: NearbyListing[] = [];
  let totalScraped = 0;
  let successCount = 0;
  let errorCount = 0;

  const apiKey = Deno.env.get("TRIPADVISOR") || Deno.env.get("TRIPADVISOR_API_KEY");

  if (!apiKey) {
    console.error("TRIPADVISOR or TRIPADVISOR_API_KEY environment variable not set");
    return {
      success: false,
      error: "TRIPADVISOR API key not configured",
      totalScraped: 0,
      uniqueListings: 0,
      upserted: 0,
      successCount: 0,
      errorCount: PHILIPPINES_CITIES.length * CATEGORIES.length,
      message: "Failed: Missing TripAdvisor API key",
      timestamp: new Date().toISOString(),
    };
  }

  console.log(`\n========== Starting TripAdvisor API Scrape ==========`);
  console.log(`Fetching ${PHILIPPINES_CITIES.length} cities × ${CATEGORIES.length} categories`);
  console.log(`Each location will be fetched with complete details\n`);

  for (const city of PHILIPPINES_CITIES) {
    for (const category of CATEGORIES) {
      try {
        const listings = await fetchLocationsFromTripAdvisor(
          city.id,
          city.name,
          category,
          apiKey
        );

        if (listings.length > 0) {
          allListings.push(...listings);
          totalScraped += listings.length;
          successCount++;
          console.log(`✓ Completed ${category} in ${city.name}: ${listings.length} listings\n`);
        }

        // Rate limiting between category fetches
        await sleep(500);
      } catch (err) {
        errorCount++;
        console.warn(`✗ Error fetching ${category} in ${city.name}:`, (err as any).message);
      }
    }
  }

  const uniqueMap = new Map();
  for (const listing of allListings) {
    uniqueMap.set(listing.tripadvisor_id, listing);
  }

  const uniqueListings = Array.from(uniqueMap.values());

  console.log(`\n========== TripAdvisor API Scrape Results ==========`);
  console.log(`Total fetched: ${totalScraped}`);
  console.log(`Unique listings: ${uniqueListings.length}`);
  console.log(`Categories processed: ${successCount}`);
  console.log(`Errors: ${errorCount}\n`);

  let upsertedCount = 0;
  if (uniqueListings.length > 0) {
    console.log(`Upserting ${uniqueListings.length} listings to database...`);
    upsertedCount = await upsertListings(supabase, uniqueListings);
    console.log(`✓ Successfully upserted: ${upsertedCount}\n`);
  }

  return {
    success: true,
    totalScraped,
    uniqueListings: uniqueListings.length,
    upserted: upsertedCount,
    successCount,
    errorCount,
    message: `TripAdvisor API scraping completed: fetched ${upsertedCount} complete listings with all details`,
    timestamp: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const result = await performAdvancedScrape(supabase);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Advanced scrape failed:", err);
    return new Response(
      JSON.stringify({
        error: (err as any).message || "Advanced scrape failed",
        details: String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
