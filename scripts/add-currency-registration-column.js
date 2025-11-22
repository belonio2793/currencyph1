import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

async function addCurrencyRegistrationIdColumn() {
  console.log('🔧 Adding currency_registration_id column to businesses table...')

  try {
    // First, check if the column already exists
    const { data, error: checkError } = await supabase
      .from('businesses')
      .select('currency_registration_id')
      .limit(1)

    if (!checkError) {
      console.log('✅ Column currency_registration_id already exists!')
      return
    }

    // Column doesn't exist, so we need to add it
    // We'll use the raw SQL through Supabase
    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE businesses 
        ADD COLUMN currency_registration_id TEXT UNIQUE NOT NULL DEFAULT '';
        
        CREATE INDEX idx_businesses_currency_registration_id 
        ON businesses(currency_registration_id);
        
        COMMENT ON COLUMN businesses.currency_registration_id IS 
        'Auto-generated unique currency registration ID for currency.ph platform (format: CRN-XXXXXXXXXXXXXXXX). This is immutable once synced with a business.';
      `
    }).catch(err => {
      // If exec_sql doesn't exist, try direct table modification
      return { error: err }
    })

    if (sqlError) {
      console.warn('⚠️  Could not add column via RPC. Please add it manually through Supabase dashboard.')
      console.log('📝 SQL to run in Supabase SQL Editor:')
      console.log(`
ALTER TABLE businesses 
ADD COLUMN currency_registration_id TEXT UNIQUE NOT NULL DEFAULT '';

CREATE INDEX idx_businesses_currency_registration_id 
ON businesses(currency_registration_id);
      `)
      return
    }

    console.log('✅ Column currency_registration_id added successfully!')
    console.log('✅ Index created for faster lookups')
  } catch (err) {
    console.error('❌ Error adding column:', err.message)
    console.log('\n📝 Please add the column manually through Supabase dashboard:')
    console.log('1. Go to https://supabase.com/dashboard')
    console.log('2. Select your project')
    console.log('3. Go to SQL Editor')
    console.log('4. Run this SQL:')
    console.log(`
ALTER TABLE businesses 
ADD COLUMN currency_registration_id TEXT UNIQUE NOT NULL DEFAULT '';

CREATE INDEX idx_businesses_currency_registration_id 
ON businesses(currency_registration_id);
    `)
  }
}

addCurrencyRegistrationIdColumn()
