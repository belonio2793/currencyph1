#!/usr/bin/env node
/**
 * URGENT FIX SCRIPT: Fix all exchange rates in deposits and database
 * 
 * This script:
 * 1. Applies migration 0206 to remove hardcoded rates from public.pairs
 * 2. Applies migration 0207 to backfill deposits with correct rates
 * 3. Fetches fresh rates from APIs
 * 4. Verifies all rates are correct
 * 
 * Usage: node scripts/urgent-fix-all-rates.js
 */

const { createClient } = await import('@supabase/supabase-js')
const fetch = (await import('node-fetch')).default

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const EXCONVERT_KEY = process.env.EXCONVERT || process.env.VITE_EXCONVERT

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

console.log(`
╔════════════════════════════════════════════════════════════════╗
║         URGENT FIX: Exchange Rates & Deposits                  ║
╠════════════════════════════════════════════════════════════════╣
║ This will:                                                     ║
║   1. Remove hardcoded rates from public.pairs                  ║
║   2. Backfill all deposits with correct rates                  ║
║   3. Fetch fresh exchange rates from APIs                      ║
║   4. Verify all rates are correct                              ║
║                                                                ║
║ Expected result:                                               ║
║   ✓ 1 PHP = 0.0000001931 BTC (not 0.0000004)                   ║
║   ✓ All deposits show correct "You Received" amounts           ║
║   ✓ All exchange rates synced with market                      ║
╚════════════════════════════════════════════════════════════════╝\n`)

async function checkCurrentState() {
  console.log('📊 Checking current state...\n')
  
  try {
    // Check for deposits with wrong rates
    const { data: deposits, error: depositError } = await supabase
      .from('deposits')
      .select('id, amount, currency_code, converted_amount, exchange_rate, created_at')
      .eq('status', 'pending')
      .limit(3)
    
    if (depositError) throw depositError
    
    // Check current BTC rate
    const { data: btcRate, error: rateError } = await supabase
      .from('pairs')
      .select('rate, source_table, updated_at')
      .eq('from_currency', 'BTC')
      .eq('to_currency', 'PHP')
      .order('updated_at', { ascending: false })
      .limit(1)
    
    if (rateError) throw rateError
    
    if (deposits && deposits.length > 0) {
      console.log('Sample Deposits (BEFORE FIX):')
      deposits.forEach(d => {
        const rate = d.converted_amount && d.amount ? (d.converted_amount / d.amount) : null
        console.log(`  ${d.currency_code}: ${d.amount} → ${d.converted_amount} (rate: ${rate?.toLocaleString(undefined, { maximumFractionDigits: 10 }) || 'N/A'})`)
      })
      console.log()
    }
    
    if (btcRate && btcRate.length > 0) {
      const r = btcRate[0]
      const inverse = r.rate ? (1 / r.rate) : null
      console.log(`Current BTC Rate in public.pairs:`)
      console.log(`  BTC→PHP: ${r.rate?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 'NULL'} PHP`)
      console.log(`  PHP→BTC: 1 PHP = ${inverse?.toLocaleString(undefined, { maximumFractionDigits: 10 }) || 'NULL'} BTC`)
      console.log(`  Source: ${r.source_table}`)
      console.log(`  Updated: ${r.updated_at}`)
      console.log()
      
      if (r.rate <= 2500000) {
        console.log('⚠️  HARDCODED RATE DETECTED - Need to apply migration 0206')
      }
    } else {
      console.log('⚠️  NO BTC RATE FOUND - Need to fetch fresh rates')
    }
    
    return { deposits, btcRate }
  } catch (err) {
    console.error('❌ Error checking state:', err.message)
    return { deposits: [], btcRate: [] }
  }
}

async function applyMigration0206() {
  console.log('\n🔧 STEP 1: Applying Migration 0206 (Remove hardcoded rates)...\n')
  
  try {
    // Delete hardcoded rates from public.pairs
    const { error: deleteError } = await supabase
      .from('pairs')
      .delete()
      .eq('source_table', 'currency_rates')
      .lt('updated_at', new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString())
    
    if (deleteError) {
      console.warn('⚠️  Delete query returned:', deleteError.message)
    } else {
      console.log('✓ Deleted stale hardcoded rates from public.pairs')
    }
    
    // Also try to delete specific hardcoded values
    const hardcodedPairs = [
      { from: 'BTC', to: 'PHP', rate: 2500000 },
      { from: 'ETH', to: 'PHP', rate: 150000 },
      { from: 'USD', to: 'PHP', rate: 56.5 }
    ]
    
    for (const pair of hardcodedPairs) {
      const { error } = await supabase
        .from('pairs')
        .delete()
        .eq('from_currency', pair.from)
        .eq('to_currency', pair.to)
        .eq('rate', pair.rate)
      
      if (!error) {
        console.log(`  ✓ Removed ${pair.from}→${pair.to} = ${pair.rate}`)
      }
    }
    
    return true
  } catch (err) {
    console.error('❌ Error applying migration 0206:', err.message)
    return false
  }
}

