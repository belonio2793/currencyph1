#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing PROJECT_URL or SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function main() {
  try {
    // Get all listings with photo_urls
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, slug, name, city, photo_urls, photo_count')
      .order('id', { ascending: true })

    if (error) {
      console.error('Error fetching listings:', error)
      process.exit(1)
    }

    // Filter listings that have photos
    const withPhotos = listings.filter(l => Array.isArray(l.photo_urls) && l.photo_urls.length > 0)
    const withoutPhotos = listings.filter(l => !Array.isArray(l.photo_urls) || l.photo_urls.length === 0)

    console.log('\n📊 PHOTO SUMMARY')
    console.log('='.repeat(80))
    console.log(`Total listings: ${listings.length}`)
    console.log(`Listings WITH photos: ${withPhotos.length} (${Math.round((withPhotos.length / listings.length) * 100)}%)`)
    console.log(`Listings WITHOUT photos: ${withoutPhotos.length}`)

    if (withPhotos.length > 0) {
      console.log('\n' + '='.repeat(80))
      console.log('📸 LISTINGS WITH PHOTOS:')
      console.log('='.repeat(80))

      withPhotos.forEach((listing, idx) => {
        const photoCount = Array.isArray(listing.photo_urls) ? listing.photo_urls.length : 0
        console.log(`\n${idx + 1}. ${listing.name}`)
        console.log(`   City: ${listing.city}`)
        console.log(`   Slug: ${listing.slug}`)
        console.log(`   Photos: ${photoCount}`)
        console.log(`   URL: /nearby/${listing.slug}`)
        if (listing.photo_urls && listing.photo_urls.length > 0) {
          console.log(`   First photo: ${listing.photo_urls[0].substring(0, 80)}...`)
        }
      })
    } else {
      console.log('\n⚠️  No listings with photos found!')
    }

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
