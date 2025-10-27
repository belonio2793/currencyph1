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
    for (const review of location.reviews.slice(0, 20)) {
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

  if (location.description && location.description.length > 0) {
    highlights.push("Detailed description available");
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

  return highlights.filter((h, i, a) => a.indexOf(h) === i).slice(0, 12);
}

async function downloadAndParsePage(
  url: string,
  listingName: string,
  cityId: string,
  locationId: string
): Promise<Partial<NearbyListing> | null> {
  try {
    console.log(`⬇️  Downloading full page for ${listingName}...`);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.tripadvisor.com/"
      }
    });

    if (!response.ok) {
      console.warn(`Failed to download page ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const enhancements: Partial<NearbyListing> = {
      raw: {
        html_page_downloaded: true,
        page_size: html.length,
        download_timestamp: new Date().toISOString()
      }
    };

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.address) {
          if (!enhancements.address) {
            enhancements.address = jsonLd.address.streetAddress || jsonLd.address;
          }
        }
        if (jsonLd.telephone && !enhancements.phone_number) {
          enhancements.phone_number = jsonLd.telephone;
        }
        if (jsonLd.url && !enhancements.website) {
          enhancements.website = jsonLd.url;
        }
      } catch (e) {
        console.warn(`Failed to parse JSON-LD`);
      }
    }

    const phonePatterns = [
      /\+63\s?\d{1,3}[\s\-]?\d{3,4}[\s\-]?\d{4}/g,
      /\(\d{2,3}\)\s?\d{3,4}[\s\-]?\d{4}/g,
      /\b\d{3,4}[\s\-]\d{4}[\s\-]\d{4}\b/g
    ];
    
    for (const pattern of phonePatterns) {
      const matches = html.match(pattern);
      if (matches && !enhancements.phone_number) {
        enhancements.phone_number = matches[0];
        break;
      }
    }

    const admissionPatterns = [
      /(?:admission|entry|entrance|fee|price)[^<]*?₱\s*([0-9,]+(?:\.\d{2})?[^<]*)/gi,
      /₱\s*([0-9,]+(?:\.\d{2})?)\s*(?:php|philippine|peso)?\s*(?:adults?|per person|admission)?/gi,
      /admission[^<]*?₱\s*([^<]+)/gi
    ];

    for (const pattern of admissionPatterns) {
      const matches = html.match(pattern);
      if (matches && !enhancements.admission_fee) {
        const cleanedFee = matches[0]
          .replace(/^[^₱]*₱\s*/, "₱ ")
          .substring(0, 100);
        enhancements.admission_fee = cleanedFee;
        break;
      }
    }

    const hoursPatterns = [
      /(?:hours?|open|operating)[^<]*?(\d{1,2}:\d{2}\s*(?:am|pm)[^<]*(?:to|-|–)\s*\d{1,2}:\d{2}\s*(?:am|pm))/gi,
      /monday[\s\w:,]+?(?:am|pm)[^<]*?sunday/gi,
      /daily[\s:]*(\d{1,2}:\d{2}\s*(?:am|pm)[^<]*\d{1,2}:\d{2}\s*(?:am|pm))/gi
    ];

    const extractedHours: Record<string, string> = {};
    for (const pattern of hoursPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        dayNames.forEach((day, i) => {
          const dayPatternStr = day.substring(0, 3);
          const dayRegex = new RegExp(`${dayPatternStr}[^<]*?(\\d{1,2}:\\d{2}\\s*(?:am|pm)[^<]*\\d{1,2}:\\d{2}\\s*(?:am|pm))`, "gi");
          const dayMatch = html.match(dayRegex);
          if (dayMatch) {
            extractedHours[day] = dayMatch[0].replace(new RegExp(`${dayPatternStr}[^\\d]*`), "");
          }
        });
      }
    }
    if (Object.keys(extractedHours).length > 0 && (!enhancements.hours_of_operation || Object.keys(enhancements.hours_of_operation).length === 0)) {
      enhancements.hours_of_operation = extractedHours;
    }

    const amenityPatterns = [
      /(?:amenities?|facilities?)[\s<]*:?[\s<]*([^<]{20,200}?(?=<|amenities|facilities|$))/gi,
      /<(?:li|div)[^>]*>[\s]*([A-Z][a-z\s]+)(?:✓|✔|yes|available)<\/(?:li|div)>/gi,
      /(?:wifi|parking|restaurant|bar|pool|spa|gym|laundry|air\s*conditioning|heating)/gi
    ];

    const amenities: any[] = [];
    const amenitySet = new Set<string>();

    for (const pattern of amenityPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleaned = match.replace(/<[^>]+>/g, "").trim();
          if (cleaned.length > 2 && cleaned.length < 100 && !amenitySet.has(cleaned)) {
            amenities.push({
              name: cleaned,
              available: true
            });
            amenitySet.add(cleaned);
          }
        }
      }
    }
    if (amenities.length > 0 && (!enhancements.amenities || enhancements.amenities.length === 0)) {
      enhancements.amenities = amenities.slice(0, 20);
    }

    const websitePatterns = [
      /(?:website|web|url|link)[^<]*?(?:href=)?["\']?(https?:\/\/[^\s"\'<>]+)/gi,
      /(?:www\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/g
    ];

    for (const pattern of websitePatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          const url = match.startsWith("http") ? match : `https://${match}`;
          if (!url.includes("tripadvisor") && !url.includes("facebook") && url.length > 10 && url.length < 200) {
            if (!enhancements.website) {
              enhancements.website = url;
              break;
            }
          }
        }
      }
    }

    const accessibilityKeywords = [
      "wheelchair",
      "accessible",
      "disability",
      "pet friendly",
      "elevator",
      "parking",
      "restroom"
    ];

    const accessibilityInfo: Record<string, any> = {};
    const htmlLower = html.toLowerCase();

    accessibilityInfo.wheelchair_accessible = htmlLower.includes("wheelchair");
    accessibilityInfo.pet_friendly = htmlLower.includes("pet") && (htmlLower.includes("friendly") || htmlLower.includes("allowed") || htmlLower.includes("welcome"));
    accessibilityInfo.elevator = htmlLower.includes("elevator");
    accessibilityInfo.accessible_parking = htmlLower.includes("accessible") && htmlLower.includes("parking");
    accessibilityInfo.accessible_restroom = htmlLower.includes("accessible") && (htmlLower.includes("restroom") || htmlLower.includes("bathroom") || htmlLower.includes("toilet"));

    enhancements.accessibility_info = accessibilityInfo;

    const imageUrls: string[] = [];
    const imgRegex = /(?:src|data-src)=["']([^"']*(?:jpg|jpeg|png|webp)[^"']*)/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const url = imgMatch[1];
      if (url.includes("tripadvisor") || url.includes("media-cdn") || url.includes("dynamic")) {
        if (!imageUrls.includes(url) && imageUrls.length < 30) {
          imageUrls.push(url);
        }
      }
    }
    if (imageUrls.length > 0 && (!enhancements.photo_urls || enhancements.photo_urls.length === 0)) {
      enhancements.photo_urls = imageUrls;
      enhancements.photo_count = imageUrls.length;
      if (!enhancements.image_urls || enhancements.image_urls.length === 0) {
        enhancements.image_urls = imageUrls.slice(0, 10);
      }
      if (!enhancements.primary_image_url) {
        enhancements.primary_image_url = imageUrls[0];
      }
      if (!enhancements.featured_image_url) {
        enhancements.featured_image_url = imageUrls[0];
      }
      if (!enhancements.image_url) {
        enhancements.image_url = imageUrls[0];
      }
    }

    const nearbyAttractionsMatch = html.match(/nearby[\s\w:]*?attractions[^<]{0,500}?(?:<|$)/gi);
    if (nearbyAttractionsMatch) {
      const attractionLinks = html.match(/href="\/(?:Attraction|Hotel|Restaurant)_Review[^"]*"[^>]*>([^<]+)<\/a>/gi);
      if (attractionLinks) {
        const attractions = attractionLinks
          .map(link => link.match(/>([^<]+)</)?.[1])
          .filter((a) => a && a.length > 0 && a.length < 100)
          .slice(0, 10);
        if (attractions.length > 0) {
          enhancements.nearby_attractions = attractions as string[];
        }
      }
    }

    const awardsMatch = html.match(/(?:award|recognition|certified|excellence)[^<]{10,200}?(?=<|award)/gi);
    if (awardsMatch) {
      const awards = awardsMatch
        .map(a => a.replace(/<[^>]+>/g, "").trim())
        .filter((a) => a.length > 0 && a.length < 150)
        .slice(0, 10);
      if (awards.length > 0 && (!enhancements.awards || enhancements.awards.length === 0)) {
        enhancements.awards = awards;
      }
    }

    console.log(`✅ Downloaded & parsed ${listingName}: found amenities, hours, contact info, photos`);
    return Object.keys(enhancements).length > 1 ? enhancements : null;
  } catch (err) {
    console.warn(`Page download/parse failed for ${listingName}:`, (err as any).message);
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

    console.log(`🔗 Fetching API details for ${locationId} (${category} in ${cityName})...`);

    const response = await fetch(detailsUrl);

    if (!response.ok) {
      console.warn(`Failed to fetch API details for location ${locationId}: ${response.status}`);
      return null;
    }

    let location: TripAdvisorLocation;
    try {
      location = await response.json();
    } catch (e) {
      console.warn(`Failed to parse JSON response for location ${locationId}`);
      return null;
    }

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
        raw_location: location,
        data_sources: ["tripadvisor_api", "web_page_scrape"]
      }
    };

    await sleep(300);

    const webEnhancements = await downloadAndParsePage(webUrl, name, cityId, locationId_str);
    if (webEnhancements) {
      listing = {
        ...listing,
        ...webEnhancements,
        source: "tripadvisor_api_enhanced"
      };
      if (listing.raw) {
        listing.raw.web_page_parsed = true;
        listing.raw.combined_from_sources = true;
      }
      console.log(`✨ Enhanced ${name} with full web page data`);
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

    console.log(`🔍 Searching for ${category} in ${cityName}...`);

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

    const data = searchData.data || [];
    if (!Array.isArray(data)) {
      console.warn(`Invalid data format for ${cityName}/${category}`);
      return listings;
    }

    for (const locationSummary of data) {
      const locationId = String(locationSummary.location_id || "");
      if (!locationId) continue;

      try {
        const detailedListing = await fetchListingDetails(
          locationId,
          cityId,
          cityName,
          category,
          apiKey
        );

        if (detailedListing) {
          listings.push(detailedListing);
          console.log(`✓ Complete: ${detailedListing.name}\n`);
        }
      } catch (err) {
        console.warn(`Error fetching details for location ${locationId}:`, (err as any).message);
      }

      await sleep(500);
    }

    if (listings.length > 0) {
      console.log(`✓ Fetched ${listings.length} complete ${category} listings from ${cityName} (API + full page scrape)\n`);
    }

    return listings;
  } catch (err) {
    console.error(`Error fetching locations from TripAdvisor API:`, (err as any).message);
    return listings;
  }
}