async function fetchFreshRates() {
  console.log('\n🌐 STEP 2: Fetching fresh exchange rates...\n')
  
  if (!EXCONVERT_KEY) {
    console.warn('⚠️  EXCONVERT_KEY not set, trying to call fetch-rates edge function...')
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch-rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`
        }
      })
      
      if (response.ok) {
        console.log('✓ fetch-rates edge function called successfully')
        return true
      } else {
        console.warn(`⚠️  fetch-rates returned ${response.status}`)
        return false
      }
    } catch (err) {
      console.error('❌ Error calling fetch-rates:', err.message)
      return false
    }
  }
  
  // Fallback: Fetch from ExConvert manually
  try {
    console.log('Fetching rates from ExConvert API...')
    
    const rates = {}
    const currencies = ['BTC', 'ETH', 'USDT', 'USD', 'EUR', 'GBP']
    
    for (const currency of currencies) {
      try {
        const url = `https://api.exconvert.com/convert?access_key=${EXCONVERT_KEY}&from=${currency}&to=PHP&amount=1`
        const response = await fetch(url)
        
        if (!response.ok) {
          console.warn(`⚠️  Failed to get ${currency}: ${response.status}`)
          continue
        }
        
        const json = await response.json()
        const rateValue = json.result?.PHP || json.result?.rate
        
        if (typeof rateValue === 'number' && rateValue > 0) {
          rates[currency] = rateValue
          console.log(`  ✓ ${currency}: ${rateValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} PHP`)
        }
      } catch (err) {
        console.warn(`⚠️  Error fetching ${currency}:`, err.message)
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200))
    }
    
    // Insert/update rates in database
    if (Object.keys(rates).length > 0) {
      const records = Object.entries(rates).map(([from, rate]) => ({
        from_currency: from.toUpperCase(),
        to_currency: 'PHP',
        rate: rate,
        source_table: 'exconvert',
        updated_at: new Date().toISOString()
      }))
      
      const { error: upsertError } = await supabase
        .from('pairs')
        .upsert(records, { onConflict: 'from_currency,to_currency' })
      
      if (!upsertError) {
        console.log(`✓ Stored ${records.length} fresh rates in public.pairs`)
        return true
      } else {
        throw upsertError
      }
    }
    
    return false
  } catch (err) {
    console.error('❌ Error fetching rates:', err.message)
    return false
  }
}

async function applyMigration0207() {
  console.log('\n🔧 STEP 3: Applying Migration 0207 (Backfill deposits)...\n')
  
  try {
    // Get pairs for conversion
    const { data: pairs, error: pairsError } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate')
      .eq('to_currency', 'PHP')
    
    if (pairsError) throw pairsError
    
    const pairMap = {}
    if (pairs) {
      pairs.forEach(p => {
        pairMap[p.from_currency] = p.rate
      })
    }
    
    // Get deposits to update
    const { data: deposits, error: depositsError } = await supabase
      .from('deposits')
      .select('id, amount, currency_code, exchange_rate, converted_amount')
      .in('status', ['pending', 'approved', 'completed'])
      .neq('currency_code', 'PHP')
    
    if (depositsError) throw depositsError
    
    // Update deposits with correct rates
    let updatedCount = 0
    if (deposits) {
      for (const deposit of deposits) {
        const correctRate = pairMap[deposit.currency_code]
        
        if (!correctRate || correctRate <= 0) {
          continue
        }
        
        const correctConverted = deposit.amount * correctRate
        
        // Only update if the rate actually changed
        if (Math.abs(deposit.exchange_rate - correctRate) > 0.00001) {
          const { error: updateError } = await supabase
            .from('deposits')
            .update({
              exchange_rate: correctRate,
              converted_amount: correctConverted,
              metadata: {
                rate_corrected: {
                  corrected_at: new Date().toISOString(),
                  migration: '0207',
                  old_rate: deposit.exchange_rate,
                  new_rate: correctRate
                }
              }
            })
            .eq('id', deposit.id)
          
          if (!updateError) {
            updatedCount++
          }
        }
      }
    }
    
    console.log(`✓ Updated ${updatedCount} deposits with correct exchange rates`)
    return true
  } catch (err) {
    console.error('❌ Error applying migration 0207:', err.message)
    console.log('  This is expected if deposits have not yet been created')
    return false
  }
}

