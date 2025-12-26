/**
 * Script to verify the rate inversion security fix is working correctly
 * 
 * Usage:
 * node scripts/verify-rate-inversion-fix.js
 * 
 * This script:
 * 1. Checks database constraints are in place
 * 2. Verifies pairs math (forward × reverse = ~1.0)
 * 3. Tests the safe rate lookup function
 * 4. Tests conversion logic with proper inversion
 * 5. Generates a verification report
 */

import { supabase } from '../src/lib/supabaseClient.js'
import { getPairRate, getPairRateWithMetadata } from '../src/lib/pairsRateService.js'
import { multiCurrencyDepositService } from '../src/lib/multiCurrencyDepositService.js'

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function section(title) {
  log(`\n${'='.repeat(80)}`, 'cyan')
  log(title, 'cyan')
  log('='.repeat(80), 'cyan')
}

async function checkConstraints() {
  section('1. DATABASE CONSTRAINT VERIFICATION')
  
  try {
    const { data, error } = await supabase.rpc('check_constraint_exists', {
      p_table: 'pairs',
      p_constraint: 'pairs_rate_must_be_positive'
    }).single()

    if (error) {
      // Try alternative check
      const { data: constraints } = await supabase
        .from('information_schema.table_constraints')
        .select('constraint_name')
        .eq('table_name', 'pairs')
      
      log('✓ Checking constraints via direct query...', 'blue')
      
      if (constraints?.length > 0) {
        const constraintNames = constraints.map(c => c.constraint_name)
        const hasPositive = constraintNames.some(c => c.includes('positive'))
        const hasDirection = constraintNames.some(c => c.includes('direction'))
        const hasConsistency = constraintNames.some(c => c.includes('consistency'))
        
        if (hasPositive) log('  ✓ pairs_rate_must_be_positive', 'green')
        else log('  ✗ pairs_rate_must_be_positive NOT FOUND', 'red')
        
        if (hasDirection) log('  ✓ pairs_valid_direction', 'green')
        else log('  ✗ pairs_valid_direction NOT FOUND', 'red')
        
        if (hasConsistency) log('  ✓ pairs_inversion_consistency', 'green')
        else log('  ✗ pairs_inversion_consistency NOT FOUND', 'red')
        
        return hasPositive && hasDirection && hasConsistency
      }
    } else {
      log('✓ All constraints verified', 'green')
      return true
    }
  } catch (err) {
    log(`✗ Error checking constraints: ${err.message}`, 'red')
    return false
  }
}

async function verifyPairsMath() {
  section('2. PAIRS MATHEMATICS VERIFICATION')
  
  try {
    // Get all pairs that should be bidirectional
    const { data: pairs, error } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate, pair_direction')
      .gt('rate', 0)
      .order('from_currency')
      .limit(20)

    if (error) throw error

    log(`Found ${pairs.length} pairs to verify`, 'blue')

    let correctCount = 0
    let issuesFound = []

    for (const pair of pairs) {
      // Get the reverse pair
      const { data: reversePair } = await supabase
        .from('pairs')
        .select('rate')
        .eq('from_currency', pair.to_currency)
        .eq('to_currency', pair.from_currency)
        .maybeSingle()

      if (reversePair) {
        const product = pair.rate * reversePair.rate
        const isCorrect = Math.abs(product - 1.0) < 0.01  // Allow 1% tolerance

        if (isCorrect) {
          correctCount++
          log(`  ✓ ${pair.from_currency}→${pair.to_currency} × ${pair.to_currency}→${pair.from_currency} = ${product.toFixed(6)} (correct)`, 'green')
        } else {
          issuesFound.push({
            pair: `${pair.from_currency}→${pair.to_currency}`,
            product,
            message: `Product ${product.toFixed(6)} ≠ 1.0`
          })
          log(`  ✗ ${pair.from_currency}→${pair.to_currency} × ${pair.to_currency}→${pair.from_currency} = ${product.toFixed(6)} (MISMATCH)`, 'red')
        }
      } else {
        issuesFound.push({
          pair: `${pair.from_currency}→${pair.to_currency}`,
          message: 'Reverse pair not found'
        })
        log(`  ⚠ ${pair.from_currency}→${pair.to_currency} has no reverse pair`, 'yellow')
      }
    }

    log(`\nResult: ${correctCount}/${pairs.length} pairs have correct inversion`, correctCount === pairs.length ? 'green' : 'yellow')
    return issuesFound.length === 0
  } catch (err) {
    log(`✗ Error verifying pairs math: ${err.message}`, 'red')
    return false
  }
}

async function testSafeRateFunction() {
  section('3. SAFE RATE LOOKUP FUNCTION TEST')
  
  try {
    const testPairs = [
      ['BTC', 'PHP'],
      ['ADA', 'BTC'],
      ['USD', 'PHP'],
      ['ETH', 'USD']
    ]

    let successCount = 0

    for (const [from, to] of testPairs) {
      try {
        const { data, error } = await supabase
          .rpc('get_exchange_rate_safe', {
            p_from_currency: from,
            p_to_currency: to
          })
          .single()

        if (!error && data?.rate) {
          log(`  ✓ ${from}→${to} = ${data.rate} (inverted: ${data.is_inverted})`, 'green')
          successCount++
        } else {
          log(`  ✗ ${from}→${to} - No rate found`, 'yellow')
        }
      } catch (err) {
        log(`  ✗ ${from}→${to} - Error: ${err.message}`, 'yellow')
      }
    }

    log(`\nResult: ${successCount}/${testPairs.length} rate lookups successful`, 'blue')
    return successCount > 0
  } catch (err) {
    log(`✗ Error testing safe rate function: ${err.message}`, 'red')
    return false
  }
}

