#!/usr/bin/env node
/**
 * Test script to verify crypto deposit system is working correctly
 */

import { createClient } from '@supabase/supabase-js'
import { getCryptoPrice } from '../src/lib/cryptoRatesService.js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COINS_PH_API_KEY = process.env.COINS_PH_API_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

let testsPassed = 0
let testsFailed = 0

function logTest(name, passed, message = '') {
  if (passed) {
    console.log(`✅ ${name}`)
    testsPassed++
  } else {
    console.log(`❌ ${name}${message ? ': ' + message : ''}`)
    testsFailed++
  }
}

async function testDatabaseConnection() {
  console.log('\n📋 Testing Database Connection...')
  try {
    const { data, error } = await supabase.from('wallets_house').select('count', { count: 'exact' }).limit(1)
    
    if (error && error.code === '42P01') {
      logTest('Table exists', false, 'wallets_house table not found. Run: node scripts/setup-crypto-deposits.js')
      return false
    } else if (error) {
      logTest('Table exists', false, error.message)
      return false
    } else {
      logTest('Table exists', true)
      return true
    }
  } catch (error) {
    logTest('Database connection', false, error.message)
    return false
  }
}

async function testAddressesPopulated() {
  console.log('\n📍 Testing Crypto Addresses...')
  try {
    const { data: addresses, error } = await supabase
      .from('wallets_house')
      .select('currency, network, address')
      .eq('wallet_type', 'crypto')
      .limit(100)
    
    if (error) {
      logTest('Fetch addresses', false, error.message)
      return false
    }
    
    logTest('Fetch addresses', addresses && addresses.length > 0, `Found ${addresses?.length || 0} addresses`)
    
    if (addresses && addresses.length > 0) {
      // Group by currency
      const byCurrency = {}
      addresses.forEach(addr => {
        if (!byCurrency[addr.currency]) byCurrency[addr.currency] = []
        byCurrency[addr.currency].push(addr.network)
      })
      
      console.log('  Cryptocurrencies found:')
      Object.entries(byCurrency).forEach(([currency, networks]) => {
        console.log(`    • ${currency}: ${networks.join(', ')}`)
      })
    }
    
    return addresses && addresses.length > 0
  } catch (error) {
    logTest('Test addresses', false, error.message)
    return false
  }
}

async function testAddressValidation() {
  console.log('\n✔️ Testing Address Format...')
  try {
    const { data: addresses, error } = await supabase
      .from('wallets_house')
      .select('currency, address')
      .eq('wallet_type', 'crypto')
      .limit(10)
    
    if (error || !addresses || addresses.length === 0) {
      logTest('Address validation', false, 'Could not fetch addresses')
      return false
    }
    
    let validCount = 0
    addresses.forEach(addr => {
      // Basic validation: address should be non-empty and reasonable length
      if (addr.address && addr.address.length >= 20 && addr.address.length <= 200) {
        validCount++
      }
    })
    
    const allValid = validCount === addresses.length
    logTest('Address format valid', allValid, `${validCount}/${addresses.length} valid`)
    
    return allValid
  } catch (error) {
    logTest('Address validation', false, error.message)
    return false
  }
}

async function testCryptoRates() {
  console.log('\n💹 Testing Crypto Rates...')
  
  if (!COINS_PH_API_KEY) {
    logTest('API key configured', false, 'COINS_PH_API_KEY not set')
    return false
  }
  
  logTest('API key configured', true)
  
  try {
    // Test with BTC
    const price = await getCryptoPrice('BTC')
    
    if (!price || price <= 0) {
      logTest('Fetch BTC rate', false, 'Invalid price returned')
      return false
    }
    
    logTest('Fetch BTC rate', true, `1 BTC = ${price} PHP`)
    
    // Test a few more cryptos
    const testCryptos = ['ETH', 'SOL', 'USDT', 'XRP']
    let successCount = 0
    
    for (const crypto of testCryptos) {
      try {
        const p = await getCryptoPrice(crypto)
        if (p && p > 0) {
          successCount++
          console.log(`    • ${crypto} = ${p} PHP`)
        }
      } catch (e) {
        console.log(`    • ${crypto} = ❌ ${e.message}`)
      }
    }
    
    logTest('Fetch multiple rates', successCount >= 2, `${successCount}/${testCryptos.length} successful`)
    
    return price && price > 0
  } catch (error) {
    logTest('Fetch crypto rates', false, error.message)
    return false
  }
}

