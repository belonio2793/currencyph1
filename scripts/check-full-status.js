import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function checkFullStatus() {
  console.log('���� Checking enrichment across ALL 1000 listings...\n')

  // Get all listings
  const { data: allListings } = await supabase
    .from('nearby_listings')
    .select('id, name, tripadvisor_id, photo_urls, primary_image_url, cuisine, features, tags, admission_fee, web_url')

  console.log(`📈 Total listings: ${allListings?.length || 0}`)

  if (!allListings || allListings.length === 0) {
    console.log('No listings found')
    return
  }

  // Count fields with values
  let withTripadvisorId = 0
  let withPhotoUrls = 0
  let withPrimaryImage = 0
  let withCuisine = 0
  let withFeatures = 0
  let withTags = 0
  let withAdmissionFee = 0
  let withWebUrl = 0

  const samples = {
    tripadvisorIds: [],
    photoUrls: [],
    cuisines: [],
    features: [],
    tags: [],
    admissionFees: []
  }

  allListings.forEach((listing, idx) => {
    if (listing.tripadvisor_id) withTripadvisorId++
    if (listing.photo_urls && Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0) withPhotoUrls++
    if (listing.primary_image_url) withPrimaryImage++
    if (listing.cuisine) withCuisine++
    if (listing.features && Array.isArray(listing.features) && listing.features.length > 0) withFeatures++
    if (listing.tags && Array.isArray(listing.tags) && listing.tags.length > 0) withTags++
    if (listing.admission_fee) withAdmissionFee++
    if (listing.web_url) withWebUrl++

    // Collect samples
    if (idx < 3) {
      if (listing.tripadvisor_id) samples.tripadvisorIds.push(listing.tripadvisor_id)
      if (listing.photo_urls?.[0]) samples.photoUrls.push(listing.photo_urls[0])
      if (listing.cuisine) samples.cuisines.push(listing.cuisine)
      if (listing.features?.[0]) samples.features.push(listing.features[0])
      if (listing.tags?.[0]) samples.tags.push(listing.tags[0])
      if (listing.admission_fee) samples.admissionFees.push(listing.admission_fee)
    }
  })

  const total = allListings.length
  const percent = (val) => `${Math.round((val / total) * 100)}%`

  console.log('\n✅ FIELD COMPLETION:')
  console.log(`   TripAdvisor IDs:     ${withTripadvisorId}/${total} (${percent(withTripadvisorId)})`)
  console.log(`   Photo URLs:          ${withPhotoUrls}/${total} (${percent(withPhotoUrls)})`)
  console.log(`   Primary Image:       ${withPrimaryImage}/${total} (${percent(withPrimaryImage)})`)
  console.log(`   Cuisine:             ${withCuisine}/${total} (${percent(withCuisine)})`)
  console.log(`   Features:            ${withFeatures}/${total} (${percent(withFeatures)})`)
  console.log(`   Tags:                ${withTags}/${total} (${percent(withTags)})`)
  console.log(`   Admission Fee:       ${withAdmissionFee}/${total} (${percent(withAdmissionFee)})`)
  console.log(`   Web URL:             ${withWebUrl}/${total} (${percent(withWebUrl)})`)

  // Show samples
  console.log('\n📋 SAMPLE DATA:')
  if (samples.tripadvisorIds.length > 0) console.log(`   TripAdvisor ID: ${samples.tripadvisorIds[0]}`)
  if (samples.photoUrls.length > 0) console.log(`   Photo URL: ${samples.photoUrls[0]?.slice(0, 60)}...`)
  if (samples.cuisines.length > 0) console.log(`   Cuisine: ${samples.cuisines[0]}`)
  if (samples.features.length > 0) console.log(`   Feature: ${samples.features[0]}`)
  if (samples.tags.length > 0) console.log(`   Tag: ${samples.tags[0]}`)
  if (samples.admissionFees.length > 0) console.log(`   Admission: ${samples.admissionFees[0]}`)

  // Overall completion
  const filledFields = withTripadvisorId + withPhotoUrls + withPrimaryImage + withCuisine + withFeatures + withTags + withAdmissionFee + withWebUrl
  const totalSlots = total * 8
  const overallCompletion = Math.round((filledFields / totalSlots) * 100)

  console.log(`\n📊 OVERALL COMPLETION: ${overallCompletion}%`)
  console.log('\n')
}

checkFullStatus().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
