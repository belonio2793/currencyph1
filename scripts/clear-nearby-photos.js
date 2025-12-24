#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let stats = {
  totalListings: 0,
  cleared: 0,
  errors: 0
}

async function clearPhotos() {
  try {
    console.log('🧹 Clearing photos column from nearby_listings...\n')

    // Update all listings - set photos to NULL
    const { error: updateError, data: response } = await supabase
      .from('nearby_listings')
      .update({
        photos: null,
        photo_count: 0,
        updated_at: new Date().toISOString()
      })
      .not('id', 'is', null)
      .select('id')

    if (updateError) {
      console.error('❌ Error clearing photos:', updateError)
      stats.errors++
    } else {
      // Count how many were updated
      const { data: allListings, error: countError } = await supabase
        .from('nearby_listings')
        .select('id', { count: 'exact' })
        .limit(1)

      if (!countError) {
        stats.cleared = response?.length || 0

        // Verify the clear
        const { data: verify, error: verifyError } = await supabase
          .from('nearby_listings')
          .select('id')
          .not('photos', 'is', null)
          .limit(1)

        const hasRemainingPhotos = verify && verify.length > 0

        console.log('✅ Photos column cleared!')
        console.log(`\n📊 REPORT`)
        console.log('═══════════════════════════════════')
        console.log(`Total listings in database: ${response?.length || 'unknown'}`)
        console.log(`Listings with photos cleared: ${stats.cleared}`)
        console.log(`Remaining listings with photos: ${hasRemainingPhotos ? 'Some' : 'None'}`)
        console.log(`Errors: ${stats.errors}`)
      }
    }
  } catch (err) {
    console.error('❌ Fatal error:', err.message)
    stats.errors++
  }
}

console.log('Starting cleanup...\n')
clearPhotos().then(() => {
  if (stats.errors === 0) {
    console.log('\n✅ Success! Photos column has been cleared.')
    process.exit(0)
  } else {
    console.log('\n❌ Cleanup completed with errors.')
    process.exit(1)
  }
}).catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
