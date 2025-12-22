import { supabase } from './supabaseClient'

/**
 * Record a deposit and create wallet transaction
 * Updates wallet balance and creates audit trail in wallet_transactions
 */
export const receiveMoneyService = {
  /**
   * Create a deposit record and optionally credit wallet
   */
  async recordDeposit(depositData) {
    try {
      const {
        user_id,
        guest_email,
        wallet_id,
        amount,
        currency_code,
        payment_method, // 'gcash', 'bank', 'crypto'
        crypto_network,
        crypto_address,
        reference_number,
        received_amount, // PHP equivalent
        exchange_rate,
        status = 'pending', // pending, confirmed, failed
        metadata = {}
      } = depositData

      // Create deposit record
      const deposit = {
        user_id,
        guest_email,
        wallet_id,
        amount: parseFloat(amount),
        currency_code,
        payment_method,
        crypto_network,
        crypto_address,
        reference_number,
        received_amount: received_amount ? parseFloat(received_amount) : null,
        exchange_rate,
        status,
        metadata: {
          ...metadata,
          created_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      }

      const { data: createdDeposit, error: depositError } = await supabase
        .from('deposits')
        .insert([deposit])
        .select()
        .single()

      if (depositError) {
        throw new Error(`Failed to create deposit: ${depositError.message}`)
      }

      // If wallet_id provided and status is confirmed, credit the wallet
      if (wallet_id && status === 'confirmed') {
        await this.creditWallet(wallet_id, received_amount || amount, currency_code, createdDeposit.id)
      }

      return createdDeposit
    } catch (error) {
      console.error('Error recording deposit:', error)
      throw error
    }
  },

  /**
   * Credit a wallet and create transaction record
   */
  async creditWallet(walletId, amount, currencyCode, depositId) {
    try {
      // Get current wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .single()

      if (walletError) {
        throw new Error(`Wallet not found: ${walletError.message}`)
      }

      const newBalance = (parseFloat(wallet.balance) || 0) + parseFloat(amount)

      // Update wallet balance
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', walletId)

      if (updateError) {
        throw new Error(`Failed to update wallet balance: ${updateError.message}`)
      }

      // Create wallet transaction record
      const transaction = {
        wallet_id: walletId,
        user_id: wallet.user_id,
        type: 'deposit', // deposit, transfer, withdrawal, exchange, etc.
        amount: parseFloat(amount),
        currency: currencyCode,
        balance_before: parseFloat(wallet.balance) || 0,
        balance_after: newBalance,
        description: `Deposit received via receive link`,
        metadata: {
          deposit_id: depositId,
          source: 'receive_money',
          status: 'completed',
          recorded_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      }

      const { data: txRecord, error: txError } = await supabase
        .from('wallet_transactions')
        .insert([transaction])
        .select()
        .single()

      if (txError) {
        console.warn('Failed to create transaction record:', txError)
        // Don't throw - wallet was credited, just missing the audit log
      }

      return {
        wallet: { ...wallet, balance: newBalance },
        transaction: txRecord
      }
    } catch (error) {
      console.error('Error crediting wallet:', error)
      throw error
    }
  },

  /**
   * Convert crypto amount to PHP equivalent
   */
  async convertCryptoToPhp(amount, cryptoCode) {
    try {
      const { data, error } = await supabase
        .from('cached_rates')
        .select('crypto_prices')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data?.crypto_prices) {
        console.warn('Could not fetch crypto rates:', error)
        return null
      }

      const cryptoPricePhp = data.crypto_prices[cryptoCode.toLowerCase()]?.php

      if (!cryptoPricePhp) {
        console.warn(`No PHP rate found for ${cryptoCode}`)
        return null
      }

      return parseFloat(amount) * cryptoPricePhp
    } catch (error) {
      console.error('Error converting crypto to PHP:', error)
      return null
    }
  },

  /**
   * Verify a pending deposit and mark as confirmed
   * This would typically be called after payment verification
   */
  async confirmDeposit(depositId, receivedPhpAmount) {
    try {
      const { data: deposit, error: depositError } = await supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (depositError) {
        throw new Error(`Deposit not found: ${depositError.message}`)
      }

      // Update deposit status
      const { data: updatedDeposit, error: updateError } = await supabase
        .from('deposits')
        .update({
          status: 'confirmed',
          received_amount: receivedPhpAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to confirm deposit: ${updateError.message}`)
      }

      // Credit the wallet
      if (deposit.wallet_id) {
        await this.creditWallet(deposit.wallet_id, receivedPhpAmount, 'PHP', depositId)
      }

      return updatedDeposit
    } catch (error) {
      console.error('Error confirming deposit:', error)
      throw error
    }
  },

  /**
   * Get deposit history for a wallet
   */
  async getDepositHistory(walletId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.warn('Error fetching deposits:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting deposit history:', error)
      return []
    }
  },

  /**
   * Get user's receive links
   */
  async getReceiveLinks(userId) {
    try {
      const { data, error } = await supabase
        .from('receive_links')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching receive links:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting receive links:', error)
      return []
    }
  },

  /**
   * Create a receive link record (if table exists)
   */
  async createReceiveLink(linkData) {
    try {
      const link = {
        id: linkData.id,
        user_id: linkData.user_id,
        guest_email: linkData.guest_email,
        wallet_id: linkData.wallet_id,
        amount: linkData.amount ? parseFloat(linkData.amount) : null,
        currency: linkData.currency,
        method: linkData.method,
        crypto_network: linkData.crypto_network,
        crypto_address: linkData.crypto_address,
        status: 'active',
        metadata: {
          created_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      }

      const { data: createdLink, error } = await supabase
        .from('receive_links')
        .insert([link])
        .select()
        .single()

      if (error && error.code === 'PGRST116') {
        // Table doesn't exist - just return the link data without storing
        console.warn('receive_links table not found, storing in memory only')
        return linkData
      }

      if (error) {
        throw error
      }

      return createdLink
    } catch (error) {
      console.warn('Could not create receive link record:', error)
      // Don't throw - function can work without database persistence
      return linkData
    }
  }
}

export default receiveMoneyService