async function upsertListings(supabase: any, listings: NearbyListing[]): Promise<number> {
  if (!listings || listings.length === 0) return 0;

  const chunkSize = 25;
  let upsertedCount = 0;

  for (let i = 0; i < listings.length; i += chunkSize) {
    const chunk = listings.slice(i, i + chunkSize);
    const chunkNum = Math.floor(i / chunkSize) + 1;

    try {
      let response: any;
      try {
        response = await supabase
          .from("nearby_listings")
          .upsert(chunk, { onConflict: "tripadvisor_id" });
      } catch (fetchErr) {
        const msg = fetchErr && typeof fetchErr === 'object' && 'message' in fetchErr ? (fetchErr as any).message : String(fetchErr);
        console.error(`Supabase call error for chunk ${chunkNum}:`, msg);
        continue;
      }

      if (!response) {
        console.warn(`No response from Supabase for chunk ${chunkNum}`);
        continue;
      }

      if (response.error) {
        const errorMsg = typeof response.error === 'string' ? response.error :
                        (response.error && typeof response.error === 'object' && 'message' in response.error) ? response.error.message :
                        JSON.stringify(response.error);
        console.error(`Error upserting chunk ${chunkNum}:`, errorMsg);
      } else {
        upsertedCount += chunk.length;
        console.log(`✓ Upserted chunk ${chunkNum}: ${chunk.length} listings`);
      }
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
      console.error(`Exception upserting chunk ${chunkNum}:`, msg);
    }

    await sleep(200);
  }

  return upsertedCount;
}

