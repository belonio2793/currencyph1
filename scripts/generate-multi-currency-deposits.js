/**
 * Script to generate sample multi-currency deposits
 * Demonstrates:
 * - Deposits from any currency into any user wallet
 * - Automatic conversion and rate calculation
 * - Cross-currency pair support (BTC→PHP, USD→EUR, etc.)
 * 
 * Usage: node scripts/generate-multi-currency-deposits.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_PROJECT_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Example currency pairs to generate
const DEMO_DEPOSITS = [
  {
    amount: 10000,
    fromCurrency: 'BTC',
    toCurrency: 'PHP',
    depositMethod: 'solana',
    description: 'Bitcoin deposit converting to PHP'
  },
  {
    amount: 5000,
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    depositMethod: 'fiat_transfer',
    description: 'US Dollar deposit converting to Euro'
  },
  {
    amount: 2,
    fromCurrency: 'ETH',
    toCurrency: 'CAD',
    depositMethod: 'solana',
    description: 'Ethereum deposit converting to Canadian Dollar'
  },
  {
    amount: 50000,
    fromCurrency: 'PHP',
    toCurrency: 'USD',
    depositMethod: 'gcash',
    description: 'PHP to USD conversion via GCash'
  },
  {
    amount: 100,
    fromCurrency: 'USDT',
    toCurrency: 'AUD',
    depositMethod: 'solana',
    description: 'USDT stablecoin to Australian Dollar'
  },
  {
    amount: 0.5,
    fromCurrency: 'BTC',
    toCurrency: 'EUR',
    depositMethod: 'solana',
    description: 'Bitcoin to Euro cross-conversion'
  }
]

async function getExchangeRate(fromCurrency, toCurrency) {
  try {
    // Check database for cached rate
    const { data: cachedRate, error: dbError } = await supabase
      .from('rates')
      .select('rate')
      .eq('currency_code', fromCurrency)
      .eq('base_currency', toCurrency)
      .single()

    if (!dbError && cachedRate) {
      return cachedRate.rate
    }

    // For demo, use hardcoded realistic rates
    const rates = {
      'BTC_PHP': 2800000, // 1 BTC = 2.8M PHP
      'BTC_USD': 45000,   // 1 BTC = 45k USD
      'BTC_EUR': 42000,   // 1 BTC = 42k EUR
      'BTC_CAD': 62000,   // 1 BTC = 62k CAD
      'BTC_AUD': 70000,   // 1 BTC = 70k AUD
      'ETH_PHP': 170000,  // 1 ETH = 170k PHP
      'ETH_USD': 2500,    // 1 ETH = 2500 USD
      'ETH_EUR': 2300,    // 1 ETH = 2300 EUR
      'ETH_CAD': 3400,    // 1 ETH = 3400 CAD
      'ETH_AUD': 4000,    // 1 ETH = 4000 AUD
      'USD_PHP': 56,      // 1 USD = 56 PHP
      'USD_EUR': 0.92,    // 1 USD = 0.92 EUR
      'USD_CAD': 1.38,    // 1 USD = 1.38 CAD
      'USD_AUD': 1.55,    // 1 USD = 1.55 AUD
      'EUR_PHP': 61,      // 1 EUR = 61 PHP
      'EUR_USD': 1.09,    // 1 EUR = 1.09 USD
      'EUR_CAD': 1.51,    // 1 EUR = 1.51 CAD
      'EUR_AUD': 1.69,    // 1 EUR = 1.69 AUD
      'CAD_PHP': 41,      // 1 CAD = 41 PHP
      'CAD_USD': 0.72,    // 1 CAD = 0.72 USD
      'CAD_EUR': 0.66,    // 1 CAD = 0.66 EUR
      'CAD_AUD': 1.12,    // 1 CAD = 1.12 AUD
      'AUD_PHP': 37,      // 1 AUD = 37 PHP
      'AUD_USD': 0.64,    // 1 AUD = 0.64 USD
      'AUD_EUR': 0.59,    // 1 AUD = 0.59 EUR
      'AUD_CAD': 0.89,    // 1 AUD = 0.89 CAD
      'PHP_USD': 0.018,   // 1 PHP = 0.018 USD
      'PHP_EUR': 0.016,   // 1 PHP = 0.016 EUR
      'PHP_CAD': 0.024,   // 1 PHP = 0.024 CAD
      'PHP_AUD': 0.027,   // 1 PHP = 0.027 AUD
      'USDT_USD': 1,      // 1 USDT = 1 USD
      'USDT_PHP': 56,     // 1 USDT = 56 PHP
      'USDT_EUR': 0.92,   // 1 USDT = 0.92 EUR
      'USDT_AUD': 1.55    // 1 USDT = 1.55 AUD
    }

    const key = `${fromCurrency}_${toCurrency}`
    const rate = rates[key]

    if (rate) {
      return rate
    }

    // Default fallback
    console.warn(`No rate found for ${key}, using default`)
    return 1
  } catch (err) {
    console.error(`Error getting rate for ${fromCurrency}→${toCurrency}:`, err)
    return 1
  }
}

async function generateDeposits() {
  try {
    console.log('🚀 Starting multi-currency deposit generation...\n')

    // Get a test user (first user in database)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (usersError || !users || users.length === 0) {
      console.error('❌ No users found in database')
      return
    }

    const userId = users[0].id
    console.log(`📊 Using user: ${userId}\n`)

    // Get user's wallets
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('id, currency_code, currency_type, currency_name')
      .eq('user_id', userId)

    if (walletsError || !wallets || wallets.length === 0) {
      console.error('❌ User has no wallets')
      return
    }

    console.log(`💼 User has ${wallets.length} wallet(s):\n`)
    wallets.forEach(w => {
      console.log(`   • ${w.currency_code} (${w.currency_type})`)
    })
    console.log()

    // Generate deposits for each demo pair
    let successCount = 0
    let failureCount = 0

    for (const demo of DEMO_DEPOSITS) {
      try {
        // Find a wallet for the target currency
        const targetWallet = wallets.find(w => w.currency_code === demo.toCurrency)

        if (!targetWallet) {
          console.log(`⏭️  Skipping ${demo.fromCurrency}→${demo.toCurrency} (no ${demo.toCurrency} wallet)`)
          continue
        }

        // Get exchange rate
        const rate = await getExchangeRate(demo.fromCurrency, demo.toCurrency)
        const convertedAmount = parseFloat(demo.amount) * rate

        // Round to 2-8 decimal places based on currency
        const decimals = ['USD', 'EUR', 'GBP', 'PHP'].includes(demo.toCurrency) ? 2 : 8
        const roundedAmount = Math.round(convertedAmount * Math.pow(10, decimals)) / Math.pow(10, decimals)

        // Create deposit record
        const depositRecord = {
          user_id: userId,
          wallet_id: targetWallet.id,
          amount: demo.amount,
          currency_code: demo.fromCurrency,
          received_currency: demo.toCurrency,
          exchange_rate: rate,
          converted_amount: roundedAmount,
          deposit_method: demo.depositMethod,
          status: 'completed', // Mark as completed for demo
          description: demo.description,
          payment_reference: `DEMO-${Date.now()}`,
          metadata: {
            conversion_rate: rate,
            from_currency: demo.fromCurrency,
            to_currency: demo.toCurrency,
            created_via: 'multi_currency_deposit_demo'
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        }

        // Insert deposit
        const { data: deposit, error: insertError } = await supabase
          .from('deposits')
          .insert([depositRecord])
          .select()
          .single()

        if (insertError) {
          console.log(`❌ Failed to create ${demo.fromCurrency}→${demo.toCurrency}: ${insertError.message}`)
          failureCount++
        } else {
          console.log(
            `✅ ${demo.amount} ${demo.fromCurrency} → ${roundedAmount} ${demo.toCurrency} (Rate: ${rate})`
          )
          successCount++
        }
      } catch (err) {
        console.error(`❌ Error creating deposit: ${err.message}`)
        failureCount++
      }
    }

    console.log(`\n📈 Generation complete: ${successCount} created, ${failureCount} failed\n`)
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

// Run the script
generateDeposits()
