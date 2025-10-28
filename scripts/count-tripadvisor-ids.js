import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase PROJECT_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function main() {
  const { count: withId } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: false }).not('tripadvisor_id', 'is', null)
  const { count: total } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: false })
  console.log('Listings with tripadvisor_id:', withId)
  console.log('Total listings:', total)
}

main().catch(err => { console.error(err); process.exit(1) })
