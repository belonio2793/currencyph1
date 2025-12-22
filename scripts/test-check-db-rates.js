#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkRates() {
  console.log('\n🔍 Checking database rates...\n')
  
  // Check crypto_rates table
  const { data: cryptoRates, error: cryptoError } = await supabase
    .from('crypto_rates')
    .select('*')
    .limit(5)
  
  if (cryptoError) {
    console.log('❌ crypto_rates error:', cryptoError.message)
  } else {
    console.log(`✅ crypto_rates found: ${cryptoRates?.length || 0} records (sample of 5)`)
    cryptoRates?.forEach(r => {
      console.log(`   ${r.from_currency} → ${r.to_currency}: ${r.rate}`)
    })
  }
  
  console.log()
  
  // Check pairs table
  const { data: pairs, error: pairsError } = await supabase
    .from('pairs')
    .select('*')
    .limit(5)
  
  if (pairsError) {
    console.log('❌ pairs error:', pairsError.message)
  } else {
    console.log(`✅ pairs found: ${pairs?.length || 0} records (sample of 5)`)
    pairs?.forEach(p => {
      console.log(`   ${p.from_currency} → ${p.to_currency}: ${p.rate}`)
    })
  }
  
  console.log()
  
  // Check cached_rates
  const { data: cached, error: cacheError } = await supabase
    .from('cached_rates')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(1)
  
  if (cacheError) {
    console.log('❌ cached_rates error:', cacheError.message)
  } else if (cached && cached.length > 0) {
    const c = cached[0]
    const cryptoCount = Object.keys(c.crypto_prices || {}).length
    const rateCount = Object.keys(c.exchange_rates || {}).length
    console.log(`✅ cached_rates (latest):`)
    console.log(`   Fetched: ${c.fetched_at}`)
    console.log(`   Source: ${c.source}`)
    console.log(`   Crypto prices: ${cryptoCount}`)
    console.log(`   Exchange rates: ${rateCount}`)
  } else {
    console.log('⚠️ No cached rates found')
  }
}

checkRates().catch(console.error)
