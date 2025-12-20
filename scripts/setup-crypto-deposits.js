#!/usr/bin/env node
/**
 * Setup script for crypto deposit infrastructure
 * 1. Creates wallets_house table if it doesn't exist
 * 2. Populates crypto deposit addresses
 * 3. Verifies the setup
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CRYPTO_DEPOSIT_ADDRESSES = [
  // Bitcoin
  { currency: 'BTC', network: 'Bitcoin', address: '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu', provider: 'internal' },
  
  // Ethereum (ERC-20)
  { currency: 'ETH', network: 'Ethereum', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'ETH', network: 'Arbitrum One', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // Tether (USDT)
  { currency: 'USDT', network: 'Asset Hub (Polkadot)', address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', provider: 'internal' },
  { currency: 'USDT', network: 'APT', address: '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', provider: 'internal' },
  { currency: 'USDT', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDT', network: 'Tron', address: 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', provider: 'internal' },
  { currency: 'USDT', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDT', network: 'Solana', address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', provider: 'internal' },
  
  // Binance Coin (BNB)
  { currency: 'BNB', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // XRP (Ripple)
  { currency: 'XRP', network: 'Ripple', address: 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu', memo: '2135060125', provider: 'internal' },
  
  // USDC
  { currency: 'USDC', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDC', network: 'Solana', address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', provider: 'internal' },
  
  // Solana
  { currency: 'SOL', network: 'Solana', address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', provider: 'internal' },
  
  // Litecoin
  { currency: 'LTC', network: 'Litecoin', address: 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6', provider: 'internal' }
]

async function ensureTableExists() {
  try {
    console.log('Checking if wallets_house table exists...')
    
    const { data, error } = await supabase
      .from('wallets_house')
      .select('count', { count: 'exact' })
      .limit(1)
    
    if (error && error.code === '42P01') {
      console.log('Table does not exist. Creating...')
      
      // Read and execute migration
      const migrationPath = path.join(__dirname, '../supabase/migrations/0100_create_wallets_house.sql')
      
      if (!fs.existsSync(migrationPath)) {
        console.error('Migration file not found at:', migrationPath)
        console.log('Please ensure the migration file exists at: supabase/migrations/0100_create_wallets_house.sql')
        console.log('Or create the table manually using the SQL provided in the migration file.')
        return false
      }
      
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Execute migration through RPC (Supabase doesn't support raw SQL execution)
      console.log('Note: Please run the migration SQL manually in your Supabase dashboard:')
      console.log('Dashboard -> SQL Editor -> New Query -> Paste the migration SQL')
      return false
    } else if (error) {
      console.error('Error checking table:', error)
      return false
    } else {
      console.log('✓ Table exists')
      return true
    }
  } catch (error) {
    console.error('Unexpected error checking table:', error)
    return false
  }
}

async function populateCryptoAddresses() {
  try {
    console.log(`\nPopulating ${CRYPTO_DEPOSIT_ADDRESSES.length} crypto deposit addresses...`)
    
    // Prepare insert data
    const addressesToInsert = CRYPTO_DEPOSIT_ADDRESSES.map(addr => ({
      wallet_type: 'crypto',
      currency: addr.currency,
      network: addr.network,
      address: addr.address,
      provider: addr.provider,
      balance: 0,
      metadata: addr.memo ? { memo: addr.memo } : {}
    }))
    
    // Try upsert first
    const { data: inserted, error: upsertError } = await supabase
      .from('wallets_house')
      .upsert(addressesToInsert, {
        onConflict: 'currency,network,address'
      })
      .select()
    
    if (upsertError) {
      console.error('Error upserting addresses:', upsertError)
      return false
    } else {
      console.log(`✓ Populated ${inserted?.length || 0} crypto deposit addresses`)
      return true
    }
  } catch (error) {
    console.error('Error populating addresses:', error)
    return false
  }
}

async function verifySetup() {
  try {
    console.log('\nVerifying setup...')
    
    const { data: addresses, error } = await supabase
      .from('wallets_house')
      .select('currency, network, address, provider')
      .eq('wallet_type', 'crypto')
      .eq('provider', 'internal')
      .limit(10)
    
    if (error) {
      console.error('Error verifying:', error)
      return false
    }
    
    console.log(`✓ Found ${addresses?.length || 0} crypto deposit addresses:`)
    if (addresses && addresses.length > 0) {
      const groupedByCurrency = {}
      addresses.forEach(addr => {
        if (!groupedByCurrency[addr.currency]) {
          groupedByCurrency[addr.currency] = []
        }
        groupedByCurrency[addr.currency].push(addr.network)
      })
      
      Object.entries(groupedByCurrency).forEach(([currency, networks]) => {
        console.log(`  ${currency}: ${networks.join(', ')}`)
      })
    }
    
    return true
  } catch (error) {
    console.error('Error verifying setup:', error)
    return false
  }
}

async function setup() {
  console.log('Setting up crypto deposit infrastructure...\n')
  
  try {
    // Step 1: Ensure table exists
    console.log('Step 1: Checking table...')
    const tableExists = await ensureTableExists()
    
    if (!tableExists) {
      console.log('\n⚠️  Table check failed. Please:')
      console.log('1. Go to your Supabase dashboard')
      console.log('2. Open SQL Editor')
      console.log('3. Create a new query and paste the SQL from supabase/migrations/0100_create_wallets_house.sql')
      console.log('4. Run the query')
      console.log('\nThen re-run this script.')
      process.exit(1)
    }
    
    // Step 2: Populate addresses
    console.log('\nStep 2: Populating addresses...')
    const populateSuccess = await populateCryptoAddresses()
    
    if (!populateSuccess) {
      console.error('Failed to populate addresses')
      process.exit(1)
    }
    
    // Step 3: Verify setup
    console.log('\nStep 3: Verifying...')
    const verifySuccess = await verifySetup()
    
    if (verifySuccess) {
      console.log('\n✅ Crypto deposit infrastructure setup complete!')
      console.log('\nYou can now:')
      console.log('1. Visit /depots to see the deposit page')
      console.log('2. Select cryptocurrency as deposit method')
      console.log('3. Choose your desired cryptocurrency and network')
      console.log('4. Send funds to the provided address')
    } else {
      console.error('Verification failed')
      process.exit(1)
    }
  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

setup()
