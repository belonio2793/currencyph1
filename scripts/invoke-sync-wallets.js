#!/usr/bin/env node
// Invoke Supabase Edge Function sync-wallet-balances

import fetch from 'node-fetch'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

async function run() {
  const url = `${PROJECT_URL.replace(/\/$/, '')}/functions/v1/sync-wallet-balances`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ limit_per_wallet: 5 })
  })
  const text = await res.text()
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)) } catch (e) { console.log(text) }
}

run().catch(e => { console.error(e); process.exit(1) })
