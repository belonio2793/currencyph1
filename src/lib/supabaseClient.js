import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// DOG Token API utilities
export const dogTokenAPI = {
  // Get current user balance
  async getUserBalance(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('dog_balance')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data?.dog_balance || 0
  },

  // Get or create user
  async getOrCreateUser(email, walletAddress = null) {
    const { data, error } = await supabase
      .from('users')
      .upsert([
        {
          email,
          wallet_address: walletAddress,
          region_code: 'PH'
        }
      ])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Add DOG deposit
  async addDeposit(userId, amount, depositType = 'manual') {
    // First update user balance
    const currentBalance = await this.getUserBalance(userId)
    const newBalance = currentBalance + amount

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ dog_balance: newBalance, updated_at: new Date() })
      .eq('id', userId)
      .select()
      .single()

    if (updateError) throw updateError

    // Then record deposit in ledger
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([
        {
          user_id: userId,
          amount,
          deposit_type: depositType,
          status: 'completed'
        }
      ])
      .select()
      .single()

    if (depositError) throw depositError

    return { user: updatedUser, deposit }
  },

  // Get deposit history
  async getDepositHistory(userId) {
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  // Request withdrawal
  async requestWithdrawal(userId, amount) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert([
        {
          user_id: userId,
          amount,
          status: 'pending'
        }
      ])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Subscribe to balance updates
  subscribeToBalance(userId, callback) {
    return supabase
      .from(`users:id=eq.${userId}`)
      .on('UPDATE', payload => {
        callback(payload.new.dog_balance)
      })
      .subscribe()
  },

  // Get token stats
  async getTokenStats() {
    const { data, error } = await supabase
      .from('token_stats')
      .select('*')
      .single()
    if (error) throw error
    return data
  },

  // Calculate DOG token price: total_deposits / total_dog_supply
  async calculateDOGPrice() {
    try {
      // Get total value of all deposits
      const { data: deposits, error: depositError } = await supabase
        .from('deposits')
        .select('amount')

      if (depositError) throw depositError

      const totalDeposits = (deposits || []).reduce((sum, d) => sum + (d.amount || 0), 0)

      // Get total DOG in circulation (sum of all user balances)
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('dog_balance')

      if (userError) throw userError

      const totalDOGSupply = (users || []).reduce((sum, u) => sum + (u.dog_balance || 0), 0)

      // Avoid division by zero
      if (totalDOGSupply === 0 || totalDeposits === 0) {
        return {
          dogPrice: 0,
          totalDeposits: 0,
          totalSupply: 0,
          marketCap: 0
        }
      }

      const dogPrice = totalDeposits / totalDOGSupply

      return {
        dogPrice: parseFloat(dogPrice.toFixed(4)),
        totalDeposits: parseFloat(totalDeposits.toFixed(2)),
        totalSupply: parseFloat(totalDOGSupply.toFixed(2)),
        marketCap: parseFloat((dogPrice * totalDOGSupply).toFixed(2))
      }
    } catch (err) {
      console.error('Error calculating DOG price:', err)
      return {
        dogPrice: 0,
        totalDeposits: 0,
        totalSupply: 0,
        marketCap: 0
      }
    }
  }
}
