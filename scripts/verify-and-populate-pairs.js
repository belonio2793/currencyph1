import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  try {
    console.log('Checking pairs table...')

    // Check if pairs table exists
    const { data: tableInfo, error: tableError } = await supabase
      .from('pairs')
      .select('count(*)', { count: 'exact' })
      .limit(1)

    if (tableError) {
      console.error('❌ pairs table does not exist or error:', tableError.message)
      console.log('Creating pairs table and populating...')
      
      // Create the table with raw SQL
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS pairs (
            id BIGSERIAL PRIMARY KEY,
            from_currency VARCHAR(10) NOT NULL,
            to_currency VARCHAR(10) NOT NULL,
            rate NUMERIC NOT NULL,
            source_table VARCHAR(50) NOT NULL DEFAULT 'currency_rates',
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(from_currency, to_currency)
          );
          CREATE INDEX IF NOT EXISTS idx_pairs_lookup ON pairs(from_currency, to_currency);
          CREATE INDEX IF NOT EXISTS idx_pairs_from ON pairs(from_currency);
          CREATE INDEX IF NOT EXISTS idx_pairs_to ON pairs(to_currency);
        `
      })

      if (createError) {
        console.warn('Could not create via RPC, trying direct approach...')
      }
    } else {
      console.log(`✅ pairs table exists`)
    }

    // Check how many pairs exist
    const { data: pairCount, error: countError } = await supabase
      .from('pairs')
      .select('*', { count: 'exact', head: true })

    console.log(`Current pairs in table: ${pairCount?.length || 0}`)

    // Load and populate from currency_rates
    console.log('\nLoading from currency_rates...')
    const { data: fiatRates, error: fiatError } = await supabase
      .from('currency_rates')
      .select('*')

    if (fiatError) {
      console.error('❌ Error loading currency_rates:', fiatError)
    } else {
      console.log(`✅ Loaded ${fiatRates.length} fiat pairs`)
      console.log('Sample:', fiatRates.slice(0, 3))
    }

    // Load and populate from cryptocurrency_rates
    console.log('\nLoading from cryptocurrency_rates...')
    const { data: cryptoRates, error: cryptoError } = await supabase
      .from('cryptocurrency_rates')
      .select('*')

    if (cryptoError) {
      console.error('❌ Error loading cryptocurrency_rates:', cryptoError)
    } else {
      console.log(`✅ Loaded ${cryptoRates.length} crypto pairs`)
      console.log('Sample:', cryptoRates.slice(0, 3))
    }

    // Now populate pairs table
    console.log('\n🔄 Populating pairs table...')

    // Insert all fiat rates
    if (fiatRates && fiatRates.length > 0) {
      const fiatPairs = fiatRates.map(r => ({
        from_currency: r.from_currency,
        to_currency: r.to_currency,
        rate: r.rate,
        source_table: 'currency_rates'
      }))

      const { error: insertFiatError } = await supabase
        .from('pairs')
        .upsert(fiatPairs, { onConflict: 'from_currency,to_currency' })

      if (insertFiatError) {
        console.error('❌ Error inserting fiat pairs:', insertFiatError)
      } else {
        console.log(`✅ Inserted ${fiatPairs.length} fiat pairs`)
      }
    }

    // Insert all crypto rates
    if (cryptoRates && cryptoRates.length > 0) {
      const cryptoPairs = cryptoRates.map(r => ({
        from_currency: r.from_currency,
        to_currency: r.to_currency,
        rate: r.rate,
        source_table: 'cryptocurrency_rates'
      }))

      const { error: insertCryptoError } = await supabase
        .from('pairs')
        .upsert(cryptoPairs, { onConflict: 'from_currency,to_currency' })

      if (insertCryptoError) {
        console.error('❌ Error inserting crypto pairs:', insertCryptoError)
      } else {
        console.log(`✅ Inserted ${cryptoPairs.length} crypto pairs`)
      }
    }

    // Final verification
    const { data: finalPairs, error: finalError } = await supabase
      .from('pairs')
      .select('*')

    if (finalError) {
      console.error('❌ Error final check:', finalError)
    } else {
      console.log(`\n✅ Final: ${finalPairs.length} total pairs in table`)
      console.log('Sample from final table:')
      const samples = finalPairs.slice(0, 10)
      samples.forEach(p => {
        console.log(`  ${p.from_currency}_${p.to_currency} = ${p.rate} (from ${p.source_table})`)
      })
    }

  } catch (err) {
    console.error('Fatal error:', err)
  }
}

main()
