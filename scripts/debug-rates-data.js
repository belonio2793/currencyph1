import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  try {
    // Check fiat rates (should be like USD_PHP = 58.5)
    console.log('=== FIAT RATES (currency_rates) ===')
    const { data: fiatRates } = await supabase
      .from('currency_rates')
      .select('*')
      .filter('from_currency', 'eq', 'USD')
      .limit(5)
    
    console.log('USD pairs:')
    fiatRates.forEach(r => {
      console.log(`  ${r.from_currency}_${r.to_currency} = ${r.rate}`)
    })

    // Check crypto rates (should be like BTC_USD = 95000)
    console.log('\n=== CRYPTO RATES (cryptocurrency_rates) ===')
    const { data: cryptoRates } = await supabase
      .from('cryptocurrency_rates')
      .select('*')
      .filter('from_currency', 'eq', 'BTC')
      .limit(5)
    
    console.log('BTC pairs:')
    cryptoRates.forEach(r => {
      console.log(`  ${r.from_currency}_${r.to_currency} = ${r.rate}`)
    })

    // Check what's in pairs table
    console.log('\n=== PAIRS TABLE ===')
    const { data: pairs } = await supabase
      .from('pairs')
      .select('*')
      .or('from_currency.eq.USD,from_currency.eq.BTC')
      .limit(10)
    
    console.log('Sample pairs:')
    pairs.forEach(p => {
      console.log(`  ${p.from_currency}_${p.to_currency} = ${p.rate} (from: ${p.source_table})`)
    })

  } catch (err) {
    console.error('Error:', err)
  }
}

main()
