import { supabase } from './supabaseClient'

export const receiptService = {
  async createReceipt(businessId, userId, receiptData) {
    try {
      if (!businessId) throw new Error('Business ID is required')
      if (!userId) throw new Error('User ID is required')

      const amount = parseFloat(receiptData.amount) || 0
      if (amount < 0) throw new Error('Amount must be greater than or equal to 0')

      const { data, error } = await supabase
        .from('business_receipts')
        .insert([
          {
            business_id: businessId,
            user_id: userId,
            receipt_number: receiptData.receipt_number || `RCP-${Date.now()}`,
            customer_name: receiptData.customer_name || 'Walk-in Customer',
            customer_email: receiptData.customer_email || null,
            customer_phone: receiptData.customer_phone || null,
            amount: amount,
            payment_method: receiptData.payment_method || 'Balance',
            items: Array.isArray(receiptData.items) ? receiptData.items : [],
            notes: receiptData.notes || '',
            status: 'completed'
          }
        ])
        .select()

      if (error) {
        const errorMsg = error.message || 'Failed to create receipt'
        throw new Error(errorMsg)
      }

      if (!data || data.length === 0) {
        throw new Error('Receipt was not created. Please try again.')
      }

      return data[0]
    } catch (error) {
      console.error('Error creating receipt:', error)
      throw new Error(error.message || 'Failed to create receipt')
    }
  },

  async getBusinessReceipts(businessId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('business_receipts')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching business receipts:', error)
      throw error
    }
  },

  async getUserReceipts(customerEmail, customerPhone) {
    try {
      const receipts = []

      if (customerEmail) {
        const { data, error } = await supabase
          .from('business_receipts')
          .select(`
            *,
            businesses:business_id (
              id,
              business_name,
              tin,
              certificate_of_incorporation,
              city_of_registration,
              metadata
            )
          `)
          .eq('customer_email', customerEmail)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (data) receipts.push(...data)
      }

      if (customerPhone) {
        const { data, error } = await supabase
          .from('business_receipts')
          .select(`
            *,
            businesses:business_id (
              id,
              business_name,
              tin,
              certificate_of_incorporation,
              city_of_registration,
              metadata
            )
          `)
          .eq('customer_phone', customerPhone)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (data) {
          receipts.push(...data.filter(r => !receipts.find(existing => existing.id === r.id)))
        }
      }

      receipts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return receipts
    } catch (error) {
      console.error('Error fetching user receipts:', error)
      throw error
    }
  },

  async getReceiptById(receiptId) {
    try {
      const { data, error } = await supabase
        .from('business_receipts')
        .select(`
          *,
          businesses:business_id (
            id,
            business_name,
            tin,
            certificate_of_incorporation,
            city_of_registration,
            metadata
          )
        `)
        .eq('id', receiptId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching receipt:', error)
      throw error
    }
  },

  async updateReceipt(receiptId, updates) {
    try {
      const { data, error } = await supabase
        .from('business_receipts')
        .update(updates)
        .eq('id', receiptId)
        .select()

      if (error) throw error
      return data?.[0]
    } catch (error) {
      console.error('Error updating receipt:', error)
      throw error
    }
  },

  async deleteReceipt(receiptId) {
    try {
      const { error } = await supabase
        .from('business_receipts')
        .delete()
        .eq('id', receiptId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting receipt:', error)
      throw error
    }
  },

  async searchReceipts(businessId, searchTerm) {
    try {
      const { data, error } = await supabase
        .from('business_receipts')
        .select('*')
        .eq('business_id', businessId)
        .or(`customer_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error searching receipts:', error)
      throw error
    }
  },

  async sendReceipt(receiptId, sendToEmail, sendToPhone) {
    try {
      if (!receiptId) throw new Error('Receipt ID is required')
      if (!sendToEmail && !sendToPhone) {
        throw new Error('Email or phone number is required to send receipt')
      }

      const updateData = {
        is_sent: true,
        sent_at: new Date().toISOString()
      }

      if (sendToEmail) {
        updateData.sent_to_email = sendToEmail
      }
      if (sendToPhone) {
        updateData.sent_to_phone = sendToPhone
      }

      const { data, error } = await supabase
        .from('business_receipts')
        .update(updateData)
        .eq('id', receiptId)
        .select()

      if (error) throw error
      return data?.[0]
    } catch (error) {
      console.error('Error sending receipt:', error)
      throw new Error(error.message || 'Failed to send receipt')
    }
  }
}
