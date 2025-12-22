#!/usr/bin/env node

import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration')
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗')
  process.exit(1)
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/fetch-rates`

async function testFetchRates() {
  console.log('\n📊 Testing Fetch Rates Edge Function\n')
  console.log(`🔗 Function URL: ${FUNCTION_URL}`)
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`)

  try {
    console.log('⏳ Sending request to fetch-rates function...\n')

    const response = await fetch(FUNCTION_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    console.log(`📬 Response Status: ${response.status} ${response.statusText}\n`)

    const data = await response.json()

    if (response.status === 200 || response.status === 202) {
      console.log('✅ SUCCESS!\n')
      console.log('Response Data:')
      console.log(JSON.stringify(data, null, 2))

      // Summary
      console.log('\n📈 Summary:')
      if (data.source) console.log(`   Source: ${data.source}`)
      if (data.total_rates_stored) console.log(`   Rates Stored: ${data.total_rates_stored.toLocaleString()}`)
      if (data.currency_pairs) console.log(`   Currency Pairs: ${data.currency_pairs}`)
      if (data.message) console.log(`   Message: ${data.message}`)
      if (data.fetched_at) console.log(`   Fetched At: ${data.fetched_at}`)

      console.log('\n✨ Test completed successfully!')
    } else {
      console.log('❌ ERROR!\n')
      console.log('Response Data:')
      console.log(JSON.stringify(data, null, 2))

      if (data.error) console.log(`\nError: ${data.error}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Request Failed:\n')
    console.error(error.message)
    console.error('\nTroubleshooting:')
    console.error('1. Ensure the edge function is deployed: supabase functions deploy fetch-rates')
    console.error('2. Check that SUPABASE_URL and SUPABASE_ANON_KEY are set correctly')
    console.error('3. Verify the function exists in supabase/functions/fetch-rates/index.ts')
    process.exit(1)
  }
}

testFetchRates()
