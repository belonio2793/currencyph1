import { supabase } from './supabaseClient'

/**
 * GCash Service - Handles GCash deposit verification and status management
 */
export const gcashService = {
  /**
   * Verify a GCash deposit by reference number
   * This calls the Supabase Edge Function to verify and approve the deposit
   */
  async verifyDepositByReference(depositId, referenceNumber) {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_PROJECT_URL}/functions/v1/verify-gcash-deposit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            depositId,
            referenceNumber,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify deposit')
      }

      return {
        success: true,
        deposit: data.deposit,
        message: data.message,
      }
    } catch (error) {
      console.error('Error verifying GCash deposit:', error)
      throw error
    }
  },

  /**
   * Get pending GCash deposits for a user
   */
  async getPendingGCashDeposits(userId) {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', userId)
        .eq('deposit_method', 'gcash')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching pending GCash deposits:', error)
      throw error
    }
  },

  /**
   * Get GCash deposit by ID
   */
  async getDepositById(depositId) {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error fetching deposit:', error)
      throw error
    }
  },

  /**
   * Format deposit info for display
   */
  formatDepositInfo(deposit) {
    return {
      id: deposit.id,
      amount: deposit.amount,
      currency: deposit.currency_code,
      method: deposit.deposit_method,
      status: deposit.status,
      referenceNumber: deposit.reference_number,
      createdAt: new Date(deposit.created_at),
      walletId: deposit.wallet_id,
      convertedAmount: deposit.converted_amount,
    }
  },

  /**
   * Check if a deposit can be approved
   * A GCash deposit can be approved if:
   * - Status is 'pending'
   * - It has a reference number
   * - It's actually a GCash deposit
   */
  canApproveDeposit(deposit) {
    return (
      deposit.status === 'pending' &&
      deposit.deposit_method === 'gcash' &&
      deposit.reference_number &&
      deposit.reference_number.trim().length > 0
    )
  },

  /**
   * Get approval status message
   */
  getApprovalStatus(deposit) {
    if (deposit.deposit_method !== 'gcash') {
      return 'Not a GCash deposit'
    }

    if (!deposit.reference_number) {
      return 'Waiting for reference number'
    }

    if (deposit.status === 'approved') {
      return 'Approved'
    }

    if (deposit.status === 'rejected') {
      return 'Rejected'
    }

    return 'Pending verification'
  },
}

export default gcashService
