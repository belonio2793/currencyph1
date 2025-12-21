#!/usr/bin/env node

/**
 * Repair script to fix deposits with missing received_amount (PHP conversion)
 * 
 * This script:
 * 1. Finds all crypto deposits without received_amount
 * 2. Fetches current exchange rates from CoinGecko
 * 3. Calculates the PHP equivalent amount
 * 4. Updates the deposit record
 * 5. If deposit was approved, recalculates and fixes the wallet balance
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Crypto to CoinGecko ID mapping
const coingeckoIds = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'BCH': 'bitcoin-cash',
  'LTC': 'litecoin',
  'USDC': 'usd-coin',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'UNI': 'uniswap',
  'AVAX': 'avalanche-2',
  'TON': 'the-open-network',
  'HBAR': 'hedera-hashgraph',
  'SUI': 'sui',
  'TRX': 'tron',
  'XLM': 'stellar'
}

// Get crypto price in PHP
async function getCryptoPriceInPHP(cryptoCode) {
  try {
    const coingeckoId = coingeckoIds[cryptoCode] || cryptoCode.toLowerCase()
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=php`,
      { timeout: 5000 }
    )

    if (!response.ok) {
      console.error(`❌ CoinGecko API error for ${cryptoCode}: ${response.status}`)
      return null
    }

    const data = await response.json()
    const price = data[coingeckoId]?.php

    if (price) {
      return { price, source: 'coingecko' }
    }
    return null
  } catch (error) {
    console.error(`❌ Failed to get ${cryptoCode} price:`, error.message)
    return null
  }
}

async function repairDeposits() {
  console.log('🔧 Starting deposit conversion repair...\n')

  // Get all deposits without received_amount
  const { data: deposits, error: fetchError } = await supabase
    .from('deposits')
    .select('id, user_id, wallet_id, amount, currency_code, status, received_amount, exchange_rate')
    .is('received_amount', null)
    .neq('currency_code', 'PHP')
    .order('created_at', { ascending: false })

  if (fetchError) {
    console.error('❌ Failed to fetch deposits:', fetchError)
    process.exit(1)
  }

  if (!deposits || deposits.length === 0) {
    console.log('✅ No deposits need repair!\n')
    return
  }

  console.log(`Found ${deposits.length} deposits to repair:\n`)

  let repaired = 0
  let walletsFixed = 0
  let failed = 0

  for (const deposit of deposits) {
    const { id, user_id, wallet_id, amount, currency_code, status } = deposit

    console.log(`📝 Processing deposit ${id} (${amount} ${currency_code})`)

    // Get crypto price in PHP
    const priceData = await getCryptoPriceInPHP(currency_code)
    if (!priceData) {
      console.log(`   ⚠️  Could not get price for ${currency_code}, skipping...\n`)
      failed++
      continue
    }

    const receivedAmount = amount * priceData.price
    console.log(`   💱 Rate: 1 ${currency_code} = ${priceData.price} PHP`)
    console.log(`   ✓ Received amount: ${receivedAmount.toFixed(2)} PHP`)

    // Update deposit with received_amount and exchange_rate
    const { error: updateError } = await supabase
      .from('deposits')
      .update({
        received_amount: receivedAmount,
        exchange_rate: priceData.price,
        rate_source: priceData.source,
        rate_fetched_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.log(`   ❌ Failed to update deposit: ${updateError.message}\n`)
      failed++
      continue
    }

    repaired++
    console.log(`   ✅ Deposit record updated`)

    // If deposit is completed/approved, need to recalculate wallet balance
    if (status === 'completed' || status === 'approved') {
      console.log(`   🔄 Deposit is ${status}, checking wallet balance...`)

      // Get all approved crypto deposits for this wallet
      const { data: approvedDeposits, error: approvedError } = await supabase
        .from('deposits')
        .select('amount, currency_code, received_amount')
        .eq('wallet_id', wallet_id)
        .in('status', ['completed', 'approved'])

      if (approvedError) {
        console.log(`   ⚠️  Could not fetch approved deposits for wallet: ${approvedError.message}`)
        console.log(`   ℹ️  Manual wallet balance fix may be needed\n`)
        continue
      }

      // Calculate total PHP from all approved deposits
      let totalPhp = 0
      for (const dep of approvedDeposits) {
        if (dep.currency_code === 'PHP') {
          totalPhp += parseFloat(dep.amount)
        } else if (dep.received_amount) {
          totalPhp += parseFloat(dep.received_amount)
        } else {
          console.log(`   ⚠️  Deposit ${dep.id} still missing received_amount`)
        }
      }

      // Get wallet and update balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', wallet_id)
        .single()

      if (walletError) {
        console.log(`   ⚠️  Could not fetch wallet: ${walletError.message}\n`)
        continue
      }

      const currentBalance = parseFloat(wallet.balance)
      if (Math.abs(currentBalance - totalPhp) > 0.01) {
        console.log(`   💰 Wallet balance mismatch detected:`)
        console.log(`      Current: ${currentBalance} PHP`)
        console.log(`      Should be: ${totalPhp} PHP`)
        console.log(`      Difference: ${totalPhp - currentBalance} PHP`)

        // Update wallet balance
        const { error: balanceError } = await supabase
          .from('wallets')
          .update({ balance: totalPhp })
          .eq('id', wallet_id)

        if (balanceError) {
          console.log(`   ❌ Failed to update wallet balance: ${balanceError.message}\n`)
        } else {
          console.log(`   ✅ Wallet balance corrected to ${totalPhp} PHP`)
          walletsFixed++
        }
      } else {
        console.log(`   ✅ Wallet balance is correct`)
      }
    }

    console.log('')
  }

  console.log('\n=== REPAIR SUMMARY ===')
  console.log(`✅ Repaired: ${repaired} deposits`)
  console.log(`🔧 Wallets fixed: ${walletsFixed}`)
  console.log(`❌ Failed: ${failed} deposits`)
  console.log('')

  if (failed > 0) {
    console.log('⚠️  Some deposits could not be repaired. Please review manually.')
  }
}

repairDeposits().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
