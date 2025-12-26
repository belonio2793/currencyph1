/**
 * Unified Debt Service
 * Handles all debt operations: creating, updating, tracking payments, and audit trails
 * Consolidates loans, mortgages, credit cards, insurance, and other debt types
 */

import { supabase } from './supabaseClient'

export const debtService = {
  /**
   * Get all debts for a user
   * @param {string} userId
   * @param {object} options - Filter options (status, debtType, providerId)
   * @returns {Promise<Array>}
   */
  async getDebts(userId, options = {}) {
    try {
      let query = supabase
        .from('debts')
        .select('*')
        .eq('user_id', userId)

      if (options.status) {
        query = query.eq('status', options.status)
      }
      if (options.debtType) {
        query = query.eq('debt_type', options.debtType)
      }
      if (options.providerId) {
        query = query.eq('provider_id', options.providerId)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error('Error fetching debts:', error)
        return []
      }

      return data || []
    } catch (err) {
      console.error('Exception in getDebts:', err)
      return []
    }
  },

  /**
   * Get a single debt by ID
   * @param {string} debtId
   * @returns {Promise<object>}
   */
  async getDebt(debtId) {
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .single()

      if (error) {
        console.error('Error fetching debt:', error)
        return null
      }

      return data
    } catch (err) {
      console.error('Exception in getDebt:', err)
      return null
    }
  },

  /**
   * Get active debts for a user (status = 'active' or 'delinquent')
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getActiveDebts(userId) {
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'delinquent'])
        .order('due_date', { ascending: true })

      if (error) {
        console.error('Error fetching active debts:', error)
        return []
      }

      return data || []
    } catch (err) {
      console.error('Exception in getActiveDebts:', err)
      return []
    }
  },

  /**
   * Get total outstanding debt for a user
   * Calls the get_user_total_debt function in the database
   * @param {string} userId
   * @param {string} currencyCode - Default 'PHP'
   * @returns {Promise<object>}
   */
  async getUserTotalDebt(userId, currencyCode = 'PHP') {
    try {
      const { data, error } = await supabase
        .rpc('get_user_total_debt', {
          p_user_id: userId,
          p_currency_code: currencyCode
        })

      if (error) {
        console.error('Error getting total debt:', error)
        return {
          total_outstanding: 0,
          active_debt_count: 0,
          delinquent_count: 0,
          paid_off_count: 0
        }
      }

      return data || {
        total_outstanding: 0,
        active_debt_count: 0,
        delinquent_count: 0,
        paid_off_count: 0
      }
    } catch (err) {
      console.error('Exception in getUserTotalDebt:', err)
      return {
        total_outstanding: 0,
        active_debt_count: 0,
        delinquent_count: 0,
        paid_off_count: 0
      }
    }
  },

  /**
   * Create a new debt record
   * @param {string} userId
   * @param {object} debtData
   * @returns {Promise<object>}
   */
  async createDebt(userId, debtData) {
    try {
      const {
        debtType,
        providerType,
        providerId,
        providerName,
        originalPrincipal,
        interestRate,
        currencyCode,
        originationDate,
        dueDate,
        repaymentSchedule,
        paymentMethod,
        metadata = {}
      } = debtData

      // Calculate total owed (principal + interest)
      const totalOwed = originalPrincipal * (1 + interestRate / 100)

      const { data, error } = await supabase
        .from('debts')
        .insert([
          {
            user_id: userId,
            debt_type: debtType,
            provider_type: providerType,
            provider_id: providerId || null,
            provider_name: providerName,
            original_principal: originalPrincipal,
            interest_rate: interestRate,
            total_owed: totalOwed,
            outstanding_balance: totalOwed,
            currency_code: currencyCode,
            origination_date: originationDate || new Date().toISOString(),
            due_date: dueDate,
            original_due_date: dueDate,
            repayment_schedule: repaymentSchedule,
            payment_method: paymentMethod,
            status: 'active',
            metadata,
            days_past_due: 0
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Error creating debt:', error)
        throw error
      }

      return data
    } catch (err) {
      console.error('Exception in createDebt:', err)
      throw err
    }
  },

  /**
   * Process a debt payment
   * Calls the process_debt_payment stored procedure atomically
   * @param {string} debtId
   * @param {string} userId
   * @param {number} amount
   * @param {object} options - {principalPaid, interestPaid, feesPaid, paymentMethod, paymentReference}
   * @returns {Promise<object>}
   */
  async processPayment(debtId, userId, amount, options = {}) {
    try {
      const {
        principalPaid = amount,
        interestPaid = 0,
        feesPaid = 0,
        paymentMethod = 'bank_transfer',
        paymentReference = null,
        description = 'Debt payment'
      } = options

      // Call the stored procedure
      const { data, error } = await supabase
        .rpc('process_debt_payment', {
          p_debt_id: debtId,
          p_user_id: userId,
          p_amount: amount,
          p_principal_paid: principalPaid,
          p_interest_paid: interestPaid,
          p_fees_paid: feesPaid,
          p_payment_method: paymentMethod,
          p_payment_reference: paymentReference,
          p_description: description
        })

      if (error) {
        console.error('Error processing payment:', error)
        throw error
      }

      return data
    } catch (err) {
      console.error('Exception in processPayment:', err)
      throw err
    }
  },

  /**
   * Get payment history for a debt
   * @param {string} debtId
   * @returns {Promise<Array>}
   */
  async getPaymentHistory(debtId) {
    try {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('debt_id', debtId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching payment history:', error)
        return []
      }

      return data || []
    } catch (err) {
      console.error('Exception in getPaymentHistory:', err)
      return []
    }
  },

  /**
   * Get payment schedule for an installment debt
   * @param {string} debtId
   * @returns {Promise<Array>}
   */
  async getPaymentSchedule(debtId) {
    try {
      const { data, error } = await supabase
        .from('debt_payment_schedules')
        .select('*')
        .eq('debt_id', debtId)
        .order('payment_number', { ascending: true })

      if (error) {
        console.error('Error fetching payment schedule:', error)
        return []
      }

      return data || []
    } catch (err) {
      console.error('Exception in getPaymentSchedule:', err)
      return []
    }
  },

  /**
   * Update debt status (e.g., mark as paid_off, defaulted)
   * @param {string} debtId
   * @param {string} status
   * @param {object} metadata - Optional metadata to update
   * @returns {Promise<object>}
   */
  async updateDebtStatus(debtId, status, metadata = null) {
    try {
      const updateData = { status, updated_at: new Date().toISOString() }

      if (metadata) {
        updateData.metadata = metadata
      }

      const { data, error } = await supabase
        .from('debts')
        .update(updateData)
        .eq('id', debtId)
        .select()
        .single()

      if (error) {
        console.error('Error updating debt status:', error)
        throw error
      }

      return data
    } catch (err) {
      console.error('Exception in updateDebtStatus:', err)
      throw err
    }
  },

  /**
   * Calculate days past due and update status if needed
   * @param {string} debtId
   * @returns {Promise<object>}
   */
  async updateDelinquencyStatus(debtId) {
    try {
      const debt = await this.getDebt(debtId)

      if (!debt) {
        throw new Error('Debt not found')
      }

      const today = new Date()
      const dueDate = new Date(debt.due_date)
      const daysPastDue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)))

      // Determine new status
      let newStatus = debt.status
      if (daysPastDue > 0 && debt.status === 'active') {
        newStatus = 'delinquent'
      }

      const { data, error } = await supabase
        .from('debts')
        .update({
          days_past_due: daysPastDue,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', debtId)
        .select()
        .single()

      if (error) {
        console.error('Error updating delinquency:', error)
        throw error
      }

      return data
    } catch (err) {
      console.error('Exception in updateDelinquencyStatus:', err)
      throw err
    }
  },

  /**
   * Create payment schedule for installment debt
   * @param {string} debtId
   * @param {number} numberOfPayments
   * @param {Array} paymentDates - Array of payment dates
   * @returns {Promise<Array>}
   */
  async createPaymentSchedule(debtId, numberOfPayments, paymentDates) {
    try {
      const debt = await this.getDebt(debtId)

      if (!debt) {
        throw new Error('Debt not found')
      }

      // Calculate per-payment amounts
      const principalPerPayment = debt.original_principal / numberOfPayments
      const interestPerPayment = (debt.total_owed - debt.original_principal) / numberOfPayments

      const schedules = []
      for (let i = 0; i < numberOfPayments; i++) {
        schedules.push({
          debt_id: debtId,
          payment_number: i + 1,
          due_date: paymentDates[i] || new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000),
          amount_due: principalPerPayment + interestPerPayment,
          principal_due: principalPerPayment,
          interest_due: interestPerPayment,
          status: 'pending'
        })
      }

      const { data, error } = await supabase
        .from('debt_payment_schedules')
        .insert(schedules)
        .select()

      if (error) {
        console.error('Error creating payment schedule:', error)
        throw error
      }

      return data || []
    } catch (err) {
      console.error('Exception in createPaymentSchedule:', err)
      throw err
    }
  },

  /**
   * Get debts grouped by type and status (summary)
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getDebtSummary(userId) {
    try {
      const debts = await this.getDebts(userId)

      const summary = {
        byType: {},
        byStatus: {},
        totalOutstanding: 0,
        currencies: {}
      }

      debts.forEach(debt => {
        // By type
        if (!summary.byType[debt.debt_type]) {
          summary.byType[debt.debt_type] = {
            count: 0,
            totalOutstanding: 0,
            debts: []
          }
        }
        summary.byType[debt.debt_type].count++
        summary.byType[debt.debt_type].totalOutstanding += Number(debt.outstanding_balance)
        summary.byType[debt.debt_type].debts.push(debt)

        // By status
        if (!summary.byStatus[debt.status]) {
          summary.byStatus[debt.status] = {
            count: 0,
            totalOutstanding: 0,
            debts: []
          }
        }
        summary.byStatus[debt.status].count++
        summary.byStatus[debt.status].totalOutstanding += Number(debt.outstanding_balance)
        summary.byStatus[debt.status].debts.push(debt)

        // By currency
        if (!summary.currencies[debt.currency_code]) {
          summary.currencies[debt.currency_code] = {
            totalOutstanding: 0,
            debts: []
          }
        }
        summary.currencies[debt.currency_code].totalOutstanding += Number(debt.outstanding_balance)
        summary.currencies[debt.currency_code].debts.push(debt)

        // Grand total
        summary.totalOutstanding += Number(debt.outstanding_balance)
      })

      return summary
    } catch (err) {
      console.error('Exception in getDebtSummary:', err)
      return {
        byType: {},
        byStatus: {},
        totalOutstanding: 0,
        currencies: {}
      }
    }
  }
}

export default debtService
