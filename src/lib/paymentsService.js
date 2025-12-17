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
        .select('*')
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
