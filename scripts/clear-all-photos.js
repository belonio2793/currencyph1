#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function main() {
  console.log('🧹 Clearing all photo_urls from database...\n')

  try {
    // Get current state
    const { data: before } = await supabase
      .from('nearby_listings')
      .select('id, photo_urls')

    const withPhotos = before.filter(l => Array.isArray(l.photo_urls) && l.photo_urls.length > 0)
    console.log(`📊 Before: ${withPhotos.length} listings have photos`)

    // Clear all
    const { error } = await supabase
      .from('nearby_listings')
      .update({ photo_urls: null })
      .neq('photo_urls', null)

    if (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }

    // Verify
    const { data: after } = await supabase
      .from('nearby_listings')
      .select('id, photo_urls')

    const withPhotosAfter = after.filter(l => Array.isArray(l.photo_urls) && l.photo_urls.length > 0)
    console.log(`📊 After: ${withPhotosAfter.length} listings have photos`)

    console.log('\n✅ All Unsplash and fallback photos have been cleared!')
    console.log('Ready to scrape real TripAdvisor photos.')

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
