import * as Supabase from '@supabase/supabase-js'

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

const SUPABASE_URL = getEnv('VITE_PROJECT_URL') || getEnv('VITE_SUPABASE_URL') || getEnv('PROJECT_URL') || getEnv('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || ''

// Module-level lazy singleton: initialize Supabase client on first use without relying on globalThis
let _client = null

function createDummyClient() {
  console.warn('Supabase not fully configured. SUPABASE_URL or SUPABASE_ANON_KEY is missing. Some features will be disabled.')
  const missingError = (method) => () => { throw new Error(`Supabase not configured. Called ${method} but SUPABASE_URL or SUPABASE_ANON_KEY is missing.`) }
  return {
    from: () => ({ select: missingError('from().select'), insert: missingError('from().insert'), update: missingError('from().update'), upsert: missingError('from().upsert'), eq: missingError('from().eq'), order: missingError('from().order') }),
    auth: {
      signInWithPassword: missingError('auth.signInWithPassword'),
      signUp: missingError('auth.signUp'),
      getUser: async () => ({ data: { user: null }, error: null })
    },
    channel: (name) => ({
      on: () => ({ subscribe: missingError('channel().on().subscribe') }),
      subscribe: missingError('channel().subscribe')
    }),
    removeChannel: (c) => { /* noop when supabase not configured */ },
    rpc: missingError('rpc')
  }
}

function initClient() {
  if (_client) return _client
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    // Basic URL sanity check
    if (typeof SUPABASE_URL !== 'string' || (!SUPABASE_URL.startsWith('http://') && !SUPABASE_URL.startsWith('https://'))) {
      console.error('[supabase-client] Invalid SUPABASE_URL:', SUPABASE_URL)
      _client = createDummyClient()
      return _client
    }

    try {
      // Initialize with default global fetch - don't override to avoid interfering with runtime fetch behavior
      console.debug('[supabase-client] initializing client with URL', SUPABASE_URL)

      // Wrap fetch to handle network errors gracefully and retry transient failures
      const originalFetch = globalThis.fetch
      const wrappedFetch = async (...args) => {
        const maxRetries = 2
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // If browser is offline, fail fast with a synthetic Response to avoid noisy "Failed to fetch" TypeErrors
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              try {
                const body = JSON.stringify({ error: 'offline', message: 'Network appears to be offline' })
                return new Response(body, { status: 503, headers: { 'Content-Type': 'application/json' } })
              } catch (e) {
                const offlineErr = new Error('Network appears to be offline')
                offlineErr.name = 'NetworkError'
                throw offlineErr
              }
            }
            return await originalFetch(...args)
          } catch (err) {
            // Abort errors should be propagated immediately
            if (err && (err.name === 'AbortError' || err.name === 'DOMException')) throw err

            // On last attempt, instead of throwing a raw TypeError which causes noisy console traces
            // return a synthetic Response with 503 status so callers receive a proper response object.
            if (attempt === maxRetries) {
              console.warn('[supabase-client] Network error during fetch (final):', err && err.message)
              try {
                const url = args && args[0]
                if (url) console.debug('[supabase-client] failed URL:', url)
              } catch (e) {}

              try {
                // create a simple Response-like fallback
                const body = JSON.stringify({ error: 'network_error', message: err && err.message })
                return new Response(body, { status: 503, headers: { 'Content-Type': 'application/json' } })
              } catch (e) {
                // If Response isn't available, just throw the original error as a last resort
                throw err
              }
            }

            // small backoff before retrying
            const backoff = 150 * (attempt + 1)
            await new Promise((res) => setTimeout(res, backoff))
            // retry
          }
        }
      }

      _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { fetch: wrappedFetch }
      })
    } catch (clientErr) {
      console.error('Failed to initialize Supabase client:', clientErr)
      _client = createDummyClient()
    }
  } else {
    _client = createDummyClient()
  }
  return _client
}

// Export a Proxy that lazily initializes the real client on first access while keeping the same import shape
const supabase = new Proxy({}, {
  get(_, prop) {
    const client = initClient()
    const value = client[prop]
    if (typeof value === 'function') return value.bind(client)
    return value
  },
  set(_, prop, val) {
    const client = initClient()
    client[prop] = val
    return true
  }
})

