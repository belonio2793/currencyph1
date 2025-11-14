import { supabase } from './supabaseClient'

/**
 * Service for managing business financial data including miscellaneous costs and reporting
 */

export const businessFinanceService = {
  // Miscellaneous Costs
  async getMiscellaneousCosts(businessId) {
    try {
      const { data, error } = await supabase
        .from('miscellaneous_costs')
        .select('*')
        .eq('business_id', businessId)
        .order('cost_date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching miscellaneous costs:', err)
      throw err
    }
  },

  async addMiscellaneousCost(businessId, userId, costData) {
    try {
      const { data, error } = await supabase
        .from('miscellaneous_costs')
        .insert([{
          business_id: businessId,
          user_id: userId,
          ...costData,
          status: 'recorded',
          created_at: new Date().toISOString()
        }])
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      console.error('Error adding miscellaneous cost:', err)
      throw err
    }
  },

  async updateMiscellaneousCost(costId, costData) {
    try {
      const { data, error } = await supabase
        .from('miscellaneous_costs')
        .update({
          ...costData,
          updated_at: new Date().toISOString()
        })
        .eq('id', costId)
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      console.error('Error updating miscellaneous cost:', err)
      throw err
    }
  },

  async deleteMiscellaneousCost(costId) {
    try {
      const { error } = await supabase
        .from('miscellaneous_costs')
        .delete()
        .eq('id', costId)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error deleting miscellaneous cost:', err)
      throw err
    }
  },

  // Business Receipts (Sales)
  async getBusinessReceipts(businessId) {
    try {
      const { data, error } = await supabase
        .from('business_receipts')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching business receipts:', err)
      throw err
    }
  },

  // Financial Summary
  async getFinancialSummary(businessId, startDate, endDate) {
    try {
      // Get receipts (income)
      const { data: receipts, error: receiptError } = await supabase
        .from('business_receipts')
        .select('amount, created_at')
        .eq('business_id', businessId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (receiptError) throw receiptError

      // Get costs (expenses)
      const { data: costs, error: costError } = await supabase
        .from('miscellaneous_costs')
        .select('amount, cost_date, category')
        .eq('business_id', businessId)
        .gte('cost_date', startDate.split('T')[0])
        .lte('cost_date', endDate.split('T')[0])

      if (costError) throw costError

      // Calculate totals
      const totalIncome = (receipts || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
      const totalExpenses = (costs || []).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)
      const netIncome = totalIncome - totalExpenses

      // Group expenses by category
      const expensesByCategory = {}
      ;(costs || []).forEach(cost => {
        const cat = cost.category || 'uncategorized'
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + parseFloat(cost.amount)
      })

      return {
        totalIncome,
        totalExpenses,
        netIncome,
        taxEstimate: netIncome * 0.12, // 12% VAT
        expensesByCategory,
        receiptCount: receipts?.length || 0,
        costCount: costs?.length || 0
      }
    } catch (err) {
      console.error('Error calculating financial summary:', err)
      throw err
    }
  },

  // Payment Methods
  async getPaymentMethods(businessId) {
    try {
      const { data, error } = await supabase
        .from('business_payments')
        .select('*')
        .eq('business_id', businessId)
        .order('connected_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching payment methods:', err)
      throw err
    }
  },

  async addPaymentMethod(businessId, userId, paymentData) {
    try {
      const { data, error } = await supabase
        .from('business_payments')
        .insert([{
          business_id: businessId,
          user_id: userId,
          ...paymentData,
          connected_at: new Date().toISOString()
        }])
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      console.error('Error adding payment method:', err)
      throw err
    }
  },

  async updatePaymentMethod(paymentId, paymentData) {
    try {
      const { data, error } = await supabase
        .from('business_payments')
        .update({
          ...paymentData,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select()

      if (error) throw error
      return data?.[0]
    } catch (err) {
      console.error('Error updating payment method:', err)
      throw err
    }
  },

  async deletePaymentMethod(paymentId) {
    try {
      const { error } = await supabase
        .from('business_payments')
        .delete()
        .eq('id', paymentId)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error deleting payment method:', err)
      throw err
    }
  },

  // Tax Reporting
  async getTaxReport(businessId, year) {
    try {
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`

      const summary = await this.getFinancialSummary(businessId, startDate, endDate)

      // Calculate quarterly breakdowns
      const quarters = {}
      for (let q = 1; q <= 4; q++) {
        const qStartMonth = (q - 1) * 3 + 1
        const qEndMonth = q * 3
        const qStartDate = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
        const qEndDate = `${year}-${String(qEndMonth).padStart(2, '0')}-${new Date(year, qEndMonth, 0).getDate()}`

        quarters[`Q${q}`] = await this.getFinancialSummary(businessId, qStartDate, qEndDate)
      }

      return {
        year,
        annual: summary,
        quarterly: quarters,
        generatedAt: new Date().toISOString()
      }
    } catch (err) {
      console.error('Error generating tax report:', err)
      throw err
    }
  }
}

export default businessFinanceService
