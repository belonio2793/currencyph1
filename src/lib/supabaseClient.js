import { createClient } from '@supabase/supabase-js'

// Helper to read env both in browser (import.meta.env) and Node (process.env)
const getEnv = (name) => {
  try {
    // import.meta is available in Vite/browser builds
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) return import.meta.env[name]
  } catch (e) {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name]
  } catch (e) {
    // ignore
  }
  return undefined
}

const SUPABASE_URL = getEnv('VITE_PROJECT_URL') || getEnv('PROJECT_URL') || getEnv('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || ''

let supabase

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} else {
  console.warn('Supabase not fully configured. SUPABASE_URL or SUPABASE_ANON_KEY is missing. Some features will be disabled.')
  const missingError = (method) => () => { throw new Error(`Supabase not configured. Called ${method} but SUPABASE_URL or SUPABASE_ANON_KEY is missing.`) }
  supabase = {
    from: () => ({ select: missingError('from().select'), insert: missingError('from().insert'), update: missingError('from().update'), upsert: missingError('from().upsert'), eq: missingError('from().eq'), order: missingError('from().order') }),
    auth: {
      signInWithPassword: missingError('auth.signInWithPassword'),
      signUp: missingError('auth.signUp'),
      getUser: async () => ({ data: { user: null }, error: null })
    },
    channel: (name) => ({
      // allow .on(...).subscribe() chaining
      on: () => ({ subscribe: missingError('channel().on().subscribe') }),
      // allow subscribe() directly
      subscribe: missingError('channel().subscribe')
    }),
    removeChannel: (c) => { /* noop when supabase not configured */ },
    rpc: missingError('rpc')
  }
}

export { supabase }

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

      if (depositError) {
        console.error('Error fetching deposits:', {
          message: depositError.message,
          code: depositError.code,
          status: depositError.status,
          details: depositError.details
        })
        throw depositError
      }

      const totalDeposits = (deposits || []).reduce((sum, d) => sum + (d.amount || 0), 0)

      // Get total DOG in circulation (sum of all user balances)
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('dog_balance')

      if (userError) {
        console.error('Error fetching users:', {
          message: userError.message,
          code: userError.code,
          status: userError.status,
          details: userError.details
        })
        throw userError
      }

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
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err)
      console.error('Error calculating DOG price:', errorMessage)
      console.warn('Using fallback values: dogPrice=0. This usually means Supabase tables are not set up yet.')
      return {
        dogPrice: 0,
        totalDeposits: 0,
        totalSupply: 0,
        marketCap: 0
      }
    }
  }
}
