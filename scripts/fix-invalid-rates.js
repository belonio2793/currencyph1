#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function fixInvalidRates() {
  try {
    console.log('\n' + '='.repeat(80))
    console.log('🔧 FIXING INVALID RATES IN public.pairs TABLE')
    console.log('='.repeat(80) + '\n')

    // Step 1: Find all invalid rates
    console.log('Step 1: Finding invalid rates (rate = 0 or rate < 0)...\n')
    const { data: invalidRates, error: findError } = await supabase
      .from('pairs')
      .select('id, from_currency, to_currency, rate')
      .or('rate.eq.0,rate.lt.0')

    if (findError) {
      console.error('❌ Error finding invalid rates:', findError.message)
      process.exit(1)
    }

    if (!invalidRates || invalidRates.length === 0) {
      console.log('✅ No invalid rates found!\n')
      return
    }

    console.log(`Found ${invalidRates.length} invalid rates:\n`)
    invalidRates.forEach(rate => {
      console.log(`  • ${rate.from_currency}/${rate.to_currency}: ${rate.rate}`)
    })
    console.log()

    // Step 2: Delete the invalid rates
    console.log('Step 2: Deleting invalid rates...\n')
    const idsToDelete = invalidRates.map(r => r.id)

    const { error: deleteError, count } = await supabase
      .from('pairs')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      console.error('❌ Error deleting invalid rates:', deleteError.message)
      process.exit(1)
    }

    console.log(`✅ Successfully deleted ${invalidRates.length} invalid rates\n`)

    // Step 3: Verify deletion
    console.log('Step 3: Verifying deletion...\n')
    const { data: verifyRates, error: verifyError } = await supabase
      .from('pairs')
      .select('count(*)', { count: 'exact', head: true })

    if (!verifyError) {
      console.log(`✅ Remaining valid rates: ${verifyRates?.length || 'unknown'}\n`)
    }

    console.log('='.repeat(80))
    console.log('✅ INVALID RATES CLEANUP COMPLETE')
    console.log('='.repeat(80) + '\n')

  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
    process.exit(1)
  }
}

fixInvalidRates()
