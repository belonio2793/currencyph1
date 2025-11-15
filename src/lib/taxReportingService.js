import { supabase } from './supabaseClient'

export const taxReportingService = {
  // Month range mapping for quarters
  getQuarterMonthRange(quarterNumber) {
    const monthRanges = {
      1: 'Jan - Mar',
      2: 'Apr - Jun',
      3: 'Jul - Sep',
      4: 'Oct - Dec'
    }
    return monthRanges[quarterNumber] || ''
  },

  // Calculate quarterly/annual totals
  async calculateReportingPeriod(businessId, period = 'annual', year = new Date().getFullYear()) {
    try {
      const currentYear = new Date().getFullYear()
      let startDate, endDate
      let monthRange = ''

      if (period === 'annual') {
        startDate = new Date(year, 0, 1)
        endDate = new Date(Math.min(year, currentYear), currentYear === year ? new Date().getMonth() : 11, currentYear === year ? new Date().getDate() : 31)
      } else if (period.startsWith('Q')) {
        const quarter = parseInt(period.slice(1))
        startDate = new Date(year, (quarter - 1) * 3, 1)
        endDate = new Date(year, quarter * 3, 0)
        monthRange = this.getQuarterMonthRange(quarter)
        if (year === currentYear && quarter === Math.ceil((new Date().getMonth() + 1) / 3)) {
          endDate = new Date()
        }
      } else if (period === 'ytd') {
        startDate = new Date(currentYear, 0, 1)
        endDate = new Date()
      }

      // Fetch receipts for the period
      const { data: receipts, error: receiptsError } = await supabase
        .from('business_receipts')
        .select('*')
        .eq('business_id', businessId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (receiptsError) throw receiptsError

      // Fetch expenses for the period
      const { data: expenses, error: expensesError } = await supabase
        .from('miscellaneous_costs')
        .select('*')
        .eq('business_id', businessId)
        .gte('cost_date', startDate.toISOString().split('T')[0])
        .lte('cost_date', endDate.toISOString().split('T')[0])

      if (expensesError) throw expensesError

      // Fetch tax payments for the period
      const { data: taxPayments, error: taxError } = await supabase
        .from('tax_payments')
        .select('*')
        .eq('business_id', businessId)
        .gte('payment_date', startDate.toISOString())
        .lte('payment_date', endDate.toISOString())

      if (taxError) throw taxError

      const totalSales = receipts?.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0) || 0
      const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) || 0
      const netIncome = totalSales - totalExpenses
      const estimatedTax = Math.max(0, netIncome * 0.12)
      const taxPaid = taxPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0
      const taxDue = estimatedTax - taxPaid

      return {
        period,
        monthRange,
        year,
        startDate,
        endDate,
        totalSales,
        totalExpenses,
        netIncome,
        estimatedTax,
        taxPaid,
        taxDue,
        receiptCount: receipts?.length || 0,
        expenseCount: expenses?.length || 0,
        profitMargin: totalSales > 0 ? ((netIncome / totalSales) * 100).toFixed(2) : 0
      }
    } catch (error) {
      console.error('Error calculating reporting period:', error)
      throw error
    }
  },

  // Get monthly breakdown
  async getMonthlyBreakdown(businessId, year) {
    try {
      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(Math.min(year, new Date().getFullYear()), Math.min(11, new Date().getMonth()), year === new Date().getFullYear() ? new Date().getDate() : 31)

      const { data: receipts } = await supabase
        .from('business_receipts')
        .select('amount, created_at')
        .eq('business_id', businessId)
        .gte('created_at', yearStart.toISOString())
        .lte('created_at', yearEnd.toISOString())

      const { data: expenses } = await supabase
        .from('miscellaneous_costs')
        .select('amount, created_at')
        .eq('business_id', businessId)
        .gte('created_at', yearStart.toISOString())
        .lte('created_at', yearEnd.toISOString())

      const monthlyData = Array(12).fill(null).map((_, i) => ({
        month: new Date(year, i, 1).toLocaleString('en-US', { month: 'short' }),
        sales: 0,
        expenses: 0
      }))

      receipts?.forEach(receipt => {
        const month = new Date(receipt.created_at).getMonth()
        monthlyData[month].sales += parseFloat(receipt.amount || 0)
      })

      expenses?.forEach(expense => {
        const month = new Date(expense.created_at).getMonth()
        monthlyData[month].expenses += parseFloat(expense.amount || 0)
      })

      return monthlyData.map(month => ({
        ...month,
        netIncome: month.sales - month.expenses
      }))
    } catch (error) {
      console.error('Error getting monthly breakdown:', error)
      throw error
    }
  },

  // Save tax payment
  async saveTaxPayment(businessId, amount, paymentDate, paymentMethod, referenceNumber) {
    try {
      const { data, error } = await supabase
        .from('tax_payments')
        .insert([{
          business_id: businessId,
          amount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          reference_number: referenceNumber,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error saving tax payment:', error)
      throw error
    }
  },

  // Add business expense
  async addBusinessExpense(businessId, description, amount, category, receiptDate) {
    try {
      const { data, error } = await supabase
        .from('miscellaneous_costs')
        .insert([{
          business_id: businessId,
          description,
          amount,
          category,
          created_at: receiptDate || new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding business expense:', error)
      throw error
    }
  },

  // Generate PDF report
  async generatePDFReport(businessId, reportData, monthlyData) {
    try {
      // This will be handled by the component using a PDF library
      return {
        businessId,
        reportData,
        monthlyData,
        generatedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      throw error
    }
  },

  // Get tax filing deadlines
  getTaxFilingDeadlines(year) {
    return [
      {
        period: 'Q1 (Jan-Mar)',
        deadline: new Date(year, 3, 15), // April 15
        type: 'quarterly'
      },
      {
        period: 'Q2 (Apr-Jun)',
        deadline: new Date(year, 6, 15), // July 15
        type: 'quarterly'
      },
      {
        period: 'Q3 (Jul-Sep)',
        deadline: new Date(year, 9, 15), // Oct 15
        type: 'quarterly'
      },
      {
        period: 'Q4 (Oct-Dec)',
        deadline: new Date(year + 1, 0, 31), // Jan 31 of next year
        type: 'quarterly'
      },
      {
        period: 'Annual',
        deadline: new Date(year + 1, 3, 15), // April 15 of next year
        type: 'annual'
      }
    ]
  },

  // Estimate quarterly payment
  estimateQuarterlyPayment(annualTaxLiability) {
    return annualTaxLiability / 4
  }
}
