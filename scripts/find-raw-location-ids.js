#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!PROJECT_URL || !SERVICE_ROLE_KEY) { console.error('Missing env'); process.exit(1) }
const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function main(){
  const { data, error } = await supabase.from('nearby_listings').select('id, tripadvisor_id, name, raw').limit(2000)
  if (error) { console.error(error); process.exit(1) }
  const withLocation = (data||[]).filter(l => l.raw && (l.raw.location_id || l.raw.locationId || l.raw.location))
  console.log('rows fetched:', data.length)
  console.log('with raw location_id count:', withLocation.length)
  console.log('sample:')
  console.log(JSON.stringify(withLocation.slice(0,20), null, 2))
}

main()
