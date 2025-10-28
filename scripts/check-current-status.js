import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { count: total } = await supabase.from('nearby_listings').select('*', { count: 'exact', head: true })
  const { count: withId } = await supabase.from('nearby_listings').select('*', { count: 'exact', head: true }).not('tripadvisor_id', 'is', null)

  console.log('Current Database Status:')
  console.log('  Total listings: ' + total)
  console.log('  With TripAdvisor ID: ' + withId)

  const { data } = await supabase.from('nearby_listings').select('id, name, tripadvisor_id').limit(20)
  console.log('\nSample listings:')
  data.forEach(l => console.log('  [' + l.tripadvisor_id + '] ' + l.name))
}

check().catch(console.error)
