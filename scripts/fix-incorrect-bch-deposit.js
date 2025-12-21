/**
 * Fix Script: Correct 3443 BCH deposit that was incorrectly credited as PHP
 *
 * This script:
 * 1. Finds the problematic deposit (3443 BCH)
 * 2. Gets the current BCH/PHP exchange rate
 * 3. Calculates the correct PHP amount
 * 4. Updates the deposit with conversion data
 * 5. Adjusts the wallet balance to correct amount
 * 6. Creates audit trail entries
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function fixIncorrectBchDeposit() {
  console.log('🔧 Starting BCH deposit correction...\n')

  try {
    // Step 1: Find the problematic deposit
    console.log('📍 Step 1: Finding 3443 BCH deposit...')
    const { data: deposits, error: fetchError } = await supabase
      .from('deposits')
      .select(`
        id,
        user_id,
        wallet_id,
        amount,
        currency_code,
        status,
        created_at,
        wallets!inner(
          id,
          user_id,
          currency_code,
          balance
        ),
        users!inner(
          id,
          email
        )
      `)
      .eq('amount', 3443)
      .eq('currency_code', 'BCH')
      .eq('wallets.currency_code', 'PHP')

    if (fetchError) {
      throw new Error(`Failed to fetch deposits: ${fetchError.message}`)
    }

    if (!deposits || deposits.length === 0) {
      console.log('✓ No problematic BCH/PHP deposits found.')
      return { found: false, message: 'No deposits to fix' }
    }

    const deposit = deposits[0]
    console.log(`✓ Found deposit: ${deposit.id}`)
    console.log(`  - User: ${deposit.users.email}`)
    console.log(`  - Amount: ${deposit.amount} BCH`)
    console.log(`  - Wallet Currency: ${deposit.wallets.currency_code}`)
    console.log(`  - Status: ${deposit.status}`)
    console.log(`  - Current Wallet Balance: ${deposit.wallets.balance} PHP\n`)

    // Step 2: Get current BCH/PHP exchange rate
    console.log('💱 Step 2: Getting BCH/PHP exchange rate...')
    const { data: rateData, error: rateError } = await supabase
      .from('crypto_rates_valid')
      .select('rate, source, updated_at')
      .eq('from_currency', 'BCH')
      .eq('to_currency', 'PHP')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (rateError || !rateData) {
      throw new Error('Cannot get BCH/PHP exchange rate. Please ensure crypto_rates table is populated.')
    }

    const exchangeRate = parseFloat(rateData.rate)
    const correctPhpAmount = deposit.amount * exchangeRate

    console.log(`✓ Exchange rate found:`)
    console.log(`  - Rate: 1 BCH = ${exchangeRate} PHP`)
    console.log(`  - Source: ${rateData.source}`)
    console.log(`  - Updated: ${rateData.updated_at}`)
    console.log(`  - Correct PHP amount: ${correctPhpAmount.toFixed(2)} PHP\n`)

    // Step 3: Calculate balance correction
    console.log('🔢 Step 3: Calculating balance correction...')
    const incorrectAmount = deposit.amount // 3443 (treated as PHP)
    const balanceDifference = correctPhpAmount - incorrectAmount
    const newWalletBalance = deposit.wallets.balance - incorrectAmount + correctPhpAmount

    console.log(`  - Original wallet balance: ${deposit.wallets.balance} PHP`)
    console.log(`  - Incorrect credit: +${incorrectAmount} PHP`)
    console.log(`  - Should be: +${correctPhpAmount.toFixed(2)} PHP`)
    console.log(`  - Correction needed: ${balanceDifference > 0 ? '+' : ''}${balanceDifference.toFixed(2)} PHP`)
    console.log(`  - New wallet balance: ${newWalletBalance.toFixed(2)} PHP\n`)

    // Step 4: Update the deposit record
    console.log('📝 Step 4: Updating deposit record...')
    const { error: depositUpdateError } = await supabase
      .from('deposits')
      .update({
        received_amount: deposit.amount,
        received_currency: 'BCH',
        exchange_rate: exchangeRate,
        converted_amount: correctPhpAmount,
        conversion_status: 'confirmed'
      })
      .eq('id', deposit.id)

    if (depositUpdateError) {
      throw new Error(`Failed to update deposit: ${depositUpdateError.message}`)
    }

    console.log(`✓ Deposit updated with conversion data\n`)

    // Step 5: Correct the wallet balance
    console.log('💰 Step 5: Correcting wallet balance...')
    const { error: walletUpdateError } = await supabase
      .from('wallets')
      .update({
        balance: newWalletBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', deposit.wallet_id)

    if (walletUpdateError) {
      throw new Error(`Failed to update wallet: ${walletUpdateError.message}`)
    }

    console.log(`✓ Wallet balance corrected\n`)

    // Step 6: Create wallet transaction for the correction
    console.log('📊 Step 6: Recording transaction...')
    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert([{
        wallet_id: deposit.wallet_id,
        user_id: deposit.user_id,
        type: 'adjustment',
        amount: Math.abs(balanceDifference),
        balance_before: deposit.wallets.balance,
        balance_after: newWalletBalance,
        currency_code: 'PHP',
        description: `BCH deposit correction: 3443 BCH converted to ${correctPhpAmount.toFixed(2)} PHP at rate ${exchangeRate}`,
        reference_id: deposit.id
      }])

    if (txError) {
      console.warn(`⚠️ Warning: Failed to record transaction: ${txError.message}`)
    } else {
      console.log(`✓ Transaction recorded\n`)
    }

    // Step 7: Record audit entry
    console.log('🔍 Step 7: Recording audit trail...')
    const { error: auditError } = await supabase
      .from('deposit_conversion_audit')
      .insert([{
        deposit_id: deposit.id,
        user_id: deposit.user_id,
        action: 'conversion_applied',
        received_amount: deposit.amount,
        received_currency: 'BCH',
        exchange_rate: exchangeRate,
        converted_amount: correctPhpAmount,
        wallet_currency: 'PHP',
        notes: `CORRECTION: Fixed incorrect BCH/PHP deposit. Original balance was ${deposit.wallets.balance} PHP, corrected to ${newWalletBalance.toFixed(2)} PHP. Correction amount: ${balanceDifference > 0 ? '+' : ''}${balanceDifference.toFixed(2)} PHP`
      }])

    if (auditError) {
      console.warn(`⚠️ Warning: Failed to record audit: ${auditError.message}`)
    } else {
      console.log(`✓ Audit trail recorded\n`)
    }

    // Summary
    console.log('✅ ===== CORRECTION COMPLETE =====')
    console.log(`Deposit ID: ${deposit.id}`)
    console.log(`User: ${deposit.users.email}`)
    console.log(`Conversion: 3443 BCH → ${correctPhpAmount.toFixed(2)} PHP`)
    console.log(`Exchange Rate: 1 BCH = ${exchangeRate} PHP`)
    console.log(`Balance Correction: ${balanceDifference > 0 ? '+' : ''}${balanceDifference.toFixed(2)} PHP`)
    console.log(`New Wallet Balance: ${newWalletBalance.toFixed(2)} PHP`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log('================================\n')

    return {
      success: true,
      depositId: deposit.id,
      userEmail: deposit.users.email,
      originalAmount: deposit.amount,
      originalCurrency: 'BCH',
      convertedAmount: correctPhpAmount,
      targetCurrency: 'PHP',
      exchangeRate: exchangeRate,
      balanceCorrection: balanceDifference,
      newWalletBalance: newWalletBalance
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message)
    process.exit(1)
  }
}

// Run the fix
fixIncorrectBchDeposit()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 Fix script completed successfully!')
    }
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Fix script failed:', error)
    process.exit(1)
  })
