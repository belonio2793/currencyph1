import { supabase } from './supabaseClient'

/**
 * Deposit Sync & Reconciliation Service
 * 
 * Ensures all deposits and wallet balances are synchronized across the network:
 * - Detects and fixes balance discrepancies
 * - Validates deposit-to-wallet mappings
 * - Provides automatic reconciliation
 * - Generates detailed sync reports
 */

export class DepositSyncService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Perform full wallet reconciliation
   * Compare expected balance (sum of approved deposits) vs actual balance
   */
  async reconcileWallet(walletId, adminId) {
    try {
      // Get wallet
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('id, balance, user_id')
        .eq('id', walletId)
        .single()

      if (walletError || !wallet) {
        throw new Error(`Wallet not found: ${walletId}`)
      }

      // Get all deposits for this wallet
      const { data: deposits, error: depositsError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('wallet_id', walletId)

      if (depositsError) throw depositsError

      // Calculate expected balance from approved deposits
      const approvedDeposits = (deposits || []).filter(d =>
        d.status === 'approved' || d.status === 'completed'
      )

      const expectedBalance = approvedDeposits.reduce((sum, d) => {
        return sum + parseFloat(d.amount || 0)
      }, 0)

      const actualBalance = parseFloat(wallet.balance || 0)
      const discrepancy = actualBalance - expectedBalance

      const reconciliation = {
        walletId,
        userId: wallet.user_id,
        actualBalance,
        expectedBalance,
        discrepancy,
        isBalanced: Math.abs(discrepancy) < 0.01,
        depositCount: deposits?.length || 0,
        approvedCount: approvedDeposits.length,
        needsAction: false,
        recommendation: ''
      }

      // Determine if action is needed
      if (!reconciliation.isBalanced) {
        reconciliation.needsAction = true

        if (discrepancy > 0) {
          reconciliation.recommendation = `Wallet has ${discrepancy.toFixed(2)} extra. Consider reversing a recent approval or crediting a failed deposit.`
        } else {
          reconciliation.recommendation = `Wallet is short ${Math.abs(discrepancy).toFixed(2)}. Review pending deposits or missing approvals.`
        }
      }

      // Log reconciliation
      await this.supabase
        .from('wallet_balance_reconciliation')
        .insert([{
          wallet_id: walletId,
          user_id: wallet.user_id,
          balance_before: expectedBalance,
          balance_after: actualBalance,
          discrepancy,
          reason: 'Full wallet reconciliation',
          reconciliation_type: 'auto_sync',
          admin_id: adminId,
          status: reconciliation.isBalanced ? 'completed' : 'pending',
          completed_at: new Date().toISOString()
        }])
        .catch(() => null)

      return reconciliation
    } catch (error) {
      console.error('[DepositSyncService] Reconciliation error:', error)
      throw error
    }
  }

  /**
   * Sync all deposits for a user - ensure consistency
   */
  async syncUserDeposits(userId, adminId) {
    try {
      const syncReport = {
        userId,
        timestamp: new Date().toISOString(),
        totalDeposits: 0,
        pendingDeposits: 0,
        approvedDeposits: 0,
        completedDeposits: 0,
        issues: [],
        warnings: [],
        wallets: []
      }

      // Get all user deposits
      const { data: deposits, error: depositsError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('user_id', userId)

      if (depositsError) throw depositsError

      syncReport.totalDeposits = deposits?.length || 0

      // Group by status
      const byStatus = {}
      const byWallet = {}

      ;(deposits || []).forEach(d => {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1

        if (!byWallet[d.wallet_id]) {
          byWallet[d.wallet_id] = []
        }
        byWallet[d.wallet_id].push(d)
      })

      syncReport.pendingDeposits = byStatus['pending'] || 0
      syncReport.approvedDeposits = byStatus['approved'] || 0
      syncReport.completedDeposits = byStatus['completed'] || 0

      // Check each wallet for consistency
      for (const [walletId, walletDeposits] of Object.entries(byWallet)) {
        const walletSync = await this.reconcileWallet(walletId, adminId)
        syncReport.wallets.push(walletSync)

        if (!walletSync.isBalanced) {
          syncReport.issues.push({
            walletId,
            issue: walletSync.recommendation,
            discrepancy: walletSync.discrepancy
          })
        }
      }

      // Check for duplicate deposits (same amount, currency, method within 1 minute)
      const depositsBySignature = {}
      ;(deposits || []).forEach(d => {
        const signature = `${d.amount}-${d.currency_code}-${d.deposit_method}`
        if (!depositsBySignature[signature]) {
          depositsBySignature[signature] = []
        }
        depositsBySignature[signature].push(d)
      })

      for (const [sig, dupes] of Object.entries(depositsBySignature)) {
        if (dupes.length > 1) {
          const timeDiff = new Date(dupes[dupes.length - 1].created_at) - new Date(dupes[0].created_at)
          if (timeDiff < 60000) { // Less than 1 minute apart
            syncReport.warnings.push({
              type: 'possible_duplicate',
              message: `Found ${dupes.length} similar deposits within 1 minute`,
              depositIds: dupes.map(d => d.id)
            })
          }
        }
      }

      // Check for orphaned deposits (wallet doesn't exist)
      const walletIds = Object.keys(byWallet)
      if (walletIds.length > 0) {
        const { data: wallets } = await this.supabase
          .from('wallets')
          .select('id')
          .in('id', walletIds)

        const existingIds = new Set(wallets?.map(w => w.id) || [])
        const orphanedIds = walletIds.filter(id => !existingIds.has(id))

        if (orphanedIds.length > 0) {
          syncReport.issues.push({
            type: 'orphaned_deposits',
            message: `${orphanedIds.length} deposits reference non-existent wallets`,
            walletIds: orphanedIds
          })
        }
      }

      return syncReport
    } catch (error) {
      console.error('[DepositSyncService] Sync error:', error)
      throw error
    }
  }

  /**
   * Find and fix balance discrepancies
   */
  async fixDiscrepancy(walletId, adminId, reason = '') {
    try {
      const reconciliation = await this.reconcileWallet(walletId, adminId)

      if (reconciliation.isBalanced) {
        return {
          success: true,
          message: 'Wallet is already balanced',
          reconciliation
        }
      }

      // Get current wallet data
      const { data: wallet } = await this.supabase
        .from('wallets')
        .select('balance')
        .eq('id', walletId)
        .single()

      const balanceBefore = parseFloat(wallet.balance)

      // Correct the balance
      const { error: updateError } = await this.supabase
        .from('wallets')
        .update({
          balance: reconciliation.expectedBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', walletId)

      if (updateError) throw updateError

      // Log the correction
      await this.supabase
        .from('wallet_balance_reconciliation')
        .insert([{
          wallet_id: walletId,
          balance_before: balanceBefore,
          balance_after: reconciliation.expectedBalance,
          discrepancy: reconciliation.discrepancy,
          reason: reason || 'Automatic balance correction',
          reconciliation_type: 'auto_sync',
          admin_id: adminId,
          status: 'completed',
          completed_at: new Date().toISOString()
        }])
        .catch(() => null)

      // Record transaction for audit
      await this.supabase
        .from('wallet_transactions')
        .insert([{
          wallet_id: walletId,
          type: 'balance_correction',
          amount: reconciliation.discrepancy,
          balance_before: balanceBefore,
          balance_after: reconciliation.expectedBalance,
          description: `Balance correction: ${reconciliation.discrepancy > 0 ? 'credit' : 'debit'} ${Math.abs(reconciliation.discrepancy).toFixed(2)}`
        }])
        .catch(() => null)

      return {
        success: true,
        message: 'Balance corrected',
        discrepancy: reconciliation.discrepancy,
        balanceBefore,
        balanceAfter: reconciliation.expectedBalance,
        reconciliation
      }
    } catch (error) {
      console.error('[DepositSyncService] Fix discrepancy error:', error)
      throw error
    }
  }

  /**
   * Validate deposit integrity
   */
  async validateDeposit(depositId) {
    try {
      const { data: deposit, error: depositError } = await this.supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (depositError || !deposit) {
        throw new Error('Deposit not found')
      }

      const validation = {
        depositId,
        isValid: true,
        issues: [],
        warnings: []
      }

      // Check 1: Wallet exists
      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('id, user_id')
        .eq('id', deposit.wallet_id)
        .single()

      if (walletError || !wallet) {
        validation.isValid = false
        validation.issues.push('Wallet does not exist')
      } else if (wallet.user_id !== deposit.user_id) {
        validation.isValid = false
        validation.issues.push('Wallet belongs to different user')
      }

      // Check 2: Amount is positive
      if (parseFloat(deposit.amount) <= 0) {
        validation.isValid = false
        validation.issues.push('Amount must be positive')
      }

      // Check 3: Status is valid
      const validStatuses = ['pending', 'approved', 'completed', 'rejected', 'cancelled']
      if (!validStatuses.includes(deposit.status)) {
        validation.isValid = false
        validation.issues.push(`Invalid status: ${deposit.status}`)
      }

      // Check 4: Dates make sense
      if (new Date(deposit.created_at) > new Date()) {
        validation.warnings.push('Created date is in the future')
      }

      if (deposit.approved_at && new Date(deposit.approved_at) < new Date(deposit.created_at)) {
        validation.isValid = false
        validation.issues.push('Approved date is before created date')
      }

      // Check 5: Check for version consistency
      if (!deposit.version) {
        validation.warnings.push('Deposit missing version number')
      }

      // Check 6: Verify audit trail exists
      const { data: auditLogs } = await this.supabase
        .from('deposit_audit_log')
        .select('id')
        .eq('deposit_id', depositId)
        .limit(1)

      if (deposit.status !== 'pending' && !auditLogs?.length) {
        validation.warnings.push('Deposit status changed but no audit log found')
      }

      return validation
    } catch (error) {
      console.error('[DepositSyncService] Validation error:', error)
      throw error
    }
  }

  /**
   * Generate comprehensive sync report
   */
  async generateSyncReport(adminId, options = {}) {
    const {
      includeUsers = false,
      limit = 100,
      offset = 0
    } = options

    try {
      const report = {
        timestamp: new Date().toISOString(),
        generatedBy: adminId,
        totalDeposits: 0,
        totalAmount: 0,
        byStatus: {},
        byMethod: {},
        discrepancies: [],
        warnings: [],
        recommendations: []
      }

      // Get all deposits
      const { data: deposits, count } = await this.supabase
        .from('deposits')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      report.totalDeposits = count || 0

      // Analyze deposits
      for (const deposit of deposits || []) {
        report.totalAmount += parseFloat(deposit.amount)

        // Group by status
        if (!report.byStatus[deposit.status]) {
          report.byStatus[deposit.status] = 0
        }
        report.byStatus[deposit.status]++

        // Group by method
        if (!report.byMethod[deposit.deposit_method]) {
          report.byMethod[deposit.deposit_method] = 0
        }
        report.byMethod[deposit.deposit_method]++
      }

      // Check for discrepancies
      const { data: reconciliations } = await this.supabase
        .from('wallet_balance_reconciliation')
        .select('*')
        .neq('discrepancy', 0)
        .order('created_at', { ascending: false })
        .limit(10)

      report.discrepancies = reconciliations || []

      // Generate recommendations
      if (report.byStatus['pending'] && report.byStatus['pending'] > 10) {
        report.recommendations.push(
          `High number of pending deposits (${report.byStatus['pending']}). Review and approve/reject soon.`
        )
      }

      const completedRatio = (report.byStatus['completed'] || 0) / (report.totalDeposits || 1)
      if (completedRatio < 0.5) {
        report.recommendations.push('Less than 50% of deposits are completed. Check for approval bottlenecks.')
      }

      return report
    } catch (error) {
      console.error('[DepositSyncService] Report generation error:', error)
      throw error
    }
  }

  /**
   * Check network-wide consistency
   */
  async checkNetworkConsistency(adminId) {
    try {
      const consistency = {
        timestamp: new Date().toISOString(),
        isConsistent: true,
        issues: [],
        walletCount: 0,
        depositCount: 0,
        stats: {}
      }

      // Get all wallets and their balances
      const { data: wallets } = await this.supabase
        .from('wallets')
        .select('id, balance, user_id')

      consistency.walletCount = wallets?.length || 0

      // Get all deposits
      const { data: deposits, count } = await this.supabase
        .from('deposits')
        .select('*', { count: 'exact' })

      consistency.depositCount = count || 0

      // Check each wallet
      const inconsistentWallets = []
      for (const wallet of wallets || []) {
        const walletDeposits = (deposits || []).filter(d => d.wallet_id === wallet.id)
        const expectedBalance = walletDeposits
          .filter(d => d.status === 'approved' || d.status === 'completed')
          .reduce((sum, d) => sum + parseFloat(d.amount), 0)

        const actualBalance = parseFloat(wallet.balance)
        if (Math.abs(expectedBalance - actualBalance) > 0.01) {
          consistency.isConsistent = false
          inconsistentWallets.push({
            walletId: wallet.id,
            userId: wallet.user_id,
            expectedBalance,
            actualBalance,
            discrepancy: actualBalance - expectedBalance
          })
        }
      }

      consistency.issues = inconsistentWallets

      // Generate stats
      consistency.stats = {
        totalWallets: consistency.walletCount,
        inconsistentWallets: inconsistentWallets.length,
        totalDeposits: consistency.depositCount,
        consistencyRate: ((consistency.walletCount - inconsistentWallets.length) / consistency.walletCount * 100).toFixed(2) + '%'
      }

      return consistency
    } catch (error) {
      console.error('[DepositSyncService] Network consistency check error:', error)
      throw error
    }
  }
}

export const depositSyncService = new DepositSyncService(supabase)

export default DepositSyncService
