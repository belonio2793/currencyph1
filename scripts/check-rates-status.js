#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkRatesStatus() {
  console.log('\n📊 Checking Exchange Rates Database Status\n')

  try {
    // Get counts by source
    console.log('🔍 Querying database for rate statistics...\n')

    const { data: rates, error } = await supabase
      .from('crypto_rates')
      .select('source, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) throw error

    if (!rates || rates.length === 0) {
      console.log('⚠️  No rates found in database yet')
      return
    }

    const latestRate = rates[0]
    console.log('📈 Latest Rate Entry:')
    console.log(`   Source: ${latestRate.source}`)
    console.log(`   Updated: ${latestRate.updated_at}`)

    // Get count of rates by source
    const { data: sourceStats, error: sourceError } = await supabase
      .from('crypto_rates')
      .select('source', { count: 'exact' })

    if (!sourceError && sourceStats) {
      const sourceMap = {}
      sourceStats.forEach(row => {
        sourceMap[row.source] = (sourceMap[row.source] || 0) + 1
      })

      console.log('\n📊 Rates by Source:')
      Object.entries(sourceMap).forEach(([source, count]) => {
        console.log(`   ${source}: ${count.toLocaleString()} pairs`)
      })
    }

    // Get unique currencies
    const { data: currencies, error: currencyError } = await supabase
      .from('crypto_rates')
      .select('from_currency', { count: 'exact' })

    if (!currencyError && currencies) {
      const uniqueCurrencies = new Set(currencies.map(r => r.from_currency))
      console.log(`\n💰 Total Unique Currencies: ${uniqueCurrencies.size}`)
      
      // Show sample
      console.log('\nSample currencies:')
      Array.from(uniqueCurrencies)
        .sort()
        .slice(0, 20)
        .forEach(currency => console.log(`   ${currency}`))
      
      if (uniqueCurrencies.size > 20) {
        console.log(`   ... and ${uniqueCurrencies.size - 20} more`)
      }
    }

    // Get total pairs
    const { count: totalPairs, error: countError } = await supabase
      .from('crypto_rates')
      .select('*', { count: 'exact', head: true })

    if (!countError && totalPairs) {
      console.log(`\n📦 Total Exchange Rate Pairs: ${totalPairs.toLocaleString()}`)
    }

    // Check for expired rates
    const { count: expiredCount, error: expiredError } = await supabase
      .from('crypto_rates')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', new Date().toISOString())

    if (!expiredError && expiredCount !== null) {
      console.log(`⏰ Expired Rate Entries: ${expiredCount.toLocaleString()}`)
    }

    console.log('\n✅ Database check completed!\n')

  } catch (error) {
    console.error('❌ Error checking rates status:')
    console.error(error.message)
    process.exit(1)
  }
}

checkRatesStatus()
