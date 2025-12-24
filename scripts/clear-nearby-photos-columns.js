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
  total: 0,
  cleared: 0,
  errors: 0
}

async function clearPhotos() {
  try {
    console.log('🧹 Clearing photo columns from nearby_listings...\n')

    // Get total count first
    const { count: totalCount } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true })

    console.log(`📊 Total listings: ${totalCount}\n`)

    // Clear photo columns in batches
    const batchSize = 100
    let offset = 0
    let totalCleared = 0

    while (offset < (totalCount || 0)) {
      // Get batch of IDs
      const { data: batch, error: fetchError } = await supabase
        .from('nearby_listings')
        .select('id')
        .range(offset, offset + batchSize - 1)

      if (fetchError) {
        console.error('❌ Error fetching batch:', fetchError)
        stats.errors++
        break
      }

      if (!batch || batch.length === 0) break

      // Clear photo columns for this batch
      const ids = batch.map(b => b.id)

      const { error: updateError } = await supabase
        .from('nearby_listings')
        .update({
          photo_urls: null,
          image_urls: null,
          photo_count: 0,
          image_url: null,
          featured_image_url: null,
          primary_image_url: null,
          stored_image_path: null,
          image_downloaded_at: null,
          updated_at: new Date().toISOString()
        })
        .in('id', ids)

      if (updateError) {
        console.error(`❌ Error updating batch at offset ${offset}:`, updateError)
        stats.errors++
      } else {
        totalCleared += batch.length
        const progress = Math.min(offset + batchSize, totalCount)
        console.log(`✅ Cleared ${progress}/${totalCount} listings`)
      }

      offset += batchSize
    }

    stats.cleared = totalCleared

    // Verify
    const { data: verify } = await supabase
      .from('nearby_listings')
      .select('id')
      .not('photo_urls', 'is', null)
      .limit(1)

    const hasRemainingPhotos = verify && verify.length > 0

    console.log('\n📋 REPORT')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`Listings processed: ${stats.cleared}`)
    console.log(`Errors: ${stats.errors}`)
    console.log(`Remaining listings with photo_urls: ${hasRemainingPhotos ? '⚠️  Some remain' : '✅ None'}`)
    console.log('\nCleared columns:')
    console.log('  • photo_urls')
    console.log('  • image_urls')
    console.log('  • photo_count')
    console.log('  • image_url')
    console.log('  • featured_image_url')
    console.log('  • primary_image_url')
    console.log('  • stored_image_path')
    console.log('  • image_downloaded_at')

  } catch (err) {
    console.error('❌ Fatal error:', err.message)
    stats.errors++
  }
}

console.log('🚀 Starting photo columns cleanup...\n')
clearPhotos().then(() => {
  if (stats.errors === 0) {
    console.log('\n✅ Success! All photo columns have been cleared.')
    process.exit(0)
  } else {
    console.log('\n⚠️  Cleanup completed with some errors.')
    process.exit(1)
  }
}).catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
