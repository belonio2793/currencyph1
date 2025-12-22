#!/usr/bin/env node

import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const EXCONVERT_KEY = process.env.EXCONVERT || process.env.VITE_EXCONVERT

if (!EXCONVERT_KEY) {
  console.error('❌ Missing EXCONVERT API key')
  process.exit(1)
}

// Known fiat currencies (ISO 4217)
const FIAT_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLF', 'CLP',
  'CNH', 'CNY', 'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK',
  'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL',
  'GGP', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK',
  'HTG', 'HUF', 'IDR', 'ILS', 'IMP', 'INR', 'IQD', 'IRR', 'ISK', 'JEP',
  'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD',
  'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL',
  'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN',
  'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB',
  'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB',
  'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLL', 'SOS',
  'SPL', 'SRD', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND',
  'TOP', 'TRY', 'TTD', 'TVD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'USN',
  'UYU', 'UZS', 'VEF', 'VND', 'VUV', 'WST', 'XAF', 'XAG', 'XAU', 'XBA',
  'XBB', 'XBC', 'XBD', 'XCD', 'XDR', 'XOF', 'XPD', 'XPF', 'XPT', 'XSU',
  'XTS', 'XUA', 'XXX', 'YER', 'ZAR', 'ZMW', 'ZWL'
]

// Known major cryptocurrencies
const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'DOT', 'LINK',
  'UNI', 'AAVE', 'USDC', 'USDT', 'BNB', 'XLM', 'TRX', 'HBAR', 'TON', 'SUI',
  'BCH', 'SHIB', 'PYUSD', 'WLD', 'XAUT', 'PEPE', 'HYPE', 'ASTER', 'ENA', 'SKY',
  'ARB', 'OP', 'POLYGON', 'NEAR', 'APTOS', 'SEI', 'ICP', 'FIL', 'STARKNET',
  'MANTLE', 'MANTA', 'SCROLL', 'LINEA', 'BASE', 'BLAST', 'ARBITRUM'
]

// All symbols together
const ALL_SYMBOLS = [...FIAT_CURRENCIES, ...CRYPTO_SYMBOLS]

console.log(`\n🔍 Discovering ExConvert supported currencies\n`)
console.log(`📊 Testing ${ALL_SYMBOLS.length} currencies and cryptos...`)
console.log(`   Fiat: ${FIAT_CURRENCIES.length}`)
console.log(`   Crypto: ${CRYPTO_SYMBOLS.length}\n`)

async function testCurrencySupport() {
  const supported = {
    fiat: [],
    crypto: [],
    unsupported: []
  }

  // Test a sample of currencies to understand support
  const sampleSize = 50
  const testSymbols = ALL_SYMBOLS.slice(0, sampleSize)

  for (let i = 0; i < testSymbols.length; i++) {
    const symbol = testSymbols[i]
    try {
      const url = `https://api.exconvert.com/convert?access_key=${EXCONVERT_KEY}&from=${symbol}&to=USD&amount=1`
      
      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      })

      const json = await resp.json()

      if (json.result && json.result.USD) {
        if (CRYPTO_SYMBOLS.includes(symbol)) {
          supported.crypto.push(symbol)
          process.stdout.write('✅')
        } else {
          supported.fiat.push(symbol)
          process.stdout.write('✅')
        }
      } else {
        supported.unsupported.push(symbol)
        process.stdout.write('❌')
      }
    } catch (e) {
      supported.unsupported.push(symbol)
      process.stdout.write('⚠️')
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${sampleSize}`)
    }
  }

  console.log(`\n\n📈 Results (sample of ${sampleSize}):\n`)
  console.log(`✅ Fiat currencies supported: ${supported.fiat.length}`)
  console.log(`   Sample: ${supported.fiat.slice(0, 10).join(', ')}`)
  
  console.log(`\n✅ Cryptocurrencies supported: ${supported.crypto.length}`)
  console.log(`   Sample: ${supported.crypto.slice(0, 10).join(', ')}`)
  
  if (supported.unsupported.length > 0) {
    console.log(`\n❌ Not supported: ${supported.unsupported.length}`)
    console.log(`   ${supported.unsupported.slice(0, 10).join(', ')}`)
  }

  // Extrapolate for all currencies
  const fiatSupportRate = supported.fiat.length / (supported.fiat.length + supported.unsupported.filter(s => FIAT_CURRENCIES.includes(s)).length || 1)
  const cryptoSupportRate = supported.crypto.length / (supported.crypto.length + supported.unsupported.filter(s => CRYPTO_SYMBOLS.includes(s)).length || 1)

  console.log(`\n🔮 Estimated support:\n`)
  console.log(`   Fiat currencies: ~${Math.round(FIAT_CURRENCIES.length * fiatSupportRate)} / ${FIAT_CURRENCIES.length} (${(fiatSupportRate * 100).toFixed(0)}%)`)
  console.log(`   Cryptocurrencies: ~${Math.round(CRYPTO_SYMBOLS.length * cryptoSupportRate)} / ${CRYPTO_SYMBOLS.length} (${(cryptoSupportRate * 100).toFixed(0)}%)`)

  const totalSupported = Math.round(FIAT_CURRENCIES.length * fiatSupportRate) + Math.round(CRYPTO_SYMBOLS.length * cryptoSupportRate)
  const totalRequests = totalSupported * totalSupported
  
  console.log(`\n⚡ For everything-to-everything fetch:\n`)
  console.log(`   Total supported symbols: ~${totalSupported}`)
  console.log(`   API requests needed: ~${totalRequests.toLocaleString()}`)
  console.log(`   At 100 req/sec: ~${Math.round(totalRequests / 100)}s`)
  console.log(`   At 10 req/sec: ~${Math.round(totalRequests / 10)}s`)
}

testCurrencySupport().catch(console.error)
