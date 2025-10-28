#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!PROJECT_URL || !SERVICE_ROLE_KEY) { console.error('Missing env'); process.exit(1) }
const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function main(){
  const { data, error } = await supabase.from('nearby_listings').select('id, tripadvisor_id, image_url, stored_image_path').limit(1000)
  if (error) { console.error(error); process.exit(1) }
  const total = data.length
  const numeric = data.filter(l => l.tripadvisor_id && /^\d+$/.test(String(l.tripadvisor_id))).length
  const nonNumeric = total - numeric
  const withImage = data.filter(l => l.image_url || l.stored_image_path).length
  console.log({ total, numeric, nonNumeric, withImage })
}

main()
