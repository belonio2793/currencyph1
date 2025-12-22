#!/usr/bin/env node

import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const EXCONVERT_KEY = process.env.EXCONVERT || process.env.VITE_EXCONVERT

if (!EXCONVERT_KEY) {
  console.error('❌ Missing EXCONVERT API key')
  process.exit(1)
}

// Comprehensive list of known cryptocurrencies (100+)
const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'DOT', 'LINK',
  'UNI', 'AAVE', 'USDC', 'USDT', 'BNB', 'XLM', 'TRX', 'HBAR', 'TON', 'SUI',
  'BCH', 'SHIB', 'PYUSD', 'WLD', 'XAUT', 'PEPE', 'HYPE', 'ASTER', 'ENA', 'SKY',
  'ARB', 'OP', 'POLYGON', 'NEAR', 'APTOS', 'SEI', 'ICP', 'FIL', 'STARKNET',
  'MANTLE', 'MANTA', 'SCROLL', 'LINEA', 'BASE', 'BLAST', 'ARBITRUM',
  'FTX', 'LIDO', 'MAKER', 'CURVE', 'CONVEX', 'BALANCER', 'YEARN', 'COMPOUND',
  'AURA', 'ALCHEMIX', 'ALETH', 'AKRO', 'ANT', 'ANTV2', 'APIX', 'APT',
  'ARKM', 'ARK', 'AST', 'ATOM', 'AUCTION', 'AUR', 'AURORA', 'AUTO',
  'AVA', 'AVALONFT', 'AXS', 'AYE', 'AZ', 'B20', 'BAKE', 'BANANA',
  'BAND', 'BAR', 'BARB', 'BARE', 'BARK', 'BARN', 'BARR', 'BASE',
  'BASIC', 'BATH', 'BAX', 'BATON', 'BATT', 'BATWING', 'BAYC', 'BB',
  'BCA', 'BCN', 'BCPT', 'BCZERO', 'BDOT', 'BEE', 'BEEF', 'BEER',
  'BEN', 'BEND', 'BENM', 'BENT', 'BEST', 'BET', 'BETA', 'BETAV2',
  'BEV', 'BEVY', 'BEYOND', 'BFC', 'BFI', 'BFP', 'BFT', 'BGG',
  'BGI', 'BGP', 'BHD', 'BHI', 'BHP', 'BHT', 'BI', 'BIA',
  'BIAS', 'BIB', 'BIC', 'BICON', 'BID', 'BIDRX', 'BIG', 'BIGBANK',
  'BIGGER', 'BIGM', 'BIGNS', 'BIGX', 'BIK', 'BIKE', 'BIKINI', 'BIL',
  'BILE', 'BILD', 'BILI', 'BILION', 'BILLO', 'BILLS', 'BILLY', 'BILT'
]

async function testCryptoSupport() {
  const supported = []
  const unsupported = []
  
  console.log(`\n🔍 Discovering ExConvert Cryptocurrency Support\n`)
  console.log(`Testing ${CRYPTO_SYMBOLS.length} cryptocurrencies...\n`)

  for (let i = 0; i < CRYPTO_SYMBOLS.length; i++) {
    const symbol = CRYPTO_SYMBOLS[i]
    try {
      const url = `https://api.exconvert.com/convert?access_key=${EXCONVERT_KEY}&from=${symbol}&to=USD&amount=1`
      
      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      })

      const json = await resp.json()

      if (json.result && json.result.USD && json.result.USD > 0) {
        supported.push(symbol)
        process.stdout.write('✅')
      } else {
        unsupported.push(symbol)
        process.stdout.write('❌')
      }
    } catch (e) {
      unsupported.push(symbol)
      process.stdout.write('⚠️')
    }

    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${CRYPTO_SYMBOLS.length}`)
    }
  }

  console.log(`\n\n📊 Results:\n`)
  console.log(`✅ Supported: ${supported.length}`)
  console.log(`   ${supported.join(', ')}\n`)
  
  console.log(`❌ Not supported: ${unsupported.length}`)
  console.log(`   ${unsupported.slice(0, 20).join(', ')}${unsupported.length > 20 ? '...' : ''}\n`)

  console.log(`📈 Statistics:`)
  console.log(`   Support rate: ${((supported.length / CRYPTO_SYMBOLS.length) * 100).toFixed(1)}%`)
  console.log(`   Usable cryptos: ${supported.length}`)

  // Major fiat currencies for conversion
  const majorFiats = ['USD', 'EUR', 'GBP', 'JPY', 'PHP', 'SGD', 'HKD', 'CAD', 'AUD', 'NZD']
  
  console.log(`\n⚡ For everything-to-everything fetch:\n`)
  console.log(`   Fiat currencies: ~163`)
  console.log(`   Supported cryptos: ${supported.length}`)
  console.log(`   Crypto-to-fiat pairs: ${supported.length} × ${majorFiats.length}`)
  console.log(`   Total requests: ~${(163 * 162 + supported.length * majorFiats.length).toLocaleString()}`)
  
  // Calculate time estimate
  const totalRequests = 163 * 162 + supported.length * majorFiats.length
  const timeMinutes = Math.round(totalRequests * 0.15 / 60)
  console.log(`   Estimated time: ~${timeMinutes} minutes`)
}

testCryptoSupport().catch(console.error)
