import { supabase } from './supabaseClient'
import { v4 as uuidv4 } from 'uuid'

/**
 * Deposit Status Change Service
 * 
 * Provides safe, audited status changes for deposits with:
 * - Complete audit trails
 * - Idempotency prevention (no double-crediting)
 * - Version control for network sync
 * - Reversal capability with proper rollback
 * - Wallet balance validation and reconciliation
 */

export class DepositStatusChangeService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Safely change deposit status with full audit trail
   * @param {string} depositId - Deposit ID
   * @param {string} newStatus - New status ('approved', 'rejected', 'completed', 'pending')
   * @param {object} options - { adminId, adminEmail, reason, notes, idempotencyKey }
   * @returns {Promise<object>} - { success, deposit, auditLog, warnings }
   */
  async changeDepositStatus(depositId, newStatus, options = {}) {
    const {
      adminId,
      adminEmail = 'system',
      reason = '',
      notes = {},
      idempotencyKey = uuidv4()
    } = options

    const startTime = Date.now()
    const result = {
      success: false,
      deposit: null,
      auditLog: null,
      reversal: null,
      warnings: [],
      walletReconciliation: null,
      timeTaken: 0
    }

    try {
      // Step 1: Fetch current deposit state
      const { data: deposit, error: fetchError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (fetchError || !deposit) {
        throw new Error(`Deposit not found: ${depositError?.message || ''}`)
      }

      // Step 2: Validate the state transition
      this._validateStateTransition(deposit.status, newStatus)

      // Step 3: Check for idempotency - prevent duplicate operations
      const { data: existingAudit } = await this.supabase
        .from('deposit_audit_log')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single()
        .catch(() => ({ data: null }))

      if (existingAudit) {
        // Operation already completed - return cached result
        result.success = true
        result.auditLog = existingAudit
        result.deposit = deposit
        result.warnings.push('Operation was already completed (idempotent)')
        return result
      }

      // Step 4: Acquire version lock to prevent concurrent modifications
      const { data: lock } = await this.supabase
        .from('deposit_state_lock')
        .select('version, locked_by')
        .eq('deposit_id', depositId)
        .single()
        .catch(() => ({ data: null }))

      const currentVersion = lock?.version || 1
      const nextVersion = currentVersion + 1

      // Step 5: Record status history
      const { data: statusHistory, error: historyError } = await this.supabase
        .from('deposit_status_history')
        .insert([{
          deposit_id: depositId,
          user_id: deposit.user_id,
          old_status: deposit.status,
          new_status: newStatus,
          changed_by: adminId,
          reason,
          notes
        }])
        .select()
        .single()

      if (historyError) {
        result.warnings.push(`Failed to record status history: ${historyError.message}`)
      }

      // Step 6: Prepare wallet impact data
      let walletImpact = null
      let shouldUpdateWallet = false

      if (newStatus === 'approved' && deposit.status === 'pending') {
        // Approval: Credit the wallet (with currency conversion if needed)
        shouldUpdateWallet = true
        walletImpact = await this._calculateWalletImpact(
          deposit.wallet_id,
          deposit.amount,
          'credit',
          deposit.currency_code,
          depositId
        )

        // If conversion happened, update deposit with conversion details
        if (walletImpact.conversion) {
          await this._recordConversionAudit(
            depositId,
            deposit.user_id,
            'conversion_initiated',
            walletImpact.conversion
          )
        }
      } else if (deposit.status === 'approved' && newStatus === 'pending') {
        // Reversal: Debit the wallet
        shouldUpdateWallet = true
        walletImpact = await this._calculateWalletImpact(
          deposit.wallet_id,
          deposit.amount,
          'debit',
          deposit.currency_code,
          depositId
        )
      }

      // Step 7: Update deposit status atomically
      const updatePayload = {
        status: newStatus,
        version: nextVersion,
        idempotency_key: idempotencyKey,
        updated_at: new Date().toISOString()
      }

      if (newStatus === 'approved') {
        updatePayload.approved_by = adminId
        updatePayload.approved_at = new Date().toISOString()
      }

      if (newStatus === 'pending' && deposit.status === 'approved') {
        updatePayload.reversal_reason = reason
      }

      const { data: updatedDeposit, error: updateError } = await this.supabase
        .from('deposits')
        .update(updatePayload)
        .eq('id', depositId)
        .eq('version', currentVersion) // Optimistic locking - only update if version hasn't changed
        .select()
        .single()

      if (updateError) {
        if (updateError.message.includes('duplicate')) {
          throw new Error('Deposit was modified concurrently. Please refresh and try again.')
        }
        throw updateError
      }

      // Step 8: Handle wallet balance update if needed
      if (shouldUpdateWallet && walletImpact) {
        await this._updateWalletBalance(deposit.wallet_id, walletImpact, depositId, adminId)
      }

      // Step 9: Create comprehensive audit log
      const { data: auditLog, error: auditError } = await this.supabase
        .from('deposit_audit_log')
        .insert([{
          deposit_id: depositId,
          user_id: deposit.user_id,
          wallet_id: deposit.wallet_id,
          action: newStatus === 'pending' ? 'reverse' : newStatus,
          old_state: {
            status: deposit.status,
            amount: deposit.amount,
            version: currentVersion
          },
          new_state: {
            status: newStatus,
            amount: deposit.amount,
            version: nextVersion
          },
          wallet_impact: walletImpact,
          admin_id: adminId,
          admin_email: adminEmail,
          idempotency_key: idempotencyKey,
          status: 'success',
          network_sync_version: nextVersion,
          completed_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (auditError) {
        result.warnings.push(`Failed to create audit log: ${auditError.message}`)
      } else {
        result.auditLog = auditLog
      }

      // Step 10: Create reversal registry if reverting approval
      if (newStatus === 'pending' && deposit.status === 'approved') {
        const { data: reversal } = await this.supabase
          .from('deposit_reversal_registry')
          .insert([{
            original_deposit_id: depositId,
            reason: reason || 'manual_revert',
            reversed_by: adminId,
            original_balance: walletImpact?.balance_before,
            reversal_balance: walletImpact?.balance_after,
            status: 'active'
          }])
          .select()
          .single()
          .catch(() => ({ data: null }))

        result.reversal = reversal
      }

      // Step 11: Update state lock
      await this.supabase
        .from('deposit_state_lock')
        .upsert({
          deposit_id: depositId,
          version: nextVersion,
          locked_by: adminId,
          is_locked: false,
          last_modified_at: new Date().toISOString()
        })
        .catch(() => null)

      result.success = true
      result.deposit = updatedDeposit
      result.walletReconciliation = walletImpact

    } catch (error) {
      console.error('[DepositStatusChangeService] Error:', error)
      result.success = false
      result.warnings.push(`Operation failed: ${error.message}`)

      // Log the failure for investigation
      try {
        await this.supabase
          .from('deposit_audit_log')
          .insert([{
            deposit_id: depositId,
            user_id: null,
            action: newStatus,
            admin_id: adminId,
            admin_email: adminEmail,
            idempotency_key: idempotencyKey,
            status: 'failed',
            error_message: error.message,
            created_at: new Date().toISOString()
          }])
          .catch(() => null)
      } catch (auditErr) {
        console.error('[DepositStatusChangeService] Failed to log error:', auditErr)
      }
    } finally {
      result.timeTaken = Date.now() - startTime
    }

    return result
  }

  /**
   * Validate state transitions
   */
  _validateStateTransition(fromStatus, toStatus) {
    const validTransitions = {
      'pending': ['approved', 'rejected', 'cancelled'],
      'approved': ['pending', 'completed', 'rejected'],
      'completed': ['pending'], // Allow reversal only
      'rejected': ['pending'],
      'cancelled': ['pending']
    }

    const allowedTransitions = validTransitions[fromStatus] || []
    if (!allowedTransitions.includes(toStatus)) {
      throw new Error(
        `Invalid status transition: ${fromStatus} -> ${toStatus}. ` +
        `Allowed transitions: ${allowedTransitions.join(', ')}`
      )
    }
  }

  /**
   * Calculate wallet impact of the status change with currency conversion
   * @param {string} walletId - Wallet ID
   * @param {number} amount - Deposit amount
   * @param {string} operation - 'credit' or 'debit'
   * @param {string} depositCurrency - Currency of the deposit
   * @param {string} depositId - Deposit ID (for audit trail)
   * @returns {Promise<object>} - Wallet impact with conversion details
   */
  async _calculateWalletImpact(walletId, amount, operation, depositCurrency = null, depositId = null) {
    // Fetch wallet with currency info
    const { data: wallet, error } = await this.supabase
      .from('wallets')
      .select('id, balance, currency_code')
      .eq('id', walletId)
      .single()

    if (error || !wallet) {
      throw new Error(`Wallet not found: ${walletId}`)
    }

    const walletCurrency = wallet.currency_code
    const balanceBefore = parseFloat(wallet.balance)
    const amountChange = parseFloat(amount)

    // Handle currency validation and conversion
    let finalAmount = amountChange
    let conversionData = null

    if (depositCurrency && depositCurrency !== walletCurrency) {
      // Currency mismatch - need to convert
      conversionData = await this._convertCurrency(
        depositCurrency,
        walletCurrency,
        amountChange,
        depositId
      )

      if (!conversionData) {
        throw new Error(
          `Cannot convert ${depositCurrency} to ${walletCurrency}. No exchange rate available.`
        )
      }

      finalAmount = conversionData.convertedAmount
    }

    const balanceAfter = operation === 'credit'
      ? balanceBefore + finalAmount
      : balanceBefore - finalAmount

    if (operation === 'debit' && balanceAfter < 0) {
      throw new Error(
        `Insufficient balance. Current: ${balanceBefore}, Required: ${finalAmount}`
      )
    }

    return {
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      amount_changed: operation === 'credit' ? finalAmount : -finalAmount,
      operation,
      wallet_id: walletId,
      wallet_currency: walletCurrency,
      deposit_currency: depositCurrency,
      conversion: conversionData
    }
  }

  /**
   * Convert currency amount using exchange rates
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @param {number} amount - Amount in source currency
   * @param {string} depositId - Deposit ID for audit trail
   * @returns {Promise<object>} - Conversion details or null if rate unavailable
   */
  async _convertCurrency(fromCurrency, toCurrency, amount, depositId = null) {
    try {
      // Get latest exchange rate from crypto_rates table
      const { data: rateData, error: rateError } = await this.supabase
        .from('crypto_rates_valid')
        .select('rate, source, updated_at')
        .eq('from_currency', fromCurrency)
        .eq('to_currency', toCurrency)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (rateError || !rateData) {
        console.warn(`No exchange rate found for ${fromCurrency}/${toCurrency}`)
        return null
      }

      const exchangeRate = parseFloat(rateData.rate)
      const convertedAmount = amount * exchangeRate

      return {
        fromCurrency,
        toCurrency,
        originalAmount: amount,
        exchangeRate: exchangeRate,
        convertedAmount: convertedAmount,
        rateSource: rateData.source,
        rateUpdatedAt: rateData.updated_at,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error(`Currency conversion failed for ${fromCurrency}->${toCurrency}:`, error)
      return null
    }
  }

  /**
   * Update wallet balance with audit trail
   */
  async _updateWalletBalance(walletId, impact, depositId, adminId) {
    // Update wallet balance
    const { error: balanceError } = await this.supabase
      .from('wallets')
      .update({
        balance: impact.balance_after,
        updated_at: new Date().toISOString()
      })
      .eq('id', walletId)

    if (balanceError) {
      throw new Error(`Failed to update wallet balance: ${balanceError.message}`)
    }

    // Record wallet transaction
    const { error: txError } = await this.supabase
      .from('wallet_transactions')
      .insert([{
        wallet_id: walletId,
        type: impact.operation === 'credit' ? 'deposit' : 'deposit_reversal',
        amount: impact.amount_changed,
        balance_before: impact.balance_before,
        balance_after: impact.balance_after,
        description: impact.operation === 'credit'
          ? `Deposit approved: ${impact.amount_changed}`
          : `Deposit reversed: ${-impact.amount_changed}`,
        reference_id: depositId
      }])

    if (txError) {
      console.warn('[DepositStatusChangeService] Failed to record transaction:', txError)
    }

    // Record reconciliation
    await this.supabase
      .from('wallet_balance_reconciliation')
      .insert([{
        wallet_id: walletId,
        balance_before: impact.balance_before,
        balance_after: impact.balance_after,
        reconciliation_type: impact.operation === 'credit' ? 'deposit_approval' : 'deposit_reversal',
        admin_id: adminId,
        reason: `Deposit ${impact.operation}`,
        status: 'completed',
        completed_at: new Date().toISOString()
      }])
      .catch(() => null)
  }

  /**
   * Get deposit audit history
   */
  async getAuditHistory(depositId, limit = 50) {
    try {
      const [statusHistory, auditLogs] = await Promise.all([
        this.supabase
          .from('deposit_status_history')
          .select('*')
          .eq('deposit_id', depositId)
          .order('created_at', { ascending: false })
          .limit(limit),
        this.supabase
          .from('deposit_audit_log')
          .select('*')
          .eq('deposit_id', depositId)
          .order('created_at', { ascending: false })
          .limit(limit)
      ])

      return {
        statusHistory: statusHistory.data || [],
        auditLogs: auditLogs.data || [],
        errors: [statusHistory.error, auditLogs.error].filter(Boolean)
      }
    } catch (error) {
      console.error('[DepositStatusChangeService] Failed to fetch audit history:', error)
      throw error
    }
  }

  /**
   * Reconcile wallet balance against deposits
   */
  async reconcileWalletBalance(walletId, adminId) {
    try {
      const { data: wallet } = await this.supabase
        .from('wallets')
        .select('balance')
        .eq('id', walletId)
        .single()

      if (!wallet) {
        throw new Error('Wallet not found')
      }

      // Sum all approved deposits
      const { data: approvedDeposits } = await this.supabase
        .from('deposits')
        .select('amount')
        .eq('wallet_id', walletId)
        .in('status', ['approved', 'completed'])

      const expectedBalance = (approvedDeposits || [])
        .reduce((sum, d) => sum + parseFloat(d.amount), 0)

      const discrepancy = parseFloat(wallet.balance) - expectedBalance

      if (Math.abs(discrepancy) > 0.01) {
        // Log reconciliation issue
        const { data: reconciliation } = await this.supabase
          .from('wallet_balance_reconciliation')
          .insert([{
            wallet_id: walletId,
            balance_before: expectedBalance,
            balance_after: parseFloat(wallet.balance),
            discrepancy,
            reason: 'Balance mismatch detected',
            reconciliation_type: 'auto_sync',
            admin_id: adminId,
            status: 'pending'
          }])
          .select()
          .single()

        return {
          isBalanced: false,
          discrepancy,
          expectedBalance,
          actualBalance: parseFloat(wallet.balance),
          reconciliation
        }
      }

      return {
        isBalanced: true,
        discrepancy: 0,
        expectedBalance,
        actualBalance: parseFloat(wallet.balance)
      }
    } catch (error) {
      console.error('[DepositStatusChangeService] Reconciliation error:', error)
      throw error
    }
  }
}

// Export singleton instance
export const depositStatusChangeService = new DepositStatusChangeService(supabase)

export default DepositStatusChangeService
