import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const checkpointPath = path.join(__dirname, '..', '.enrich-accurate-checkpoint.json')

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'))

console.log('📊 ENRICHMENT PROGRESS:\n')
console.log(`✅ Success: ${checkpoint.stats.success}`)
console.log(`❌ Failed: ${checkpoint.stats.failed}`)
console.log(`⏭️  Not found on TripAdvisor: ${checkpoint.stats.skipped}`)
console.log(`📝 Total processed: ${Object.keys(checkpoint.processed).length}`)

const supabase = createClient(process.env.PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function checkDB() {
  const { count: total } = await supabase.from('nearby_listings').select('*', { count: 'exact', head: true })
  const { count: withId } = await supabase.from('nearby_listings').select('*', { count: 'exact', head: true }).not('tripadvisor_id', 'is', null)

  console.log(`\n🗄️  DATABASE STATUS:`)
  console.log(`   Total listings: ${total}`)
  console.log(`   With TripAdvisor ID: ${withId}`)
  console.log(`   Enrichment: ${((withId / total) * 100).toFixed(1)}%`)
}

checkDB().catch(console.error)
