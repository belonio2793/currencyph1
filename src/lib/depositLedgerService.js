import { supabase } from './supabaseClient'
import { v4 as uuidv4 } from 'uuid'

/**
 * Deposit Ledger Service
 * 
 * Single-table ledger model using wallet_transactions
 * Every deposit action creates a new transaction row with type and note
 * Balance is calculated from sum of all transactions
 */
export class DepositLedgerService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Process new incoming deposit
   * Creates deposit record + initial pending transaction
   * 
   * @param {object} options - { userId, walletId, amount, currency, method, externalId, methodDetails }
   * @returns {Promise<object>} - { success, deposit, transaction, warnings }
   */
  async processIncomingDeposit(options = {}) {
    const {
      userId,
      walletId,
      amount,
      currency,
      method = 'unknown',
      externalId = null,
      methodDetails = {},
      description = null
    } = options

    const result = {
      success: false,
      deposit: null,
      transaction: null,
      warnings: []
    }

    try {
      // Validate input
      if (!userId || !walletId || !amount || amount <= 0) {
        throw new Error('Invalid deposit parameters')
      }

      // Check for duplicate deposits
      if (externalId) {
        const { data: existingDeposit } = await this.supabase
          .from('deposits')
          .select('id')
          .eq('external_id', externalId)
          .single()
          .catch(() => ({ data: null }))

        if (existingDeposit) {
          result.warnings.push(`Duplicate deposit detected: ${externalId}`)
          result.success = true
          return result
        }
      }

      // Create deposit record
      const { data: deposit, error: depositError } = await this.supabase
        .from('deposits')
        .insert([{
          user_id: userId,
          wallet_id: walletId,
          amount: amount,
          currency_code: currency,
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

      // Create pending transaction in wallet_transactions
      const { data: transaction, error: txError } = await this.supabase
        .from('wallet_transactions')
        .insert([{
          wallet_id: walletId,
          user_id: userId,
          type: 'deposit_pending',
          amount: amount,
          currency_code: currency,
          note: 'pending',
          status: 'pending',
          reference_id: deposit.id,
          description: description || `Deposit pending: ${amount} ${currency} via ${method}`,
          metadata: {
            method: method,
            method_details: methodDetails,
            external_id: externalId
          }
        }])
        .select()
        .single()

      if (txError) {
        result.warnings.push(`Failed to record transaction: ${txError.message}`)
      }

      result.success = true
      result.deposit = deposit
      result.transaction = transaction

    } catch (error) {
      console.error('[DepositLedgerService] Error processing deposit:', error)
      result.warnings.push(`Deposit processing failed: ${error.message}`)
    }

    return result
  }

  /**
   * Approve pending deposit
   * Creates new 'deposit_approved' transaction and credits wallet
   * 
   * @param {string} depositId - Deposit ID
   * @param {object} options - { adminId, adminEmail, reason, receivedAmount, exchangeRate }
   * @returns {Promise<object>} - { success, deposit, transaction, balanceVerification, warnings }
   */
  async approveDeposit(depositId, options = {}) {
    const {
      adminId = null,
      adminEmail = 'system',
      reason = 'Admin approval',
      receivedAmount = null,
      exchangeRate = 1
    } = options

    const result = {
      success: false,
      deposit: null,
      transaction: null,
      balanceVerification: null,
      warnings: []
    }

    try {
      // Fetch deposit
      const { data: deposit, error: fetchError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (fetchError || !deposit) {
        throw new Error('Deposit not found')
      }

      // Validate state
      if (deposit.status !== 'pending') {
        throw new Error(`Cannot approve deposit with status: ${deposit.status}`)
      }

      // Update deposit
      const creditAmount = receivedAmount || deposit.amount
      const { data: updatedDeposit, error: updateError } = await this.supabase
        .from('deposits')
        .update({
          status: 'approved',
          approved_by: adminId,
          approved_at: new Date().toISOString(),
          received_amount: creditAmount,
          exchange_rate: exchangeRate
        })
        .eq('id', depositId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update deposit: ${updateError.message}`)
      }

      // Create approval transaction - trigger will auto-credit wallet
      const { data: transaction, error: txError } = await this.supabase
        .from('wallet_transactions')
        .insert([{
          wallet_id: deposit.wallet_id,
          user_id: deposit.user_id,
          type: 'deposit_approved',
          amount: creditAmount,
          currency_code: deposit.currency_code,
          note: 'approved',
          status: 'approved',
          reference_id: depositId,
          description: `Deposit approved: ${creditAmount} ${deposit.currency_code}`,
          metadata: {
            original_amount: deposit.amount,
            original_currency: deposit.currency_code,
            exchange_rate: exchangeRate,
            admin_id: adminId,
            admin_email: adminEmail,
            reason: reason
          }
        }])
        .select()
        .single()

      if (txError) {
        throw new Error(`Failed to record approval transaction: ${txError.message}`)
      }

      // Verify wallet balance
      const verification = await this.verifyWalletBalance(deposit.wallet_id)

      result.success = true
      result.deposit = updatedDeposit
      result.transaction = transaction
      result.balanceVerification = verification

    } catch (error) {
      console.error('[DepositLedgerService] Error approving deposit:', error)
      result.warnings.push(`Deposit approval failed: ${error.message}`)
    }

    return result
  }

  /**
   * Reject pending deposit
   * No wallet transaction needed for rejection
   * 
   * @param {string} depositId - Deposit ID
   * @param {object} options - { adminId, adminEmail, reason }
   * @returns {Promise<object>} - { success, deposit, warnings }
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
      warnings: []
    }

    try {
      // Fetch deposit
      const { data: deposit, error: fetchError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (fetchError || !deposit) {
        throw new Error('Deposit not found')
      }

      if (deposit.status !== 'pending') {
        throw new Error(`Cannot reject deposit with status: ${deposit.status}`)
      }

      // Update deposit
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

      // Record rejection in wallet_transactions
      const { error: txError } = await this.supabase
        .from('wallet_transactions')
        .insert([{
          wallet_id: deposit.wallet_id,
          user_id: deposit.user_id,
          type: 'deposit_rejected',
          amount: deposit.amount,
          currency_code: deposit.currency_code,
          note: 'rejected',
          status: 'rejected',
          reference_id: depositId,
          description: `Deposit rejected: ${deposit.amount} ${deposit.currency_code}`,
          metadata: {
            admin_id: adminId,
            admin_email: adminEmail,
            reason: reason
          }
        }])

      if (txError) {
        result.warnings.push(`Failed to record rejection: ${txError.message}`)
      }

      result.success = true
      result.deposit = updatedDeposit

    } catch (error) {
      console.error('[DepositLedgerService] Error rejecting deposit:', error)
      result.warnings.push(`Deposit rejection failed: ${error.message}`)
    }

    return result
  }

  /**
   * Reverse an approved deposit
   * Creates deposit_reversed transaction, debits wallet
   * 
   * @param {string} depositId - Deposit ID
   * @param {object} options - { adminId, adminEmail, reason }
   * @returns {Promise<object>} - { success, deposit, transaction, balanceVerification, warnings }
   */
  async reverseDeposit(depositId, options = {}) {
    const {
      adminId = null,
      adminEmail = 'system',
      reason = 'Deposit reversal'
    } = options

    const result = {
      success: false,
      deposit: null,
      transaction: null,
      balanceVerification: null,
      warnings: []
    }

    try {
      // Fetch deposit
      const { data: deposit, error: fetchError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (fetchError || !deposit) {
        throw new Error('Deposit not found')
      }

      if (deposit.status !== 'approved' && deposit.status !== 'completed') {
        throw new Error(`Cannot reverse deposit with status: ${deposit.status}`)
      }

      // Update deposit
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

      // Create reversal transaction - trigger will auto-debit wallet
      const reverseAmount = deposit.received_amount || deposit.amount
      const { data: transaction, error: txError } = await this.supabase
        .from('wallet_transactions')
        .insert([{
          wallet_id: deposit.wallet_id,
          user_id: deposit.user_id,
          type: 'deposit_reversed',
          amount: reverseAmount,
          currency_code: deposit.currency_code,
          note: 'reversed',
          status: 'reversed',
          reference_id: depositId,
          description: `Deposit reversed: ${reverseAmount} ${deposit.currency_code}`,
          metadata: {
            admin_id: adminId,
            admin_email: adminEmail,
            reason: reason,
            reversed_from_balance: deposit.received_amount || deposit.amount
          }
        }])
        .select()
        .single()

      if (txError) {
        throw new Error(`Failed to record reversal: ${txError.message}`)
      }

      // Verify wallet balance
      const verification = await this.verifyWalletBalance(deposit.wallet_id)

      result.success = true
      result.deposit = updatedDeposit
      result.transaction = transaction
      result.balanceVerification = verification

    } catch (error) {
      console.error('[DepositLedgerService] Error reversing deposit:', error)
      result.warnings.push(`Deposit reversal failed: ${error.message}`)
    }

    return result
  }

  /**
   * Verify wallet balance against ledger
   * Calculates balance from wallet_transactions
   * 
   * @param {string} walletId - Wallet ID
   * @returns {Promise<object>} - { isValid, actualBalance, calculatedBalance, discrepancy }
   */
  async verifyWalletBalance(walletId) {
    try {
      const { data, error } = await this.supabase
        .rpc('verify_wallet_balance', { p_wallet_id: walletId })

      if (error) throw error

      return data?.[0] || {
        is_valid: false,
        actual_balance: 0,
        calculated_balance: 0,
        discrepancy: 0
      }
    } catch (error) {
      console.error('[DepositLedgerService] Balance verification error:', error)
      return { error: error.message }
    }
  }

  /**
   * Get complete deposit timeline
   * All transactions related to a deposit
   * 
   * @param {string} depositId - Deposit ID
   * @returns {Promise<array>} - Complete transaction timeline
   */
  async getDepositTimeline(depositId) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_deposit_timeline', { p_deposit_id: depositId })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('[DepositLedgerService] Failed to fetch timeline:', error)
      return []
    }
  }

  /**
   * Get wallet transaction history
   * 
   * @param {string} walletId - Wallet ID
   * @param {number} limit - Number of transactions
   * @returns {Promise<array>} - Transaction history
   */
  async getWalletTransactionHistory(walletId, limit = 100) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_wallet_transaction_history', {
          p_wallet_id: walletId,
          p_limit: limit
        })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('[DepositLedgerService] Failed to fetch history:', error)
      return []
    }
  }

  /**
   * Get all wallets with balance verification
   * 
   * @returns {Promise<array>} - Wallet balance status
   */
  async getWalletsBalanceStatus() {
    try {
      const { data, error } = await this.supabase
        .from('wallet_balance_verification')
        .select('*')

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('[DepositLedgerService] Failed to get balance status:', error)
      return []
    }
  }

  /**
   * Get recent deposit activity
   * 
   * @returns {Promise<array>} - Recent deposits
   */
  async getRecentDepositActivity(limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('recent_deposit_activity')
        .select('*')
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('[DepositLedgerService] Failed to get recent activity:', error)
      return []
    }
  }

  /**
   * Reconcile all wallets
   * Check for any balance discrepancies
   * 
   * @returns {Promise<object>} - Reconciliation report
   */
  async reconcileAllWallets() {
    try {
      const walletStatus = await this.getWalletsBalanceStatus()

      const report = {
        totalWallets: walletStatus.length,
        validWallets: walletStatus.filter(w => w.status === 'VALID').length,
        mismatchWallets: walletStatus.filter(w => w.status === 'MISMATCH').length,
        wallets: walletStatus,
        timestamp: new Date().toISOString()
      }

      return report
    } catch (error) {
      console.error('[DepositLedgerService] Reconciliation error:', error)
      return { error: error.message }
    }
  }

  /**
   * Generate audit trail for deposit
   * Gets deposit record + all related transactions
   * 
   * @param {string} depositId - Deposit ID
   * @returns {Promise<object>} - Complete audit trail
   */
  async generateAuditTrail(depositId) {
    try {
      // Fetch deposit
      const { data: deposit, error: depError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (depError) throw depError

      // Fetch timeline
      const timeline = await this.getDepositTimeline(depositId)

      return {
        deposit,
        timeline,
        totalTransactions: timeline.length,
        status: deposit.status,
        createdAt: deposit.created_at,
        lastUpdate: timeline[0]?.created_at || deposit.updated_at
      }
    } catch (error) {
      console.error('[DepositLedgerService] Failed to generate audit trail:', error)
      return { error: error.message }
    }
  }

  _generateReference(method) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `${(method || 'DEP').toUpperCase()}-${timestamp}-${random}`
  }
}

export const depositLedgerService = new DepositLedgerService(supabase)

export default DepositLedgerService
