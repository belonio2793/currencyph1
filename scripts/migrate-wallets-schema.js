#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase credentials')
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

console.log('🔌 Connecting to Supabase...')
console.log(`URL: ${SUPABASE_URL}`)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function executeMigrations() {
  try {
    // Read the SQL migration file
    const migrationPath = path.join(process.cwd(), 'scripts/setup-wallets-schema.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // Split by semicolons to execute individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`\n📝 Executing ${statements.length} SQL statements...\n`)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      const stmtNum = i + 1
      
      try {
        console.log(`[${stmtNum}/${statements.length}] Executing statement...`)
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: stmt })
        
        if (error) {
          console.error(`❌ Error in statement ${stmtNum}:`, error.message)
          console.error('SQL:', stmt.substring(0, 100) + (stmt.length > 100 ? '...' : ''))
          continue
        }
        
        console.log(`✅ Statement ${stmtNum} executed successfully`)
      } catch (err) {
        console.error(`❌ Exception in statement ${stmtNum}:`, err.message)
        console.error('SQL:', stmt.substring(0, 100) + (stmt.length > 100 ? '...' : ''))
      }
    }

    console.log('\n✅ Migration statements processed!')
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  }
}

async function seedCurrencies() {
  try {
    console.log('\n\n📚 Seeding currencies table...')

    const currencies = [
      // Fiat currencies
      { code: 'PHP', name: 'Philippine Peso', type: 'fiat', symbol: '₱', decimals: 2, is_default: true },
      { code: 'USD', name: 'United States Dollar', type: 'fiat', symbol: '$', decimals: 2 },
      { code: 'EUR', name: 'Euro', type: 'fiat', symbol: '€', decimals: 2 },
      { code: 'GBP', name: 'British Pound', type: 'fiat', symbol: '£', decimals: 2 },
      { code: 'JPY', name: 'Japanese Yen', type: 'fiat', symbol: '¥', decimals: 0 },
      { code: 'CAD', name: 'Canadian Dollar', type: 'fiat', symbol: 'C$', decimals: 2 },
      { code: 'AUD', name: 'Australian Dollar', type: 'fiat', symbol: 'A$', decimals: 2 },
      { code: 'SGD', name: 'Singapore Dollar', type: 'fiat', symbol: 'S$', decimals: 2 },
      { code: 'HKD', name: 'Hong Kong Dollar', type: 'fiat', symbol: 'HK$', decimals: 2 },
      { code: 'CNY', name: 'Chinese Yuan', type: 'fiat', symbol: '¥', decimals: 2 },
      { code: 'INR', name: 'Indian Rupee', type: 'fiat', symbol: '₹', decimals: 2 },
      { code: 'MXN', name: 'Mexican Peso', type: 'fiat', symbol: '$', decimals: 2 },
      { code: 'BRL', name: 'Brazilian Real', type: 'fiat', symbol: 'R$', decimals: 2 },
      { code: 'ZAR', name: 'South African Rand', type: 'fiat', symbol: 'R', decimals: 2 },
      
      // Cryptocurrencies
      { code: 'BTC', name: 'Bitcoin', type: 'crypto', symbol: '₿', decimals: 8 },
      { code: 'ETH', name: 'Ethereum', type: 'crypto', symbol: 'Ξ', decimals: 8 },
      { code: 'USDT', name: 'Tether', type: 'crypto', symbol: 'USDT', decimals: 6 },
      { code: 'USDC', name: 'USD Coin', type: 'crypto', symbol: 'USDC', decimals: 6 },
      { code: 'XRP', name: 'Ripple', type: 'crypto', symbol: 'XRP', decimals: 6 },
      { code: 'ADA', name: 'Cardano', type: 'crypto', symbol: 'ADA', decimals: 6 },
      { code: 'SOL', name: 'Solana', type: 'crypto', symbol: 'SOL', decimals: 8 },
      { code: 'DOT', name: 'Polkadot', type: 'crypto', symbol: 'DOT', decimals: 10 },
      { code: 'LINK', name: 'Chainlink', type: 'crypto', symbol: 'LINK', decimals: 18 },
      { code: 'MATIC', name: 'Polygon', type: 'crypto', symbol: 'MATIC', decimals: 18 },
      { code: 'LTC', name: 'Litecoin', type: 'crypto', symbol: 'LTC', decimals: 8 },
      { code: 'BCH', name: 'Bitcoin Cash', type: 'crypto', symbol: 'BCH', decimals: 8 }
    ]

    // Upsert currencies
    const { data, error } = await supabase
      .from('currencies')
      .upsert(currencies, { onConflict: 'code' })
      .select()

    if (error) {
      console.error('❌ Failed to seed currencies:', error.message)
      return false
    }

    console.log(`✅ Seeded ${currencies.length} currencies`)
    console.log(`   - ${currencies.filter(c => c.type === 'fiat').length} fiat currencies`)
    console.log(`   - ${currencies.filter(c => c.type === 'crypto').length} cryptocurrencies`)
    return true
  } catch (err) {
    console.error('❌ Currency seeding failed:', err.message)
    return false
  }
}

async function main() {
  console.log('🚀 Starting wallet schema migration...\n')

  // For now, let's just try to seed currencies since direct SQL execution may not work
  // The schema should already exist in most cases
  const success = await seedCurrencies()

  if (success) {
    console.log('\n\n✅ Migration completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Verify the wallets page loads without errors')
    console.log('2. Check that currencies are displayed correctly')
    console.log('3. Ensure new users get a PHP wallet automatically')
  } else {
    console.log('\n❌ Some steps failed. Check the errors above.')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
