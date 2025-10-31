import { supabase } from './supabaseClient'

import { supabase } from './supabaseClient'
import { currencyAPI } from './currencyAPI'

// Helper: generate numeric account number of given length
const generateAccountNumber = (length = 12) => {
  const digits = '0123456789'
  let s = ''
  for (let i = 0; i < length; i++) s += digits[Math.floor(Math.random() * digits.length)]
  return s
}

// Helper: generate a unique account number by checking the wallets table
const generateUniqueAccountNumber = async (length = 12, attempts = 10) => {
  for (let i = 0; i < attempts; i++) {
    const candidate = generateAccountNumber(length)
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('id')
        .eq('account_number', candidate)
        .limit(1)

      if (error) {
        // If the query fails for some reason, log and retry
        console.warn('Account number uniqueness check failed, retrying', error)
        continue
      }

      if (!data || data.length === 0) return candidate
      // otherwise collision, try again
    } catch (err) {
      console.warn('Error checking account number uniqueness', err)
      continue
    }
  }
  throw new Error('Could not generate unique account number after multiple attempts')
}

export const wisegcashAPI = {
  // ============ User Management ============
  async getOrCreateUser(email, fullName = 'User') {
    try {
      // First, try to find user by email
      const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (existingUser) {
        console.log('User exists:', existingUser.id)
        return existingUser
      }

      // User doesn't exist, create one
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            email,
            full_name: fullName,
            country_code: 'PH',
            status: 'active'
          }
        ])
        .select()
        .single()

      if (insertError) {
        console.error('Error creating user:', insertError)
        throw insertError
      }

      console.log('User created successfully:', newUser.id)

      // Create default wallets for new user (PHP + USD) using the function
      try {
        await supabase.rpc('create_default_wallets', { p_user_id: newUser.id })
        console.log('Default wallets created via RPC for user:', newUser.id)
      } catch (rpcErr) {
        console.warn('RPC default wallets creation failed, falling back to direct insert:', rpcErr)
        try {
          await supabase
            .from('wallets')
            .insert([
              {
                user_id: newUser.id,
                currency_code: 'PHP',
                balance: 0,
                total_deposited: 0,
                total_withdrawn: 0,
                is_active: true
              },
              {
                user_id: newUser.id,
                currency_code: 'USD',
                balance: 0,
                total_deposited: 0,
                total_withdrawn: 0,
                is_active: true
              }
            ])
          console.log('Default wallets created manually for user:', newUser.id)
        } catch (fallbackErr) {
          console.error('Failed to create default wallets even with fallback:', fallbackErr)
        }
      }

      return newUser
    } catch (err) {
      console.error('getOrCreateUser error:', err)
      throw err
    }
  },

  async getUserById(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  },

  async updateUserProfile(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', userId)
      .select()
      .maybeSingle()

    if (error) throw error
    return data
  },

  async searchUsers(query) {
    if (!query || query.trim().length < 2) return []

    const searchTerm = query.toLowerCase().trim()
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone_number, profile_picture_url, status, created_at, country_code')
      .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    return data || []
  },

  // ============ Wallet Management ============
  async createWallet(userId, currencyCode) {
    if (!userId || userId === 'null' || userId === 'undefined') {
      throw new Error('Invalid userId: ' + userId)
    }

    // Guest-local users cannot have wallets
    if (userId.includes('guest-local')) {
      throw new Error('Guest accounts cannot create wallets. Please sign up to create wallets.')
    }

    // Try to verify user exists, handle gracefully if not found
    try {
      const { data: userExists, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (userCheckError && userCheckError.code !== 'PGRST116') {
        console.warn('Warning checking user existence:', userCheckError)
      }
    } catch (err) {
      console.warn('Could not verify user, but will attempt wallet creation anyway:', err)
    }

    // Check if wallet already exists
    const { data: existing } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('currency_code', currencyCode)
      .single()

    if (existing) {
      return existing
    }

    // Generate a unique account number for the wallet
    const accountNumber = await generateUniqueAccountNumber(12, 12)

    // Create new wallet
    const { data, error } = await supabase
      .from('wallets')
      .insert([
        {
          user_id: userId,
          currency_code: currencyCode,
          balance: 0,
          total_deposited: 0,
          total_withdrawn: 0,
          is_active: true,
          account_number: accountNumber
        }
      ])
      .select()
      .single()

    if (error) {
      const errorInfo = {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        status: error.status,
        statusText: error.statusText,
        userId,
        currencyCode,
        fullError: JSON.stringify(error)
      }
      console.error('Wallet creation failed:', errorInfo)
      throw new Error(`Wallet creation failed: ${error.message || error.code || 'Unknown error'}`)
    }
    return data
  },

  async getWallets(userId) {
    if (!userId || userId === 'null' || userId === 'undefined') return []

    // Try querying the wallets table directly (more reliable than views for real-time data)
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('currency_code')

    // If wallets table query fails, try the summary view as fallback
    if (error) {
      console.warn('Error querying wallets table, trying summary view:', error)
      const { data: summaryData, error: summaryError } = await supabase
        .from('user_wallets_summary')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('currency_code')

      if (summaryError) throw summaryError
      return summaryData || []
    }

    return data || []
  },

  async getWallet(userId, currencyCode) {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('currency_code', currencyCode)
      .single()

    if (error && error.code === 'PGRST116') {
      return null
    }
    if (error) throw error
    return data
  },

  async addFunds(userId, currencyCode, amount) {
    if (!userId || !currencyCode || !amount || amount <= 0) {
      throw new Error('Invalid parameters for addFunds')
    }

    let wallet = await this.getWallet(userId, currencyCode)
    if (!wallet) {
      wallet = await this.createWallet(userId, currencyCode)
    }

    try {
      const { data, error } = await supabase.rpc('record_wallet_transaction', {
        p_user_id: userId,
        p_wallet_id: wallet.id,
        p_transaction_type: 'deposit',
        p_amount: amount,
        p_currency_code: currencyCode,
        p_description: `Deposit of ${amount} ${currencyCode}`
      })

      if (error) throw error
      return data
    } catch (err) {
      console.error('Add funds error:', err)
      throw err
    }
  },

  async withdrawFunds(userId, currencyCode, amount) {
    if (!userId || !currencyCode || !amount || amount <= 0) {
      throw new Error('Invalid parameters for withdrawFunds')
    }

    const wallet = await this.getWallet(userId, currencyCode)
    if (!wallet) throw new Error('Wallet not found')
    if (wallet.balance < amount) throw new Error('Insufficient balance')

    try {
      const { data, error } = await supabase.rpc('record_wallet_transaction', {
        p_user_id: userId,
        p_wallet_id: wallet.id,
        p_transaction_type: 'withdrawal',
        p_amount: amount,
        p_currency_code: currencyCode,
        p_description: `Withdrawal of ${amount} ${currencyCode}`
      })

      if (error) throw error
      return data
    } catch (err) {
      console.error('Withdraw funds error:', err)
      throw err
    }
  },

  // ============ Transfers ============
  async sendMoney(senderId, recipientEmail, senderCurrency, recipientCurrency, senderAmount, exchangeRate) {
    if (!senderId || !recipientEmail || !senderAmount || !exchangeRate) {
      throw new Error('Invalid parameters for sendMoney')
    }

    const { data: recipientUser, error: recipientError } = await supabase
      .from('users')
      .select('*')
      .eq('email', recipientEmail)
      .single()

    if (recipientError) throw new Error('Recipient not found')

    const recipientAmount = senderAmount * exchangeRate
    const fee = senderAmount * 0.01
    const totalDebit = senderAmount + fee

    const senderWallet = await this.getWallet(senderId, senderCurrency)
    if (!senderWallet || senderWallet.balance < totalDebit) {
      throw new Error('Insufficient balance')
    }

    let recipientWallet = await this.getWallet(recipientUser.id, recipientCurrency)
    if (!recipientWallet) {
      recipientWallet = await this.createWallet(recipientUser.id, recipientCurrency)
    }

    const refNumber = `TRN-${Date.now()}`

    try {
      // Debit sender with fee
      await supabase.rpc('record_wallet_transaction', {
        p_user_id: senderId,
        p_wallet_id: senderWallet.id,
        p_transaction_type: 'transfer_out',
        p_amount: senderAmount,
        p_currency_code: senderCurrency,
        p_description: `Transfer to ${recipientEmail} (${recipientCurrency})`,
        p_reference_id: refNumber
      })

      // Debit fee
      await supabase.rpc('record_wallet_transaction', {
        p_user_id: senderId,
        p_wallet_id: senderWallet.id,
        p_transaction_type: 'rake',
        p_amount: fee,
        p_currency_code: senderCurrency,
        p_description: `Transfer fee`,
        p_reference_id: refNumber
      })

      // Credit recipient
      await supabase.rpc('record_wallet_transaction', {
        p_user_id: recipientUser.id,
        p_wallet_id: recipientWallet.id,
        p_transaction_type: 'transfer_in',
        p_amount: recipientAmount,
        p_currency_code: recipientCurrency,
        p_description: `Received from ${recipientEmail}`,
        p_reference_id: refNumber
      })

      // Record transfer if transfers table exists
      const { data: transfer } = await supabase
        .from('transfers')
        .insert([
          {
            sender_id: senderId,
            recipient_id: recipientUser.id,
            sender_currency: senderCurrency,
            recipient_currency: recipientCurrency,
            sender_amount: senderAmount,
            recipient_amount: recipientAmount,
            exchange_rate: exchangeRate,
            fee,
            status: 'completed',
            reference_number: refNumber
          }
        ])
        .select()
        .single()

      return transfer || { reference_number: refNumber, sender_amount: senderAmount, recipient_amount: recipientAmount }
    } catch (err) {
      console.error('Send money error:', err)
      throw err
    }
  },

  async getTransfers(userId) {
    const { data, error } = await supabase
      .from('transfers')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // ============ Beneficiaries ============
  async addBeneficiary(userId, beneficiaryData) {
    const { data, error } = await supabase
      .from('beneficiaries')
      .insert([
        {
          user_id: userId,
          ...beneficiaryData
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // ============ Exchange rate helpers ============
  async getExchangeRate(from, to) {
    if (!from || !to) return null
    if (from === to) return 1

    try {
      // Try DB first (currency_rates table)
      const { data, error } = await supabase
        .from('currency_rates')
        .select('rate')
        .eq('from_currency', from)
        .eq('to_currency', to)
        .maybeSingle()

      if (!error && data && typeof data.rate !== 'undefined') {
        return Number(data.rate)
      }
    } catch (e) {
      // ignore and fallback
    }

    try {
      const conv = await currencyAPI.convert(1, from, to)
      if (conv && conv.rate) return Number(conv.rate)
    } catch (e) {
      console.warn('Failed to compute exchange rate via currencyAPI', e)
    }

    return null
  },

  async getAllExchangeRates() {
    try {
      const { data, error } = await supabase
        .from('currency_rates')
        .select('from_currency,to_currency,rate')

      if (!error && data) return data
    } catch (e) {
      console.warn('Failed to fetch currency_rates from DB', e)
    }

    // Fallback: build from currencyAPI global rates
    try {
      const globalRates = await currencyAPI.getGlobalRates()
      const arr = []
      const codes = Object.keys(globalRates || {})
      codes.forEach(from => {
        codes.forEach(to => {
          if (from === to) return
          const rateFrom = globalRates[from]?.rate || 0
          const rateTo = globalRates[to]?.rate || 0
          if (rateFrom > 0 && rateTo > 0) {
            arr.push({ from_currency: from, to_currency: to, rate: rateTo / rateFrom })
          }
        })
      })
      return arr
    } catch (e) {
      console.warn('Fallback building exchange rates failed', e)
      return []
    }
  },

  // ============ Account number utilities ============
  async assignAccountNumberToWallet(walletId, length = 12) {
    if (!walletId) throw new Error('walletId is required')
    const accountNumber = await generateUniqueAccountNumber(length, 12)
    const { data, error } = await supabase
      .from('wallets')
      .update({ account_number: accountNumber })
      .eq('id', walletId)
      .select()
      .single()

    if (error) {
      console.error('Failed assigning account number to wallet', { walletId, error })
      throw error
    }
    return data
  },

  // Ensure all wallets for a user have account numbers. Returns the up-to-date wallets array.
  async ensureWalletsHaveAccountNumbers(userId) {
    if (!userId) return []
    const wallets = await this.getWallets(userId)
    const updated = []
    for (const w of wallets) {
      if (!w.account_number) {
        try {
          const newW = await this.assignAccountNumberToWallet(w.id)
          updated.push(newW)
        } catch (err) {
          console.warn('Could not assign account number to wallet', w.id, err)
          updated.push(w)
        }
      } else {
        updated.push(w)
      }
    }
    return updated
  }
}
