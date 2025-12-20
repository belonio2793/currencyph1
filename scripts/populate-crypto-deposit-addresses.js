#!/usr/bin/env node
/**
 * Populate crypto deposit addresses to wallets_house table
 * This script sets up deposit addresses for multiple cryptocurrencies across different networks
 */

import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

const CRYPTO_DEPOSIT_ADDRESSES = [
  // Bitcoin
  { currency: 'BTC', network: 'Bitcoin', address: '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu', provider: 'internal' },
  
  // Ethereum (ERC-20) - single address for multiple tokens
  { currency: 'ETH', network: 'Ethereum', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // Ethereum - Arbitrum One
  { currency: 'ETH', network: 'Arbitrum One', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // Tether (USDT) - multiple networks
  { currency: 'USDT', network: 'Asset Hub (Polkadot)', address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', provider: 'internal' },
  { currency: 'USDT', network: 'APT', address: '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', provider: 'internal' },
  { currency: 'USDT', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDT', network: 'Tron', address: 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', provider: 'internal' },
  { currency: 'USDT', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDT', network: 'Arbitrum One', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDT', network: 'Solana', address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', provider: 'internal' },
  { currency: 'USDT', network: 'The Open Network', address: 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', memo: '641022568', provider: 'internal' },
  { currency: 'USDT', network: 'Polygon', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDT', network: 'Kaia', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDT', network: 'Plasma', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // Binance Coin (BNB)
  { currency: 'BNB', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // XRP (Ripple)
  { currency: 'XRP', network: 'Ripple', address: 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu', memo: '2135060125', provider: 'internal' },
  
  // USDC - multiple networks
  { currency: 'USDC', network: 'Asset Hub (Polkadot)', address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', provider: 'internal' },
  { currency: 'USDC', network: 'APT', address: '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', provider: 'internal' },
  { currency: 'USDC', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDC', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDC', network: 'Arbitrum One', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDC', network: 'RONIN', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDC', network: 'Stellar', address: '475001388', provider: 'internal' },
  { currency: 'USDC', network: 'BASE', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDC', network: 'Polygon', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'USDC', network: 'Solana', address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', provider: 'internal' },
  
  // TRX (Tron)
  { currency: 'TRX', network: 'TRON', address: 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', provider: 'internal' },
  
  // DOGE
  { currency: 'DOGE', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'DOGE', network: 'DogeCoin', address: 'DJungBB29tYgcuUXnXUpParVN9BTwKj4kH', provider: 'internal' },
  
  // ADA (Cardano)
  { currency: 'ADA', network: 'Cardano', address: 'addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2', provider: 'internal' },
  
  // BCH (Bitcoin Cash)
  { currency: 'BCH', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'BCH', network: 'Bitcoin Cash', address: '1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr', provider: 'internal' },
  
  // LINK
  { currency: 'LINK', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'LINK', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // XLM (Stellar)
  { currency: 'XLM', network: 'Stellar', address: 'GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU', memo: '475001388', provider: 'internal' },
  
  // HYPE (Hyperliquid)
  { currency: 'HYPE', network: 'Hyperliquid', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // LITECOIN
  { currency: 'LTC', network: 'Litecoin', address: 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6', provider: 'internal' },
  
  // Sui
  { currency: 'SUI', network: 'Sui', address: '0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb', provider: 'internal' },
  
  // AVAX (Avalanche)
  { currency: 'AVAX', network: 'AVAX C-Chain', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // HBAR (Hedera Hashgraph)
  { currency: 'HBAR', network: 'Hedera Hashgraph', address: '0.0.9932322', memo: '2102701194', provider: 'internal' },
  
  // SHIB
  { currency: 'SHIB', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // PYUSD
  { currency: 'PYUSD', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // WLD (World Chain)
  { currency: 'WLD', network: 'World Chain', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'WLD', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // TON (The Open Network)
  { currency: 'TON', network: 'The Open Network', address: 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', memo: '641022568', provider: 'internal' },
  
  // UNI (Uniswap)
  { currency: 'UNI', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'UNI', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // DOT (Polkadot)
  { currency: 'DOT', network: 'Asset Hub (Polkadot)', address: '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', provider: 'internal' },
  
  // AAVE
  { currency: 'AAVE', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  { currency: 'AAVE', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // XAUT
  { currency: 'XAUT', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // PEPE
  { currency: 'PEPE', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // ASTER
  { currency: 'ASTER', network: 'BNB Smart Chain (BEP20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // ENA
  { currency: 'ENA', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // SKY
  { currency: 'SKY', network: 'Ethereum (ERC20)', address: '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', provider: 'internal' },
  
  // Solana
  { currency: 'SOL', network: 'Solana', address: 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', provider: 'internal' }
]

async function populateAddresses() {
  try {
    console.log(`Starting to populate ${CRYPTO_DEPOSIT_ADDRESSES.length} crypto deposit addresses...`)
    
    // First, check existing addresses
    const { data: existing, error: checkError } = await supabase
      .from('wallets_house')
      .select('id, currency, network, address')
      .eq('wallet_type', 'crypto')
      .eq('provider', 'internal')
    
    if (checkError) {
      console.error('Error checking existing addresses:', checkError)
    } else {
      console.log(`Found ${existing.length} existing internal crypto addresses`)
    }
    
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
    
    // Insert or upsert addresses
    const { data: inserted, error: insertError } = await supabase
      .from('wallets_house')
      .upsert(addressesToInsert, {
        onConflict: 'currency,network,address',
        ignoreDuplicates: false
      })
      .select()
    
    if (insertError) {
      console.error('Error inserting addresses:', insertError)
      process.exit(1)
    } else {
      console.log(`Successfully populated ${inserted.length} crypto deposit addresses`)
      console.log('\nSample addresses:')
      inserted.slice(0, 5).forEach(addr => {
        console.log(`  ${addr.currency} (${addr.network}): ${addr.address}`)
      })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
}

populateAddresses()
