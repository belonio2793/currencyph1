import { supabase } from './supabaseClient'

/**
 * Payment Transfer Service
 * Handles wallet-to-wallet transfers and balance management
 */

export const paymentTransferService = {
  /**
   * Get user's wallet balances for all active currencies
   */
  async getUserBalances(userId) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('id, user_id, currency_code, balance, total_deposited, total_withdrawn, is_active, created_at, updated_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (error) throw error

      return {
        success: true,
        balances: data || [],
        total: data?.length || 0
      }
    } catch (error) {
      console.error('Error fetching user balances:', error)
      throw new Error(`Failed to fetch balances: ${error.message}`)
    }
  },

  /**
   * Get specific wallet balance
   */
  async getWalletBalance(walletId) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .single()

      if (error) throw error

      return {
        success: true,
        wallet: data
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error)
      throw new Error(`Failed to fetch wallet: ${error.message}`)
    }
  },

  /**
   * Get wallet by user ID and currency code
   */
  async getWalletByCurrency(userId, currencyCode) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('currency_code', currencyCode)
        .single()

      if (error) throw error

      return {
        success: true,
        wallet: data
      }
    } catch (error) {
      console.error('Error fetching wallet:', error)
      throw new Error(`Failed to fetch wallet: ${error.message}`)
    }
  },

  /**
   * Get user info by ID (for display in checkout)
   */
  async getUserInfo(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url')
        .eq('id', userId)
        .single()

      if (error) throw error

      return {
        success: true,
        user: data
      }
    } catch (error) {
      console.error('Error fetching user info:', error)
      throw new Error(`Failed to fetch user: ${error.message}`)
    }
  },

  /**
   * Record balance transaction in the ledger
   */
  async recordBalanceTransaction(transactionData) {
    try {
      const {
        userId,
        currencyCode,
        transactionType,
        amount,
        balanceBefore,
        balanceAfter,
        senderId = null,
        receiverId = null,
        referenceId = null,
        referenceType = null,
        description = null,
        metadata = {}
      } = transactionData

      const { data, error } = await supabase
        .rpc('record_balance_transaction', {
          p_user_id: userId,
          p_currency_code: currencyCode,
          p_transaction_type: transactionType,
          p_amount: amount,
          p_balance_before: balanceBefore,
          p_balance_after: balanceAfter,
          p_sender_id: senderId,
          p_receiver_id: receiverId,
          p_reference_id: referenceId,
          p_reference_type: referenceType,
          p_description: description,
          p_metadata: metadata
        })

      if (error) throw error

      return {
        success: true,
        transactionId: data
      }
    } catch (error) {
      console.error('Error recording balance transaction:', error)
      throw new Error(`Failed to record transaction: ${error.message}`)
    }
  },

  /**
   * Transfer funds between two users (wallet to wallet)
   */
  async transferFunds(transferData) {
    try {
      const {
        senderId,
        receiverId,
        amount,
        currencyCode,
        description = 'Payment transfer',
        metadata = {}
      } = transferData

      if (!senderId || !receiverId || !amount || !currencyCode) {
        throw new Error('Missing required transfer data: senderId, receiverId, amount, currencyCode')
      }

      if (senderId === receiverId) {
        throw new Error('Cannot transfer to yourself')
      }

      if (amount <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      // Get sender's wallet
      const senderWallet = await this.getWalletByCurrency(senderId, currencyCode)
      if (!senderWallet.success) throw new Error('Sender wallet not found')

      const senderBalance = parseFloat(senderWallet.wallet.balance)
      if (senderBalance < amount) {
        throw new Error(`Insufficient balance. Available: ${senderBalance} ${currencyCode}`)
      }

      // Get receiver's wallet
      const receiverWallet = await this.getWalletByCurrency(receiverId, currencyCode)
      if (!receiverWallet.success) throw new Error('Receiver wallet not found')

      // Perform the transfer using Supabase RPC
      const { data, error } = await supabase.rpc('transfer_funds', {
        p_sender_id: senderId,
        p_receiver_id: receiverId,
        p_sender_wallet_id: senderWallet.wallet.id,
        p_receiver_wallet_id: receiverWallet.wallet.id,
        p_amount: amount,
        p_currency_code: currencyCode,
        p_description: description,
        p_metadata: metadata
      })

      if (error) {
        if (error.message.includes('Insufficient balance')) {
          throw new Error(`Insufficient balance. Available: ${senderBalance} ${currencyCode}`)
        }
        throw error
      }

      return {
        success: true,
        transfer: data,
        message: `Successfully transferred ${amount} ${currencyCode} to recipient`
      }
    } catch (error) {
      console.error('Error transferring funds:', error)
      throw new Error(`Transfer failed: ${error.message}`)
    }
  },

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(userId, currencyCode = null, limit = 50) {
    try {
      let query = supabase
        .from('public.balances')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit)

      // Filter by user (they sent or received)
      query = query.or(`user_id.eq.${userId},sender_id.eq.${userId},receiver_id.eq.${userId}`)

      if (currencyCode) {
        query = query.eq('currency_code', currencyCode)
      }

      const { data, error } = await query

      if (error) throw error

      return {
        success: true,
        transactions: data || [],
        total: data?.length || 0
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error)
      throw new Error(`Failed to fetch transactions: ${error.message}`)
    }
  },

  /**
   * Get balance by user and currency with conversion
   */
  async getBalance(userId, currencyCode) {
    try {
      const result = await this.getWalletByCurrency(userId, currencyCode)
      if (!result.success) {
        return { success: false, balance: 0 }
      }
      return {
        success: true,
        balance: parseFloat(result.wallet.balance),
        walletId: result.wallet.id,
        currency: currencyCode
      }
    } catch (error) {
      console.error('Error getting balance:', error)
      return { success: false, balance: 0, error: error.message }
    }
  }
}

export default paymentTransferService
