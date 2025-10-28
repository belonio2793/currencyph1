#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!PROJECT_URL || !SERVICE_ROLE_KEY) { console.error('Missing env'); process.exit(1) }
const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function main(){
  const slug = process.argv[2]
  if (!slug) { console.error('Usage: node scripts/show-listing-by-slug.js <slug>'); process.exit(1) }
  const { data, error } = await supabase.from('nearby_listings').select('*').eq('slug', slug).limit(1).maybeSingle()
  if (error) { console.error(error); process.exit(1) }
  console.log(JSON.stringify(data, null, 2))
}

main()
