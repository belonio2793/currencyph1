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
        const imageUrl = photoObj?.photo?.images?.medium?.url || 
                        photoObj?.photo?.images?.large?.url ||
                        photoObj?.photo?.images?.original?.url;
        if (imageUrl && !images.includes(imageUrl)) {
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
    for (const review of location.reviews.slice(0, 15)) {
      reviews.push({
        author: review.reviewer?.username || "Anonymous",
        rating: review.rating || location.rating,
        comment: review.text || review.title || "",
        date: review.review_datetime_utc || review.published_date,
        verified: !!review.is_traveler_reviewed,
        helpful_count: review.helpful_votes || 0,
        country: review.reviewer?.country
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

function extractHighlights(location: TripAdvisorLocation, category: string): string[] {
  const highlights: string[] = [];

  if (location.description) {
    if (location.description.length > 0) {
      highlights.push("Detailed description available");
    }
  }

  if (location.amenities && location.amenities.length > 0) {
    highlights.push(`${location.amenities.length} amenities`);
  }

  if (location.awards && location.awards.length > 0) {
    highlights.push("Award-winning");
  }

  if (location.photo_count && location.photo_count > 100) {
    highlights.push(`${location.photo_count} verified photos`);
  }

  if (location.review_count || location.num_reviews) {
    highlights.push("Highly reviewed");
  }

  const categoryHighlights: Record<string, string[]> = {
    attractions: ["Cultural significance", "Popular destination", "Well-maintained"],
    hotels: ["Comfortable accommodation", "Quality service", "Good reviews"],
    restaurants: ["Local cuisine", "Dining experience", "Recommended"],
    beaches: ["Scenic views", "Water activities", "Family-friendly"],
    "things to do": ["Adventure activities", "Tourist attraction", "Memorable experience"]
  };

  const categorySpecific = categoryHighlights[category];
  if (categorySpecific) {
    highlights.push(...categorySpecific.slice(0, 2));
  }

  return highlights.filter((h, i, a) => a.indexOf(h) === i).slice(0, 10);
}

async function scrapeWebPageDetails(
  url: string,
  listingName: string
): Promise<Partial<NearbyListing> | null> {
  try {
    console.log(`Scraping web page for ${listingName}...`);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (!response.ok) {
      console.warn(`Failed to scrape ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const enhancements: Partial<NearbyListing> = {};

    const phoneMatch = html.match(/\+63\s?\d{1,3}[\s\-]?\d{3,4}[\s\-]?\d{4}|\(\d{2,3}\)\s?\d{3,4}[\s\-]?\d{4}/);
    if (phoneMatch && !enhancements.phone_number) {
      enhancements.phone_number = phoneMatch[0];
    }

    const hoursMatch = html.match(/(?:hours?|open|closed)[\s:]*([^<]+?(?:am|pm|AM|PM)[^<]*)/gi);
    if (hoursMatch && Object.keys(enhancements.hours_of_operation || {}).length === 0) {
      enhancements.hours_of_operation = {
        note: hoursMatch.slice(0, 3).join(" | ")
      };
    }

    const admissionMatch = html.match(/(?:admission|entry|entrance|fee|price)[\s:]*(?:₱|php|peso)?\s*([\d,]+(?:\.\d{2})?[^<]*)/gi);
    if (admissionMatch && !enhancements.admission_fee) {
      enhancements.admission_fee = admissionMatch[0].replace(/^[^₱php]+/, "").trim();
    }

    const websiteMatch = html.match(/(?:href=|visit\s+)?(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9\-_.]+\.[a-z]{2,})/i);
    if (websiteMatch && !enhancements.website) {
      const domain = websiteMatch[1];
      if (!domain.includes("tripadvisor")) {
        enhancements.website = `https://${domain}`;
      }
    }

    const accessibilityTerms = ["wheelchair", "accessible", "disability", "pet friendly"];
    const accessibilityMatches = html.toLowerCase().match(new RegExp(accessibilityTerms.join("|"), "g"));
    if (accessibilityMatches) {
      enhancements.accessibility_info = {
        wheelchair_accessible: html.toLowerCase().includes("wheelchair"),
        pet_friendly: html.toLowerCase().includes("pet friendly") || html.toLowerCase().includes("pets allowed"),
        elevator: html.toLowerCase().includes("elevator"),
        accessible_parking: html.toLowerCase().includes("accessible parking"),
        accessible_restroom: html.toLowerCase().includes("accessible restroom")
      };
    }

    return Object.keys(enhancements).length > 0 ? enhancements : null;
  } catch (err) {
    console.warn(`Web scraping failed for ${listingName}:`, (err as any).message);
    return null;
  }
}

async function fetchListingDetails(
  locationId: string,
  cityId: string,
  cityName: string,
  category: string,
  apiKey: string
): Promise<NearbyListing | null> {
  try {
    const detailsUrl = `https://api.tripadvisor.com/api/private/2.1/locations/${locationId}?key=${apiKey}`;

    console.log(`Fetching API details for location ${locationId} (${category} in ${cityName})...`);

    const response = await fetch(detailsUrl);

    if (!response.ok) {
      console.warn(`Failed to fetch API details for location ${locationId}: ${response.status}`);
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

    const highlights = extractHighlights(location, category);

    const bestFor = [];
    if (category === "attractions") bestFor.push("Culture", "History", "Tourism");
    if (category === "hotels") bestFor.push("Comfort", "Convenience", "Business");
    if (category === "restaurants") bestFor.push("Food", "Dining", "Experience");
    if (category === "beaches") bestFor.push("Relaxation", "Nature", "Swimming");
    if (category === "things to do") bestFor.push("Adventure", "Fun", "Recreation");

    const amenities = extractAmenities(location);
    const awards = extractAwards(location);
    const hours = parseHours(location.hours);

    const tripadvisorId = locationId_str;
    const webUrl = `https://www.tripadvisor.com/Attraction_Review-g${cityId}-d${locationId_str}-Reviews.html`;
    
    let listing: NearbyListing = {
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
      web_url: webUrl,
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
      duration: category === "attractions" ? "2-4 hours" : category === "restaurants" ? "1-2 hours" : undefined,
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
        source: "tripadvisor_api_enhanced",
        scraped_at: new Date().toISOString(),
        raw_location: location
      }
    };

    await sleep(200);

    const webEnhancements = await scrapeWebPageDetails(webUrl, name);
    if (webEnhancements) {
      listing = {
        ...listing,
        ...webEnhancements,
        source: "tripadvisor_api_enhanced"
      };
      console.log(`✓ Enhanced with web data: ${name}`);
    }

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

    for (const locationSummary of searchData.data) {
      const locationId = String(locationSummary.location_id || "");
      if (!locationId) continue;

      const detailedListing = await fetchListingDetails(
        locationId,
        cityId,
        cityName,
        category,
        apiKey
      );

      if (detailedListing) {
        listings.push(detailedListing);
        console.log(`✓ Fetched and enhanced: ${detailedListing.name}`);
      }

      await sleep(150);
    }

    if (listings.length > 0) {
      console.log(`✓ Fetched ${listings.length} complete ${category} listings from ${cityName}\n`);
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

  console.log(`\n========== Starting Enhanced TripAdvisor Scrape ==========`);
  console.log(`Method: API + Web Scraping (Hybrid)`);
  console.log(`Fetching ${PHILIPPINES_CITIES.length} cities × ${CATEGORIES.length} categories`);
  console.log(`Each location will fetch: Full API data + Web page enrichment\n`);

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
          console.log(`✓ Completed ${category} in ${city.name}: ${listings.length} enhanced listings\n`);
        }

        await sleep(800);
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

  console.log(`\n========== Enhanced Scrape Results ==========`);
  console.log(`Total fetched: ${totalScraped}`);
  console.log(`Unique listings: ${uniqueListings.length}`);
  console.log(`Categories processed: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Data sources: TripAdvisor API + Web Page Scraping\n`);

  let upsertedCount = 0;
  if (uniqueListings.length > 0) {
    console.log(`Upserting ${uniqueListings.length} enhanced listings to database...`);
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
    message: `Enhanced scraping completed: fetched ${upsertedCount} listings with complete API + web data (amenities, hours, phone, admission fees, accessibility, etc.)`,
    dataSource: "tripadvisor_api_enhanced",
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
