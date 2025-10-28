import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TRIPADVISOR_API_KEY = Deno.env.get('VITE_TRIPADVISOR') || Deno.env.get('TRIPADVISOR_API_KEY')

function generateSlug(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extractPhotoUrls(data: any): string[] {
  const urls: string[] = []
  if (data.photos && Array.isArray(data.photos)) {
    for (const photo of data.photos.slice(0, 20)) {
      if (photo.images?.large?.url) urls.push(photo.images.large.url)
      else if (photo.images?.original?.url) urls.push(photo.images.original.url)
    }
  }
  if (data.photo?.images?.large?.url) urls.unshift(data.photo.images.large.url)
  return urls.filter((url, idx, arr) => arr.indexOf(url) === idx).slice(0, 50)
}

function extractHours(data: any): Record<string, string> {
  if (!data.hours) return {}
  const hours: Record<string, string> = {}
  const dayMap: Record<number, string> = { 0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday' }
  if (Array.isArray(data.hours)) {
    for (const entry of data.hours) {
      const day = dayMap[entry.day]
      if (day && entry.open_time && entry.close_time) hours[day] = `${entry.open_time} - ${entry.close_time}`
    }
  }
  return hours
}

function formatListingData(rawData: any): any {
  if (!rawData) return null

  return {
    tripadvisor_id: String(rawData.location_id ?? `php_${Math.random().toString(36).slice(2,10)}`),
    name: rawData.name || '',
    slug: generateSlug(rawData.name || ''),
    description: rawData.description || rawData.overview || '',
    address: rawData.address || rawData.address_string || '',
    latitude: rawData.latitude || rawData.address_obj?.latitude || null,
    longitude: rawData.longitude || rawData.address_obj?.longitude || null,
    rating: rawData.rating ? Number(rawData.rating) : null,
    review_count: rawData.num_reviews || rawData.review_count || 0,
    category: rawData.subcategory || rawData.category?.name || rawData.type || '',
    location_type: rawData.location_type || rawData.type || '',
    phone_number: rawData.phone || rawData.telephone || null,
    website: rawData.website || rawData.web_url || null,
    web_url: rawData.web_url || null,
    image_url: rawData.photo?.images?.large?.url || rawData.image_url || null,
    featured_image_url: rawData.photo?.images?.original?.url || rawData.featured_image || null,
    photo_count: rawData.num_photos || 0,
    photo_urls: extractPhotoUrls(rawData),
    hours_of_operation: extractHours(rawData),
    admission_fee: rawData.admission || rawData.price_range || null,
    price_level: rawData.price_level || null,
    amenities: rawData.amenities || [],
    accessibility_info: { wheelchair_accessible: rawData.is_wheelchair_accessible || null },
    awards: rawData.awards || [],
    ranking_in_city: rawData.ranking?.ranking || null,
    source: 'tripadvisor',
    verified: true,
    last_verified_at: new Date().toISOString(),
    raw: rawData
  }
}

async function fetchListingDetails(locationId: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.tripadvisor.com/api/partner/2.0/location/${locationId}/details?language=en`,
      {
        headers: {
          'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY!,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.warn(`TripAdvisor API error for ${locationId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    return formatListingData(data)
  } catch (err) {
    console.error(`Error fetching details for ${locationId}:`, err.message)
    return null
  }
}

async function searchCity(city: string, limit: number = 20): Promise<any[]> {
  try {
    const params = new URLSearchParams()
    params.append('query', `${city} Philippines`)
    params.append('limit', String(Math.min(limit, 30)))

    const response = await fetch(
      `https://api.tripadvisor.com/api/partner/2.0/locations/search?${params.toString()}`,
      {
        headers: {
          'X-TripAdvisor-API-Key': TRIPADVISOR_API_KEY!,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      }
    )

    if (!response.ok) {
      console.warn(`Search error for ${city}: ${response.status}`)
      return []
    }

    const data = await response.json()
    const items = data.data || []

    const listings = []
    for (const item of items) {
      if (!item.location_id) continue
      
      const detailed = await fetchListingDetails(String(item.location_id))
      if (detailed) {
        listings.push(detailed)
      }
      await new Promise(r => setTimeout(r, 600))
    }

    return listings
  } catch (err) {
    console.error(`Error searching ${city}:`, err.message)
    return []
  }
}

async function saveListings(supabase: any, listings: any[]): Promise<any> {
  if (!listings || listings.length === 0) {
    return { success: false, message: 'No listings to save' }
  }

  try {
    const chunkSize = 10

    for (let i = 0; i < listings.length; i += chunkSize) {
      const chunk = listings.slice(i, i + chunkSize)

      const { error } = await supabase
        .from('nearby_listings')
        .upsert(chunk, { onConflict: 'tripadvisor_id' })

      if (error) {
        console.error(`Error saving batch ${i}-${i + chunkSize}:`, error)
        continue
      }

      await new Promise(r => setTimeout(r, 300))
    }

    return {
      success: true,
      saved: listings.length,
      message: `Saved ${listings.length} listings`
    }
  } catch (err) {
    console.error('Error saving listings:', err)
    return {
      success: false,
      message: err.message,
      saved: 0
    }
  }
}

const PHILIPPINES_CITIES = [
  'Manila', 'Cebu', 'Davao', 'Quezon City', 'Makati', 'Baguio', 'Boracay',
  'Puerto Princesa', 'Iloilo', 'Pasig', 'Taguig', 'Parañaque', 'Bacoor',
  'Cavite City', 'Imus', 'Dasmariñas', 'Tagaytay', 'Batangas City', 'Lipa',
  'Calamba', 'Santa Rosa', 'Antipolo', 'Marikina', 'Mandaluyong', 'San Juan',
  'Malabon', 'Navotas', 'Caloocan', 'Valenzuela', 'Angeles City', 'San Fernando',
  'Tarlac', 'Cabanatuan', 'Nueva Ecija', 'Baler', 'Vigan', 'Ilocos',
  'Dagupan', 'Lingayen', 'Urdaneta', 'Dumaguete', 'Negros Oriental', 'Siquijor',
  'Tacloban', 'Leyte', 'Samar', 'Biliran', 'Coron', 'El Nido', 'Roxas',
  'Cagayan de Oro', 'Misamis Oriental', 'Iligan', 'Marawi', 'Zamboanga',
  'Basilan', 'Sulu', 'Koronadal', 'General Santos', 'Sipalay', 'San Carlos'
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!TRIPADVISOR_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'TRIPADVISOR_API_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const allListings = []
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < PHILIPPINES_CITIES.length; i++) {
      const city = PHILIPPINES_CITIES[i]

      try {
        const listings = await searchCity(city, 20)

        if (listings.length > 0) {
          allListings.push(...listings)
          successCount++
        }
      } catch (err) {
        console.error(`Error with ${city}:`, err.message)
        errorCount++
      }

      await new Promise(r => setTimeout(r, 800))
    }

    // Deduplicate
    const deduped: Record<string, any> = {}
    for (const listing of allListings) {
      deduped[listing.tripadvisor_id] = listing
    }
    const unique = Object.values(deduped)

    // Save to database
    const saveResult = await saveListings(supabase, unique)

    return new Response(
      JSON.stringify({
        success: saveResult.success,
        totalFetched: allListings.length,
        uniqueListings: unique.length,
        saved: saveResult.saved || 0,
        successCount,
        errorCount,
        message: saveResult.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: saveResult.success ? 200 : 500
      }
    )
  } catch (err) {
    console.error('Error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
