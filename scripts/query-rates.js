#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Get all rates from public.pairs
async function getAllRates() {
  console.log('Fetching all rates from public.pairs...\n')
  
  const { data, error } = await supabase
    .from('pairs')
    .select('from_currency, to_currency, rate, source_table, updated_at')
    .order('from_currency')
    .order('to_currency')

  if (error) {
    console.error('Error:', error.message)
    return null
  }

  return data
}

// Get rate for specific pair
async function getRate(fromCurrency, toCurrency) {
  const { data, error } = await supabase
    .from('pairs')
    .select('rate, updated_at')
    .eq('from_currency', fromCurrency.toUpperCase())
    .eq('to_currency', toCurrency.toUpperCase())
    .single()

  if (error) {
    console.error(`Error: ${error.message}`)
    return null
  }

  return data
}

// Get all rates for a currency
async function getRatesFor(currency) {
  const { data, error } = await supabase
    .from('pairs')
    .select('from_currency, to_currency, rate, updated_at')
    .eq('from_currency', currency.toUpperCase())
    .order('to_currency')

  if (error) {
    console.error(`Error: ${error.message}`)
    return null
  }

  return data
}

// Main CLI
const args = process.argv.slice(2)
const command = args[0]

async function main() {
  try {
    if (!command || command === '--help' || command === '-h') {
      console.log(`
Usage:
  node scripts/query-rates.js [command] [options]

Commands:
  all                        Get all rates from public.pairs
  get <FROM> <TO>            Get specific exchange rate (e.g., get PHP USD)
  for <CURRENCY>             Get all rates for a currency (e.g., for PHP)
  
Examples:
  node scripts/query-rates.js all
  node scripts/query-rates.js get PHP USD
  node scripts/query-rates.js for BTC
  node scripts/query-rates.js for USD
      `)
      return
    }

    if (command === 'all') {
      const rates = await getAllRates()
      if (!rates) return

      console.log(`✅ Fetched ${rates.length} rates\n`)
      console.log('FROM | TO | RATE | SOURCE | UPDATED')
      console.log('-'.repeat(80))
      
      rates.slice(0, 50).forEach(rate => {
        const from = rate.from_currency.padEnd(5)
        const to = rate.to_currency.padEnd(5)
        const rateStr = String(rate.rate).padEnd(20)
        const source = (rate.source_table || 'N/A').padEnd(20)
        const updated = new Date(rate.updated_at).toISOString().split('T')[0]
        console.log(`${from} | ${to} | ${rateStr} | ${source} | ${updated}`)
      })
      
      if (rates.length > 50) {
        console.log(`... and ${rates.length - 50} more`)
      }
    } 
    else if (command === 'get' && args.length >= 3) {
      const from = args[1]
      const to = args[2]
      
      console.log(`Getting rate: 1 ${from.toUpperCase()} = ? ${to.toUpperCase()}\n`)
      
      const rate = await getRate(from, to)
      if (!rate) return

      console.log(`✅ 1 ${from.toUpperCase()} = ${rate.rate} ${to.toUpperCase()}`)
      console.log(`   Updated: ${new Date(rate.updated_at).toISOString()}`)
    } 
    else if (command === 'for' && args.length >= 2) {
      const currency = args[1]
      
      console.log(`Getting all rates for ${currency.toUpperCase()}:\n`)
      
      const rates = await getRatesFor(currency)
      if (!rates) return

      console.log(`✅ Found ${rates.length} rates\n`)
      
      rates.slice(0, 50).forEach(rate => {
        console.log(`  • 1 ${rate.from_currency} = ${rate.rate} ${rate.to_currency}`)
      })
      
      if (rates.length > 50) {
        console.log(`  ... and ${rates.length - 50} more`)
      }
    } 
    else {
      console.log(`❌ Unknown command: ${command}\n`)
      console.log('Use: node scripts/query-rates.js --help')
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

main()
