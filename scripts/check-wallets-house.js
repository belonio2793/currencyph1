#!/usr/bin/env node
// Check wallets_house rows with safer column selection

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
    console.log('Checking wallets_house (recent 10 rows)')
    const { data: rows, error } = await supabase
      .from('wallets_house')
      .select('id,wallet_type,currency,network,address,provider,balance,metadata,updated_at,private_key,thirdweb_wallet_id')
      .order('updated_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error querying wallets_house:', error)
    } else {
      console.log('Count:', rows.length)
      console.log(JSON.stringify(rows.slice(0,5), null, 2))
    }
  } catch (e) {
    console.error('Unexpected error:', e)
  }
}

run()
