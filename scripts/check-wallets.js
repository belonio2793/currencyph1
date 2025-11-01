#!/usr/bin/env node
// Simple script to check wallets_crypto and wallets_house entries

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function run() {
  try {
    console.log('Checking wallets_crypto (recent 10 rows)')
    const { data: cryptoRows, error: cryptoErr } = await supabase
      .from('wallets_crypto')
      .select('id,user_id,chain,chain_id,address,provider,balance,metadata,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (cryptoErr) {
      console.error('Error querying wallets_crypto:', cryptoErr)
    } else {
      console.log('Count:', cryptoRows.length)
      console.log(JSON.stringify(cryptoRows.slice(0,5), null, 2))
    }

    console.log('\nChecking wallets_house (recent 10 rows)')
    const { data: houseRows, error: houseErr } = await supabase
      .from('wallets_house')
      .select('id,wallet_type,currency,network,address,provider,balance,metadata,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (houseErr) {
      console.error('Error querying wallets_house:', houseErr)
    } else {
      console.log('Count:', houseRows.length)
      console.log(JSON.stringify(houseRows.slice(0,5), null, 2))
    }

  } catch (e) {
    console.error('Unexpected error:', e)
    process.exit(1)
  }
}

run()
