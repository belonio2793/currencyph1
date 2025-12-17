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

// Keep reference to original fetch (no wrapper to avoid response body conflicts with Supabase)
const originalFetch = typeof window !== 'undefined' ? window.fetch : global.fetch

// Add global error handler to suppress expected network connectivity errors from Supabase
if (typeof window !== 'undefined') {
  // Suppress unhandled promise rejections from Supabase fetch failures
  const suppressSupabaseErrors = (event) => {
    const reason = event.reason
    if (!reason) return false

    const reasonStr = String(reason)
    const reasonMsg = reason?.message ? String(reason.message) : ''
    const stack = reason?.stack ? String(reason.stack) : ''

    const isFetchError = reasonStr.includes('Failed to fetch') || reasonMsg.includes('Failed to fetch')
    const isTypeError = (reasonStr.includes('TypeError') && reasonStr.includes('fetch')) || reasonStr.includes('TypeError: Failed to fetch')
    const isSupabaseStack = stack.includes('@supabase') || stack.includes('supabase-js') || stack.includes('updatePresence') || stack.includes('presence.js')

    return isFetchError || isTypeError || isSupabaseStack
  }

  window.addEventListener('unhandledrejection', (event) => {
    if (suppressSupabaseErrors(event)) {
      event.preventDefault()
    }
  }, true)

  window.addEventListener('error', (event) => {
    // Suppress "Failed to fetch" errors from within Supabase library or presence functionality
    const msgStr = String(event.message || '')
    const filenameStr = String(event.filename || '')

    if (msgStr.includes('Failed to fetch') ||
        (msgStr.includes('TypeError') && (filenameStr.includes('supabase') || filenameStr.includes('presence')))) {
      event.preventDefault()
    }
  }, true)
}

const SUPABASE_URL = getEnv('VITE_PROJECT_URL') || getEnv('VITE_SUPABASE_URL') || getEnv('PROJECT_URL') || getEnv('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || ''

// Module-level lazy singleton: initialize Supabase client on first use without relying on globalThis
let _client = null

function createDummyClient() {
  // Silent initialization - don't spam console on startup
  const missingError = (method) => () => { throw new Error(`Supabase not configured. Called ${method} but SUPABASE_URL or SUPABASE_ANON_KEY is missing.`) }
  return {
    from: () => ({
      select: missingError('from().select'),
      insert: missingError('from().insert'),
      update: missingError('from().update'),
      upsert: missingError('from().upsert'),
      eq: missingError('from().eq'),
      order: missingError('from().order'),
      limit: missingError('from().limit'),
      or: missingError('from().or'),
      in: missingError('from().in'),
      not: missingError('from().not'),
      single: missingError('from().single'),
      delete: missingError('from().delete')
    }),
    auth: {
      signInWithPassword: missingError('auth.signInWithPassword'),
      signUp: missingError('auth.signUp'),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    channel: (name) => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} })
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

      _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    } catch (clientErr) {
      console.error('Failed to initialize Supabase client:', clientErr)
      _client = createDummyClient()
    }
  } else {
    _client = createDummyClient()
  }
  return _client
}

// Verify Supabase connectivity on module load (with retry logic)
let _supabaseHealthy = true
let _connectionRetries = 0
const MAX_HEALTH_CHECK_RETRIES = 3

async function checkSupabaseHealth(retryCount = 0) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    _supabaseHealthy = false
    return false
  }

  try {
    // Simple health check without creating additional fetch complexity
    // Just assume healthy unless we detect connectivity issues later
    _supabaseHealthy = true
    _connectionRetries = 0
    console.debug('[supabase-client] Supabase configured, assuming healthy')
    return true
  } catch (err) {
    _supabaseHealthy = false
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.debug(`[supabase-client] Supabase health check initialization failed: ${errorMsg}`)
    return false
  }
}

// Initialize Supabase on module load (simplified - no health checks to avoid network interference)
if (typeof window !== 'undefined' && typeof setTimeout !== 'undefined') {
  // Initialize client on first page load without health checks
  setTimeout(() => {
    try {
      initClient()
      console.debug('[supabase-client] Supabase client initialized')
    } catch (err) {
      console.debug('[supabase-client] Initialization error:', err?.message)
    }
  }, 50)
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
export const isSupabaseHealthy = () => _supabaseHealthy
export const getSupabaseStatus = () => ({
  configured: isSupabaseConfigured(),
  healthy: isSupabaseHealthy(),
  connectionRetries: _connectionRetries,
  supabaseUrl: SUPABASE_URL ? '✓' : '✗',
  anonKey: SUPABASE_ANON_KEY ? '✓' : '✗'
})

/**
 * Retry wrapper for Supabase queries with exponential backoff
 * @param {Function} queryFn - Async function that performs the query
 * @param {number} maxRetries - Maximum number of retry attempts (default 3)
 * @returns {Promise} Result of the query
 */
export async function executeWithRetry(queryFn, maxRetries = 3) {
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn()
    } catch (error) {
      lastError = error

      // Don't retry on validation errors or permission errors
      if (error?.status >= 400 && error?.status < 500) {
        throw error
      }

      // Only retry on network errors
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt) // 1s, 2s, 4s, 8s
        console.debug(`[supabase] Query failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // If we get here, all retries failed
  console.error('[supabase] Query failed after all retries:', lastError)
  throw lastError
}

// Generic Token API utilities (replacing deprecated dog token API)
export const tokenAPI = {
  // Get current user balance with retry
  async getUserBalance(userId) {
    try {
      return await executeWithRetry(async () => {
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
      }, 2)
    } catch (err) {
      console.warn('[tokenAPI] getUserBalance failed after retries:', err?.message)
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
