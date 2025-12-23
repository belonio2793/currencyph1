#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in environment variables')
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkAllRates() {
  try {
    console.log('\n' + '='.repeat(80))
    console.log('📊 PULLING ALL RATES FROM public.pairs TABLE')
    console.log('='.repeat(80) + '\n')

    // 1. Get total count
    console.log('📈 Step 1: Checking total rate pairs...\n')
    const { data: countData, error: countError } = await supabase
      .from('pairs')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('❌ Error counting pairs:', countError.message)
    } else {
      console.log(`✅ Total rate pairs: ${countData?.length || 0}\n`)
    }

    // 2. Get all rates
    console.log('📋 Step 2: Fetching all rates...\n')
    const { data: allRates, error: ratesError } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate, source_table, updated_at')
      .order('from_currency')
      .order('to_currency')

    if (ratesError) {
      console.error('❌ Error fetching rates:', ratesError.message)
    } else {
      console.log(`✅ Fetched ${allRates?.length || 0} rates\n`)

      // Display first 20 rates as sample
      if (allRates && allRates.length > 0) {
        console.log('📌 Sample of fetched rates (first 20):')
        console.log('-'.repeat(80))
        console.log('FROM        | TO          | RATE              | SOURCE          | UPDATED')
        console.log('-'.repeat(80))
        allRates.slice(0, 20).forEach(rate => {
          const fromStr = rate.from_currency.padEnd(11)
          const toStr = rate.to_currency.padEnd(11)
          const rateStr = String(rate.rate).padEnd(17)
          const sourceStr = (rate.source_table || 'N/A').padEnd(15)
          const updatedStr = new Date(rate.updated_at).toISOString().split('T')[0]
          console.log(`${fromStr} | ${toStr} | ${rateStr} | ${sourceStr} | ${updatedStr}`)
        })
        console.log('-'.repeat(80))
        console.log(`... and ${Math.max(0, allRates.length - 20)} more rates\n`)
      }
    }

    // 3. Check data by source
    console.log('📊 Step 3: Analyzing rates by source...\n')
    const { data: sourceData, error: sourceError } = await supabase
      .from('pairs')
      .select('source_table, id')

    if (sourceError) {
      console.error('❌ Error fetching source data:', sourceError.message)
    } else if (sourceData) {
      const sourceCount = {}
      sourceData.forEach(item => {
        sourceCount[item.source_table || 'unknown'] = (sourceCount[item.source_table || 'unknown'] || 0) + 1
      })

      console.log('Rates by source:')
      Object.entries(sourceCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
          console.log(`  • ${source}: ${count} pairs`)
        })
      console.log()
    }

    // 4. Check for invalid rates
    console.log('⚠️  Step 4: Checking for invalid rates...\n')
    const { data: invalidRates, error: invalidError } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate')
      .or('rate.is.null,rate.eq.0,rate.lt.0')

    if (invalidError) {
      console.error('❌ Error checking invalid rates:', invalidError.message)
    } else {
      if (invalidRates && invalidRates.length > 0) {
        console.log(`⚠️  Found ${invalidRates.length} invalid rates:`)
        invalidRates.slice(0, 10).forEach(rate => {
          console.log(`  • ${rate.from_currency}/${rate.to_currency}: ${rate.rate}`)
        })
        if (invalidRates.length > 10) {
          console.log(`  ... and ${invalidRates.length - 10} more`)
        }
      } else {
        console.log('✅ No invalid rates found\n')
      }
    }

    // 5. Check update frequency
    console.log('🕐 Step 5: Checking update timestamps...\n')
    const { data: timestampData, error: timestampError } = await supabase
      .from('pairs')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (timestampError) {
      console.error('❌ Error fetching timestamps:', timestampError.message)
    } else if (timestampData && timestampData.length > 0) {
      const lastUpdate = new Date(timestampData[0].updated_at)
      const now = new Date()
      const diffMinutes = Math.round((now - lastUpdate) / 1000 / 60)

      console.log(`✅ Last update: ${lastUpdate.toISOString()}`)
      console.log(`   (${diffMinutes} minutes ago)\n`)
    }

    // 6. Check specific currencies
    console.log('🔍 Step 6: Checking specific currencies (PHP, USD, BTC, ETH)...\n')
    const testCurrencies = ['PHP', 'USD', 'BTC', 'ETH']

    for (const currency of testCurrencies) {
      const { data: currencyRates, error: currencyError } = await supabase
        .from('pairs')
        .select('from_currency, to_currency, rate')
        .eq('from_currency', currency)
        .limit(5)

      if (currencyError) {
        console.log(`❌ ${currency}: Error fetching rates`)
      } else if (currencyRates && currencyRates.length > 0) {
        console.log(`✅ ${currency}:`)
        currencyRates.forEach(rate => {
          console.log(`   • 1 ${rate.from_currency} = ${rate.rate} ${rate.to_currency}`)
        })
      } else {
        console.log(`⚠️  ${currency}: No rates found`)
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ RATES CHECK COMPLETE')
    console.log('='.repeat(80) + '\n')

    // Display summary
    console.log('📋 SUMMARY:')
    console.log(`  • Total pairs in table: ${allRates?.length || 0}`)
    console.log(`  • Last updated: ${timestampData?.[0]?.updated_at ? new Date(timestampData[0].updated_at).toISOString() : 'Unknown'}`)
    console.log(`  • Invalid rates: ${invalidRates?.length || 0}`)
    console.log('  • Status: ' + (allRates && allRates.length > 100 ? '✅ Healthy' : '⚠️  Low data'))
    console.log()

  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
    process.exit(1)
  }
}

checkAllRates()
