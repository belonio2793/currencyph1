#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function main() {
  const { data: listings } = await supabase
    .from('nearby_listings')
    .select('id, name, city, photo_urls')
    .order('id', { ascending: true })

  const withPhotos = listings.filter(l => Array.isArray(l.photo_urls) && l.photo_urls.length > 0)
  const withoutPhotos = listings.filter(l => !Array.isArray(l.photo_urls) || l.photo_urls.length === 0)

  console.log(`✅ Listings WITH photos: ${withPhotos.length} / ${listings.length}`)
  console.log(`❌ Listings WITHOUT photos: ${withoutPhotos.length}`)
  console.log(`Progress: ${Math.round((withPhotos.length / listings.length) * 100)}%`)
  
  process.exit(0)
}

main()
