import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkAnyPhotos() {
  // Check listings where photo_urls is not null
  const { data: withUrls, error: err1 } = await supabase
    .from('nearby_listings')
    .select('id, name, slug, photo_urls, photo_count')
    .not('photo_urls', 'is', null)
    .limit(5)

  if (err1) {
    console.error('Error:', err1)
    return
  }

  console.log(`Found ${withUrls.length} listings with photo_urls (not null)`)
  
  if (withUrls.length > 0) {
    withUrls.forEach((listing, i) => {
      console.log(`\n[${i + 1}] ${listing.name}`)
      console.log(`  - Type: ${typeof listing.photo_urls}`)
      console.log(`  - Is Array: ${Array.isArray(listing.photo_urls)}`)
      if (Array.isArray(listing.photo_urls)) {
        console.log(`  - Length: ${listing.photo_urls.length}`)
        console.log(`  - First URL: ${listing.photo_urls[0]}`)
      } else if (typeof listing.photo_urls === 'string') {
        console.log(`  - String length: ${listing.photo_urls.length}`)
        console.log(`  - First 100 chars: ${listing.photo_urls.substring(0, 100)}`)
      }
    })
  } else {
    console.log('\n⚠️ NO listings have photo_urls populated!')
    
    // Check how many have photo_count > 0
    const { data: withCount } = await supabase
      .from('nearby_listings')
      .select('id, name, photo_count, photo_urls')
      .gt('photo_count', 0)
      .limit(5)
    
    if (withCount && withCount.length > 0) {
      console.log(`\nFound ${withCount.length} listings with photo_count > 0:`)
      withCount.forEach((l, i) => {
        console.log(`[${i + 1}] ${l.name} - photo_count: ${l.photo_count}, photo_urls: ${l.photo_urls}`)
      })
    }
  }
}

checkAnyPhotos()
