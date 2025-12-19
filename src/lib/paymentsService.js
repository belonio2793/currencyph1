import { supabase } from './supabaseClient'
import { v4 as uuidv4 } from 'uuid'

export const paymentsService = {
  // ============ Merchants ============
  async getMerchant(merchantId) {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .single()

      if (error) {
        const errorMessage = error?.message || JSON.stringify(error)
        throw new Error(errorMessage)
      }
      return data
    } catch (err) {
      console.error('getMerchant error:', err)
      throw err
    }
  },

  async getMerchantsByUser(userId) {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*, business:businesses(*)')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        const errorMessage = error?.message || JSON.stringify(error)
        throw new Error(errorMessage)
      }
      return data || []
    } catch (err) {
      console.error('getMerchantsByUser error:', err)
      throw err
    }
  },

  async getUserBusinesses(userId) {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
        .order('business_name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('getUserBusinesses error:', err)
      throw err
    }
  },

  async createMerchant(userId, merchantData) {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .insert([
          {
            owner_user_id: userId,
            merchant_name: merchantData.merchant_name,
            description: merchantData.description || '',
            logo_url: merchantData.logo_url || null,
            default_settlement_currency: merchantData.default_settlement_currency || 'PHP',
            business_id: merchantData.business_id || null,
            is_active: true,
            metadata: merchantData.metadata || {}
          }
        ])
        .select()
        .single()

      if (error) {
        const errorMessage = error?.message || JSON.stringify(error)
        throw new Error(errorMessage)
      }
      return data
    } catch (err) {
      console.error('createMerchant error:', err)
      throw err
    }
  },

  async updateMerchant(merchantId, updates) {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', merchantId)
        .select()
        .single()

      if (error) {
        const errorMessage = error?.message || JSON.stringify(error)
        throw new Error(errorMessage)
      }
      return data
    } catch (err) {
      console.error('updateMerchant error:', err)
      throw err
    }
  },

  // ============ Products ============
  async getProduct(productId) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (error) throw error
    return data
  },

  async getProductsByMerchant(merchantId) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createProduct(merchantId, productData) {
    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          merchant_id: merchantId,
          name: productData.name,
          description: productData.description || '',
          image_url: productData.image_url || null,
          is_active: true,
          metadata: productData.metadata || {}
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateProduct(productId, updates) {
    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteProduct(productId) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId)

    if (error) throw error
  },

  // ============ Prices ============
  async getPrice(priceId) {
    const { data, error } = await supabase
      .from('prices')
      .select('*')
      .eq('id', priceId)
      .single()

    if (error) throw error
    return data
  },

  async getPricesByProduct(productId) {
    const { data, error } = await supabase
      .from('prices')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getPricesByMerchant(merchantId) {
    const { data, error } = await supabase
      .from('prices')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createPrice(merchantId, priceData) {
    const { data, error } = await supabase
      .from('prices')
      .insert([
        {
          merchant_id: merchantId,
          product_id: priceData.product_id || null,
          amount: priceData.amount,
          currency: priceData.currency || 'PHP',
          type: priceData.type || 'one_time',
          is_active: true,
          metadata: priceData.metadata || {}
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updatePrice(priceId, updates) {
    const { data, error } = await supabase
      .from('prices')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', priceId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deletePrice(priceId) {
    const { error } = await supabase
      .from('prices')
      .update({ is_active: false })
      .eq('id', priceId)

    if (error) throw error
  },

  // ============ Invoices ============
  async getInvoice(invoiceId) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error) throw error
    return data
  },

  async getPaymentLinkByUniversalSlug(slug) {
    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('url_slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw error
    return { data, error: null }
  },

  async getInvoicesByMerchant(merchantId, status = null) {
    let query = supabase
      .from('invoices')
      .select('*')
      .eq('merchant_id', merchantId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getInvoicesByCustomer(customerId) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createInvoice(merchantId, invoiceData) {
    const { data, error } = await supabase
      .from('invoices')
      .insert([
        {
          merchant_id: merchantId,
          customer_id: invoiceData.customer_id || null,
          customer_email: invoiceData.customer_email,
          customer_name: invoiceData.customer_name,
          amount_due: invoiceData.amount_due,
          currency: invoiceData.currency || 'PHP',
          status: 'draft',
          due_date: invoiceData.due_date || null,
          description: invoiceData.description || '',
          line_items: invoiceData.line_items || [],
          metadata: invoiceData.metadata || {}
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateInvoice(invoiceId, updates) {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async sendInvoice(invoiceId) {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async markInvoicePaid(invoiceId) {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // ============ Payment Links ============
  async getPaymentLink(paymentLinkId) {
    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', paymentLinkId)
      .single()

    if (error) throw error
    return data
  },

  async getPaymentLinkBySlug(merchantId, slug) {
    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('url_slug', slug)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  },

  async getPaymentLinksByMerchant(merchantId) {
    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createPaymentLink(merchantId, linkData) {
    const slug = linkData.url_slug || this.generateSlug(linkData.name)

    const { data, error } = await supabase
      .from('payment_links')
      .insert([
        {
          merchant_id: merchantId,
          product_id: linkData.product_id || null,
          price_id: linkData.price_id || null,
          name: linkData.name,
          description: linkData.description || '',
          amount: linkData.amount || null,
          currency: linkData.currency || 'PHP',
          is_active: true,
          url_slug: slug,
          expires_at: linkData.expires_at || null,
          metadata: linkData.metadata || {}
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updatePaymentLink(paymentLinkId, updates) {
    const { data, error } = await supabase
      .from('payment_links')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentLinkId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deletePaymentLink(paymentLinkId) {
    const { error } = await supabase
      .from('payment_links')
      .update({ is_active: false })
      .eq('id', paymentLinkId)

    if (error) throw error
  },

  // ============ Payment Intents ============
  async getPaymentIntent(intentId) {
    const { data, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', intentId)
      .single()

    if (error) throw error
    return data
  },

  async createPaymentIntent(merchantId, intentData) {
    const { data, error } = await supabase
      .from('payment_intents')
      .insert([
        {
          merchant_id: merchantId,
          payer_id: intentData.payer_id || null,
          guest_email: intentData.guest_email || null,
          guest_name: intentData.guest_name || null,
          amount: intentData.amount,
          currency: intentData.currency || 'PHP',
          status: 'pending',
          source_type: intentData.source_type,
          reference_id: intentData.reference_id || null,
          invoice_id: intentData.invoice_id || null,
          payment_link_id: intentData.payment_link_id || null,
          qr_code_data: intentData.qr_code_data || null,
          onboarding_state: 'none',
          expires_at: intentData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          metadata: intentData.metadata || {}
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updatePaymentIntent(intentId, updates) {
    const { data, error } = await supabase
      .from('payment_intents')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', intentId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getPaymentIntentsByMerchant(merchantId, status = null) {
    let query = supabase
      .from('payment_intents')
      .select('*')
      .eq('merchant_id', merchantId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // ============ Transactions ============
  async createTransaction(intentId, transactionData) {
    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          payment_intent_id: intentId,
          from_balance_id: transactionData.from_balance_id || null,
          to_balance_id: transactionData.to_balance_id || null,
          amount: transactionData.amount,
          currency: transactionData.currency || 'PHP',
          status: 'pending',
          transaction_hash: transactionData.transaction_hash || null,
          metadata: transactionData.metadata || {}
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getTransactionsByPaymentIntent(intentId) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_intent_id', intentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async updateTransaction(transactionId, updates) {
    const { data, error } = await supabase
      .from('transactions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // ============ Deposit Intents ============
  async createDepositIntent(userId, depositData) {
    const { data, error } = await supabase
      .from('deposit_intents')
      .insert([
        {
          user_id: userId,
          amount: depositData.amount,
          currency: depositData.currency || 'PHP',
          deposit_method: depositData.deposit_method,
          status: 'pending',
          linked_payment_intent_id: depositData.linked_payment_intent_id || null,
          metadata: depositData.metadata || {}
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getDepositIntentsByUser(userId) {
    const { data, error } = await supabase
      .from('deposit_intents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async updateDepositIntent(depositIntentId, updates) {
    const { data, error } = await supabase
      .from('deposit_intents')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', depositIntentId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // ============ Payments (Central Ledger) ============
  async getPaymentsByMerchant(merchantId, status = null) {
    let query = supabase
      .from('payments')
      .select('*')
      .eq('merchant_id', merchantId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getPaymentsByCustomer(customerId) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getPayment(paymentId) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (error) throw error
    return data
  },

  async createPayment(paymentData) {
    const { data, error } = await supabase
      .from('payments')
      .insert([
        {
          merchant_id: paymentData.merchant_id,
          customer_id: paymentData.customer_id || null,
          business_id: paymentData.business_id || null,
          payment_intent_id: paymentData.payment_intent_id || null,
          invoice_id: paymentData.invoice_id || null,
          payment_link_id: paymentData.payment_link_id || null,
          deposit_intent_id: paymentData.deposit_intent_id || null,
          product_id: paymentData.product_id || null,
          guest_email: paymentData.guest_email || null,
          guest_name: paymentData.guest_name || null,
          amount: paymentData.amount,
          currency: paymentData.currency || 'PHP',
          fee_amount: paymentData.fee_amount || 0,
          net_amount: (paymentData.amount - (paymentData.fee_amount || 0)),
          status: paymentData.status || 'pending',
          payment_type: paymentData.payment_type || 'payment',
          payment_method: paymentData.payment_method || null,
          description: paymentData.description || null,
          reference_number: paymentData.reference_number || null,
          external_reference_id: paymentData.external_reference_id || null,
          qr_code_url: paymentData.qr_code_url || null,
          metadata: paymentData.metadata || {},
          completed_at: paymentData.status === 'succeeded' ? new Date().toISOString() : null
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updatePaymentStatus(paymentId, status, extraData = {}) {
    const updates = {
      status,
      ...extraData,
      updated_at: new Date().toISOString()
    }

    if (status === 'succeeded' && !extraData.completed_at) {
      updates.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', paymentId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async ensurePaymentSyncedFromIntent(paymentIntentId) {
    try {
      const intent = await this.getPaymentIntent(paymentIntentId)
      if (!intent) return null

      if (intent.status !== 'succeeded') return null

      // Check if payment record exists
      let payment = await this.getPaymentByIntentId(paymentIntentId)

      if (!payment && intent.status === 'succeeded') {
        // Create the payment record if trigger didn't fire
        const { fee_amount, net_amount } = intent.metadata || {}
        const feeData = fee_amount ? { feeAmount: fee_amount, netAmount: net_amount } : this.calculateFee(intent.amount, intent.metadata?.payment_method)

        payment = await this.createPayment({
          merchant_id: intent.merchant_id,
          customer_id: intent.payer_id,
          payment_intent_id: intent.id,
          invoice_id: intent.invoice_id,
          payment_link_id: intent.payment_link_id,
          guest_email: intent.guest_email,
          guest_name: intent.guest_name,
          amount: intent.amount,
          currency: intent.currency,
          fee_amount: feeData.feeAmount,
          net_amount: feeData.netAmount,
          status: 'succeeded',
          payment_type: 'payment',
          payment_method: intent.metadata?.payment_method,
          metadata: intent.metadata || {},
          completed_at: new Date().toISOString()
        })
      }

      return payment
    } catch (err) {
      console.error('ensurePaymentSyncedFromIntent error:', err)
      return null
    }
  },

  async getPaymentByIntentId(paymentIntentId) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_intent_id', paymentIntentId)
        .maybeSingle()

      if (error) throw error
      return data
    } catch (err) {
      console.error('getPaymentByIntentId error:', err)
      return null
    }
  },

  // ============ Fee Calculation ============
  calculateFee(amount, paymentMethod = 'wallet_balance') {
    // Fee structure by payment method (percentage or flat + percentage)
    const feeStructure = {
      'wallet_balance': { flat: 0, percentage: 0 },
      'bank_transfer': { flat: 0, percentage: 0.02 }, // 2% for bank transfers
      'credit_card': { flat: 0.50, percentage: 0.029 }, // $0.50 + 2.9%
      'e_wallet': { flat: 0, percentage: 0.025 }, // 2.5% for GCash, PayMaya, etc.
      'crypto': { flat: 0, percentage: 0.03 }, // 3% for crypto
      'deposit': { flat: 0, percentage: 0.02 }, // 2% for deposits
      'withdrawal': { flat: 0, percentage: 0.02 } // 2% for withdrawals
    }

    const structure = feeStructure[paymentMethod] || feeStructure['wallet_balance']
    const percentageFee = amount * structure.percentage
    const flatFee = structure.flat
    const totalFee = flatFee + percentageFee

    return {
      feeAmount: Math.round(totalFee * 100) / 100,
      netAmount: Math.round((amount - totalFee) * 100) / 100,
      breakdown: {
        flat: flatFee,
        percentage: Math.round(percentageFee * 100) / 100
      }
    }
  },

  // ============ Helpers ============
  generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .replace(/-+/g, '-')
      .slice(0, 50)
  },

  async generateUniqueSlug(merchantId, baseSlug) {
    let slug = baseSlug
    let counter = 1

    while (true) {
      const existing = await this.getPaymentLinkBySlug(merchantId, slug)
      if (!existing) return slug
      slug = `${baseSlug}-${counter++}`
    }
  },

  generateQRCodeData(merchantId, amount, currency, memo = '') {
    return JSON.stringify({
      merchant_id: merchantId,
      amount: amount.toString(),
      currency: currency,
      memo: memo,
      timestamp: new Date().toISOString()
    })
  }
}
