#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!PROJECT_URL || !SERVICE_ROLE_KEY) { console.error('Missing env'); process.exit(1) }
const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function main(){
  const { count, error, data } = await supabase
    .from('nearby_listings')
    .select('id, tripadvisor_id, name, city', { count: 'exact' })

  if (error) { console.error(error); process.exit(1) }
  const nonNumeric = (data || []).filter(l => !l.tripadvisor_id || !/^\d+$/.test(String(l.tripadvisor_id)))
  console.log('Total rows fetched:', data.length)
  console.log('Non-numeric tripadvisor_id count (in fetched set):', nonNumeric.length)
  console.log('Sample non-numeric:')
  nonNumeric.slice(0,20).forEach(l => console.log(l.id, l.tripadvisor_id, l.name, l.city))
}

main()
