import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function analyze() {
  console.log('📊 ANALYZING LISTINGS DATA\n')

  const { data: withIds } = await supabase.from('nearby_listings').select('id, name, city, tripadvisor_id, source, raw').not('tripadvisor_id', 'is', null).limit(10)

  console.log('✅ Listings WITH tripadvisor_id (first 10):')
  withIds.forEach(l => {
    console.log(`  [${l.tripadvisor_id}] ${l.name} (${l.city}) - Source: ${l.source}`)
  })

  const { data: withoutIds } = await supabase.from('nearby_listings').select('id, name, city, source, raw').is('tripadvisor_id', null).limit(10)

  console.log('\n❌ Listings WITHOUT tripadvisor_id (first 10):')
  withoutIds.forEach(l => {
    try {
      const raw = typeof l.raw === 'string' ? JSON.parse(l.raw) : l.raw
      const isGenerated = raw?.generated || false
      console.log(`  ${l.name} (${l.city}) - Source: ${l.source} - Generated: ${isGenerated}`)
    } catch (e) {
      console.log(`  ${l.name} (${l.city}) - Source: ${l.source}`)
    }
  })

  const { count: totalCount } = await supabase.from('nearby_listings').select('*', { count: 'exact', head: true })
  const { count: withIdCount } = await supabase.from('nearby_listings').select('*', { count: 'exact', head: true }).not('tripadvisor_id', 'is', null)
  const { count: generatedCount } = await supabase.from('nearby_listings').select('*', { count: 'exact', head: true })

  console.log(`\n📈 STATISTICS:`)
  console.log(`  Total listings: ${totalCount}`)
  console.log(`  With tripadvisor_id: ${withIdCount}`)
  console.log(`  Need enrichment: ${totalCount - withIdCount}`)
  console.log(`  Enrichment progress: ${((withIdCount / totalCount) * 100).toFixed(1)}%`)
}

analyze().catch(console.error)