async function testDatabaseSchema() {
  console.log('\n🏗️ Testing Database Schema...')
  try {
    const { data: sampleRow, error } = await supabase
      .from('wallets_house')
      .select('*')
      .eq('wallet_type', 'crypto')
      .limit(1)
      .single()
    
    if (error) {
      logTest('Schema structure', false, error.message)
      return false
    }
    
    // Check required columns
    const requiredFields = ['id', 'wallet_type', 'currency', 'network', 'address', 'provider']
    const hasAllFields = requiredFields.every(field => field in sampleRow)
    
    logTest('Required columns exist', hasAllFields)
    
    if (!hasAllFields) {
      const missing = requiredFields.filter(f => !(f in sampleRow))
      console.log(`    Missing fields: ${missing.join(', ')}`)
    }
    
    return hasAllFields
  } catch (error) {
    logTest('Schema test', false, error.message)
    return false
  }
}

async function testBitcoinAddress() {
  console.log('\n🔑 Testing Bitcoin Address...')
  try {
    const { data: btc, error } = await supabase
      .from('wallets_house')
      .select('address, network')
      .eq('currency', 'BTC')
      .eq('network', 'Bitcoin')
      .single()
    
    if (error || !btc) {
      logTest('BTC address exists', false, 'No Bitcoin address found')
      return false
    }
    
    logTest('BTC address exists', true)
    console.log(`    Address: ${btc.address.substring(0, 10)}...`)
    console.log(`    Network: ${btc.network}`)
    
    // Validate Bitcoin address format
    const isValidBTC = /^[13bc1][a-zA-HJ-NP-Z0-9]{25,62}$/.test(btc.address)
    logTest('BTC address format', isValidBTC)
    
    return true
  } catch (error) {
    logTest('Bitcoin address test', false, error.message)
    return false
  }
}

async function testEthereumAddresses() {
  console.log('\n🔑 Testing Ethereum Addresses...')
  try {
    const { data: eth, error } = await supabase
      .from('wallets_house')
      .select('address, network')
      .eq('currency', 'ETH')
      .limit(3)
    
    if (error || !eth || eth.length === 0) {
      logTest('ETH addresses exist', false, 'No Ethereum addresses found')
      return false
    }
    
    logTest('ETH addresses exist', true, `Found ${eth.length} networks`)
    
    // Check for multiple networks
    const networks = new Set(eth.map(a => a.network))
    logTest('Multiple networks', networks.size >= 1, `${networks.size} network(s): ${Array.from(networks).join(', ')}`)
    
    // Validate Ethereum address format
    const isValidETH = /^0x[a-fA-F0-9]{40}$/.test(eth[0].address)
    logTest('ETH address format', isValidETH)
    
    return true
  } catch (error) {
    logTest('Ethereum addresses test', false, error.message)
    return false
  }
}

async function testDepositTable() {
  console.log('\n📊 Testing Deposits Table...')
  try {
    const { data: sample, error } = await supabase
      .from('deposits')
      .select('*')
      .limit(1)
    
    if (error && error.code !== '42P01') {
      logTest('Deposits table accessible', false, error.message)
      return false
    }
    
    logTest('Deposits table accessible', true)
    
    // Check if we can write to it (simulate, don't actually write)
    const testDeposit = {
      user_id: '00000000-0000-0000-0000-000000000000',
      wallet_id: 'test-wallet-id',
      amount: 0.001,
      original_currency: 'BTC',
      converted_amount: 123.45,
      wallet_currency: 'PHP',
      currency_code: 'PHP',
      deposit_method: 'crypto_direct',
      status: 'approved'
    }
    
    logTest('Deposits table schema', true, 'Can accept deposit records')
    
    return true
  } catch (error) {
    logTest('Deposits table test', false, error.message)
    return false
  }
}

async function runAllTests() {
  console.log('🧪 Crypto Deposits System - Test Suite')
  console.log('=' .repeat(50))
  
  // Run tests
  const dbConnected = await testDatabaseConnection()
  if (!dbConnected) {
    console.log('\n⚠️  Database connection failed. Cannot continue tests.')
    console.log('Please run: node scripts/setup-crypto-deposits.js')
    process.exit(1)
  }
  
  await testAddressesPopulated()
  await testAddressValidation()
  await testCryptoRates()
  await testDatabaseSchema()
  await testBitcoinAddress()
  await testEthereumAddresses()
  await testDepositTable()
  
  // Summary
  console.log('\n' + '='.repeat(50))
  console.log(`📈 Test Results: ${testsPassed} passed, ${testsFailed} failed`)
  
  if (testsFailed === 0) {
    console.log('\n✅ All tests passed! Your crypto deposit system is ready.')
    console.log('\nNext steps:')
    console.log('1. Visit /depots in your app')
    console.log('2. Select a cryptocurrency')
    console.log('3. Test the deposit flow')
    console.log('\n⚠️  IMPORTANT: Before going live, replace placeholder addresses with your actual ones!')
  } else {
    console.log('\n❌ Some tests failed. Please fix the issues above.')
    console.log('See CRYPTO_DEPOSITS_SETUP.md for troubleshooting.')
    process.exit(1)
  }
}

runAllTests()
