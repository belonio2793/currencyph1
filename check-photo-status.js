import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkStatus() {
  // Count listings with photos
  const { data: withPhotos } = await supabase
    .from('nearby_listings')
    .select('id, name, photo_count')
    .not('photo_urls', 'is', null)
    .gt('photo_count', 0)

  // Count listings without photos
  const { data: withoutPhotos } = await supabase
    .from('nearby_listings')
    .select('id, name, web_url')
    .is('photo_urls', null)
    .limit(10)

  console.log('=== Photo Status ===\n')
  console.log(`✓ Listings WITH photos: ${withPhotos?.length || 0}`)
  console.log(`✗ Listings WITHOUT photos: Need to check total...\n`)

  if (withoutPhotos && withoutPhotos.length > 0) {
    console.log('Sample listings that need photos:')
    withoutPhotos.forEach((l, i) => {
      console.log(`${i + 1}. ${l.name}`)
      console.log(`   URL: ${l.web_url}`)
    })
  }

  // Try fetching a real listing's page to see HTML structure
  console.log('\n\nAttempting to fetch a test listing page...')
  const testUrl = 'https://www.tripadvisor.com.ph/Restaurant_Review-g298466-d11654568-Reviews-Farm_to_Table-Iloilo_City_Iloilo_Province_Panay_Island_Visayas.html'
  
  try {
    // Try with a longer timeout and custom headers
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(testUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    })

    clearTimeout(timeoutId)

    console.log(`\nResponse status: ${response.status}`)
    console.log(`Response headers:`)
    console.log(`  Content-Type: ${response.headers.get('content-type')}`)
    console.log(`  Cache-Control: ${response.headers.get('cache-control')}`)

    if (response.ok) {
      const html = await response.text()
      console.log(`\nHTML length: ${html.length} bytes`)

      // Look for dynamic-media-cdn URLs
      const matches = html.match(/https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo[^"'\s<>]*/g) || []
      console.log(`Found ${matches.length} dynamic-media-cdn URLs in HTML`)
      if (matches.length > 0) {
        console.log(`First match: ${matches[0].substring(0, 100)}...`)
      }
    } else {
      console.log(`\n✗ Status ${response.status} - Server is blocking requests`)
      console.log(`  This is likely TripAdvisor's bot detection`)
    }
  } catch (err) {
    console.log(`\n✗ Error: ${err.message}`)
  }
}

checkStatus()
