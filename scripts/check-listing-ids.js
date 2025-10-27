import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(PROJECT_URL, ANON_KEY)

async function check() {
  const { data } = await supabase
    .from('nearby_listings')
    .select('tripadvisor_id, name, raw, photo_count')
    .limit(5)

  data?.forEach(l => {
    console.log('\n' + '='.repeat(60))
    console.log(`Name: ${l.name}`)
    console.log(`tripadvisor_id: ${l.tripadvisor_id}`)
    console.log(`photo_count: ${l.photo_count}`)
    if (l.raw) {
      console.log(`raw.location_id: ${l.raw?.location_id}`)
      console.log(`raw.web_url: ${l.raw?.web_url}`)
    }
  })
}

check()
