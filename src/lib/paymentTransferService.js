import { supabase } from './supabaseClient'
import { currencyAPI } from './payments'

/**
 * PaymentTransferService
 * Handles multi-step payment transfers with currency conversion,
 * wallet management, and transaction recording
 */
export const paymentTransferService = {
  /**
   * Create a payment transfer request
   * Step 1: User enters amount in their preferred currency
   * Step 2: Select recipient and method
   * Step 3: Finalize with profile details
   */
  async createTransferRequest(senderUserId, recipientUserId, transferData) {
    try {
      const {
        senderAmount,
        senderCurrency,
        recipientAmount,
        recipientCurrency,
        senderWalletId,
        recipientWalletId,
        description,
        exchangeRate,
        rateSource,
        metadata = {}
      } = transferData

      // Validate amounts
      if (!senderAmount || senderAmount <= 0) {
        throw new Error('Invalid sender amount')
      }
      if (!recipientAmount || recipientAmount <= 0) {
        throw new Error('Invalid recipient amount')
      }

      // Check sender has sufficient balance
      const senderWallet = await this.getWallet(senderWalletId)
      if (!senderWallet) {
        throw new Error('Sender wallet not found')
      }
      if (senderWallet.balance < senderAmount) {
        throw new Error('Insufficient balance')
      }

      // Create transfer record
      const { data: transfer, error: transferError } = await supabase
        .from('transfers')
        .insert([
          {
            from_user_id: senderUserId,
            to_user_id: recipientUserId,
            from_wallet_id: senderWalletId,
            to_wallet_id: recipientWalletId,
            sender_amount: senderAmount,
            sender_currency: senderCurrency,
            recipient_amount: recipientAmount,
            recipient_currency: recipientCurrency,
            exchange_rate: exchangeRate || 1,
            rate_source: rateSource || 'manual',
            rate_fetched_at: new Date().toISOString(),
            status: 'pending',
            fee: 0,
            description: description || 'Payment transfer',
            metadata: {
              ...metadata,
              created_via: 'payment_request'
            }
          }
        ])
        .select()
        .single()

      if (transferError) {
        throw new Error(`Failed to create transfer: ${transferError.message}`)
      }

      return {
        success: true,
        transfer,
        message: 'Transfer request created successfully'
      }
    } catch (error) {
      console.error('Error creating transfer request:', error)
      throw error
    }
  },

  /**
   * Complete a transfer and update wallets
   * Uses database function for atomic operations
   */
  async completeTransfer(transferId, recipientConfirmation = {}) {
    try {
      // Call database function for atomic transfer
      const { data, error } = await supabase
        .rpc('process_payment_transfer', {
          p_transfer_id: transferId,
          p_recipient_confirmation: recipientConfirmation
        })

      if (error) {
        throw new Error(error.message)
      }

      if (!data || !data[0]?.success) {
        throw new Error(data?.[0]?.message || 'Failed to process transfer')
      }

      // Get updated transfer data
      const { data: transfer } = await supabase
        .from('transfers')
        .select('*')
        .eq('id', transferId)
        .single()

      return {
        success: true,
        transfer: transfer || {
          id: transferId,
          status: 'completed',
          completed_at: new Date().toISOString()
        },
        walletUpdates: {
          senderNewBalance: data[0].new_sender_balance,
          recipientNewBalance: data[0].new_recipient_balance
        },
        message: 'Transfer completed successfully'
      }
    } catch (error) {
      console.error('Error completing transfer:', error)
      throw error
    }
  },

  /**
   * Get wallet details
   */
  async getWallet(walletId) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .single()

      if (error) {
        console.warn('Wallet not found:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching wallet:', error)
      return null
    }
  },

  /**
   * Update wallet balance and create transaction record
   */
  async updateWalletBalance(walletId, amountChange, transactionType, description, referenceId) {
    try {
      // Get current wallet
      const wallet = await this.getWallet(walletId)
      if (!wallet) {
        throw new Error('Wallet not found')
      }

      const newBalance = parseFloat(wallet.balance || 0) + parseFloat(amountChange)

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('wallets')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', walletId)

      if (walletError) {
        throw new Error(`Failed to update wallet: ${walletError.message}`)
      }

      // Record transaction
      const { error: txError } = await supabase
        .from('wallet_transactions')
        .insert([
          {
            wallet_id: walletId,
            user_id: wallet.user_id,
            amount: Math.abs(amountChange),
            currency_code: wallet.currency_code,
            transaction_type: transactionType,
            description: description || transactionType,
            reference_id: referenceId,
            balance_before: wallet.balance,
            balance_after: newBalance,
            metadata: {
              reference_type: 'transfer',
              reference_id: referenceId
            },
            created_at: new Date().toISOString()
          }
        ])

      if (txError) {
        console.warn('Failed to record transaction:', txError)
        // Continue even if transaction recording fails
      }

      return {
        success: true,
        wallet: {
          ...wallet,
          balance: newBalance
        }
      }
    } catch (error) {
      console.error('Error updating wallet balance:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get exchange rate between currencies
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      if (fromCurrency === toCurrency) {
        return 1
      }
      const rate = await currencyAPI.getExchangeRate(fromCurrency, toCurrency)
      return rate || 1
    } catch (error) {
      console.warn('Error fetching exchange rate:', error)
      return 1
    }
  },

  /**
   * Cancel a pending transfer
   */
  async cancelTransfer(transferId) {
    try {
      const { data: transfer, error: fetchError } = await supabase
        .from('transfers')
        .select('*')
        .eq('id', transferId)
        .single()

      if (fetchError) {
        throw new Error('Transfer not found')
      }

      if (transfer.status !== 'pending') {
        throw new Error(`Cannot cancel ${transfer.status} transfer`)
      }

      const { error: updateError } = await supabase
        .from('transfers')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId)

      if (updateError) {
        throw new Error('Failed to cancel transfer')
      }

      return {
        success: true,
        message: 'Transfer cancelled successfully'
      }
    } catch (error) {
      console.error('Error cancelling transfer:', error)
      throw error
    }
  },

  /**
   * Get transfer history for a user
   */
  async getTransferHistory(userId, limit = 20, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:from_user_id(id, email, full_name),
          to_user:to_user_id(id, email, full_name)
        `)
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw error
      }

      return {
        success: true,
        transfers: data || [],
        total: data?.length || 0
      }
    } catch (error) {
      console.error('Error fetching transfer history:', error)
      return {
        success: false,
        transfers: [],
        total: 0
      }
    }
  },

  /**
   * Generate payment link for transfer
   */
  generatePaymentLink(transferId, baseUrl = window.location.origin) {
    return `${baseUrl}/payment/${transferId}`
  },

  /**
   * Get recipient wallets for transfer
   */
  async getRecipientWallets(recipientUserId) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', recipientUserId)
        .eq('is_active', true)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error fetching recipient wallets:', error)
      return []
    }
  }
}

export default paymentTransferService
