#!/usr/bin/env node

import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const EXCONVERT_KEY = process.env.EXCONVERT || process.env.VITE_EXCONVERT

if (!EXCONVERT_KEY) {
  console.error('❌ Missing EXCONVERT API key')
  process.exit(1)
}

async function testExConvertFix() {
  console.log('\n🔧 Testing Fixed ExConvert Implementation\n')
  console.log(`API Key: ${EXCONVERT_KEY.substring(0, 8)}...`)
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`)

  // Test parameters from the fixed function
  const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY']
  const targetCurrencies = ['USD', 'PHP', 'EUR', 'GBP']

  let successCount = 0
  let failureCount = 0
  const results = {}

  console.log('📤 Making individual ExConvert API calls...\n')

  // Test fetching rates for a sample currency
  for (const fromCurrency of majorCurrencies) {
    const targetForThisCurrency = targetCurrencies.filter(c => c !== fromCurrency)
    if (targetForThisCurrency.length === 0) continue

    for (const toCurrency of targetForThisCurrency) {
      try {
        const url = `https://api.exconvert.com/convert?access_key=${EXCONVERT_KEY}&from=${fromCurrency}&to=${toCurrency}&amount=1`
        
        const resp = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000)
        })

        if (!resp.ok) {
          console.log(`❌ ${fromCurrency} → ${toCurrency}: ${resp.status}`)
          failureCount++
          continue
        }

        const json = await resp.json()

        // Parse the response
        if (json.result && typeof json.result === 'object') {
          const rateValue = json.result[toCurrency] || json.result.rate
          if (typeof rateValue === 'number' && rateValue > 0) {
            console.log(`✅ ${fromCurrency} → ${toCurrency}: ${rateValue}`)
            successCount++
            results[`${fromCurrency}_${toCurrency}`] = rateValue
          }
        }
      } catch (e) {
        console.log(`❌ ${fromCurrency} → ${toCurrency}: ${e.message}`)
        failureCount++
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log(`\n📊 Results:`)
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   ❌ Failed: ${failureCount}`)
  console.log(`   Success Rate: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%`)

  if (successCount > 0) {
    console.log(`\n✨ ExConvert API is working correctly!`)
    console.log(`Sample rates:`)
    Object.entries(results).slice(0, 5).forEach(([pair, rate]) => {
      const [from, to] = pair.split('_')
      console.log(`   1 ${from} = ${rate} ${to}`)
    })
  } else {
    console.log(`\n⚠️ All requests failed. Check your API key or network.`)
  }
}

testExConvertFix().catch(console.error)