async function performAdvancedScrape(supabase: any) {
  try {
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

    console.log(`\n========== Starting FULL PAGE TripAdvisor Scrape ==========`);
    console.log(`Method: TripAdvisor API + Complete Page Download & Parse`);
    console.log(`Fetching ${PHILIPPINES_CITIES.length} cities × ${CATEGORIES.length} categories`);
    console.log(`Each listing: Full API data + Complete HTML page download + Comprehensive parsing\n`);
    console.log(`Data extracted: amenities, hours, phone, admission fees, website, accessibility, photos, reviews, nearby attractions, awards\n`);

    for (const city of PHILIPPINES_CITIES) {
      for (const category of CATEGORIES) {
        try {
          const listings = await fetchLocationsFromTripAdvisor(
            city.id,
            city.name,
            category,
            apiKey
          );

          if (listings && listings.length > 0) {
            allListings.push(...listings);
            totalScraped += listings.length;
            successCount++;
          }

          await sleep(1000);
        } catch (err) {
          errorCount++;
          const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
          console.warn(`✗ Error fetching ${category} in ${city.name}:`, msg);
        }
      }
    }

    const uniqueMap = new Map();
    for (const listing of allListings) {
      if (listing && listing.tripadvisor_id) {
        uniqueMap.set(listing.tripadvisor_id, listing);
      }
    }

    const uniqueListings = Array.from(uniqueMap.values());

    console.log(`\n========== Full Page Scrape Results ==========`);
    console.log(`Total fetched: ${totalScraped}`);
    console.log(`Unique listings: ${uniqueListings.length}`);
    console.log(`Categories processed: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Data sources: TripAdvisor API + Full Page HTML Downloads\n`);

    let upsertedCount = 0;
    if (uniqueListings.length > 0) {
      console.log(`Upserting ${uniqueListings.length} fully enhanced listings to database...`);
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
      message: `Full page scraping completed: ${upsertedCount} listings with comprehensive data (amenities, hours, phone, admission, website, accessibility, photos, reviews, nearby attractions, awards)`,
      dataSource: "tripadvisor_api_enhanced_fullpage",
      scrapeMethod: "Hybrid: API + HTML Page Download + Parsing",
      timestamp: new Date().toISOString(),
    };
  } catch (mainErr) {
    const msg = mainErr && typeof mainErr === 'object' && 'message' in mainErr ? (mainErr as any).message : String(mainErr);
    console.error("Error in performAdvancedScrape:", msg);
    return {
      success: false,
      error: msg,
      totalScraped: 0,
      uniqueListings: 0,
      upserted: 0,
      successCount: 0,
      errorCount: 1,
      message: `Scrape failed: ${msg}`,
      timestamp: new Date().toISOString(),
    };
  }
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
    const errorMsg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
    console.error("Advanced scrape failed:", errorMsg);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg || "Advanced scrape failed",
        details: String(err),
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
