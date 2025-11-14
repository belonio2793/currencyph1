import { supabase } from './supabaseClient'

export const miscellaneousCostsService = {
  async getBusinessCosts(businessId) {
    if (!businessId) throw new Error('Business ID is required')
    
    const { data, error } = await supabase
      .from('miscellaneous_costs')
      .select('*')
      .eq('business_id', businessId)
      .order('cost_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async createCost(businessId, userId, costData) {
    if (!businessId) throw new Error('Business ID is required')
    if (!userId) throw new Error('User ID is required')
    
    const amount = parseFloat(costData.amount)
    if (isNaN(amount) || amount <= 0) throw new Error('Amount must be a valid positive number')
    
    const { data, error } = await supabase
      .from('miscellaneous_costs')
      .insert([{
        business_id: businessId,
        user_id: userId,
        description: costData.description || 'Miscellaneous Cost',
        amount: amount,
        category: costData.category || 'other',
        cost_date: costData.cost_date || new Date().toISOString().split('T')[0],
        payment_method: costData.payment_method || null,
        notes: costData.notes || null,
        receipt_url: costData.receipt_url || null,
        status: costData.status || 'recorded'
      }])
      .select()
    
    if (error) throw error
    return data?.[0]
  },

  async updateCost(costId, updates) {
    const { data, error } = await supabase
      .from('miscellaneous_costs')
      .update(updates)
      .eq('id', costId)
      .select()
    
    if (error) throw error
    return data?.[0]
  },

  async deleteCost(costId) {
    const { error } = await supabase
      .from('miscellaneous_costs')
      .delete()
      .eq('id', costId)
    
    if (error) throw error
  },

  async getCostsByDateRange(businessId, startDate, endDate) {
    if (!businessId) throw new Error('Business ID is required')
    
    const { data, error } = await supabase
      .from('miscellaneous_costs')
      .select('*')
      .eq('business_id', businessId)
      .gte('cost_date', startDate)
      .lte('cost_date', endDate)
      .order('cost_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getCostsByCategory(businessId, category) {
    if (!businessId) throw new Error('Business ID is required')
    
    const { data, error } = await supabase
      .from('miscellaneous_costs')
      .select('*')
      .eq('business_id', businessId)
      .eq('category', category)
      .order('cost_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  calculateTotalCosts(costs) {
    return costs.reduce((total, cost) => total + parseFloat(cost.amount || 0), 0)
  }
}
