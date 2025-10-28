import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function testGrokAPI() {
  console.log('🧪 Testing Grok API...\n')

  const testPrompt = `You are a TripAdvisor Philippines expert. For this restaurant:
Business: "Steakhouse Restaurant"
City: "Manila"
Category: "Restaurant"

Search tripadvisor.com.ph and return ONLY valid JSON (no markdown):
{
  "tripadvisor_id": "numeric ID or null",
  "rating": 4.5 or null,
  "review_count": 100 or null,
  "phone_number": "phone or null",
  "website": "url or null"
}`

  try {
    console.log('📤 Sending request to Grok API...')
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [{ role: 'user', content: testPrompt }],
        temperature: 0.1,
        max_tokens: 500
      }),
      timeout: 30000
    })

    console.log(`📊 Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', errorText)
      return
    }

    const data = await response.json()
    console.log('✅ API Response received')
    console.log('\n📝 Content:')
    console.log(data.choices[0].message.content)
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

async function checkDatabaseSample() {
  console.log('\n\n🗄️  Checking database sample...\n')

  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id, name, city, tripadvisor_id, category, location_type')
    .range(0, 10)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Sample listings (first 10 with missing tripadvisor_id):`)
  const missingIds = data.filter(d => !d.tripadvisor_id)
  missingIds.forEach(listing => {
    console.log(`  ${listing.name} (${listing.city}) - Category: ${listing.category}`)
  })
}

async function main() {
  console.log('════════════════════════════════════════════════════════════\n')
  await testGrokAPI()
  await checkDatabaseSample()
  console.log('\n════════════════════════════════════════════════════════════')
}

main().catch(console.error)
