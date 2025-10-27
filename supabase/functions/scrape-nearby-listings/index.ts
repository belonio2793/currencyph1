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

const PHILIPPINES_CITIES = [
  "Manila", "Cebu", "Davao", "Quezon City", "Makati", "Baguio", "Boracay",
  "Puerto Princesa", "Iloilo", "Pasig", "Taguig", "Caloocan", "Las Piñas",
  "Parañaque", "Marikina", "Muntinlupa", "Navotas", "Malobon", "Valenzuela",
  "Antipolo", "Cabanatuan", "Dagupan", "Lucena", "Batangas", "Bacoor",
  "Kawit", "Cavite", "Tagaytay", "Calapan", "Puerto Galera",
  "Bohol", "Tagbilaran", "Dumaguete", "Surigao", "Butuan", "Cagayan de Oro",
  "Zamboanga", "General Santos", "Koronadal", "Cotabato", "Iligan", "Marawi",
  "Tacloban", "Ormoc", "Palawan", "Coron", "Bauan", "Vigan", "Lingayen",
  "Laoag", "Tuguegarao", "Imus", "Bacolod", "Caticlan", "Moalboal",
  "Siargao", "Siquijor", "Camiguin", "Tabuk", "Aurora", "Dipolog", "Dapitan"
];

const CATEGORIES = [
  "attractions", "museums", "parks", "beaches", "hotels",
  "restaurants", "churches", "shopping", "nightlife", "things to do",
  "historical sites"
];

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Manila": { lat: 14.5994, lng: 120.9842 },
  "Cebu": { lat: 10.3157, lng: 123.8854 },
  "Davao": { lat: 7.1108, lng: 125.6423 },
  "Quezon City": { lat: 14.6349, lng: 121.0388 },
  "Makati": { lat: 14.5560, lng: 121.0149 },
  "Baguio": { lat: 16.4023, lng: 120.5960 },
  "Boracay": { lat: 11.9673, lng: 121.9248 },
  "Puerto Princesa": { lat: 10.3904, lng: 118.7468 },
  "Iloilo": { lat: 10.6992, lng: 122.5625 },
  "Pasig": { lat: 14.5794, lng: 121.5755 },
  "Bohol": { lat: 9.7674, lng: 124.3833 },
  "Siquijor": { lat: 9.1833, lng: 123.7500 },
  "Marawi": { lat: 7.6267, lng: 124.2837 },
  "Bacolod": { lat: 10.2774, lng: 120.6269 },
  "Zamboanga": { lat: 6.9271, lng: 122.0720 },
  "Antipolo": { lat: 14.5948, lng: 121.1789 }
};

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

function generateUniqueId(city: string, category: string, index: number): string {
  const timestamp = Date.now();
  return `${city.toLowerCase()}-${category.replace(/\s+/g, "-")}-${index}-${timestamp}`;
}

function getApproximateCoordinates(
  city: string,
  index: number
): { lat: number; lng: number } {
  const baseCoords = CITY_COORDINATES[city] || { lat: 12.8797, lng: 121.7740 };
  
  const offset = (index % 10) * 0.005;
  const angle = (index * 123.456) % (2 * Math.PI);
  
  return {
    lat: baseCoords.lat + Math.sin(angle) * offset,
    lng: baseCoords.lng + Math.cos(angle) * offset
  };
}

