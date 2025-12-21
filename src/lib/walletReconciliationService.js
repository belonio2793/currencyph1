import { supabase } from './supabaseClient'

/**
 * Wallet Reconciliation Service
 * 
 * Provides wallet balance verification and reconciliation with:
 * - Balance calculation and verification
 * - Discrepancy detection and reporting
 * - Automated reconciliation auditing
 * - Historical balance tracking
 */
export class WalletReconciliationService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Verify a single wallet's balance
   * Calculates expected balance from transactions and compares to actual
   * 
   * @param {string} walletId - Wallet ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} - Verification result
   */
  async verifyWalletBalance(walletId, userId) {
    const result = {
      walletId,
      userId,
      isValid: false,
      actualBalance: 0,
      calculatedBalance: 0,
      discrepancy: 0,
      discrepancyPercentage: 0,
      transactionCount: 0,
      warnings: [],
      timestamp: new Date().toISOString()
    }

    try {
      // Step 1: Fetch wallet
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('id, balance, currency_code')
        .eq('id', walletId)
        .single()

      if (walletError || !wallet) {
        throw new Error(`Wallet not found: ${walletId}`)
      }

      result.actualBalance = wallet.balance

      // Step 2: Calculate balance from wallet transactions
      const { data: transactions, error: txError } = await this.supabase
        .from('wallet_transactions')
        .select('type, amount')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: true })

      if (txError) {
        throw new Error(`Failed to fetch transactions: ${txError.message}`)
      }

      // Step 3: Calculate running balance
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
          default:
            // Skip unknown transaction types
            break
        }
      })

      result.calculatedBalance = calculatedBalance
      result.transactionCount = transactions.length
      result.discrepancy = wallet.balance - calculatedBalance
      result.discrepancyPercentage = calculatedBalance > 0 
        ? (result.discrepancy / calculatedBalance) * 100 
        : 0

      // Consider valid if discrepancy is negligible (< 0.01)
      result.isValid = Math.abs(result.discrepancy) < 0.01

    } catch (error) {
      console.error('[WalletReconciliationService] Balance verification error:', error)
      result.warnings.push(`Verification failed: ${error.message}`)
    }

    return result
  }

  /**
   * Reconcile all wallets for a user
   * Verifies all user's wallets and returns summary
   * 
   * @param {string} userId - User ID
   * @returns {Promise<object>} - Reconciliation summary
   */
  async reconcileUserWallets(userId) {
    const result = {
      userId,
      totalWallets: 0,
      validWallets: 0,
      invalidWallets: 0,
      wallets: [],
      totalDiscrepancy: 0,
      warnings: [],
      timestamp: new Date().toISOString()
    }

    try {
      // Step 1: Fetch all user wallets
      const { data: wallets, error: walletsError } = await this.supabase
        .from('wallets')
        .select('id, currency_code, balance')
        .eq('user_id', userId)

      if (walletsError) {
        throw new Error(`Failed to fetch wallets: ${walletsError.message}`)
      }

      result.totalWallets = wallets.length

      // Step 2: Verify each wallet
      for (const wallet of wallets) {
        const verification = await this.verifyWalletBalance(wallet.id, userId)
        result.wallets.push(verification)

        if (verification.isValid) {
          result.validWallets++
        } else {
          result.invalidWallets++
          result.totalDiscrepancy += verification.discrepancy
        }
      }

      // Step 3: Create audit record
      if (result.invalidWallets > 0) {
        const { error: auditError } = await this.supabase
          .from('wallet_balance_audit')
          .insert([{
            wallet_id: null,
            user_id: userId,
            audit_type: 'automatic',
            audit_reason: `Automatic reconciliation for user with ${result.invalidWallets} invalid wallets`,
            balance_before: null,
            balance_after: null,
            expected_balance: null,
            calculation_method: 'multi_wallet_verification',
            status: result.invalidWallets > 0 ? 'pending' : 'resolved',
            metadata: {
              total_wallets: result.totalWallets,
              valid_wallets: result.validWallets,
              invalid_wallets: result.invalidWallets,
              total_discrepancy: result.totalDiscrepancy,
              wallet_summaries: result.wallets
            }
          }])

        if (auditError) {
          result.warnings.push(`Failed to create audit record: ${auditError.message}`)
        }
      }

    } catch (error) {
      console.error('[WalletReconciliationService] User reconciliation error:', error)
      result.warnings.push(`Reconciliation failed: ${error.message}`)
    }

    return result
  }

  /**
   * Reconcile a specific wallet against deposit ledger
   * Verifies wallet balance matches approved deposits
   * 
   * @param {string} walletId - Wallet ID
   * @param {string} userId - User ID
   * @param {string} adminId - Admin ID (optional)
   * @returns {Promise<object>} - Reconciliation result
   */
  async reconcileAgainstDeposits(walletId, userId, adminId = null) {
    const result = {
      walletId,
      isBalanced: false,
      actualBalance: 0,
      expectedBalance: 0,
      discrepancy: 0,
      depositSummary: {
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        reversed: 0
      },
      issues: [],
      timestamp: new Date().toISOString()
    }

    try {
      // Step 1: Fetch wallet
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('balance')
        .eq('id', walletId)
        .single()

      if (walletError || !wallet) {
        throw new Error('Wallet not found')
      }

      result.actualBalance = wallet.balance

      // Step 2: Fetch all deposits for wallet
      const { data: deposits, error: depositsError } = await this.supabase
        .from('deposits')
        .select('id, amount, received_amount, status')
        .eq('wallet_id', walletId)

      if (depositsError) {
        throw new Error('Failed to fetch deposits')
      }

      // Step 3: Calculate expected balance
      let expectedBalance = 0
      deposits.forEach(dep => {
        result.depositSummary.total++
        
        switch (dep.status) {
          case 'approved':
          case 'completed':
            expectedBalance += dep.received_amount || dep.amount
            result.depositSummary.approved++
            break
          case 'pending':
            result.depositSummary.pending++
            break
          case 'rejected':
            result.depositSummary.rejected++
            break
          case 'reversed':
            expectedBalance -= dep.received_amount || dep.amount
            result.depositSummary.reversed++
            break
          default:
            break
        }
      })

      result.expectedBalance = expectedBalance
      result.discrepancy = wallet.balance - expectedBalance
      result.isBalanced = Math.abs(result.discrepancy) < 0.01

      // Step 4: Identify issues
      if (!result.isBalanced) {
        result.issues.push({
          type: 'balance_mismatch',
          severity: Math.abs(result.discrepancy) > 100 ? 'high' : 'medium',
          amount: result.discrepancy,
          message: `Wallet balance (${result.actualBalance}) does not match expected (${result.expectedBalance})`
        })
      }

      // Step 5: Check for orphaned pending deposits
      const pendingDeposits = deposits.filter(d => d.status === 'pending')
      if (pendingDeposits.length > 0) {
        result.issues.push({
          type: 'pending_deposits',
          severity: 'low',
          count: pendingDeposits.length,
          message: `${pendingDeposits.length} pending deposit(s) awaiting approval`
        })
      }

      // Step 6: Create audit record
      const { error: auditError } = await this.supabase
        .from('wallet_balance_audit')
        .insert([{
          wallet_id: walletId,
          user_id: userId,
          audit_type: 'automatic',
          audit_reason: 'Reconciliation against deposit ledger',
          balance_before: result.actualBalance,
          balance_after: result.actualBalance,
          expected_balance: result.expectedBalance,
          calculation_method: 'deposit_ledger_sum',
          status: result.isBalanced ? 'resolved' : 'pending',
          approved_by: adminId,
          metadata: {
            deposit_summary: result.depositSummary,
            issues: result.issues
          }
        }])

        if (auditError) {
          result.issues.push({
            type: 'audit_logging_failed',
            message: auditError.message
          })
        }

    } catch (error) {
      console.error('[WalletReconciliationService] Deposit reconciliation error:', error)
      result.issues.push({
        type: 'reconciliation_error',
        severity: 'critical',
        message: error.message
      })
    }

    return result
  }

  /**
   * Detect and report all wallet discrepancies
   * Finds all wallets with balance mismatches
   * 
   * @returns {Promise<object>} - Discrepancy report
   */
  async findAllDiscrepancies() {
    const result = {
      totalWalletsScanned: 0,
      walletsWithDiscrepancies: 0,
      totalDiscrepancy: 0,
      discrepancies: [],
      timestamp: new Date().toISOString()
    }

    try {
      // Fetch all wallets
      const { data: wallets, error: walletsError } = await this.supabase
        .from('wallets')
        .select('id, user_id, currency_code, balance')
        .order('user_id', { ascending: true })

      if (walletsError) {
        throw new Error('Failed to fetch wallets')
      }

      result.totalWalletsScanned = wallets.length

      // Check each wallet
      for (const wallet of wallets) {
        const verification = await this.verifyWalletBalance(wallet.id, wallet.user_id)
        
        if (!verification.isValid) {
          result.walletsWithDiscrepancies++
          result.totalDiscrepancy += verification.discrepancy
          result.discrepancies.push({
            walletId: wallet.id,
            userId: wallet.user_id,
            currency: wallet.currency_code,
            actualBalance: verification.actualBalance,
            calculatedBalance: verification.calculatedBalance,
            discrepancy: verification.discrepancy,
            discrepancyPercentage: verification.discrepancyPercentage
          })
        }
      }

    } catch (error) {
      console.error('[WalletReconciliationService] Discrepancy detection error:', error)
      throw error
    }

    return result
  }

  /**
   * Get wallet transaction history for verification
   * Returns all transactions for a wallet for manual review
   * 
   * @param {string} walletId - Wallet ID
   * @param {number} limit - Number of transactions to fetch
   * @returns {Promise<array>} - Transaction history
   */
  async getWalletTransactionHistory(walletId, limit = 1000) {
    try {
      const { data, error } = await this.supabase
        .from('wallet_transactions')
        .select('id, type, amount, balance_before, balance_after, currency_code, description, created_at, reference_id')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('[WalletReconciliationService] Failed to fetch transaction history:', error)
      throw error
    }
  }

  /**
   * Get deposit history for a wallet
   * Returns all deposits linked to this wallet
   * 
   * @param {string} walletId - Wallet ID
   * @returns {Promise<array>} - Deposit history
   */
  async getWalletDepositHistory(walletId) {
    try {
      const { data, error } = await this.supabase
        .from('deposits')
        .select('id, amount, received_amount, currency_code, status, created_at, approved_at, rejected_at, reversed_at')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('[WalletReconciliationService] Failed to fetch deposit history:', error)
      throw error
    }
  }

  /**
   * Get wallet balance history
   * Returns historical balance records
   * 
   * @param {string} walletId - Wallet ID
   * @param {number} daysBack - Number of days to look back
   * @returns {Promise<array>} - Balance history
   */
  async getWalletBalanceHistory(walletId, daysBack = 90) {
    try {
      const { data, error } = await this.supabase
        .from('wallet_balance_audit')
        .select('id, audit_type, balance_before, balance_after, discrepancy, status, created_at')
        .eq('wallet_id', walletId)
        .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('[WalletReconciliationService] Failed to fetch balance history:', error)
      throw error
    }
  }

  /**
   * Generate comprehensive wallet report
   * Includes balance, transactions, deposits, and audit summary
   * 
   * @param {string} walletId - Wallet ID
   * @returns {Promise<object>} - Comprehensive wallet report
   */
  async generateWalletReport(walletId, userId) {
    const result = {
      walletId,
      userId,
      balance: null,
      currency: null,
      verification: null,
      depositReconciliation: null,
      transactionCount: 0,
      depositCount: 0,
      timestamp: new Date().toISOString()
    }

    try {
      // Get wallet info
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('balance, currency_code')
        .eq('id', walletId)
        .single()

      if (walletError || !wallet) {
        throw new Error('Wallet not found')
      }

      result.balance = wallet.balance
      result.currency = wallet.currency_code

      // Get verification
      result.verification = await this.verifyWalletBalance(walletId, userId)

      // Get deposit reconciliation
      result.depositReconciliation = await this.reconcileAgainstDeposits(walletId, userId)

      // Get transaction summary
      const { data: transactions } = await this.supabase
        .from('wallet_transactions')
        .select('id')
        .eq('wallet_id', walletId)
        .catch(() => ({ data: [] }))
      result.transactionCount = transactions?.length || 0

      // Get deposit summary
      const { data: deposits } = await this.supabase
        .from('deposits')
        .select('id')
        .eq('wallet_id', walletId)
        .catch(() => ({ data: [] }))
      result.depositCount = deposits?.length || 0

    } catch (error) {
      console.error('[WalletReconciliationService] Report generation error:', error)
      result.error = error.message
    }

    return result
  }
}

export const walletReconciliationService = new WalletReconciliationService(supabase)

export default WalletReconciliationService
