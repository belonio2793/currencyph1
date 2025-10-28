import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function deleteSyntheticListings() {
  console.log('⚠️  DELETING SYNTHETIC LISTINGS\n')

  // Get all listings
  const { data: allListings, error: fetchError } = await supabase
    .from('nearby_listings')
    .select('id, name, city, raw')

  if (fetchError) {
    console.error('❌ Error fetching listings:', fetchError)
    process.exit(1)
  }

  console.log(`📊 Total listings: ${allListings.length}`)

  // Identify synthetic listings
  const syntheticIds = []
  const realIds = []

  allListings.forEach(listing => {
    try {
      const raw = typeof listing.raw === 'string' ? JSON.parse(listing.raw) : listing.raw
      if (raw?.generated === true) {
        syntheticIds.push(listing.id)
      } else {
        realIds.push(listing.id)
      }
    } catch (e) {
      realIds.push(listing.id)
    }
  })

  console.log(`✅ Real listings to keep: ${realIds.length}`)
  console.log(`❌ Synthetic listings to delete: ${syntheticIds.length}\n`)

  if (syntheticIds.length === 0) {
    console.log('ℹ️  No synthetic listings to delete')
    process.exit(0)
  }

  // Confirm deletion
  console.log(`⚠️  ARE YOU SURE? This will delete ${syntheticIds.length} listings.`)
  console.log('    This action cannot be undone.\n')

  // Delete in batches
  const batchSize = 100
  let deletedCount = 0

  for (let i = 0; i < syntheticIds.length; i += batchSize) {
    const batch = syntheticIds.slice(i, i + batchSize)
    
    const { error: deleteError, count } = await supabase
      .from('nearby_listings')
      .delete()
      .in('id', batch)

    if (deleteError) {
      console.error(`❌ Error deleting batch:`, deleteError)
      continue
    }

    deletedCount += batch.length
    console.log(`✅ Deleted ${deletedCount}/${syntheticIds.length}`)
  }

  console.log(`\n✅ DELETION COMPLETE`)
  console.log(`\n📊 Final Status:`)
  console.log(`   ✅ Real listings remaining: ${realIds.length}`)
  console.log(`   ❌ Synthetic listings deleted: ${syntheticIds.length}`)
  console.log(`   📈 Database now contains: ${realIds.length} listings`)
}

deleteSyntheticListings().catch(console.error)
