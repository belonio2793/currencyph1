import { supabase } from './supabaseClient'

/**
 * Record a deposit and create wallet transaction
 * Updates wallet balance and creates audit trail in wallet_transactions
 */
export const receiveMoneyService = {
  /**
   * Search user profiles by email, phone, or name
   * Returns non-sensitive profile data
   */
  async searchProfiles(searchQuery) {
    try {
      if (!searchQuery || searchQuery.trim().length < 2) {
        return []
      }

      const query = searchQuery.toLowerCase().trim()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone_number, profile_picture_url, created_at')
        .or(`full_name.ilike.%${query}%,phone_number.ilike.%${query}%`)
        .limit(10)

      if (error) {
        console.warn('Error searching profiles:', error)
        return []
      }

      // Also search by email in auth if possible (via users table if accessible)
      let emailResults = []
      try {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('id, email')
          .ilike('email', `%${query}%`)
          .limit(5)

        if (!userError && users) {
          emailResults = users
        }
      } catch (err) {
        console.warn('Could not search users by email:', err)
      }

      // Merge results
      const mergedResults = [
        ...data.map(p => ({
          id: p.user_id,
          name: p.full_name,
          phone: p.phone_number,
          avatar: p.profile_picture_url,
          source: 'profile'
        })),
        ...emailResults.filter(u => !data.find(p => p.user_id === u.id)).map(u => ({
          id: u.id,
          email: u.email,
          name: u.email,
          source: 'email'
        }))
      ]

      return mergedResults
    } catch (error) {
      console.error('Error in searchProfiles:', error)
      return []
    }
  },

  /**
   * Get available GCash and crypto deposit methods
   */
  async getAvailableDepositMethods() {
    try {
      // Get crypto addresses from wallets_house
      const { data: cryptoAddresses, error: cryptoError } = await supabase
        .from('wallets_house')
        .select('id, currency, network, address, provider, metadata')
        .eq('wallet_type', 'crypto')
        .order('currency', { ascending: true })

      if (cryptoError) {
        console.warn('Error fetching crypto addresses:', cryptoError)
      }

      // Get GCash deposit methods (if stored in wallets_house or public.deposits)
      const { data: gcashMethods, error: gcashError } = await supabase
        .from('public.deposits')
        .select('*')
        .or('method.eq.gcash,method.eq.bank_transfer')

      if (gcashError) {
        console.warn('Error fetching GCash methods:', gcashError)
      }

      return {
        crypto: cryptoAddresses || [],
        fiat: gcashMethods || []
      }
    } catch (error) {
      console.error('Error getting deposit methods:', error)
      return { crypto: [], fiat: [] }
    }
  },
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
  },

  /**
   * Get user profile by user_id (non-sensitive fields only)
   */
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone_number, profile_picture_url, bio, created_at')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.warn('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getUserProfile:', error)
      return null
    }
  },

  /**
   * Record a wallet transaction for audit trail
   */
  async recordWalletTransaction(transactionData) {
    try {
      const {
        wallet_id,
        user_id,
        type, // 'deposit', 'transfer', 'withdrawal', 'exchange'
        amount,
        currency,
        description,
        related_deposit_id,
        metadata = {}
      } = transactionData

      // Get current wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', wallet_id)
        .single()

      if (walletError) {
        throw new Error(`Wallet not found: ${walletError.message}`)
      }

      const balanceBefore = parseFloat(wallet.balance) || 0
      const balanceAfter = type === 'deposit' ? balanceBefore + parseFloat(amount) : balanceBefore - parseFloat(amount)

      const transaction = {
        wallet_id,
        user_id,
        type,
        amount: parseFloat(amount),
        currency,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description,
        metadata: {
          ...metadata,
          related_deposit_id,
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
        console.warn('Error creating transaction record:', txError)
        return null
      }

      return txRecord
    } catch (error) {
      console.error('Error recording wallet transaction:', error)
      throw error
    }
  },

  /**
   * Approve a pending deposit and credit the wallet
   */
  async approveDeposit(depositId, receivedAmount = null) {
    try {
      // Get the deposit record
      const { data: deposit, error: depositError } = await supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (depositError) {
        throw new Error(`Deposit not found: ${depositError.message}`)
      }

      // Update deposit status to approved
      const finalAmount = receivedAmount || deposit.received_amount || deposit.amount
      const { data: updatedDeposit, error: updateError } = await supabase
        .from('deposits')
        .update({
          status: 'approved',
          received_amount: finalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update deposit: ${updateError.message}`)
      }

      // Credit the wallet if wallet_id exists
      if (deposit.wallet_id) {
        const creditResult = await this.creditWallet(
          deposit.wallet_id,
          finalAmount,
          deposit.currency_code || 'PHP',
          depositId
        )
        return { deposit: updatedDeposit, wallet: creditResult.wallet, transaction: creditResult.transaction }
      }

      return { deposit: updatedDeposit, wallet: null, transaction: null }
    } catch (error) {
      console.error('Error approving deposit:', error)
      throw error
    }
  }
}

export default receiveMoneyService
