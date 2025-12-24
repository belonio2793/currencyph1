#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORRUPTED_CHAR = '\ufffd' // Unicode replacement character (�)

let stats = {
  total: 0,
  cleaned: 0,
  errors: 0,
  fieldsFixed: {}
}

async function cleanListings() {
  try {
    console.log('🔍 Fetching all listings...')
    const { data: listings, error: fetchError } = await supabase
      .from('nearby_listings')
      .select('*')
      .limit(5000)

    if (fetchError) {
      console.error('❌ Error fetching listings:', fetchError)
      return
    }

    if (!listings || listings.length === 0) {
      console.log('✅ No listings found')
      return
    }

    console.log(`📊 Found ${listings.length} listings`)
    stats.total = listings.length

    // Process in batches to avoid timeout
    const batchSize = 50
    for (let i = 0; i < listings.length; i += batchSize) {
      const batch = listings.slice(i, i + batchSize)
      
      const updates = []

      for (const listing of batch) {
        let hasCorruption = false
        const cleaned = {}

        // Check all string fields for corrupted characters
        for (const [key, value] of Object.entries(listing)) {
          if (typeof value === 'string' && value.includes(CORRUPTED_CHAR)) {
            hasCorruption = true
            const cleanedValue = value.replace(new RegExp(CORRUPTED_CHAR, 'g'), '')
            cleaned[key] = cleanedValue

            // Track which fields were fixed
            if (!stats.fieldsFixed[key]) {
              stats.fieldsFixed[key] = 0
            }
            stats.fieldsFixed[key]++
          } else {
            cleaned[key] = value
          }
        }

        if (hasCorruption) {
          stats.cleaned++
          updates.push(cleaned)
        }
      }

      // Batch update
      if (updates.length > 0) {
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('nearby_listings')
            .update(update)
            .eq('id', update.id)

          if (updateError) {
            console.error(`❌ Error updating listing ${update.id}:`, updateError)
            stats.errors++
          }
        }
        console.log(`✅ Cleaned batch ${Math.ceil((i + batchSize) / batchSize)} (${Math.min(i + batchSize, listings.length)}/${listings.length})`)
      }
    }

    // Report
    console.log('\n📋 CLEANUP REPORT')
    console.log('═══════════════════════════')
    console.log(`Total listings scanned: ${stats.total}`)
    console.log(`Listings cleaned: ${stats.cleaned}`)
    console.log(`Errors: ${stats.errors}`)
    console.log(`\n📝 Fields affected:`)
    for (const [field, count] of Object.entries(stats.fieldsFixed)) {
      console.log(`  • ${field}: ${count} instances`)
    }

  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

console.log('🧹 Cleaning corrupted characters from nearby_listings...')
cleanListings().then(() => {
  console.log('\n✅ Cleanup complete!')
  process.exit(0)
})
