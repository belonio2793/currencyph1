#!/usr/bin/env node
/**
 * Sync Coins.ph cryptocurrency deposit addresses to wallets_house
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... COINS_PH_API_KEY=... COINS_PH_API_SECRET=... node scripts/sync-coinsph-addresses.js
 */

import { createClient } from '@supabase/supabase-js'

const COINS_PH_API_BASE = 'https://api.pro.coins.ph'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COINS_PH_API_KEY = process.env.COINSPH_API_KEY
const COINS_PH_API_SECRET = process.env.COINSPH_API_SECRET

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

if (!COINS_PH_API_KEY || !COINS_PH_API_SECRET) {
  console.error('❌ Missing Coins.ph API credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/**
 * HMAC-SHA256 signing helper
 */
async function signRequest(params, secret) {
  const queryString = Object.entries(params)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const encoder = new TextEncoder()
  const data = encoder.encode(queryString)

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, data)
  const hashArray = Array.from(new Uint8Array(signature))

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Fetch deposit address for a specific coin
 */
async function getDepositAddress(coin) {
  try {
    const params = {
      coin,
      timestamp: Math.floor(Date.now()),
    }

    const signature = await signRequest(params, COINS_PH_API_SECRET)
    params.signature = signature

    const queryString = new URLSearchParams(params).toString()
    const url = `${COINS_PH_API_BASE}/openapi/wallet/v1/deposit/address?${queryString}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': COINS_PH_API_KEY,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.warn(`⚠️  Failed to fetch address for ${coin}:`, error)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error(`❌ Error fetching address for ${coin}:`, error.message)
    return null
  }
}

/**
 * Get all coins' information
 */
async function getAllCoins() {
  try {
    const params = {
      timestamp: Math.floor(Date.now()),
    }

    const signature = await signRequest(params, COINS_PH_API_SECRET)
    params.signature = signature

    const queryString = new URLSearchParams(params).toString()
    const url = `${COINS_PH_API_BASE}/openapi/wallet/v1/coin/all/information?${queryString}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': COINS_PH_API_KEY,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Failed to fetch coins information:', error)
      return []
    }

    const data = await response.json()
    return Array.isArray(data) ? data : data.data || []
  } catch (error) {
    console.error('❌ Error fetching coins information:', error.message)
    return []
  }
}

/**
 * Sync address to database
 */
async function syncAddressToDatabase(coin, addressData) {
  try {
    if (!addressData || !addressData.address) {
      console.warn(`⚠️  No address data for ${coin}`)
      return false
    }

    const { address, network = coin } = addressData

    // Check if already exists
    const { data: existing, error: checkErr } = await supabase
      .from('wallets_house')
      .select('id')
      .eq('currency', coin)
      .eq('provider', 'coins.ph')
      .single()

    if (checkErr && checkErr.code !== 'PGRST116') {
      console.error(`❌ Error checking for existing ${coin} entry:`, checkErr)
      return false
    }

    const walletData = {
      wallet_type: 'crypto',
      currency: coin,
      network,
      address,
      provider: 'coins.ph',
      balance: 0,
      metadata: {
        coin,
        network,
        synced_from: 'coins.ph_api',
        synced_at: new Date().toISOString(),
      },
      synced_at: new Date().toISOString(),
    }

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('wallets_house')
        .update(walletData)
        .eq('id', existing.id)
        .select()

      if (error) {
        console.error(`❌ Failed to update ${coin}:`, error)
        return false
      }

      console.log(`✅ Updated ${coin} at ${address}`)
      return true
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('wallets_house')
        .insert([walletData])
        .select()

      if (error) {
        console.error(`❌ Failed to insert ${coin}:`, error)
        return false
      }

      console.log(`✨ Created new ${coin} wallet at ${address}`)
      return true
    }
  } catch (error) {
    console.error(`❌ Error syncing ${coin} to database:`, error.message)
    return false
  }
}

/**
 * Main sync function
 */
async function run() {
  console.log('\n🔄 Syncing Coins.ph cryptocurrency addresses to wallets_house...\n')

  try {
    // Get all coins
    console.log('📥 Fetching all coins information from Coins.ph...')
    const coins = await getAllCoins()

    if (coins.length === 0) {
      console.warn('⚠️  No coins found')
      return
    }

    console.log(`✅ Found ${coins.length} coins\n`)

    let successCount = 0
    let failureCount = 0

    // Process each coin
    for (const coinObj of coins) {
      const coin = coinObj.coin || coinObj.symbol || coinObj
      if (!coin) continue

      console.log(`\n📍 Processing ${coin}...`)

      // Fetch deposit address
      const addressData = await getDepositAddress(coin)

      if (addressData) {
        // Sync to database
        const synced = await syncAddressToDatabase(coin, addressData)
        if (synced) {
          successCount++
        } else {
          failureCount++
        }
      } else {
        failureCount++
      }

      // Rate limiting to avoid API throttling
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log('\n' + '='.repeat(50))
    console.log(`\n✨ Sync Complete!`)
    console.log(`✅ Synced: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)
    console.log(`📊 Total: ${coins.length}\n`)
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

run()
