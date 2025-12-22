import { supabase } from './supabaseClient'
import { currencyAPI } from './payments'
import { CRYPTOCURRENCY_DEPOSITS } from '../data/cryptoDeposits'

/**
 * Custom Payment Service
 * Handles guest checkout, payment processing, and wallet balance updates
 */
export const customPaymentService = {
  /**
   * Generate a unique payment link/code for guest checkout
   */
  async generatePaymentLink(paymentData) {
    try {
      const {
        from_user_id, // Person requesting payment
        to_email, // Guest email (optional, can be anonymous)
        amount,
        currency,
        payment_method, // 'gcash', 'bank', 'crypto'
        crypto_network, // if method is crypto
        description = '',
        expires_at = null // ISO string for expiration
      } = paymentData

      // Generate unique payment code
      const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

      // Create transfer record
      const transferData = {
        id: `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from_user_id,
        to_email: to_email || null,
        guest_checkout: true,
        amount: parseFloat(amount),
        currency: currency || 'PHP',
        payment_method,
        crypto_network: crypto_network || null,
        description,
        payment_code: paymentCode,
        status: 'pending_payment', // pending_payment, processing, completed, failed
        created_at: new Date().toISOString(),
        expires_at: expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
        metadata: {
          payment_type: 'custom',
          initiated_at: new Date().toISOString()
        }
      }

      const { data: transfer, error: transferError } = await supabase
        .from('transfers')
        .insert([transferData])
        .select()
        .single()

      if (transferError) {
        throw new Error(`Failed to create transfer: ${transferError.message}`)
      }

      return {
        success: true,
        transfer,
        paymentLink: `${window.location.origin}/checkout?code=${paymentCode}&transferId=${transfer.id}`,
        paymentCode
      }
    } catch (error) {
      console.error('Error generating payment link:', error)
      throw error
    }
  },

  /**
   * Get payment details by code or transfer ID
   */
  async getPaymentDetails(paymentCode, transferId = null) {
    try {
      let query = supabase.from('transfers').select('*')

      if (transferId) {
        query = query.eq('id', transferId)
      } else if (paymentCode) {
        query = query.eq('payment_code', paymentCode)
      } else {
        throw new Error('Either paymentCode or transferId required')
      }

      const { data: transfer, error } = await query.single()

      if (error) {
        throw new Error(`Transfer not found: ${error.message}`)
      }

      // Get sender info if from_user_id exists
      let senderInfo = null
      if (transfer.from_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone_number, profile_picture_url')
          .eq('user_id', transfer.from_user_id)
          .single()

        senderInfo = profile
      }

      // Get deposit addresses if crypto
      let depositAddresses = null
      if (transfer.payment_method === 'crypto' && transfer.crypto_network) {
        const cryptoDeposits = CRYPTOCURRENCY_DEPOSITS.filter(
          d => d.currency.includes(transfer.crypto_network) || d.network === transfer.crypto_network
        )
        depositAddresses = cryptoDeposits
      }

      return {
        transfer,
        senderInfo,
        depositAddresses,
        isExpired: new Date(transfer.expires_at) < new Date()
      }
    } catch (error) {
      console.error('Error getting payment details:', error)
      throw error
    }
  },

  /**
   * Process guest payment and update wallets/transactions
   */
  async processGuestPayment(paymentData) {
    try {
      const {
        transferId,
        paidAmount,
        paidCurrency = 'PHP',
        paymentReference = null, // GCash reference, TX hash, etc.
        guestEmail = null,
        guestName = null,
        guestPhone = null
      } = paymentData

      // Get transfer
      const { data: transfer, error: transferError } = await supabase
        .from('transfers')
        .select('*')
        .eq('id', transferId)
        .single()

      if (transferError) {
        throw new Error(`Transfer not found: ${transferError.message}`)
      }

      if (transfer.status !== 'pending_payment') {
        throw new Error(`Transfer already ${transfer.status}`)
      }

      // Calculate conversion if currencies differ
      let convertedAmount = parseFloat(paidAmount)
      let conversionRate = 1

      if (paidCurrency !== transfer.currency) {
        try {
          conversionRate = await currencyAPI.getExchangeRate(paidCurrency, transfer.currency)
          if (conversionRate) {
            convertedAmount = parseFloat(paidAmount) * conversionRate
          }
        } catch (err) {
          console.warn('Could not convert currency, using 1:1 rate:', err)
        }
      }

      // Update transfer with payment details
      const { data: updatedTransfer, error: updateError } = await supabase
        .from('transfers')
        .update({
          status: 'completed',
          paid_amount: convertedAmount,
          paid_currency: paidCurrency,
          conversion_rate: conversionRate,
          payment_reference: paymentReference,
          guest_email: guestEmail || transfer.to_email,
          guest_name: guestName || null,
          guest_phone: guestPhone || null,
          completed_at: new Date().toISOString(),
          metadata: {
            ...transfer.metadata,
            guest_info: {
              email: guestEmail,
              name: guestName,
              phone: guestPhone
            },
            payment_processed_at: new Date().toISOString()
          }
        })
        .eq('id', transferId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update transfer: ${updateError.message}`)
      }

      // Credit sender's wallet
      let walletResult = null
      if (transfer.from_user_id) {
        walletResult = await this.creditSenderWallet(
          transfer.from_user_id,
          convertedAmount,
          transfer.currency,
          transferId,
          updatedTransfer
        )
      }

      // Record deposit for audit trail
      let depositRecord = null
      try {
        depositRecord = await supabase
          .from('deposits')
          .insert([{
            user_id: transfer.from_user_id,
            guest_email: guestEmail || transfer.to_email,
            amount: parseFloat(paidAmount),
            currency_code: paidCurrency,
            received_amount: convertedAmount,
            currency_code_received: transfer.currency,
            payment_method: transfer.payment_method,
            crypto_network: transfer.crypto_network,
            reference_number: paymentReference,
            exchange_rate: conversionRate,
            status: 'completed',
            metadata: {
              transfer_id: transferId,
              payment_type: 'guest_checkout',
              payment_code: transfer.payment_code,
              processed_at: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          }])
          .select()
          .single()
      } catch (err) {
        console.warn('Could not create deposit record:', err)
      }

      return {
        success: true,
        transfer: updatedTransfer,
        wallet: walletResult?.wallet,
        transaction: walletResult?.transaction,
        deposit: depositRecord?.data
      }
    } catch (error) {
      console.error('Error processing guest payment:', error)
      throw error
    }
  },

  /**
   * Credit sender's wallet after guest payment
   */
  async creditSenderWallet(userId, amount, currency, transferId, transfer) {
    try {
      // Get user's wallet for this currency
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('currency_code', currency)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (walletError) {
        console.warn('Wallet not found for user, creating default...')
        // Create default wallet if not exists
        return await this.createAndCreditWallet(userId, amount, currency, transferId, transfer)
      }

      const newBalance = (parseFloat(wallet.balance) || 0) + parseFloat(amount)

      // Update wallet balance
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id)

      if (updateError) {
        throw new Error(`Failed to update wallet: ${updateError.message}`)
      }

      // Create wallet transaction record
      const transaction = {
        wallet_id: wallet.id,
        user_id: userId,
        type: 'deposit',
        amount: parseFloat(amount),
        currency: currency,
        balance_before: parseFloat(wallet.balance) || 0,
        balance_after: newBalance,
        description: `Payment received from guest (${transfer.description || 'Custom payment'})`,
        metadata: {
          transfer_id: transferId,
          payment_type: 'guest_checkout',
          source: 'custom_payment',
          processed_at: new Date().toISOString()
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
      }

      return {
        wallet: { ...wallet, balance: newBalance, id: wallet.id },
        transaction: txRecord?.data
      }
    } catch (error) {
      console.error('Error crediting sender wallet:', error)
      throw error
    }
  },

  /**
   * Create default wallet and credit it
   */
  async createAndCreditWallet(userId, amount, currency, transferId, transfer) {
    try {
      const walletId = `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newBalance = parseFloat(amount)

      // Create wallet
      const { data: newWallet, error: walletError } = await supabase
        .from('wallets')
        .insert([{
          id: walletId,
          user_id: userId,
          currency_code: currency,
          balance: newBalance,
          wallet_type: 'fiat',
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (walletError) {
        throw new Error(`Failed to create wallet: ${walletError.message}`)
      }

      // Create transaction record
      const transaction = {
        wallet_id: walletId,
        user_id: userId,
        type: 'deposit',
        amount: newBalance,
        currency: currency,
        balance_before: 0,
        balance_after: newBalance,
        description: `Initial payment from guest`,
        metadata: {
          transfer_id: transferId,
          payment_type: 'guest_checkout',
          wallet_created: true,
          processed_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      }

      const { data: txRecord, error: txError } = await supabase
        .from('wallet_transactions')
        .insert([transaction])
        .select()
        .single()

      if (txError) {
        console.warn('Failed to create transaction:', txError)
      }

      return {
        wallet: newWallet.data,
        transaction: txRecord?.data
      }
    } catch (error) {
      console.error('Error creating and crediting wallet:', error)
      throw error
    }
  },

  /**
   * Fail/Cancel a payment
   */
  async cancelPayment(transferId, reason = 'cancelled_by_user') {
    try {
      const { data: transfer, error: transferError } = await supabase
        .from('transfers')
        .update({
          status: 'failed',
          metadata: {
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason
          }
        })
        .eq('id', transferId)
        .select()
        .single()

      if (transferError) {
        throw new Error(`Failed to cancel payment: ${transferError.message}`)
      }

      return transfer
    } catch (error) {
      console.error('Error cancelling payment:', error)
      throw error
    }
  },

  /**
   * Get crypto deposit address for payment
   */
  async getCryptoDepositAddress(cryptoCode, network = null) {
    try {
      // First try wallets_house table
      let query = supabase
        .from('wallets_house')
        .select('id, currency, network, address, metadata')
        .eq('wallet_type', 'crypto')

      if (cryptoCode) {
        query = query.or(`currency.ilike.%${cryptoCode}%,currency.contains.${cryptoCode}`)
      }

      const { data: addresses, error } = await query

      if (error) {
        console.warn('Error fetching from wallets_house:', error)
      }

      if (addresses && addresses.length > 0) {
        // Filter by network if specified
        if (network) {
          const filtered = addresses.filter(a => a.network === network)
          return filtered.length > 0 ? filtered : addresses
        }
        return addresses
      }

      // Fallback to CRYPTOCURRENCY_DEPOSITS
      const cryptoDeposits = CRYPTOCURRENCY_DEPOSITS.filter(d =>
        d.currency.includes(cryptoCode) || d.network.includes(cryptoCode)
      )

      return cryptoDeposits.map(d => ({
        id: `${d.currency}-${d.network}`,
        currency: d.currency,
        network: d.network,
        address: d.address,
        metadata: d.metadata
      }))
    } catch (error) {
      console.error('Error getting crypto deposit address:', error)
      return []
    }
  }
}

export default customPaymentService
