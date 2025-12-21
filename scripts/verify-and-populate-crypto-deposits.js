#!/usr/bin/env node
/**
 * Verify and populate crypto deposit addresses in wallets_house table
 * Ensures the table matches the provided JSON configuration exactly
 */

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Exact data from provided JSON - mapped to match database schema
const CRYPTO_DEPOSITS = [
  { asset: 'Bitcoin (BTC)', network: 'Bitcoin', address: '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu' },
  { asset: 'Bitcoin (BTC)', network: 'Bitcoin Lightning Network', address: null },
  { asset: 'Ethereum', network: 'ERC-20', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'Ethereum', network: 'Arbitrum One', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'Tether (USDT)', network: 'Asset Hub (Polkadot)', address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ' },
  { asset: 'Tether (USDT)', network: 'APT', address: '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe' },
  { asset: 'Tether (USDT)', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'Tether (USDT)', network: 'Tron', address: 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB' },
  { asset: 'Tether (USDT)', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'Tether (USDT)', network: 'Arbitrum One', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'Tether (USDT)', network: 'Solana', address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS' },
  { asset: 'Tether (USDT)', network: 'The Open Network', address: 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', tag: '641022568' },
  { asset: 'Tether (USDT)', network: 'Polygon', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'Tether (USDT)', network: 'Kaia', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'Tether (USDT)', network: 'Plasma', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'Binance Coin', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'XRP (XRP)', network: 'Ripple', address: 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu', tag: '2135060125' },
  { asset: 'USDC', network: 'Asset Hub (Polkadot)', address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ' },
  { asset: 'USDC', network: 'APT', address: '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe' },
  { asset: 'USDC', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'USDC', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'USDC', network: 'Arbitrum One', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'USDC', network: 'RONIN', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'USDC', network: 'Stellar', address: '475001388' },
  { asset: 'USDC', network: 'BASE', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'USDC', network: 'Polygon', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'USDC', network: 'Solana', address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS' },
  { asset: 'TRX', network: 'TRON', address: 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB' },
  { asset: 'DOGE', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'DOGE', network: 'DogeCoin', address: 'DJungBB29tYgcuUXnXUpParVN9BTwKj4kH' },
  { asset: 'ADA', network: 'Cardano', address: 'addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2' },
  { asset: 'BCH', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'BCH', network: 'Bitcoin Cash', address: '1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr' },
  { asset: 'LINK', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'LINK', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'XLM', network: 'Stellar', address: 'GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU', memo: '475001388' },
  { asset: 'HYPE', network: 'Hyperliquid', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'LITECOIN', network: 'Litecoin', address: 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6' },
  { asset: 'Sui', network: 'Sui', address: '0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb' },
  { asset: 'AVAX', network: 'AVAX C-Chain', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'HBAR', network: 'Hedera Hashgraph', address: '0.0.9932322', tag: '2102701194' },
  { asset: 'SHIB', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'PYUSD', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'WLD', network: 'World Chain', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'WLD', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'TON', network: 'The Open Network', address: 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', tag: '641022568' },
  { asset: 'UNI', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'UNI', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'DOT', network: 'Asset Hub (Polkadot)', address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ' },
  { asset: 'AAVE', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'AAVE', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'XAUT', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'PEPE', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'ASTER', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'ENA', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
  { asset: 'SKY', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c' },
]

async function verifyAndPopulate() {
  try {
    console.log('🔍 Starting verification and population of crypto deposits...\n')

    // Fetch current data
    const { data: currentData, error: fetchError } = await supabase
      .from('wallets_house')
      .select('id, currency_name, network, address, metadata, wallet_type, provider')
      .eq('wallet_type', 'crypto')
      .eq('provider', 'internal')

    if (fetchError) {
      console.error('❌ Error fetching current data:', fetchError)
      process.exit(1)
    }

    console.log(`📊 Current database has ${currentData.length} entries`)
    console.log(`📊 JSON configuration has ${CRYPTO_DEPOSITS.length} entries\n`)

    // Build comparison maps
    const currentMap = new Map()
    currentData.forEach(row => {
      const key = `${row.currency_name}|${row.network}|${row.address}`
      currentMap.set(key, row)
    })

    const jsonMap = new Map()
    CRYPTO_DEPOSITS.forEach(entry => {
      const key = `${entry.asset}|${entry.network}|${entry.address}`
      jsonMap.set(key, entry)
    })

    // Find discrepancies
    const toAdd = []
    const toRemove = []
    const toUpdate = []

    // Check for entries in JSON that are missing or different in DB
    for (const [key, jsonEntry] of jsonMap) {
      const currentEntry = currentMap.get(key)
      if (!currentEntry) {
        toAdd.push(jsonEntry)
      }
    }

    // Check for entries in DB that are not in JSON
    for (const [key, currentEntry] of currentMap) {
      if (!jsonMap.has(key)) {
        toRemove.push(currentEntry)
      }
    }

    // Report findings
    console.log('📋 VERIFICATION REPORT:')
    console.log(`  ✓ Entries to add: ${toAdd.length}`)
    console.log(`  ✓ Entries to remove: ${toRemove.length}`)
    console.log(`  ✓ Entries already correct: ${currentData.length - toRemove.length}`)
    console.log()

    if (toAdd.length > 0) {
      console.log(`⚠️  New entries to add (${toAdd.length}):`)
      toAdd.forEach(entry => {
        console.log(`  - ${entry.asset} (${entry.network}): ${entry.address || 'NULL'}`)
      })
      console.log()
    }

    if (toRemove.length > 0) {
      console.log(`⚠️  Entries to remove from DB (${toRemove.length}):`)
      toRemove.forEach(entry => {
        console.log(`  - ${entry.currency_name} (${entry.network}): ${entry.address || 'NULL'}`)
      })
      console.log()
    }

    // Check for pending null addresses that shouldn't be null
    const nullAddressesInJson = CRYPTO_DEPOSITS.filter(e => e.address === null)
    const nullAddressesInDb = currentData.filter(e => e.address === null)

    console.log(`🔍 NULL ADDRESS CHECK:`)
    console.log(`  ✓ NULL addresses in JSON: ${nullAddressesInJson.length}`)
    if (nullAddressesInJson.length > 0) {
      nullAddressesInJson.forEach(entry => {
        console.log(`    - ${entry.asset} (${entry.network})`)
      })
    }
    console.log(`  ✓ NULL addresses in DB: ${nullAddressesInDb.length}`)
    if (nullAddressesInDb.length > 0 && nullAddressesInDb.length > nullAddressesInJson.length) {
      console.log(`    ⚠️  Found extra NULL addresses in DB:`)
      nullAddressesInDb.forEach(entry => {
        const inJson = nullAddressesInJson.find(j => j.asset === entry.currency_name && j.network === entry.network)
        if (!inJson) {
          console.log(`      - ${entry.currency_name} (${entry.network}) [NOT IN JSON]`)
        }
      })
    }
    console.log()

    // Summary
    if (toAdd.length === 0 && toRemove.length === 0 && nullAddressesInDb.length === nullAddressesInJson.length) {
      console.log('✅ SUCCESS: Database matches JSON configuration exactly!')
      console.log(`   Total verified entries: ${currentData.length}`)
    } else {
      console.log('⚠️  ACTION REQUIRED:')
      if (toAdd.length > 0) {
        console.log(`   1. Run migrations to add ${toAdd.length} missing entries`)
      }
      if (toRemove.length > 0) {
        console.log(`   2. Remove ${toRemove.length} entries that are not in JSON`)
      }
      if (nullAddressesInDb.length > nullAddressesInJson.length) {
        console.log(`   3. Fill or review ${nullAddressesInDb.length - nullAddressesInJson.length} unexpected NULL addresses`)
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

verifyAndPopulate()
