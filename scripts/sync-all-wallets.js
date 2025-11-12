#!/usr/bin/env node
// Script to list wallets_crypto and call sync-wallets edge function in batches
const fetch = require('node-fetch')
const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabaseUrl = SUPABASE_URL
const serviceKey = SUPABASE_SERVICE_ROLE

async function listWalletsCrypto() {
  const url = `${supabaseUrl}/rest/v1/wallets_crypto?select=id,address,chain_id`
  const resp = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  })
  if (!resp.ok) throw new Error('Failed listing wallets')
  return await resp.json()
}

async function invokeSync(addresses) {
  const fnUrl = `${supabaseUrl}/functions/v1/sync-wallets`
  const resp = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ addresses })
  })
  return await resp.json()
}

async function run() {
  const wallets = await listWalletsCrypto()
  console.log(`Found ${wallets.length} wallets_crypto`)
  const batchSize = 10
  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize).map(w => ({ address: w.address, chain_id: w.chain_id, wallet_id: w.id }))
    console.log('Syncing batch', i, batch.length)
    const res = await invokeSync(batch)
    console.log('Result:', res)
  }
}

run().catch(e => { console.error(e); process.exit(1) })
