import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

async function testConstraints() {
  console.log('Testing photo_urls column...\n')

  // Test 1: Check current state
  console.log('Test 1: Fetch a listing with photo_urls')
  const { data: listing, error: fetchErr } = await supabase
    .from('nearby_listings')
    .select('id, name, photo_urls, photo_count')
    .eq('id', 19)
    .single()

  if (fetchErr) {
    console.error('  ✗ Fetch error:', fetchErr.message)
    return
  }

  console.log(`  ✓ Found: ${listing.name}`)
  console.log(`  - photo_urls type: ${typeof listing.photo_urls}`)
  console.log(`  - photo_urls is null: ${listing.photo_urls === null}`)
  if (Array.isArray(listing.photo_urls)) {
    console.log(`  - photo_urls length: ${listing.photo_urls.length}`)
  }

  // Test 2: Try updating with empty array
  console.log('\nTest 2: Update with empty array')
  const { error: updateErr1 } = await supabase
    .from('nearby_listings')
    .update({ photo_urls: [] })
    .eq('id', 19)

  if (updateErr1) {
    console.error('  ✗ Error:', updateErr1.message)
  } else {
    console.log('  ✓ Successfully updated with empty array')
  }

  // Test 3: Try updating with test photo URLs
  console.log('\nTest 3: Update with test photo URLs')
  const testUrls = [
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/bb/89/52/test1.jpg',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/2b/cc/9a/63/test2.jpg'
  ]

  const { error: updateErr2 } = await supabase
    .from('nearby_listings')
    .update({ photo_urls: testUrls })
    .eq('id', 19)

  if (updateErr2) {
    console.error('  ✗ Error:', updateErr2.message)
  } else {
    console.log('  ✓ Successfully updated with test URLs')

    // Verify it was saved
    const { data: updated } = await supabase
      .from('nearby_listings')
      .select('photo_urls')
      .eq('id', 19)
      .single()

    if (updated && Array.isArray(updated.photo_urls)) {
      console.log(`  ✓ Verified: ${updated.photo_urls.length} URLs saved`)
      console.log(`    - First URL: ${updated.photo_urls[0]}`)
    }
  }

  // Test 4: Check RLS policies
  console.log('\nTest 4: Check if this is an RLS (Row Level Security) issue')
  console.log('  (Service role key should bypass RLS)')

  // Test 5: Try with a large array
  console.log('\nTest 5: Update with 20 URLs (max test)')
  const largeArray = Array.from({ length: 20 }, (_, i) => 
    `https://dynamic-media-cdn.tripadvisor.com/media/photo-o/test${i}.jpg`
  )

  const { error: updateErr3 } = await supabase
    .from('nearby_listings')
    .update({ photo_urls: largeArray, photo_count: 20 })
    .eq('id', 19)

  if (updateErr3) {
    console.error('  ✗ Error:', updateErr3.message)
  } else {
    console.log(`  ✓ Successfully updated with 20 URLs`)
  }

  console.log('\n=== All tests complete ===')
}

testConstraints().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