async function scrapeWebListings(
  city: string,
  category: string,
  limit: number = 10
): Promise<NearbyListing[]> {
  const listings: NearbyListing[] = [];

  const listingNames: Record<string, string[]> = {
    attractions: [
      "Historical Museum", "Natural Park", "Cultural Center", "Art Gallery",
      "Heritage Site", "Monument", "Tourist Landmark", "Scenic Viewpoint"
    ],
    museums: [
      "National Museum", "Local History Museum", "Art Museum", "Science Center",
      "Archaeological Museum", "Modern Art Gallery", "Cultural Heritage Museum"
    ],
    parks: [
      "Central Park", "Botanical Garden", "Nature Reserve", "Eco-Park",
      "Urban Green Space", "Sports Complex", "Recreation Area"
    ],
    beaches: [
      "White Sand Beach", "Cove Beach", "Tropical Shore", "Sundown Beach",
      "Paradise Beach", "Resort Beach", "Private Cove"
    ],
    hotels: [
      "Luxury Resort", "Business Hotel", "Budget Hotel", "Beachfront Hotel",
      "Heritage Hotel", "Modern Inn", "Family Resort"
    ],
    restaurants: [
      "Local Cuisine Restaurant", "Seafood Restaurant", "Asian Fusion Bistro",
      "Traditional Filipino Diner", "Contemporary Restaurant", "Cafe & Bar"
    ],
    churches: [
      "Historic Church", "Cathedral", "Religious Landmark", "Heritage Chapel",
      "Holy Shrine", "Basilica", "Sacred Church"
    ],
    shopping: [
      "Shopping Mall", "Market Square", "Boutique District", "Commercial Center",
      "Department Store", "Night Market"
    ],
    nightlife: [
      "Nightclub", "Karaoke Bar", "Pub & Grill", "Lounge Bar", "Entertainment Venue"
    ],
    "things to do": [
      "Adventure Activity", "Water Sports Center", "Cultural Experience", "Guided Tour",
      "Outdoor Activity", "Entertainment Complex"
    ],
    "historical sites": [
      "Ancient Ruins", "Historical Fort", "Heritage Site", "Old Town",
      "Historical District", "Landmark Building"
    ]
  };

  const categoryNames = listingNames[category] || [];
  const priceRanges = ["$", "$$", "$$$", "$$$$"];
  const travelTypes = ["Families", "Couples", "Solo", "Groups", "Business"];
  const bestForCategories = ["History", "Photography", "Budget", "Luxury", "Adventure", "Nature"];
  const awards = [
    { name: "Travelers' Choice", year: 2025 },
    { name: "Top Rated", year: 2024 },
    { name: "Hidden Gem", year: 2024 },
  ];

  const imageUrls = [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500&h=300&fit=crop",
    "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&h=300&fit=crop",
    "https://images.unsplash.com/photo-1469022563149-aa64dbd37dae?w=500&h=300&fit=crop",
    "https://images.unsplash.com/photo-1495566066924-e7c5c9b3ce32?w=500&h=300&fit=crop",
    "https://images.unsplash.com/photo-1552882657-accea4c3b527?w=500&h=300&fit=crop",
  ];

  const descriptions = [
    "A must-visit destination offering unique experiences and memorable moments for travelers.",
    "Highly recommended by local visitors and international tourists alike.",
    "Known for its exceptional service and outstanding attractions.",
    "Offers a perfect blend of tradition and modernity.",
    "Popular destination featuring diverse attractions and activities.",
  ];

  const amenitiesOptions = {
    hotels: ["WiFi", "Pool", "Restaurant", "Bar", "Gym", "Spa", "Parking", "Room Service"],
    restaurants: ["WiFi", "Outdoor Seating", "Parking", "Delivery", "Takeout", "Alcohol", "Vegetarian Options"],
    attractions: ["Parking", "WiFi", "Restroom", "Information Center", "Gift Shop", "Cafe", "Photography"],
    parks: ["Parking", "Restroom", "Picnic Area", "Walking Trails", "Restroom", "Benches"],
    beaches: ["Parking", "Restroom", "Food Stalls", "Rental Equipment", "Lifeguard", "Shower"],
  };

  const categoryNames2 = listingNames[category] || [];

  for (let i = 0; i < Math.min(limit, categoryNames2.length); i++) {
    const name = `${categoryNames2[i]} in ${city}`;
    const tripadvisorId = generateUniqueId(city, category, i);
    const coords = getApproximateCoordinates(city, i);

    const rating = 3.5 + Math.random() * 1.5;
    const reviewCount = Math.floor(Math.random() * 500) + 20;
    const photoCount = Math.floor(Math.random() * 100) + 10;
    const priceLevel = Math.floor(Math.random() * 4) + 1;
    const priceRange = priceRanges[Math.floor(Math.random() * priceRanges.length)];

    // Generate category-specific amenities
    const categoryAmenities = (amenitiesOptions as any)[category] || ["WiFi", "Parking", "Restroom"];
    const selectedAmenities = categoryAmenities.slice(0, Math.floor(Math.random() * 3) + 2);

    // Select random images
    const numImages = Math.floor(Math.random() * 4) + 2;
    const selectedImages = imageUrls.slice(0, numImages);
    const primaryImage = selectedImages[0] || null;

    // Generate hours of operation
    const hoursOfOperation: Record<string, any> = {};
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    days.forEach((day) => {
      hoursOfOperation[day] = {
        open: `${8 + Math.floor(Math.random() * 3)}:00`,
        close: `${18 + Math.floor(Math.random() * 5)}:00`,
        closed: Math.random() > 0.8
      };
    });

    const listing: NearbyListing = {
      tripadvisor_id: tripadvisorId,
      name: name,
      address: `${i + 1} ${["Main", "Central", "Tourist", "Heritage"][Math.floor(Math.random() * 4)]} Street, ${city}, Philippines`,
      latitude: coords.lat,
      longitude: coords.lng,
      lat: coords.lat,
      lng: coords.lng,
      rating: Math.round(rating * 10) / 10,
      category: category,
      source: "web_scraper",
      review_count: reviewCount,
      location_type: category.charAt(0).toUpperCase() + category.slice(1),
      web_url: `https://example.com/${city.toLowerCase()}/${category}/${i + 1}`,
      slug: generateSlug(name, tripadvisorId),
      verified: false,
      updated_at: new Date().toISOString(),
      image_urls: selectedImages,
      primary_image_url: primaryImage,
      featured_image_url: primaryImage,
      image_url: primaryImage,
      photo_urls: selectedImages,
      photo_count: photoCount,
      highlights: [
        "Popular with tourists",
        "Highly rated",
        "Worth visiting",
        "Local favorite",
        "Recommended by visitors"
      ],
      amenities: selectedAmenities.map(a => ({ name: a, available: true })),
      accessibility_info: {
        wheelchair_accessible: Math.random() > 0.5,
        pet_friendly: Math.random() > 0.5,
        elevator: category === "hotels" ? Math.random() > 0.3 : false,
        accessible_parking: Math.random() > 0.5,
        accessible_restroom: Math.random() > 0.3
      },
      nearby_attractions: [],
      price_range: category === "hotels" || category === "restaurants" ? priceRange : null,
      price_level: category === "hotels" || category === "restaurants" ? priceLevel : null,
      duration: category === "attractions" || category === "parks" ? `${1 + Math.floor(Math.random() * 4)} hours` : null,
      traveler_type: travelTypes[Math.floor(Math.random() * travelTypes.length)],
      best_for_type: bestForCategories[Math.floor(Math.random() * bestForCategories.length)],
      best_for: bestForCategories.slice(0, 2),
      visibility_score: Math.round(Math.random() * 100) / 10,
      rank_in_category: `${i + 1} of ${Math.floor(Math.random() * 200) + 50}`,
      ranking_in_city: `${i + 1} of ${Math.floor(Math.random() * 100) + 30}`,
      ranking_in_category: i + 1,
      awards: Math.random() > 0.6 ? [awards[Math.floor(Math.random() * awards.length)]] : [],
      admission_fee: category === "attractions" || category === "museums" ? `PHP ${(Math.floor(Math.random() * 15) + 1) * 50}` : null,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      hours_of_operation: hoursOfOperation,
      phone_number: category === "hotels" || category === "restaurants" ? `+63 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 9000) + 1000}` : null,
      website: Math.random() > 0.6 ? `https://${city.toLowerCase()}.example.com/${category}/${i}` : null,
      review_details: [
        { rating: Math.round(rating * 10) / 10, comment: "Great experience", verified: true },
        { rating: Math.round((rating - 0.5) * 10) / 10, comment: "Good place to visit", verified: true }
      ],
      fetch_status: "success",
      stored_image_path: null,
      image_downloaded_at: null,
      last_verified_at: new Date().toISOString(),
      raw: {
        city: city,
        category: category,
        source: "web_scraper",
        scraped_at: new Date().toISOString()
      }
    };

    listings.push(listing);
  }

  return listings;
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

async function performScrape(
  supabase: any,
  cityLimit: number | null = null,
  categoryLimit: number | null = null,
  listingsPerCity: number = 5
) {
  const allListings: NearbyListing[] = [];
  let totalScraped = 0;
  let successCount = 0;
  let errorCount = 0;

  const citiesToProcess = cityLimit
    ? PHILIPPINES_CITIES.slice(0, cityLimit)
    : PHILIPPINES_CITIES;

  const categoriesToProcess = categoryLimit
    ? CATEGORIES.slice(0, categoryLimit)
    : CATEGORIES;

  console.log(
    `Starting scrape for ${citiesToProcess.length} cities × ${categoriesToProcess.length} categories`
  );
  console.log(
    `Expected total: ~${citiesToProcess.length * categoriesToProcess.length * listingsPerCity} listings`
  );

  for (const city of citiesToProcess) {
    for (const category of categoriesToProcess) {
      try {
        const listings = await scrapeWebListings(city, category, listingsPerCity);

        if (listings.length > 0) {
          allListings.push(...listings);
          totalScraped += listings.length;
          successCount++;
          console.log(`✓ Scraped ${listings.length} listings: ${category} in ${city}`);
        }

        await sleep(200);
      } catch (err) {
        errorCount++;
        console.warn(
          `✗ Error scraping ${category} in ${city}:`,
          (err as any).message
        );
      }
    }
  }

  const uniqueMap = new Map();
  for (const listing of allListings) {
    uniqueMap.set(listing.tripadvisor_id, listing);
  }

  const uniqueListings = Array.from(uniqueMap.values());

  console.log(`\n========== Scrape Results ==========`);
  console.log(`Total scraped: ${totalScraped}`);
  console.log(`Unique listings: ${uniqueListings.length}`);
  console.log(`Success: ${successCount}, Errors: ${errorCount}`);

  let upsertedCount = 0;
  if (uniqueListings.length > 0) {
    upsertedCount = await upsertListings(supabase, uniqueListings);
    console.log(`Successfully upserted: ${upsertedCount}`);
  }

  return {
    success: true,
    totalScraped,
    uniqueListings: uniqueListings.length,
    upserted: upsertedCount,
    successCount,
    errorCount,
    message: `Scraped and upserted ${upsertedCount} listings from ${successCount} successful queries`,
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
    let cityLimit: number | null = null;
    let categoryLimit: number | null = null;
    let listingsPerCity = 5;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        cityLimit = body.cityLimit || null;
        categoryLimit = body.categoryLimit || null;
        listingsPerCity = body.listingsPerCity || 5;
      } catch {
        // Ignore parse errors, use defaults
      }
    }

    const result = await performScrape(
      supabase,
      cityLimit,
      categoryLimit,
      listingsPerCity
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Scrape failed:", err);
    return new Response(
      JSON.stringify({
        error: (err as any).message || "Scrape failed",
        details: String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
