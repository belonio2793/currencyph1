#!/usr/bin/env node
/**
 * IMMEDIATE FIX SCRIPT: Populate fresh exchange rates
 * 
 * Run this after migration 0206 to ensure fresh rates are in the database
 * Usage: node scripts/fix-rates-immediate.js
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const EXCONVERT_KEY = process.env.EXCONVERT || process.env.VITE_EXCONVERT

const CRITICAL_RATES = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  USDT: 'USDT',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  PHP: 'Philippine Peso'
}

async function callFetchRatesFunction() {
  if (!SUPABASE_URL) {
    console.error('❌ SUPABASE_URL not set')
    return false
  }
  
  try {
    console.log('📡 Calling fetch-rates edge function...')
    console.log(`   URL: ${SUPABASE_URL}/functions/v1/fetch-rates\n`)
    
    const response = await (await import('node-fetch')).default(
      `${SUPABASE_URL}/functions/v1/fetch-rates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`
        },
        body: JSON.stringify({})
      }
    )
    
    if (!response.ok) {
      console.error(`❌ fetch-rates returned ${response.status}`)
      const text = await response.text()
      console.error(`   Response: ${text}`)
      return false
    }
    
    const result = await response.json()
    console.log('✅ fetch-rates executed successfully\n')
    console.log('Response:', JSON.stringify(result, null, 2))
    return true
  } catch (err) {
    console.error('❌ Error calling fetch-rates:', err.message)
    console.error('\nTroubleshooting:')
    console.error('1. Ensure fetch-rates edge function is deployed: supabase functions deploy fetch-rates')
    console.error('2. Check environment variables are set correctly')
    console.error('3. Verify the function exists: supabase functions list')
    return false
  }
}

async function fetchRatesViaExConvert() {
  if (!EXCONVERT_KEY) {
    console.warn('⚠️  EXCONVERT_KEY not set, skipping')
    return null
  }
  
  try {
    console.log('📡 Fetching real rates from ExConvert API...\n')
    
    const rates = {}
    const toCurrency = 'PHP'
    
    // Fetch critical currency rates
    for (const [code, name] of Object.entries(CRITICAL_RATES)) {
      if (code === 'PHP') {
        rates[code] = 1
        console.log(`   ✓ ${code}: 1 (base currency)`)
        continue
      }
      
      try {
        const url = `https://api.exconvert.com/convert?access_key=${EXCONVERT_KEY}&from=${code}&to=${toCurrency}&amount=1`
        const response = await (await import('node-fetch')).default(url)
        
        if (!response.ok) {
          console.warn(`   ⚠️  ${code}: Failed (${response.status})`)
          continue
        }
        
        const json = await response.json()
        const rateValue = json.result?.[toCurrency] || json.result?.rate
        
        if (typeof rateValue === 'number' && rateValue > 0) {
          rates[code] = rateValue
          const formatted = code.includes('USD') || code.includes('EUR') 
            ? rateValue.toFixed(2)
            : rateValue.toLocaleString(undefined, { maximumFractionDigits: 8 })
          console.log(`   ✓ ${code}: ${formatted} PHP`)
        } else {
          console.warn(`   ⚠️  ${code}: Invalid rate value`)
        }
      } catch (err) {
        console.warn(`   ⚠️  ${code}: Error - ${err.message}`)
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    return rates
  } catch (err) {
    console.error('❌ ExConvert fetch failed:', err.message)
    return null
  }
}

async function verifyRates() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    console.warn('Cannot verify - Supabase credentials missing')
    return
  }
  
  try {
    console.log('\n📊 VERIFYING RATES IN DATABASE...\n')
    
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    
    const { data: btcRate, error } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate, source_table, updated_at')
      .eq('from_currency', 'BTC')
      .eq('to_currency', 'PHP')
      .order('updated_at', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('❌ Query error:', error)
      return
    }
    
    if (!btcRate || btcRate.length === 0) {
      console.error('❌ NO BTC→PHP RATE FOUND IN DATABASE!')
      console.error('   The fetch-rates function needs to be called')
      return
    }
    
    const rate = btcRate[0]
    const ageMinutes = (Date.now() - new Date(rate.updated_at).getTime()) / (1000 * 60)
    const inverse = 1 / rate.rate
    
    console.log('Current BTC→PHP Rate:')
    console.log(`   Rate: ${rate.rate.toLocaleString(undefined, { maximumFractionDigits: 2 })} PHP`)
    console.log(`   Inverse (1 PHP→BTC): ${inverse.toLocaleString(undefined, { maximumFractionDigits: 10 })}`)
    console.log(`   Source: ${rate.source_table}`)
    console.log(`   Updated: ${ageMinutes.toFixed(1)} minutes ago\n`)
    
    if (inverse > 0.0000002) {
      console.error('❌ RATE STILL WRONG!')
      console.error(`   Expected: 1 PHP = 0.0000001931 BTC`)
      console.error(`   Got: 1 PHP = ${inverse.toLocaleString(undefined, { maximumFractionDigits: 10 })} BTC`)
      console.error(`   This suggests BTC rate of only ${rate.rate.toLocaleString()} PHP (should be ~5,200,000)`)
    } else if (rate.rate > 4000000) {
      console.log('✅ RATE LOOKS CORRECT!')
      console.log('   Hardcoded rates have been replaced with real market rates')
    }
  } catch (err) {
    console.error('❌ Verification error:', err.message)
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║     MIGRATION 0206 FIX - Populate Fresh Exchange Rates         ║
╠════════════════════════════════════════════════════════════════╣
║ This script will:                                              ║
║   1. Call fetch-rates edge function to populate real rates     ║
║   2. Verify rates are correct in the database                  ║
║   3. Confirm 1 PHP = 0.0000001931 BTC (not 0.0000004)         ║
╚════════════════════════════════════════════════════════════════╝\n`)
  
  const success = await callFetchRatesFunction()
  
  if (success) {
    // Wait a moment for the function to complete
    console.log('⏳ Waiting for rates to be stored in database...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    await verifyRates()
    
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    ✅ COMPLETE                                 ║
╠════════════════════════════════════════════════════════════════╣
║ Next steps:                                                    ║
║   1. Refresh the Deposits page in your browser                 ║
║   2. Verify exchange rates now show correct values             ║
║   3. Test deposit with cryptocurrency to confirm              ║
║                                                                ║
║ If rates still show incorrectly:                               ║
║   1. Check browser console for any errors                     ║
║   2. Run: node scripts/fix-rates-immediate.js again            ║
║   3. Or manually call: npm run fetch-rates                    ║
╚════════════════════════════════════════════════════════════════╝`)
  } else {
    console.error(`
╔════════════════════════════════════════════════════════════════╗
║                    ❌ FAILED                                   ║
╠════════════════════════════════════════════════════════════════╣
║ fetch-rates edge function could not be called.                 ║
║ Try these alternatives:                                        ║
║   1. npm run fetch-rates                                       ║
║   2. npx supabase functions deploy fetch-rates                 ║
║   3. Manually query from ExConvert API                         ║
╚════════════════════════════════════════════════════════════════╝`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
