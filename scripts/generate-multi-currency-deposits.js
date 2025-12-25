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
    // Return 1 if same currency
    if (fromCurrency === toCurrency) {
      return 1
    }

    const fromUpper = fromCurrency.toUpperCase()
    const toUpper = toCurrency.toUpperCase()

    // Try direct pair from public.pairs table (exconvert data)
    const { data: directRate, error: directError } = await supabase
      .from('pairs')
      .select('rate')
      .eq('from_currency', fromUpper)
      .eq('to_currency', toUpper)
      .single()

    if (!directError && directRate && typeof directRate.rate === 'number' && directRate.rate > 0) {
      return directRate.rate
    }

    // Fallback: try base currency conversion (USD)
    const baseCurrency = 'USD'
    if (fromUpper !== baseCurrency && toUpper !== baseCurrency) {
      const { data: fromBase, error: fromBaseError } = await supabase
        .from('pairs')
        .select('rate')
        .eq('from_currency', fromUpper)
        .eq('to_currency', baseCurrency)
        .single()

      const { data: baseToTarget, error: baseToError } = await supabase
        .from('pairs')
        .select('rate')
        .eq('from_currency', baseCurrency)
        .eq('to_currency', toUpper)
        .single()

      if (
        !fromBaseError &&
        !baseToError &&
        fromBase &&
        baseToTarget &&
        typeof fromBase.rate === 'number' &&
        typeof baseToTarget.rate === 'number' &&
        fromBase.rate > 0 &&
        baseToTarget.rate > 0
      ) {
        return fromBase.rate * baseToTarget.rate
      }
    }

    // Alternative fallback: try PHP base
    const altBase = 'PHP'
    if (fromUpper !== altBase && toUpper !== altBase) {
      const { data: fromAlt, error: fromAltError } = await supabase
        .from('pairs')
        .select('rate')
        .eq('from_currency', fromUpper)
        .eq('to_currency', altBase)
        .single()

      const { data: altToTarget, error: altToError } = await supabase
        .from('pairs')
        .select('rate')
        .eq('from_currency', altBase)
        .eq('to_currency', toUpper)
        .single()

      if (
        !fromAltError &&
        !altToError &&
        fromAlt &&
        altToTarget &&
        typeof fromAlt.rate === 'number' &&
        typeof altToTarget.rate === 'number' &&
        fromAlt.rate > 0 &&
        altToTarget.rate > 0
      ) {
        return fromAlt.rate * altToTarget.rate
      }
    }

    console.warn(`No rate found for ${fromCurrency}→${toCurrency}, check if pair exists in public.pairs`)
    throw new Error(`No exchange rate available for ${fromCurrency}→${toCurrency}`)
  } catch (err) {
    console.error(`Error getting rate for ${fromCurrency}→${toCurrency}:`, err)
    throw err
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
