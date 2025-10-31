#!/usr/bin/env node
// Create only Solana house wallet via Supabase Edge Function create-wallet-pairs

import fetch from 'node-fetch'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const chain = { chainId: 245022926, name: 'solana', symbol: 'SOL' }
const url = `${PROJECT_URL.replace(/\/$/, '')}/functions/v1/create-wallet-pairs`

async function run() {
  console.log('Creating Solana house wallet...')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ create_house: true, chain_id: chain.chainId })
    })
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      console.log('Status:', res.status)
      console.log(JSON.stringify(json, null, 2))
    } catch (e) {
      console.log('Status:', res.status, 'Raw response:', text)
    }
  } catch (e) {
    console.error('Request failed:', e)
    process.exit(1)
  }
}

run()
