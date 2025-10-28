import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function checkMissingFields() {
  console.log('🔍 Analyzing missing fields in nearby_listings...\n')

  const { data: listings } = await supabase
    .from('nearby_listings')
    .select('*')
    .limit(5)

  if (!listings || listings.length === 0) {
    console.log('No listings found')
    return
  }

  const sample = listings[0]
  const fields = Object.keys(sample)
  const nullFields = []
  const filledFields = []

  fields.forEach(field => {
    const values = listings.map(l => l[field])
    const nullCount = values.filter(v => v === null || v === undefined || v === '').length
    const filledCount = values.filter(v => v !== null && v !== undefined && v !== '').length

    if (nullCount === values.length) {
      nullFields.push(field)
    } else if (filledCount > 0) {
      filledFields.push({ field, filled: filledCount, total: values.length })
    }
  })

  console.log('❌ EMPTY FIELDS (all rows NULL):')
  nullFields.forEach(f => console.log(`   - ${f}`))

  console.log('\n✅ PARTIALLY/FULLY FILLED FIELDS:')
  filledFields
    .sort((a, b) => b.filled - a.filled)
    .forEach(f => {
      const pct = Math.round((f.filled / f.total) * 100)
      console.log(`   - ${f.field}: ${f.filled}/${f.total} (${pct}%)`)
    })

  console.log('\n📊 PRIORITY FIELDS TO FILL:')
  const priority = [
    'tripadvisor_id',
    'photo_urls',
    'primary_image_url',
    'web_url',
    'awards',
    'best_for',
    'traveler_type',
    'ranking_in_category',
    'price_level'
  ]

  for (const field of priority) {
    const count = listings.filter(l => l[field] === null || l[field] === undefined || l[field] === '').length
    const missing = count === listings.length
    const symbol = missing ? '❌' : '⚠️'
    console.log(`   ${symbol} ${field}`)
  }

  console.log('\n')
}

checkMissingFields().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
