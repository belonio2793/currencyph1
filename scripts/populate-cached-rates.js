#!/usr/bin/env node
const fetch = require('node-fetch')
require('dotenv').config()

const SUPABASE_URL = process.env.VITE_PROJECT_URL || 'https://corcofbmafdxehvlbesx.supabase.co'

async function populateCache() {
  try {
    console.log('Calling fetch-rates edge function to populate cache...')
    const url = `${SUPABASE_URL}/functions/v1/fetch-rates`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.log(`Edge function returned ${response.status}`)
      const text = await response.text()
      console.log('Response:', text)
      return
    }
    
    const data = await response.json()
    console.log('✅ Cache populated successfully!')
    console.log('Exchange rates:', Object.keys(data.exchangeRates || {}).length, 'currencies')
    console.log('Crypto prices:', Object.keys(data.cryptoPrices || {}).length, 'cryptos')
    console.log('Cached at:', data.fetched_at)
  } catch (err) {
    console.error('Error:', err.message)
  }
}

populateCache()
