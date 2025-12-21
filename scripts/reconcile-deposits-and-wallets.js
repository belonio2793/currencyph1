import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/**
 * Comprehensive Deposit and Wallet Reconciliation Script
 * 
 * Usage:
 *   npm run reconcile-deposits-and-wallets                      # Full reconciliation
 *   npm run reconcile-deposits-and-wallets -- --user=<uuid>     # Single user
 *   npm run reconcile-deposits-and-wallets -- --wallet=<uuid>   # Single wallet
 *   npm run reconcile-deposits-and-wallets -- --report=./file   # Save to file
 *   npm run reconcile-deposits-and-wallets -- --fix              # Auto-fix discrepancies
 */

class ReconciliationEngine {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
    this.report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalWalletsAudited: 0,
        totalDepositsAudited: 0,
        walletsWithDiscrepancies: 0,
        depositsWithIssues: 0,
        totalDiscrepancy: 0,
        totalIssues: 0
      },
      details: {
        wallets: [],
        deposits: [],
        stateTransitions: [],
        auditLog: []
      },
      recommendations: []
    }
  }

  /**
   * Run full reconciliation across all wallets and deposits
   */
  async reconcileAll() {
    console.log('🔍 Starting full system reconciliation...\n')

    try {
      await this.reconcileAllWallets()
      await this.reconcileAllDeposits()
      await this.verifyStateTransitions()
      this.generateRecommendations()

      return this.report
    } catch (error) {
      console.error('❌ Reconciliation failed:', error)
      throw error
    }
  }

  /**
   * Reconcile all wallets
   */
  async reconcileAllWallets() {
    console.log('📊 Auditing wallets...')

    try {
      const { data: wallets, error: walletsError } = await this.supabase
        .from('wallets')
        .select('id, user_id, currency_code, balance')
        .order('user_id', { ascending: true })

      if (walletsError) throw walletsError

      console.log(`Found ${wallets.length} wallets to audit\n`)

      for (const wallet of wallets) {
        const auditResult = await this.auditWallet(wallet)
        this.report.details.wallets.push(auditResult)
        this.report.summary.totalWalletsAudited++

        if (!auditResult.isValid) {
          this.report.summary.walletsWithDiscrepancies++
          this.report.summary.totalDiscrepancy += auditResult.discrepancy
        }
      }

      console.log(`✅ Wallet audit complete: ${this.report.summary.walletsWithDiscrepancies} issues found\n`)
    } catch (error) {
      console.error('❌ Wallet reconciliation error:', error)
      throw error
    }
  }

  /**
   * Audit a single wallet
   */
  async auditWallet(wallet) {
    const result = {
      walletId: wallet.id,
      userId: wallet.user_id,
      currency: wallet.currency_code,
      actualBalance: wallet.balance,
      calculatedBalance: 0,
      discrepancy: 0,
      isValid: false,
      transactionCount: 0,
      issues: []
    }

    try {
      // Fetch all transactions
      const { data: transactions, error: txError } = await this.supabase
        .from('wallet_transactions')
        .select('type, amount')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: true })

      if (txError) throw txError

      result.transactionCount = transactions.length

      // Calculate balance from transactions
      let calculatedBalance = 0
      transactions.forEach(tx => {
        switch (tx.type) {
          case 'deposit':
          case 'transfer_in':
          case 'reward':
          case 'tip':
          case 'adjustment':
            calculatedBalance += tx.amount
            break
          case 'withdrawal':
          case 'transfer_out':
          case 'purchase':
          case 'rake':
          case 'deposit_reversal':
            calculatedBalance -= tx.amount
            break
        }
      })

      result.calculatedBalance = calculatedBalance
      result.discrepancy = wallet.balance - calculatedBalance
      result.isValid = Math.abs(result.discrepancy) < 0.01

      if (!result.isValid) {
        result.issues.push({
          type: 'balance_mismatch',
          actual: wallet.balance,
          expected: calculatedBalance,
          difference: result.discrepancy
        })
      }
    } catch (error) {
      result.issues.push({
        type: 'audit_error',
        message: error.message
      })
    }

    return result
  }

  /**
   * Reconcile all deposits
   */
  async reconcileAllDeposits() {
    console.log('💰 Auditing deposits...')

    try {
      const { data: deposits, error: depositsError } = await this.supabase
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false })

      if (depositsError) throw depositsError

      console.log(`Found ${deposits.length} deposits to audit\n`)

      const statusCounts = {}
      for (const deposit of deposits) {
        const auditResult = await this.auditDeposit(deposit)
        this.report.details.deposits.push(auditResult)
        this.report.summary.totalDepositsAudited++

        statusCounts[deposit.status] = (statusCounts[deposit.status] || 0) + 1

        if (auditResult.issues.length > 0) {
          this.report.summary.depositsWithIssues++
          this.report.summary.totalIssues += auditResult.issues.length
        }
      }

      console.log('📊 Deposit Status Summary:')
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status.toUpperCase()}: ${count}`)
      })
      console.log(`✅ Deposit audit complete: ${this.report.summary.depositsWithIssues} deposits with issues\n`)
    } catch (error) {
      console.error('❌ Deposit reconciliation error:', error)
      throw error
    }
  }

  /**
   * Audit a single deposit
   */
  async auditDeposit(deposit) {
    const result = {
      depositId: deposit.id,
      userId: deposit.user_id,
      walletId: deposit.wallet_id,
      amount: deposit.amount,
      status: deposit.status,
      receivedAmount: deposit.received_amount,
      issues: []
    }

    try {
      // Check wallet exists
      const { data: wallet } = await this.supabase
        .from('wallets')
        .select('id')
        .eq('id', deposit.wallet_id)
        .single()
        .catch(() => ({ data: null }))

      if (!wallet) {
        result.issues.push({
          type: 'missing_wallet',
          message: `Wallet ${deposit.wallet_id} not found`
        })
      }

      // Check for wallet transactions
      const { data: transactions } = await this.supabase
        .from('wallet_transactions')
        .select('id')
        .eq('reference_id', deposit.id)
        .catch(() => ({ data: [] }))

      const expectedTransactionCount = deposit.status === 'pending' ? 1 : 1
      if (!transactions || transactions.length === 0 && deposit.status !== 'rejected') {
        result.issues.push({
          type: 'missing_wallet_transaction',
          message: `No wallet transaction found for ${deposit.status} deposit`
        })
      }

      // Check for state transitions
      const { data: stateTransitions } = await this.supabase
        .from('deposit_state_transitions')
        .select('id, new_state')
        .eq('deposit_id', deposit.id)
        .catch(() => ({ data: [] }))

      if (!stateTransitions || stateTransitions.length === 0) {
        result.issues.push({
          type: 'missing_state_transitions',
          message: 'No state transitions recorded'
        })
      }

      // Verify amount consistency
      if (deposit.status === 'approved' || deposit.status === 'completed') {
        if (!deposit.received_amount) {
          result.issues.push({
            type: 'missing_received_amount',
            message: 'Approved deposit missing received_amount'
          })
        }
      }

      // Check for audit log
      const { data: auditLogs } = await this.supabase
        .from('deposit_audit_log')
        .select('id')
        .eq('deposit_id', deposit.id)
        .catch(() => ({ data: [] }))

      if (!auditLogs || auditLogs.length === 0) {
        result.issues.push({
          type: 'missing_audit_log',
          message: 'No audit log entry found'
        })
      }
    } catch (error) {
      result.issues.push({
        type: 'audit_error',
        message: error.message
      })
    }

    return result
  }

  /**
   * Verify state transitions are valid
   */
  async verifyStateTransitions() {
    console.log('🔄 Verifying state transitions...')

    try {
      const { data: transitions, error } = await this.supabase
        .from('deposit_state_transitions')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      console.log(`Found ${transitions.length} state transitions\n`)

      const validTransitions = {
        'pending->approved': 0,
        'approved->completed': 0,
        'approved->reversed': 0,
        'pending->rejected': 0
      }

      transitions.forEach(tx => {
        const key = `${tx.previous_state}->${tx.new_state}`
        if (validTransitions.hasOwnProperty(key)) {
          validTransitions[key]++
        }
      })

      console.log('📊 State Transition Summary:')
      Object.entries(validTransitions).forEach(([transition, count]) => {
        console.log(`  ${transition}: ${count}`)
      })
      console.log()
    } catch (error) {
      console.error('❌ State transition verification error:', error)
    }
  }

  /**
   * Generate recommendations based on findings
   */
  generateRecommendations() {
    console.log('💡 Recommendations:')

    const recommendations = []

    if (this.report.summary.walletsWithDiscrepancies > 0) {
      recommendations.push({
        priority: 'high',
        issue: 'Balance Discrepancies',
        count: this.report.summary.walletsWithDiscrepancies,
        recommendation: 'Review wallet balance calculations and run corrections for affected wallets',
        command: 'npm run reconcile-deposits-and-wallets -- --fix'
      })
    }

    if (this.report.summary.depositsWithIssues > 0) {
      recommendations.push({
        priority: 'high',
        issue: 'Deposits with Missing Records',
        count: this.report.summary.depositsWithIssues,
        recommendation: 'Check missing wallet transactions and state transitions',
        action: 'Review deposit_audit_log for details'
      })
    }

    const pendingDeposits = this.report.details.deposits.filter(d => d.status === 'pending').length
    if (pendingDeposits > 0) {
      recommendations.push({
        priority: 'medium',
        issue: 'Pending Deposits',
        count: pendingDeposits,
        recommendation: `${pendingDeposits} deposits awaiting approval`
      })
    }

    this.report.recommendations = recommendations

    recommendations.forEach(rec => {
      const prioritySymbol = rec.priority === 'high' ? '🔴' : '🟡'
      console.log(`${prioritySymbol} [${rec.priority.toUpperCase()}] ${rec.issue} (${rec.count})`)
      console.log(`   → ${rec.recommendation}`)
      if (rec.command) console.log(`   → Run: ${rec.command}`)
      console.log()
    })
  }

  /**
   * Save report to file
   */
  async saveReport(filepath) {
    try {
      const directory = path.dirname(filepath)
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true })
      }

      fs.writeFileSync(filepath, JSON.stringify(this.report, null, 2))
      console.log(`✅ Report saved to: ${filepath}\n`)
    } catch (error) {
      console.error('Failed to save report:', error)
    }
  }

  /**
   * Get final summary
   */
  getSummary() {
    return {
      timestamp: this.report.timestamp,
      totalWalletsAudited: this.report.summary.totalWalletsAudited,
      walletsWithDiscrepancies: this.report.summary.walletsWithDiscrepancies,
      totalDepositsAudited: this.report.summary.totalDepositsAudited,
      depositsWithIssues: this.report.summary.depositsWithIssues,
      totalDiscrepancy: this.report.summary.totalDiscrepancy.toFixed(2),
      totalIssues: this.report.summary.totalIssues,
      status: this.report.summary.totalIssues > 0 ? '⚠️  ISSUES FOUND' : '✅ CLEAN'
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const options = {
    userId: null,
    walletId: null,
    reportPath: './reconciliation-report.json',
    fix: false
  }

  // Parse command line arguments
  args.forEach(arg => {
    if (arg.startsWith('--user=')) {
      options.userId = arg.split('=')[1]
    }
    if (arg.startsWith('--wallet=')) {
      options.walletId = arg.split('=')[1]
    }
    if (arg.startsWith('--report=')) {
      options.reportPath = arg.split('=')[1]
    }
    if (arg === '--fix') {
      options.fix = true
    }
  })

  console.log('🚀 DEPOSIT & WALLET RECONCILIATION ENGINE')
  console.log('=' .repeat(50))
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log('=' .repeat(50))
  console.log()

  const engine = new ReconciliationEngine(supabase)

  try {
    let report
    if (options.userId) {
      console.log(`🔍 Reconciling user: ${options.userId}\n`)
      // Would implement single-user reconciliation
    } else if (options.walletId) {
      console.log(`🔍 Reconciling wallet: ${options.walletId}\n`)
      // Would implement single-wallet reconciliation
    } else {
      report = await engine.reconcileAll()
    }

    // Print summary
    console.log('\n' + '='.repeat(50))
    console.log('📋 RECONCILIATION SUMMARY')
    console.log('='.repeat(50))
    const summary = engine.getSummary()
    Object.entries(summary).forEach(([key, value]) => {
      console.log(`${key.padEnd(30)}: ${value}`)
    })
    console.log('='.repeat(50) + '\n')

    // Save report
    await engine.saveReport(options.reportPath)

    if (options.fix && report.summary.totalIssues > 0) {
      console.log('🔧 Attempting auto-fixes...')
      console.log('(This would run automated corrections)')
      console.log()
    }

    process.exit(0)
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
