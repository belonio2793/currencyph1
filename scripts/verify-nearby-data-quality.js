#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let report = {
  totalListings: 0,
  byCities: {},
  byCategory: {},
  quality: {
    hasPhotos: 0,
    hasRating: 0,
    hasDescription: 0,
    hasAddress: 0,
    hasReviews: 0,
    complete: 0, // Has all required fields
    incomplete: 0
  },
  issues: {
    missingPhotos: [],
    missingRating: [],
    missingAddress: [],
    missingDescription: [],
    lowRating: [],
    noReviews: []
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function analyzeListings() {
  try {
    console.log('📊 Analyzing all listings...\n')

    let offset = 0
    const batchSize = 200
    let moreData = true

    while (moreData) {
      const { data: listings, error: fetchError } = await supabase
        .from('nearby_listings')
        .select('*')
        .range(offset, offset + batchSize - 1)
        .order('city', { ascending: true })

      if (fetchError) {
        console.error('Error fetching listings:', fetchError)
        break
      }

      if (!listings || listings.length === 0) {
        moreData = false
        break
      }

      for (const listing of listings) {
        analyzeListingQuality(listing)
      }

      process.stdout.write('.')
      offset += batchSize

      if (listings.length < batchSize) {
        moreData = false
      }
    }

    console.log('\n✅ Analysis complete!\n')
  } catch (err) {
    console.error('Error analyzing listings:', err)
  }
}

function analyzeListingQuality(listing) {
  report.totalListings++

  // Track by city
  const city = listing.city || 'Unknown'
  if (!report.byCities[city]) {
    report.byCities[city] = { count: 0, complete: 0, incomplete: 0 }
  }
  report.byCities[city].count++

  // Track by category
  const category = listing.category || 'Unknown'
  if (!report.byCategory[category]) {
    report.byCategory[category] = 0
  }
  report.byCategory[category]++

  // Check fields
  let isComplete = true

  if (listing.name) {
    // Good
  } else {
    isComplete = false
    if (report.issues.missingPhotos.length < 10) {
      report.issues.missingPhotos.push(listing.id)
    }
  }

  if (listing.address) {
    report.quality.hasAddress++
  } else {
    isComplete = false
    if (report.issues.missingAddress.length < 10) {
      report.issues.missingAddress.push(listing.id)
    }
  }

  if (listing.description && listing.description.length > 5) {
    report.quality.hasDescription++
  } else {
    isComplete = false
    if (report.issues.missingDescription.length < 10) {
      report.issues.missingDescription.push(listing.id)
    }
  }

  if (listing.rating && listing.rating > 0) {
    report.quality.hasRating++
    if (listing.rating < 2.0) {
      if (report.issues.lowRating.length < 10) {
        report.issues.lowRating.push({ id: listing.id, name: listing.name, rating: listing.rating })
      }
    }
  } else {
    isComplete = false
    if (report.issues.missingRating.length < 10) {
      report.issues.missingRating.push(listing.id)
    }
  }

  const photos = listing.photos || listing.photo_urls || []
  if (Array.isArray(photos) && photos.length > 0) {
    report.quality.hasPhotos++
  } else {
    if (report.issues.missingPhotos.length < 20) {
      report.issues.missingPhotos.push(listing.id)
    }
  }

  if (listing.review_count && listing.review_count > 0) {
    report.quality.hasReviews++
  } else {
    if (report.issues.noReviews.length < 10) {
      report.issues.noReviews.push(listing.id)
    }
  }

  if (isComplete) {
    report.quality.complete++
    report.byCities[city].complete++
  } else {
    report.quality.incomplete++
    report.byCities[city].incomplete++
  }
}

async function main() {
  try {
    console.log('🔍 Verifying Nearby Listings Data Quality')
    console.log('═══════════════════════════════════════════════════════════════\n')

    await analyzeListings()

    // Generate report
    const photoPercentage = ((report.quality.hasPhotos / report.totalListings) * 100).toFixed(1)
    const ratingPercentage = ((report.quality.hasRating / report.totalListings) * 100).toFixed(1)
    const completePercentage = ((report.quality.complete / report.totalListings) * 100).toFixed(1)

    console.log('📈 OVERALL STATISTICS')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Total listings: ${report.totalListings}`)
    console.log(`Cities covered: ${Object.keys(report.byCities).length}`)
    console.log(`Categories: ${Object.keys(report.byCategory).length}`)

    console.log('\n🖼️  PHOTO QUALITY')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Listings with photos: ${report.quality.hasPhotos} (${photoPercentage}%)`)
    console.log(`Listings missing photos: ${report.totalListings - report.quality.hasPhotos}`)

    console.log('\n⭐ RATING & REVIEWS')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Listings with ratings: ${report.quality.hasRating} (${ratingPercentage}%)`)
    console.log(`Listings with reviews: ${report.quality.hasReviews}`)
    console.log(`Listings missing ratings: ${report.totalListings - report.quality.hasRating}`)

    console.log('\n📝 CONTENT QUALITY')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Listings with descriptions: ${report.quality.hasDescription}`)
    console.log(`Listings with addresses: ${report.quality.hasAddress}`)
    console.log(`Complete listings: ${report.quality.complete} (${completePercentage}%)`)
    console.log(`Incomplete listings: ${report.quality.incomplete}`)

    console.log('\n📊 BY CATEGORY')
    console.log('═══════════════════════════════════════════════════════════════')
    Object.entries(report.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`)
      })

    console.log('\n🏙️  TOP 10 CITIES')
    console.log('═══════════════════════════════════════════════════════════════')
    Object.entries(report.byCities)
      .map(([city, data]) => ({ city, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach(city => {
        const percentage = ((city.complete / city.count) * 100).toFixed(0)
        console.log(`  ${city.city}: ${city.count} listings (${percentage}% complete)`)
      })

    if (report.issues.missingPhotos.length > 0) {
      console.log('\n📷 SAMPLE LISTINGS MISSING PHOTOS')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log(`(Showing first ${Math.min(5, report.issues.missingPhotos.length)})`)
      report.issues.missingPhotos.slice(0, 5).forEach(id => {
        console.log(`  - ID: ${id}`)
      })
    }

    console.log('\n\n✅ VERIFICATION COMPLETE')
    console.log('═══════════════════════════════════════════════════════════════')

    if (completePercentage >= 80) {
      console.log('🎉 Excellent data quality!')
    } else if (completePercentage >= 60) {
      console.log('👍 Good data quality with room for improvement')
    } else {
      console.log('⚠️  Data quality needs improvement')
    }
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main().then(() => {
  process.exit(0)
})
