import { supabase } from './supabaseClient'
import { v4 as uuidv4 } from 'uuid'

/**
 * Deposit Reconciliation Service
 * 
 * Provides comprehensive deposit management with:
 * - Full audit trails for all state transitions
 * - Atomic wallet balance updates
 * - Idempotency prevention
 * - Complete reconciliation capabilities
 * - State transition validation
 */
export class DepositReconciliationService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Process incoming deposit with full audit trail
   * Creates pending deposit and records initial transaction
   * 
   * @param {object} options - { userId, walletId, amount, currency, method, methodDetails, userEmail }
   * @returns {Promise<object>} - { success, deposit, transaction, auditLog, warnings }
   */
  async processIncomingDeposit(options = {}) {
    const {
      userId,
      walletId,
      amount,
      currency,
      method = 'unknown',
      methodDetails = {},
      userEmail = null,
      externalId = null
    } = options

    const result = {
      success: false,
      deposit: null,
      transaction: null,
      auditLog: null,
      warnings: [],
      idempotencyKey: uuidv4()
    }

    try {
      // Validate input
      if (!userId || !walletId || !amount || amount <= 0) {
        throw new Error('Invalid deposit parameters')
      }

      // Step 1: Check for duplicate deposits (using externalId)
      if (externalId) {
        const { data: existingDeposit } = await this.supabase
          .from('deposits')
          .select('id')
          .eq('external_id', externalId)
          .single()
          .catch(() => ({ data: null }))

        if (existingDeposit) {
          result.warnings.push(`Duplicate deposit detected: ${externalId}`)
          result.deposit = existingDeposit
          result.success = true
          return result
        }
      }

      // Step 2: Get wallet information
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('id, balance, currency_code')
        .eq('id', walletId)
        .single()

      if (walletError || !wallet) {
        throw new Error(`Wallet not found: ${walletId}`)
      }

      // Step 3: Create deposit record with pending status
      const { data: deposit, error: depositError } = await this.supabase
        .from('deposits')
        .insert([{
          user_id: userId,
          wallet_id: walletId,
          amount: amount,
          currency_code: currency || wallet.currency_code,
          status: 'pending',
          deposit_method: method,
          method_details: methodDetails,
          external_id: externalId,
          reference_number: this._generateReference(method)
        }])
        .select()
        .single()

      if (depositError) {
        throw new Error(`Failed to create deposit: ${depositError.message}`)
      }

      // Step 4: Record state transition (pending creation)
      const { data: stateTransition, error: stateError } = await this.supabase
        .from('deposit_state_transitions')
        .insert([{
          deposit_id: deposit.id,
          user_id: userId,
          wallet_id: walletId,
          previous_state: 'none',
          new_state: 'pending',
          reason: `Deposit initiated via ${method}`,
          notes: methodDetails,
          idempotency_key: result.idempotencyKey,
          balance_before: wallet.balance,
          balance_after: wallet.balance,
          balance_adjustment: 0
        }])
        .select()
        .single()

      if (stateError) {
        result.warnings.push(`Failed to record state transition: ${stateError.message}`)
      }

      // Step 5: Create initial wallet transaction record for tracking
      const { data: walletTx, error: txError } = await this.supabase
        .from('wallet_transactions')
        .insert([{
          wallet_id: walletId,
          user_id: userId,
          type: 'deposit_pending',
          amount: amount,
          balance_before: wallet.balance,
          balance_after: wallet.balance,
          currency_code: currency || wallet.currency_code,
          description: `Deposit pending: ${amount} ${currency || wallet.currency_code} via ${method}`,
          reference_id: deposit.id
        }])
        .select()
        .single()

      if (txError) {
        result.warnings.push(`Failed to record wallet transaction: ${txError.message}`)
      }

      // Step 6: Create audit log entry
      const { data: auditLog, error: auditError } = await this.supabase
        .from('deposit_audit_log')
        .insert([{
          deposit_id: deposit.id,
          user_id: userId,
          operation: 'deposit_created',
          status: 'success',
          previous_state: null,
          new_state: {
            id: deposit.id,
            status: 'pending',
            amount: amount,
            currency: currency
          },
          initiated_by: method
        }])
        .select()
        .single()

      if (auditError) {
        result.warnings.push(`Failed to create audit log: ${auditError.message}`)
      }

      result.success = true
      result.deposit = deposit
      result.transaction = walletTx
      result.auditLog = auditLog

    } catch (error) {
      console.error('[DepositReconciliationService] Error processing deposit:', error)
      result.success = false
      result.warnings.push(`Deposit processing failed: ${error.message}`)
    }

    return result
  }

  /**
   * Approve pending deposit with full reconciliation
   * Credits wallet and records all state transitions
   * 
   * @param {string} depositId - Deposit ID
   * @param {object} options - { adminId, adminEmail, reason, receivedAmount, exchangeRate }
   * @returns {Promise<object>} - { success, deposit, stateTransition, walletTransaction, reconciliation }
   */
  async approveDeposit(depositId, options = {}) {
    const {
      adminId = null,
      adminEmail = 'system',
      reason = 'Admin approval',
      receivedAmount = null,
      exchangeRate = 1,
      idempotencyKey = uuidv4()
    } = options

    const result = {
      success: false,
      deposit: null,
      stateTransition: null,
      walletTransaction: null,
      reconciliation: null,
      warnings: []
    }

    try {
      // Step 1: Fetch deposit
      const { data: deposit, error: fetchError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (fetchError || !deposit) {
        throw new Error('Deposit not found')
      }

      // Step 2: Validate current state
      if (deposit.status !== 'pending') {
        throw new Error(`Cannot approve deposit with status: ${deposit.status}`)
      }

      // Step 3: Check for idempotency
      const { data: existingTransition } = await this.supabase
        .from('deposit_state_transitions')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single()
        .catch(() => ({ data: null }))

      if (existingTransition) {
        result.warnings.push('This approval was already processed (idempotent)')
        result.success = true
        result.deposit = deposit
        result.stateTransition = existingTransition
        return result
      }

      // Step 4: Get wallet for balance update
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('id, balance, currency_code')
        .eq('id', deposit.wallet_id)
        .single()

      if (walletError || !wallet) {
        throw new Error('Wallet not found')
      }

      // Step 5: Calculate amounts to credit
      const creditAmount = receivedAmount || deposit.amount
      const newWalletBalance = wallet.balance + creditAmount

      // Step 6: Update deposit with approval details
      const { data: updatedDeposit, error: updateError } = await this.supabase
        .from('deposits')
        .update({
          status: 'approved',
          approved_by: adminId,
          approved_at: new Date().toISOString(),
          received_amount: creditAmount,
          exchange_rate: exchangeRate,
          completed_at: new Date().toISOString()
        })
        .eq('id', depositId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update deposit: ${updateError.message}`)
      }

      // Step 7: Update wallet balance
      const { error: balanceError } = await this.supabase
        .from('wallets')
        .update({
          balance: newWalletBalance,
          total_deposited: wallet.balance > 0 ? wallet.balance + creditAmount : creditAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id)

      if (balanceError) {
        throw new Error(`Failed to update wallet balance: ${balanceError.message}`)
      }

      // Step 8: Record state transition
      const { data: stateTransition, error: stateError } = await this.supabase
        .from('deposit_state_transitions')
        .insert([{
          deposit_id: depositId,
          user_id: deposit.user_id,
          wallet_id: deposit.wallet_id,
          previous_state: 'pending',
          new_state: 'approved',
          reason: reason,
          admin_id: adminId,
          admin_email: adminEmail,
          idempotency_key: idempotencyKey,
          amount_usd: deposit.amount,
          exchange_rate: exchangeRate,
          balance_before: wallet.balance,
          balance_after: newWalletBalance,
          balance_adjustment: creditAmount
        }])
        .select()
        .single()

      if (stateError) {
        result.warnings.push(`Failed to record state transition: ${stateError.message}`)
      }

      // Step 9: Create wallet transaction for the deposit approval
      const { data: walletTx, error: txError } = await this.supabase
        .from('wallet_transactions')
        .insert([{
          wallet_id: wallet.id,
          user_id: deposit.user_id,
          type: 'deposit',
          amount: creditAmount,
          balance_before: wallet.balance,
          balance_after: newWalletBalance,
          currency_code: deposit.currency_code,
          description: `Deposit approved: ${creditAmount} ${deposit.currency_code}${exchangeRate !== 1 ? ` (rate: ${exchangeRate})` : ''}`,
          reference_id: depositId,
          metadata: {
            original_amount: deposit.amount,
            exchange_rate: exchangeRate,
            admin_id: adminId,
            admin_email: adminEmail
          }
        }])
        .select()
        .single()

      if (txError) {
        result.warnings.push(`Failed to record wallet transaction: ${txError.message}`)
      }

      // Step 10: Create deposit transaction mapping
      if (walletTx) {
        const { error: mapError } = await this.supabase
          .from('deposit_transaction_mapping')
          .insert([{
            deposit_id: depositId,
            wallet_transaction_id: walletTx.id,
            transaction_type: 'approval',
            transaction_state: 'approved',
            amount: creditAmount,
            currency_code: deposit.currency_code
          }])

        if (mapError) {
          result.warnings.push(`Failed to create transaction mapping: ${mapError.message}`)
        }
      }

      // Step 11: Reconcile wallet balance
      const reconciliation = await this.reconcileWalletBalance(
        deposit.wallet_id,
        deposit.user_id,
        adminId
      )

      // Step 12: Create audit log
      const { data: auditLog, error: auditError } = await this.supabase
        .from('deposit_audit_log')
        .insert([{
          deposit_id: depositId,
          user_id: deposit.user_id,
          operation: 'deposit_approved',
          status: 'success',
          previous_state: { status: 'pending', balance: wallet.balance },
          new_state: { status: 'approved', balance: newWalletBalance },
          wallet_impact: {
            balance_before: wallet.balance,
            balance_after: newWalletBalance,
            credited_amount: creditAmount
          },
          admin_id: adminId,
          admin_email: adminEmail
        }])
        .select()
        .single()

      if (auditError) {
        result.warnings.push(`Failed to create audit log: ${auditError.message}`)
      }

      result.success = true
      result.deposit = updatedDeposit
      result.stateTransition = stateTransition
      result.walletTransaction = walletTx
      result.reconciliation = reconciliation

    } catch (error) {
      console.error('[DepositReconciliationService] Error approving deposit:', error)
      result.success = false
      result.warnings.push(`Deposit approval failed: ${error.message}`)

      // Log failure
      try {
        await this.supabase
          .from('deposit_audit_log')
          .insert([{
            deposit_id: depositId,
            operation: 'deposit_approval_failed',
            status: 'failed',
            error_message: error.message
          }])
      } catch (auditErr) {
        console.error('[DepositReconciliationService] Failed to log error:', auditErr)
      }
    }

    return result
  }

  /**
   * Reject pending deposit
   * Creates rejection record without wallet impact
   * 
   * @param {string} depositId - Deposit ID
   * @param {object} options - { adminId, adminEmail, reason }
   * @returns {Promise<object>} - { success, deposit, stateTransition, auditLog }
   */
  async rejectDeposit(depositId, options = {}) {
    const {
      adminId = null,
      adminEmail = 'system',
      reason = 'Rejected by admin'
    } = options

    const result = {
      success: false,
      deposit: null,
      stateTransition: null,
      auditLog: null,
      warnings: []
    }

    try {
      // Step 1: Fetch deposit
      const { data: deposit, error: fetchError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (fetchError || !deposit) {
        throw new Error('Deposit not found')
      }

      // Step 2: Validate state
      if (deposit.status !== 'pending') {
        throw new Error(`Cannot reject deposit with status: ${deposit.status}`)
      }

      // Step 3: Update deposit status
      const { data: updatedDeposit, error: updateError } = await this.supabase
        .from('deposits')
        .update({
          status: 'rejected',
          rejected_by: adminId,
          rejected_at: new Date().toISOString()
        })
        .eq('id', depositId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update deposit: ${updateError.message}`)
      }

      // Step 4: Record state transition
      const { data: stateTransition, error: stateError } = await this.supabase
        .from('deposit_state_transitions')
        .insert([{
          deposit_id: depositId,
          user_id: deposit.user_id,
          wallet_id: deposit.wallet_id,
          previous_state: 'pending',
          new_state: 'rejected',
          reason: reason,
          admin_id: adminId,
          admin_email: adminEmail,
          notes: { rejection_reason: reason }
        }])
        .select()
        .single()

      if (stateError) {
        result.warnings.push(`Failed to record state transition: ${stateError.message}`)
      }

      // Step 5: Create audit log
      const { data: auditLog } = await this.supabase
        .from('deposit_audit_log')
        .insert([{
          deposit_id: depositId,
          user_id: deposit.user_id,
          operation: 'deposit_rejected',
          status: 'success',
          previous_state: { status: 'pending' },
          new_state: { status: 'rejected' },
          admin_id: adminId,
          admin_email: adminEmail
        }])
        .select()
        .single()
        .catch(() => ({ data: null }))

      result.success = true
      result.deposit = updatedDeposit
      result.stateTransition = stateTransition
      result.auditLog = auditLog

    } catch (error) {
      console.error('[DepositReconciliationService] Error rejecting deposit:', error)
      result.success = false
      result.warnings.push(`Deposit rejection failed: ${error.message}`)
    }

    return result
  }

  /**
   * Reverse an approved deposit (refund)
   * Debits wallet and records reversal transaction
   * 
   * @param {string} depositId - Deposit ID
   * @param {object} options - { adminId, adminEmail, reason }
   * @returns {Promise<object>} - { success, deposit, walletTransaction, reconciliation }
   */
  async reverseDeposit(depositId, options = {}) {
    const {
      adminId = null,
      adminEmail = 'system',
      reason = 'Deposit reversal',
      idempotencyKey = uuidv4()
    } = options

    const result = {
      success: false,
      deposit: null,
      walletTransaction: null,
      reconciliation: null,
      warnings: []
    }

    try {
      // Step 1: Fetch deposit
      const { data: deposit, error: fetchError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (fetchError || !deposit) {
        throw new Error('Deposit not found')
      }

      // Step 2: Validate state
      if (deposit.status !== 'approved' && deposit.status !== 'completed') {
        throw new Error(`Cannot reverse deposit with status: ${deposit.status}`)
      }

      // Step 3: Get wallet
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('id, balance')
        .eq('id', deposit.wallet_id)
        .single()

      if (walletError || !wallet) {
        throw new Error('Wallet not found')
      }

      // Step 4: Check sufficient balance for reversal
      const reverseAmount = deposit.received_amount || deposit.amount
      if (wallet.balance < reverseAmount) {
        throw new Error(`Insufficient wallet balance for reversal. Balance: ${wallet.balance}, Required: ${reverseAmount}`)
      }

      // Step 5: Update deposit status
      const newBalance = wallet.balance - reverseAmount
      const { data: updatedDeposit, error: updateError } = await this.supabase
        .from('deposits')
        .update({
          status: 'reversed',
          reversed_by: adminId,
          reversed_at: new Date().toISOString()
        })
        .eq('id', depositId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update deposit: ${updateError.message}`)
      }

      // Step 6: Update wallet balance
      const { error: balanceError } = await this.supabase
        .from('wallets')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id)

      if (balanceError) {
        throw new Error(`Failed to update wallet balance: ${balanceError.message}`)
      }

      // Step 7: Record state transition
      const { error: stateError } = await this.supabase
        .from('deposit_state_transitions')
        .insert([{
          deposit_id: depositId,
          user_id: deposit.user_id,
          wallet_id: deposit.wallet_id,
          previous_state: deposit.status,
          new_state: 'reversed',
          reason: reason,
          admin_id: adminId,
          admin_email: adminEmail,
          idempotency_key: idempotencyKey,
          balance_before: wallet.balance,
          balance_after: newBalance,
          balance_adjustment: -reverseAmount
        }])

      if (stateError) {
        result.warnings.push(`Failed to record state transition: ${stateError.message}`)
      }

      // Step 8: Create reversal wallet transaction
      const { data: walletTx, error: txError } = await this.supabase
        .from('wallet_transactions')
        .insert([{
          wallet_id: wallet.id,
          user_id: deposit.user_id,
          type: 'deposit_reversal',
          amount: reverseAmount,
          balance_before: wallet.balance,
          balance_after: newBalance,
          currency_code: deposit.currency_code,
          description: `Deposit reversed: ${reverseAmount} ${deposit.currency_code}`,
          reference_id: depositId,
          metadata: {
            reason: reason,
            admin_id: adminId,
            admin_email: adminEmail
          }
        }])
        .select()
        .single()

      if (txError) {
        result.warnings.push(`Failed to record wallet transaction: ${txError.message}`)
      }

      // Step 9: Reconcile wallet
      const reconciliation = await this.reconcileWalletBalance(
        deposit.wallet_id,
        deposit.user_id,
        adminId
      )

      // Step 10: Create audit log
      const { error: auditError } = await this.supabase
        .from('deposit_audit_log')
        .insert([{
          deposit_id: depositId,
          user_id: deposit.user_id,
          operation: 'deposit_reversed',
          status: 'success',
          previous_state: { status: deposit.status, balance: wallet.balance + reverseAmount },
          new_state: { status: 'reversed', balance: newBalance },
          wallet_impact: {
            balance_before: wallet.balance + reverseAmount,
            balance_after: newBalance,
            reversed_amount: reverseAmount
          },
          admin_id: adminId,
          admin_email: adminEmail
        }])

      if (auditError) {
        result.warnings.push(`Failed to create audit log: ${auditError.message}`)
      }

      result.success = true
      result.deposit = updatedDeposit
      result.walletTransaction = walletTx
      result.reconciliation = reconciliation

    } catch (error) {
      console.error('[DepositReconciliationService] Error reversing deposit:', error)
      result.success = false
      result.warnings.push(`Deposit reversal failed: ${error.message}`)
    }

    return result
  }

  /**
   * Reconcile wallet balance against expected balance
   * Checks for discrepancies and creates audit record
   * 
   * @param {string} walletId - Wallet ID
   * @param {string} userId - User ID
   * @param {string} adminId - Admin ID (optional)
   * @returns {Promise<object>} - Reconciliation result
   */
  async reconcileWalletBalance(walletId, userId, adminId = null) {
    const result = {
      isBalanced: false,
      discrepancy: 0,
      expectedBalance: 0,
      actualBalance: 0,
      auditId: null,
      warnings: []
    }

    try {
      // Fetch wallet
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('id, balance, currency_code')
        .eq('id', walletId)
        .single()

      if (walletError || !wallet) {
        throw new Error('Wallet not found')
      }

      // Calculate expected balance from approved deposits
      const { data: deposits, error: depositsError } = await this.supabase
        .from('deposits')
        .select('amount, received_amount, status')
        .eq('wallet_id', walletId)

      if (depositsError) {
        throw new Error('Failed to fetch deposits')
      }

      // Sum approved deposits and subtract reversals
      let expectedBalance = 0
      deposits.forEach(dep => {
        if (dep.status === 'approved' || dep.status === 'completed') {
          expectedBalance += dep.received_amount || dep.amount
        } else if (dep.status === 'reversed') {
          expectedBalance -= dep.received_amount || dep.amount
        }
      })

      const discrepancy = wallet.balance - expectedBalance
      const isBalanced = Math.abs(discrepancy) < 0.01

      // Create audit record
      const { data: audit, error: auditError } = await this.supabase
        .from('wallet_balance_audit')
        .insert([{
          wallet_id: walletId,
          user_id: userId,
          audit_type: 'automatic',
          balance_before: wallet.balance,
          balance_after: wallet.balance,
          expected_balance: expectedBalance,
          calculation_method: 'sum_of_approved_deposits',
          status: isBalanced ? 'resolved' : 'pending',
          approved_by: adminId,
          metadata: {
            discrepancy: discrepancy,
            deposit_count: deposits.length
          }
        }])
        .select()
        .single()

      result.isBalanced = isBalanced
      result.discrepancy = discrepancy
      result.expectedBalance = expectedBalance
      result.actualBalance = wallet.balance
      result.auditId = audit?.id

    } catch (error) {
      console.error('[DepositReconciliationService] Reconciliation error:', error)
      result.warnings.push(`Reconciliation failed: ${error.message}`)
    }

    return result
  }

  /**
   * Get complete audit history for a deposit
   * Includes state transitions, transactions, and audit logs
   * 
   * @param {string} depositId - Deposit ID
   * @returns {Promise<object>} - Complete audit trail
   */
  async getAuditHistory(depositId) {
    try {
      const [stateTransitions, transactions, auditLogs] = await Promise.all([
        this.supabase
          .from('deposit_state_transitions')
          .select('*')
          .eq('deposit_id', depositId)
          .order('created_at', { ascending: true }),
        this.supabase
          .from('wallet_transactions')
          .select('*')
          .eq('reference_id', depositId)
          .order('created_at', { ascending: true }),
        this.supabase
          .from('deposit_audit_log')
          .select('*')
          .eq('deposit_id', depositId)
          .order('created_at', { ascending: true })
      ])

      return {
        stateTransitions: stateTransitions.data || [],
        walletTransactions: transactions.data || [],
        auditLogs: auditLogs.data || [],
        errors: [stateTransitions.error, transactions.error, auditLogs.error].filter(Boolean)
      }
    } catch (error) {
      console.error('[DepositReconciliationService] Failed to fetch audit history:', error)
      throw error
    }
  }

  /**
   * Generate reconciliation report for all wallets
   * Shows balance status and discrepancies
   * 
   * @param {string} userId - User ID (optional, for single user)
   * @returns {Promise<array>} - Reconciliation report
   */
  async generateReconciliationReport(userId = null) {
    try {
      let query = this.supabase
        .from('wallet_audit_summary')
        .select('*')

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return {
        report: data || [],
        totalWalletsAudited: data?.length || 0,
        walletsWithDiscrepancies: data?.filter(w => w.discrepancy !== 0).length || 0,
        totalDiscrepancy: (data || []).reduce((sum, w) => sum + (w.discrepancy || 0), 0)
      }
    } catch (error) {
      console.error('[DepositReconciliationService] Failed to generate report:', error)
      throw error
    }
  }

  /**
   * Utility: Generate reference number for deposit
   */
  _generateReference(method) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `${(method || 'DEP').toUpperCase()}-${timestamp}-${random}`
  }
}

export const depositReconciliationService = new DepositReconciliationService(supabase)

export default DepositReconciliationService
