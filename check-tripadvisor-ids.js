import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkIds() {
  const { data } = await supabase
    .from('nearby_listings')
    .select('id, name, tripadvisor_id, web_url')
    .not('tripadvisor_id', 'is', null)
    .limit(10)

  console.log('Listings with tripadvisor_id:')
  data.forEach((l, i) => {
    console.log(`\n[${i + 1}] ${l.name}`)
    console.log(`  - ID: ${l.tripadvisor_id}`)
    console.log(`  - URL: ${l.web_url}`)
  })

  // Check web_url too
  const { data: withUrls } = await supabase
    .from('nearby_listings')
    .select('id, name, web_url')
    .not('web_url', 'is', null)
    .limit(5)

  console.log('\n\nListings with web_url:')
  withUrls.forEach((l, i) => {
    console.log(`[${i + 1}] ${l.name}`)
    console.log(`  - ${l.web_url}`)
  })
}

checkIds()
