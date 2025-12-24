#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function checkColumns() {
  try {
    console.log('🔍 Checking nearby_listings table structure...\n')

    // Fetch a single record to see all available columns
    const { data: sample, error: sampleError } = await supabase
      .from('nearby_listings')
      .select('*')
      .limit(1)

    if (sampleError) {
      console.error('❌ Error fetching sample:', sampleError)
      return
    }

    if (!sample || sample.length === 0) {
      console.log('❌ No listings found in table')
      return
    }

    const listing = sample[0]
    console.log('📋 Columns in nearby_listings table:')
    console.log('═══════════════════════════════════════════════')

    const columns = Object.keys(listing).sort()
    columns.forEach((col, idx) => {
      const value = listing[col]
      const type = Array.isArray(value) ? 'array' : typeof value
      const isNull = value === null ? ' (NULL)' : ''
      console.log(`${(idx + 1).toString().padStart(2, ' ')}. ${col.padEnd(30)} [${type}]${isNull}`)
    })

    // Check for photo-related columns
    console.log('\n🖼️  Photo-related columns:')
    console.log('═══════════════════════════════════════════════')
    const photoColumns = columns.filter(col =>
      col.toLowerCase().includes('photo') ||
      col.toLowerCase().includes('image') ||
      col.toLowerCase().includes('media') ||
      col.toLowerCase().includes('picture')
    )

    if (photoColumns.length === 0) {
      console.log('⚠️  No photo-related columns found')
    } else {
      photoColumns.forEach(col => {
        const value = listing[col]
        console.log(`✓ ${col}`)
        if (Array.isArray(value)) {
          console.log(`  Type: Array, Items: ${value.length}`)
          if (value.length > 0) console.log(`  Sample: ${value[0].substring(0, 60)}...`)
        } else if (typeof value === 'string') {
          console.log(`  Type: String, Length: ${value.length}`)
        } else if (value === null) {
          console.log(`  Type: NULL`)
        } else {
          console.log(`  Type: ${typeof value}`)
        }
      })
    }

  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

checkColumns().then(() => {
  process.exit(0)
})
