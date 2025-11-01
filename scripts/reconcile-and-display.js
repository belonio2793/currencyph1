#!/usr/bin/env node

/**
 * Reconcile Network Balances Script
 * 
 * Usage:
 *   node scripts/reconcile-and-display.js [options]
 * 
 * Options:
 *   --type=all          Reconcile all users and house (default)
 *   --type=user         Reconcile specific user (requires --userId)
 *   --type=house        Reconcile house balances only
 *   --userId=<uuid>     User ID to reconcile (for type=user)
 *   --no-reconcile      Skip reconciliation, just display data
 * 
 * Examples:
 *   node scripts/reconcile-and-display.js
 *   node scripts/reconcile-and-display.js --type=house
 *   node scripts/reconcile-and-display.js --type=user --userId=abc-123
 *   node scripts/reconcile-and-display.js --no-reconcile
 */

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  type: 'all',
  userId: null,
  reconcile: true
}

args.forEach(arg => {
  if (arg.startsWith('--type=')) {
    options.type = arg.split('=')[1]
  } else if (arg.startsWith('--userId=')) {
    options.userId = arg.split('=')[1]
  } else if (arg === '--no-reconcile') {
    options.reconcile = false
  }
})

// Initialize Supabase
const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
}

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset)
}

async function runReconciliation() {
  try {
    log(colors.bright + colors.blue, '⏳ Running reconciliation...')
    
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/reconcile-network-balances?type=${options.type}${
      options.userId ? `&userId=${options.userId}` : ''
    }`
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Edge function failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    log(colors.green, '✅ Reconciliation completed successfully')
    log(colors.cyan, '\nReconciliation Result:')
    console.log(JSON.stringify(result, null, 2))
    
    return true
  } catch (error) {
    log(colors.red, '❌ Reconciliation failed:', error.message)
    return false
  }
}

async function displayNetworkBalances() {
  try {
    log(colors.bright + colors.blue, '\n📊 Fetching Network Balances...')
    
    let query = supabase
      .from('network_balances')
      .select('*')
      .order('reconciliation_date', { ascending: false })
    
    if (options.type === 'user' && options.userId) {
      query = query.eq('entity_id', options.userId)
    } else if (options.type === 'house') {
      query = query.eq('entity_type', 'house')
    }
    
    const { data, error } = await query.limit(50)
    
    if (error) {
      throw error
    }
    
    if (!data || data.length === 0) {
      log(colors.yellow, '⚠️  No network balance records found')
      return
    }
    
    log(colors.green, `✅ Found ${data.length} network balance records\n`)
    
    // Display summary
    const summary = {
      total: data.length,
      reconciled: data.filter(r => r.status === 'reconciled').length,
      discrepancies: data.filter(r => r.status === 'discrepancy').length,
      entities: new Set(data.map(r => `${r.entity_type}:${r.entity_id}`)).size,
      currencies: new Set(data.map(r => r.currency_code)).size
    }
    
    log(colors.cyan, '📈 Summary:')
    console.log(`   Total Records: ${summary.total}`)
    console.log(`   Reconciled: ${summary.reconciled}`)
    console.log(`   Discrepancies: ${summary.discrepancies}`)
    console.log(`   Entities: ${summary.entities}`)
    console.log(`   Currencies: ${summary.currencies}`)
    
    // Display detailed table
    log(colors.cyan, '\n📋 Detailed Balances:\n')
    
    console.table(data.map(record => ({
      Entity: record.entity_type === 'user' ? `User: ${record.entity_id.substring(0, 8)}...` : 'House',
      Currency: record.currency_code,
      'Wallet Balance': Number(record.wallet_balance).toFixed(8),
      'Computed Balance': Number(record.computed_balance).toFixed(8),
      'Difference': Number(record.balance_difference).toFixed(8),
      Status: record.status === 'reconciled' ? '✅ Reconciled' : '⚠️ Discrepancy',
      Transactions: record.total_transactions,
      'Last Updated': new Date(record.reconciliation_date).toLocaleString()
    })))
    
    // Display by entity type
    log(colors.cyan, '\n👥 By Entity Type:\n')
    const byEntity = {}
    data.forEach(record => {
      const key = `${record.entity_type}:${record.entity_id || 'N/A'}`
      if (!byEntity[key]) {
        byEntity[key] = {
          walletBalance: 0,
          computedBalance: 0,
          currencies: 0,
          status: record.status
        }
      }
      byEntity[key].walletBalance += Number(record.wallet_balance)
      byEntity[key].computedBalance += Number(record.computed_balance)
      byEntity[key].currencies += 1
    })
    
    console.table(byEntity)
    
    // Display by currency
    log(colors.cyan, '\n💱 By Currency:\n')
    const byCurrency = {}
    data.forEach(record => {
      if (!byCurrency[record.currency_code]) {
        byCurrency[record.currency_code] = {
          'Total Wallet': 0,
          'Total Computed': 0,
          'Total Difference': 0,
          Records: 0,
          'Reconciled %': '0%'
        }
      }
      byCurrency[record.currency_code]['Total Wallet'] += Number(record.wallet_balance)
      byCurrency[record.currency_code]['Total Computed'] += Number(record.computed_balance)
      byCurrency[record.currency_code]['Total Difference'] += Number(record.balance_difference)
      byCurrency[record.currency_code]['Records'] += 1
    })
    
    // Calculate reconciliation percentage
    Object.keys(byCurrency).forEach(curr => {
      const total = byCurrency[curr]['Records']
      const reconciled = data.filter(r => r.currency_code === curr && r.status === 'reconciled').length
      byCurrency[curr]['Reconciled %'] = `${((reconciled / total) * 100).toFixed(1)}%`
    })
    
    console.table(byCurrency)
    
    log(colors.green, '\n✅ Display completed successfully')
  } catch (error) {
    log(colors.red, '❌ Failed to display network balances:', error.message)
    process.exit(1)
  }
}

async function main() {
  log(colors.bright + colors.cyan, '\n🔄 Network Balance Reconciliation & Display\n')
  log(colors.bright, `Options: type=${options.type}, reconcile=${options.reconcile}${
    options.userId ? `, userId=${options.userId}` : ''
  }\n`)
  
  if (options.reconcile) {
    const success = await runReconciliation()
    if (!success) {
      process.exit(1)
    }
  }
  
  await displayNetworkBalances()
  log(colors.green, '\n✨ All done!\n')
}

main().catch(error => {
  log(colors.red, '❌ Fatal error:', error.message)
  process.exit(1)
})
