import { supabase } from './supabaseClient'
import { paymentsService } from './paymentsService'

// Currency.ph Poker merchant ID
export const POKER_MERCHANT_ID = '336c05a0-3b97-417b-90c4-eca4560346cf'

export const pokerPaymentService = {
  /**
   * Get all payment products for poker chips
   */
  async getPokerChipProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', POKER_MERCHANT_ID)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error loading poker chip products:', err)
      throw err
    }
  },

  /**
   * Get prices for a poker chip product
   */
  async getProductPrices(productId) {
    try {
      const { data, error } = await supabase
        .from('prices')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (err) {
      console.error('Error loading product price:', err)
      throw err
    }
  },

  /**
   * Get or create a payment link for a poker chip product
   */
  async getOrCreatePaymentLink(productId) {
    try {
      // Check if payment link already exists
      const { data: existingLink } = await supabase
        .from('payment_links')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .single()

      if (existingLink) {
        return existingLink
      }

      // Get product details
      const product = await paymentsService.getProduct(productId)
      if (!product) throw new Error('Product not found')

      // Get price for the product
      const price = await this.getProductPrices(productId)
      if (!price) throw new Error('Price not found for product')

      // Create payment link
      const slug = `poker-chips-${productId.substring(0, 8)}`
      const { data: paymentLink, error: linkErr } = await supabase
        .from('payment_links')
        .insert([
          {
            merchant_id: POKER_MERCHANT_ID,
            product_id: productId,
            price_id: price.id,
            slug: slug,
            name: product.name,
            description: product.description,
            amount: price.amount,
            currency: price.currency,
            is_active: true,
            metadata: {
              product_type: 'poker_chips',
              ...product.metadata
            }
          }
        ])
        .select()
        .single()

      if (linkErr) throw linkErr
      return paymentLink
    } catch (err) {
      console.error('Error getting/creating payment link:', err)
      throw err
    }
  },

  /**
   * Create a payment intent for poker chips (non-wallet payment)
   */
  async createPokerPaymentIntent(userId, productId, amount, paymentMethod = 'bank_transfer') {
    try {
      const { data: intent, error } = await paymentsService.createPaymentIntent({
        merchant_id: POKER_MERCHANT_ID,
        customer_id: userId,
        product_id: productId,
        amount: amount,
        currency: 'USD',
        payment_method: paymentMethod,
        description: 'Poker chip purchase',
        metadata: {
          product_type: 'poker_chips'
        }
      })

      if (error) throw error
      return intent
    } catch (err) {
      console.error('Error creating payment intent:', err)
      throw err
    }
  },

  /**
   * Create a poker chip purchase payment record
   */
  async createPokerPayment(userId, productId, chipPackageData, paymentMethod = 'wallet_balance', amount) {
    try {
      const { data: payment, error } = await supabase
        .from('payments')
        .insert([
          {
            merchant_id: POKER_MERCHANT_ID,
            customer_id: userId,
            product_id: productId,
            amount: amount,
            currency: 'USD',
            fee_amount: 0,
            net_amount: amount,
            status: 'succeeded',
            payment_type: 'payment',
            payment_method: paymentMethod,
            description: `Poker chips: ${chipPackageData.name}`,
            metadata: {
              product_type: 'poker_chips',
              chip_amount: chipPackageData.chip_amount,
              bonus_chips: chipPackageData.bonus_chips,
              total_chips: chipPackageData.chip_amount + chipPackageData.bonus_chips
            }
          }
        ])
        .select()
        .single()

      if (error) throw error
      return payment
    } catch (err) {
      console.error('Error creating poker payment:', err)
      throw err
    }
  },

  /**
   * Process a wallet-based poker chip purchase
   */
  async processWalletPayment(userId, productId, chipPackageData, walletId, amount) {
    try {
      // Record wallet transaction
      const { data: txData, error: txErr } = await supabase.rpc('record_wallet_transaction', {
        p_user_id: userId,
        p_wallet_id: walletId,
        p_transaction_type: 'purchase',
        p_amount: amount,
        p_currency_code: 'USD',
        p_description: `Poker chip purchase: ${chipPackageData.name}`,
        p_reference_id: productId
      })

      if (txErr) {
        throw new Error(`Failed to process wallet payment: ${txErr.message}`)
      }

      // Create payment record for ledger
      const payment = await this.createPokerPayment(
        userId,
        productId,
        chipPackageData,
        'wallet_balance',
        amount
      )

      return { transaction: txData, payment }
    } catch (err) {
      console.error('Error processing wallet payment:', err)
      throw err
    }
  },

  /**
   * Get payment history for a user's poker purchases
   */
  async getUserPokerPurchaseHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', userId)
        .eq('merchant_id', POKER_MERCHANT_ID)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error loading poker purchase history:', err)
      throw err
    }
  },

  /**
   * Get revenue stats for poker chip sales
   */
  async getPokerChipSalesStats() {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('amount, status, created_at')
        .eq('merchant_id', POKER_MERCHANT_ID)
        .eq('status', 'succeeded')

      if (error) throw error

      const stats = {
        totalRevenue: 0,
        totalTransactions: data?.length || 0,
        averageTransaction: 0
      }

      if (data && data.length > 0) {
        stats.totalRevenue = data.reduce((sum, p) => sum + Number(p.amount), 0)
        stats.averageTransaction = stats.totalRevenue / stats.totalTransactions
      }

      return stats
    } catch (err) {
      console.error('Error getting poker sales stats:', err)
      throw err
    }
  }
}