async function verifyFix() {
  console.log('\n✅ STEP 4: Verifying fix...\n')
  
  try {
    // Check current BTC rate
    const { data: btcRate, error: rateError } = await supabase
      .from('pairs')
      .select('rate, source_table, updated_at')
      .eq('from_currency', 'BTC')
      .eq('to_currency', 'PHP')
      .order('updated_at', { ascending: false })
      .limit(1)
    
    if (rateError) throw rateError
    
    // Check a few deposits
    const { data: deposits, error: depositsError } = await supabase
      .from('deposits')
      .select('id, amount, currency_code, converted_amount, exchange_rate')
      .eq('status', 'pending')
      .limit(3)
    
    if (depositsError) throw depositsError
    
    console.log('Current BTC Rate in public.pairs:')
    if (btcRate && btcRate.length > 0) {
      const r = btcRate[0]
      const inverse = r.rate ? (1 / r.rate) : null
      console.log(`  BTC→PHP: ${r.rate?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 'NULL'} PHP`)
      console.log(`  1 PHP = ${inverse?.toLocaleString(undefined, { maximumFractionDigits: 10 })} BTC`)
      console.log(`  Source: ${r.source_table}`)
      
      if (inverse && inverse < 0.00002 && inverse > 0.00001) {
        console.log('  ✅ CORRECT! (Expected around 0.0000001931)')
      } else if (inverse && inverse > 0.0000003) {
        console.log('  ❌ STILL WRONG! Rate needs to be corrected')
      } else if (!inverse) {
        console.log('  ❌ NO RATE - Need to fetch from APIs')
      }
    } else {
      console.log('  ❌ NO BTC RATE FOUND')
    }
    
    console.log('\nSample Deposits (AFTER FIX):')
    if (deposits && deposits.length > 0) {
      deposits.forEach(d => {
        const rate = d.converted_amount && d.amount ? (d.converted_amount / d.amount) : null
        console.log(`  ${d.currency_code}: ${d.amount} → ${d.converted_amount} (rate: ${rate?.toLocaleString(undefined, { maximumFractionDigits: 10 }) || 'N/A'})`)
      })
    } else {
      console.log('  No pending deposits yet')
    }
    
    return true
  } catch (err) {
    console.error('❌ Verification error:', err.message)
    return false
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  
  // Check current state
  await checkCurrentState()
  
  // Apply fixes
  const fixed0206 = await applyMigration0206()
  
  // Wait a moment
  await new Promise(r => setTimeout(r, 1000))
  
  const ratesFetched = await fetchFreshRates()
  
  // Wait for rates to be stored
  await new Promise(r => setTimeout(r, 2000))
  
  const fixed0207 = await applyMigration0207()
  
  // Verify everything
  await verifyFix()
  
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    FIX COMPLETE                                ║
╠════════════════════════════════════════════════════════════════╣
║ Summary:                                                       ║
║   • Removed hardcoded rates: ${fixed0206 ? '✓' : '⚠️'}                                  ║
║   • Fetched fresh rates: ${ratesFetched ? '✓' : '⚠️'}                                    ║
║   • Backfilled deposits: ${fixed0207 ? '✓' : '⚠️'}                                      ║
║                                                                ║
║ Next Steps:                                                    ║
║   1. Refresh the Deposits page in your browser                 ║
║   2. Verify rates show correctly (0.0000001931, not 0.0000004) ║
║   3. Check Recent Deposits table for accurate conversions      ║
║   4. Test new deposit to confirm rates are fresh               ║
║                                                                ║
║ If issues remain:                                              ║
║   • Run: npm run check:rates-status                            ║
║   • Run: npm run seed-currency-rates                           ║
║   • Check browser console for errors                           ║
╚════════════════════════════════════════════════════════════════╝\n`)
}

main().catch(err => {
  console.error('\n❌ FATAL ERROR:', err)
  process.exit(1)
})