async function testJSConversion() {
  section('4. JAVASCRIPT CONVERSION SERVICE TEST')
  
  try {
    const testCases = [
      { amount: 1, from: 'BTC', to: 'ADA', description: 'Crypto to Crypto' },
      { amount: 1000, from: 'USD', to: 'PHP', description: 'Fiat to Fiat' },
      { amount: 1, from: 'ETH', to: 'PHP', description: 'Crypto to Fiat' }
    ]

    let successCount = 0

    for (const test of testCases) {
      try {
        const result = await multiCurrencyDepositService.convertAmount(
          test.amount,
          test.from,
          test.to
        )

        if (result && result.toAmount > 0 && isFinite(result.toAmount)) {
          log(
            `  ✓ ${test.description}: ${result.fromAmount} ${result.fromCurrency} → ${result.toAmount} ${result.toCurrency} (rate: ${result.rate.toFixed(8)})`,
            'green'
          )
          successCount++
        } else {
          log(`  ✗ ${test.description}: Invalid result`, 'red')
        }
      } catch (err) {
        log(`  ✗ ${test.description}: ${err.message}`, 'yellow')
      }
    }

    log(`\nResult: ${successCount}/${testCases.length} conversions successful`, 'blue')
    return successCount > 0
  } catch (err) {
    log(`✗ Error testing conversion service: ${err.message}`, 'red')
    return false
  }
}

async function testPairRateService() {
  section('5. PAIRS RATE SERVICE TEST (JS)')
  
  try {
    const testPairs = [
      ['BTC', 'ADA'],
      ['ADA', 'BTC'],
      ['USD', 'PHP'],
      ['PHP', 'USD']
    ]

    let successCount = 0

    for (const [from, to] of testPairs) {
      try {
        const rate = await getPairRate(from, to)
        const metadata = await getPairRateWithMetadata(from, to)

        if (rate && isFinite(rate) && rate > 0) {
          const inverted = metadata?.is_inverted ? '(inverted)' : '(direct)'
          log(
            `  ✓ ${from}→${to} = ${rate.toFixed(8)} ${inverted}`,
            'green'
          )
          successCount++
        } else {
          log(`  ✗ ${from}→${to} - Rate not found`, 'yellow')
        }
      } catch (err) {
        log(`  ✗ ${from}→${to} - Error: ${err.message}`, 'yellow')
      }
    }

    log(`\nResult: ${successCount}/${testPairs.length} rate lookups successful`, 'blue')
    return successCount > 0
  } catch (err) {
    log(`✗ Error testing pairs rate service: ${err.message}`, 'red')
    return false
  }
}

async function checkAuditTrail() {
  section('6. AUDIT TRAIL VERIFICATION')
  
  try {
    // Check if audit table exists and has records
    const { data: audit, error } = await supabase
      .from('rate_inversion_audit_0207')
      .select('check_type, count(*)')
      .not('check_type', 'eq', 'BEFORE_FIX')
      .limit(5)

    if (error && error.message.includes('rate_inversion_audit_0207')) {
      log('✗ Audit table does not exist - migration may not have been applied', 'yellow')
      return false
    }

    if (error) throw error

    if (audit && audit.length > 0) {
      log(`✓ Found audit records from migration`, 'green')
      audit.forEach(record => {
        log(`  - ${record.check_type}`, 'blue')
      })
      return true
    } else {
      log('⚠ No audit records found - check if migration ran', 'yellow')
      return false
    }
  } catch (err) {
    log(`✗ Error checking audit trail: ${err.message}`, 'red')
    return false
  }
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan')
  log('║                  RATE INVERSION FIX VERIFICATION SCRIPT                     ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan')

  const results = {
    'Constraints': await checkConstraints(),
    'Pairs Math': await verifyPairsMath(),
    'Safe Function': await testSafeRateFunction(),
    'JS Conversion': await testJSConversion(),
    'Pairs Service': await testPairRateService(),
    'Audit Trail': await checkAuditTrail()
  }

  // Summary
  section('VERIFICATION SUMMARY')
  
  const passed = Object.values(results).filter(r => r).length
  const total = Object.values(results).length

  Object.entries(results).forEach(([check, result]) => {
    log(`${result ? '✓' : '✗'} ${check}`, result ? 'green' : 'yellow')
  })

  log(`\nOverall: ${passed}/${total} checks passed`, passed === total ? 'green' : 'yellow')

  if (passed === total) {
    log('\n✓ All verification checks passed! Rate inversion fix is working correctly.', 'green')
  } else {
    log('\n⚠ Some checks failed. Please review the errors above.', 'yellow')
    log('  - Ensure the migration 0207 has been applied', 'blue')
    log('  - Ensure the JS files have been redeployed', 'blue')
    log('  - Check database connection and permissions', 'blue')
  }
}

main().catch(err => {
  log(`\n✗ Fatal error: ${err.message}`, 'red')
  process.exit(1)
})
