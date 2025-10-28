import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const xaiKey = Deno.env.get('X_API_KEY')

const SCRAPINGBEE_KEYS = [
  'Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9',
  'OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS',
  'IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP',
  'DHOMQK5VZOIUQN9JJZHFR3WX07XFGTFFYFVCRM6AOLZFGI5S9Z60R23AQM2LUL84M2SNK4HH9NGMVDCG'
]

const MAX_PHOTOS = 20
let keyIndex = 0

interface Listing {
  id: number
  name: string
  city: string
  web_url: string
  photo_urls?: string[]
}

interface ProcessResult {
  id: number
  status: string
  count?: number
  error?: string
}

function getNextKey() {
  const key = SCRAPINGBEE_KEYS[keyIndex]
  keyIndex = (keyIndex + 1) % SCRAPINGBEE_KEYS.length
  return key
}

function extractPhotoUrlsFromHTML(html: string): string[] {
  const photoUrls = new Set<string>()

  // Dynamic media CDN pattern (preferred)
  const dynamicPattern = /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo[a-zA-Z0-9\-_\/]*(?:\.jpg|\.png|\.webp)?/g
  const dynamicMatches = html.match(dynamicPattern) || []
  dynamicMatches.forEach(url => {
    const cleaned = url.split(/['"?]/)[0].trim()
    if (cleaned && cleaned.startsWith('https://dynamic-media-cdn.tripadvisor.com')) {
      const baseUrl = cleaned.split('?')[0].split('#')[0]
      if (baseUrl && !baseUrl.includes('placeholder') && !baseUrl.includes('logo')) {
        photoUrls.add(baseUrl)
      }
    }
  })

  // Media tacdn pattern (backup)
  const mediaPattern = /https:\/\/media\.tacdn\.com\/media\/photo[a-zA-Z0-9\-_\/]*(?:\.jpg|\.png|\.webp)?/g
  const mediaMatches = html.match(mediaPattern) || []
  mediaMatches.forEach(url => {
    const cleaned = url.split(/['"?]/)[0].trim()
    if (cleaned && cleaned.startsWith('https://media.tacdn.com')) {
      const baseUrl = cleaned.split('?')[0].split('#')[0]
      if (baseUrl && !baseUrl.includes('placeholder') && !baseUrl.includes('logo')) {
        photoUrls.add(baseUrl)
      }
    }
  })

  return Array.from(photoUrls).slice(0, MAX_PHOTOS)
}

async function fetchTripAdvisorPage(url: string): Promise<string | null> {
  try {
    const key = getNextKey()
    const params = new URLSearchParams({
      api_key: key,
      url: url,
      render_js: 'false',
      timeout: '15000'
    })

    const response = await fetch(`https://api.scrapingbee.com/api/v1/?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.error(`ScrapingBee error: ${response.status}`)
      return null
    }

    return await response.text()
  } catch (error) {
    console.error('Fetch error:', error)
    return null
  }
}

async function grokAnalyzePhotos(listingName: string, html: string): Promise<string[]> {
  try {
    const prompt = `You are analyzing a TripAdvisor listing page for "${listingName}".
    
The HTML content is below. Extract ALL photo URLs that match these patterns:
1. https://dynamic-media-cdn.tripadvisor.com/media/photo...
2. https://media.tacdn.com/media/photo...

Return ONLY a JSON array of valid HTTPS URLs, nothing else. Example:
["https://dynamic-media-cdn.tripadvisor.com/media/photo-s/...", "https://media.tacdn.com/media/photo-..."]

Exclude placeholders, logos, and non-image URLs.

HTML Content (first 50000 chars):
${html.substring(0, 50000)}

Return only the JSON array of photo URLs, no other text.`

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${xaiKey}`
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096
      })
    })

    if (!response.ok) {
      console.error(`Grok error: ${response.status}`)
      return []
    }

    const data = await response.json() as any
    const content = data.choices?.[0]?.message?.content || ''
    
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return []
    }

    const urls = JSON.parse(jsonMatch[0]) as string[]
    return Array.isArray(urls)
      ? urls
          .filter(url => typeof url === 'string' && url.startsWith('https://'))
          .filter(url => !url.includes('placeholder') && !url.includes('logo'))
          .slice(0, MAX_PHOTOS)
      : []
  } catch (error) {
    console.error('Grok error:', error)
    return []
  }
}

async function processListing(supabase: any, listing: Listing): Promise<ProcessResult> {
  if (!listing.web_url) {
    return { id: listing.id, status: 'no-url' }
  }

  // Skip if already has photos
  if (listing.photo_urls && Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0) {
    return { id: listing.id, status: 'skip' }
  }

  try {
    // Fetch HTML
    const html = await fetchTripAdvisorPage(listing.web_url)
    if (!html) {
      return { id: listing.id, status: 'fetch-error' }
    }

    // Try Grok first
    let photos = await grokAnalyzePhotos(listing.name, html)
    
    // Fallback to regex
    if (photos.length === 0) {
      photos = extractPhotoUrlsFromHTML(html)
    }

    if (photos.length === 0) {
      return { id: listing.id, status: 'no-photos' }
    }

    // Update database
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photos,
        photo_count: photos.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', listing.id)

    if (error) {
      return { id: listing.id, status: 'db-error', error: error.message }
    }

    return { id: listing.id, status: 'updated', count: photos.length }
  } catch (error) {
    return { id: listing.id, status: 'error', error: String(error) }
  }
}

Deno.serve(async (req) => {
  if (!supabaseUrl || !supabaseKey || !xaiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing environment variables' }),
      { status: 500 }
    )
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get query parameters
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Fetch listings without photos
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url, photo_urls')
      .or('photo_urls.is.null,photo_urls.eq.{}')
      .not('web_url', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      )
    }

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No listings to process', processed: 0 }),
        { status: 200 }
      )
    }

    // Process each listing
    const results: ProcessResult[] = []
    for (const listing of listings) {
      const result = await processListing(supabase, listing)
      results.push(result)
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Calculate stats
    const stats = {
      total: results.length,
      updated: results.filter(r => r.status === 'updated').length,
      skipped: results.filter(r => r.status === 'skip').length,
      noPhotos: results.filter(r => r.status === 'no-photos').length,
      errors: results.filter(r => r.status === 'error' || r.status === 'fetch-error').length
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        results,
        message: `Processed ${stats.total} listings. Updated: ${stats.updated}, Skipped: ${stats.skipped}, Failed: ${stats.errors}`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500 }
    )
  }
})