export { supabase }

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

// Generic Token API utilities (replacing deprecated dog token API)
export const tokenAPI = {
  // Get current user balance
  async getUserBalance(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single()
      if (error) {
        console.error('[tokenAPI] getUserBalance error', error)
        throw error
      }
      return data?.balance || 0
    } catch (err) {
      console.error('[tokenAPI] getUserBalance failed', err)
      // return safe fallback when network issues occur
      return 0
    }
  },

  // Get or create user
  async getOrCreateUser(email, walletAddress = null) {
    try {
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
      if (error) {
        console.error('[tokenAPI] getOrCreateUser error', error)
        throw error
      }
      return data
    } catch (err) {
      console.error('[tokenAPI] getOrCreateUser failed', err)
      return null
    }
  },

  // Add deposit
  async addDeposit(userId, amount, depositType = 'manual') {
    try {
      // First update user balance
      const currentBalance = await this.getUserBalance(userId)
      const newBalance = currentBalance + amount

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ balance: newBalance, updated_at: new Date() })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        console.error('[tokenAPI] addDeposit update error', updateError)
        throw updateError
      }

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

      if (depositError) {
        console.error('[tokenAPI] addDeposit insert error', depositError)
        throw depositError
      }

      return { user: updatedUser, deposit }
    } catch (err) {
      console.error('[tokenAPI] addDeposit failed', err)
      throw err
    }
  },

  // Get deposit history
  async getDepositHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('[tokenAPI] getDepositHistory error', error)
        throw error
      }
      return data
    } catch (err) {
      console.error('[tokenAPI] getDepositHistory failed', err)
      return []
    }
  },

  // Request withdrawal
  async requestWithdrawal(userId, amount) {
    try {
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
      if (error) {
        console.error('[tokenAPI] requestWithdrawal error', error)
        throw error
      }
      return data
    } catch (err) {
      console.error('[tokenAPI] requestWithdrawal failed', err)
      throw err
    }
  },

  // Subscribe to balance updates (supports Supabase JS v2 realtime)
  subscribeToBalance(userId, callback) {
    try {
      const client = initClient()
      if (!client || typeof client.channel !== 'function') {
        // Not supported in environment
        return { unsubscribe: () => {} }
      }

      const channel = client
        .channel(`public:users:id=eq.${userId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload) => {
          try { callback(payload.new.balance) } catch (e) { console.error('subscribeToBalance callback error', e) }
        })
        .subscribe()

      return {
        unsubscribe: () => {
          try {
            // Unsubscribe using channel object
            if (channel && typeof channel.unsubscribe === 'function') {
              channel.unsubscribe()
            } else if (client && typeof client.removeChannel === 'function') {
              client.removeChannel(channel)
            }
          } catch (e) {
            console.debug('Error unsubscribing balance channel', e)
          }
        }
      }
    } catch (err) {
      console.debug('subscribeToBalance not available', err)
      return { unsubscribe: () => {} }
    }
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

  // Calculate token price: total_deposits / total_supply
  async calculateTokenPrice() {
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

      // Get total in circulation (sum of all user balances)
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('balance')

      if (userError) {
        console.error('Error fetching users:', {
          message: userError.message,
          code: userError.code,
          status: userError.status,
          details: userError.details
        })
        throw userError
      }

      const totalSupply = (users || []).reduce((sum, u) => sum + (u.balance || 0), 0)

      // Avoid division by zero
      if (totalSupply === 0 || totalDeposits === 0) {
        return {
          price: 0,
          totalDeposits: 0,
          totalSupply: 0,
          marketCap: 0
        }
      }

      const price = totalDeposits / totalSupply

      return {
        price: parseFloat(price.toFixed(4)),
        totalDeposits: parseFloat(totalDeposits.toFixed(2)),
        totalSupply: parseFloat(totalSupply.toFixed(2)),
        marketCap: parseFloat((price * totalSupply).toFixed(2))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err)
      console.error('Error calculating token price:', errorMessage)
      console.warn('Using fallback values: price=0. This usually means Supabase tables are not set up yet.')
      return {
        price: 0,
        totalDeposits: 0,
        totalSupply: 0,
        marketCap: 0
      }
    }
  }
}
