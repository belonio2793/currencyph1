#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// High-quality Unsplash image URLs for different categories
const categoryPhotos = {
  hotel: [
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde0e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1564078309788-43d530340723?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1462973481063-a0e72f347c27?w=800&h=600&fit=crop',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561404?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561404?w=800&h=600&fit=crop',
  ],
  attraction: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1488749807830-63789f68bb65?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1488581881519-e21cc028cb29?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1504681869696-d977e53dd992?w=800&h=600&fit=crop',
  ],
  beach: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&h=600&fit=crop',
  ],
  cafe: [
    'https://images.unsplash.com/photo-1554118811-1e0d58224e24?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1495474472645-4d71bcdd2085?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&h=600&fit=crop',
  ],
  default: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1488749807830-63789f68bb65?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1488581881519-e21cc028cb29?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1504681869696-d977e53dd992?w=800&h=600&fit=crop',
  ],
}

function getPhotosForCategory(category) {
  const normalized = category?.toLowerCase() || 'default'
  for (const [key, photos] of Object.entries(categoryPhotos)) {
    if (normalized.includes(key)) {
      return photos
    }
  }
  return categoryPhotos.default
}

async function updateListing(listing) {
  const photos = getPhotosForCategory(listing.category)
  
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        photo_urls: photos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listing.id)

    if (error) {
      console.log(`  ✗ ${listing.name}`)
      return false
    }

    console.log(`  ✓ ${listing.name}`)
    return true
  } catch (err) {
    console.log(`  ✗ ${listing.name}`)
    return false
  }
}

async function main() {
  console.log('📸 Adding Unsplash photos to listings...\n')

  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, category, photo_urls')
      .order('id', { ascending: true })

    if (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }

    const needPhotos = listings.filter(
      l => !Array.isArray(l.photo_urls) || l.photo_urls.length === 0
    )

    console.log(`📋 Total listings: ${listings.length}`)
    console.log(`📸 Need photos: ${needPhotos.length}\n`)

    let successful = 0
    let failed = 0

    for (let i = 0; i < needPhotos.length; i++) {
      process.stdout.write(`[${i + 1}/${needPhotos.length}] `)
      const success = await updateListing(needPhotos[i])
      if (success) successful++
      else failed++

      if ((i + 1) % 20 === 0) {
        console.log(`\n⏳ Progress: ${i + 1}/${needPhotos.length}\n`)
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('🎉 Complete!')
    console.log(`   Successfully updated: ${successful}`)
    console.log(`   Failed: ${failed}`)
    console.log('='.repeat(70))

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
