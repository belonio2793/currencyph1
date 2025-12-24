import { supabase } from './supabaseClient'
import { currencyAPI as currencyConverter } from './currencyAPI'
import { walletEventBus } from './walletEventBus'

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

export const currencyAPI = {
  // ============ User Management ============
  async getOrCreateUser(email, fullName = 'User', userId = null) {
    const maxRetries = 3
    let lastError = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // First, try to find user by email
        const { data: existingUser, error: selectError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle()

        if (selectError && selectError.code !== 'PGRST116') {
          throw selectError
        }

        if (existingUser) {
          console.log('User exists:', existingUser.id)
          // Ensure profiles exist even for existing users
          this.ensureAllProfiles(existingUser.id, email, fullName).catch(() => {})
          return existingUser
        }

        // User doesn't exist, create one
        const insertData = {
          email,
          full_name: fullName,
          country_code: 'PH',
          status: 'active'
        }
        if (userId) insertData.id = userId

        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([insertData])
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        console.log('User created successfully:', newUser.id)

        // Ensure all domain-specific profiles exist
        this.ensureAllProfiles(newUser.id, email, fullName).catch(() => {})

        // Create default wallets for all active currencies using the function (non-blocking)
        supabase.rpc('create_default_wallets', { p_user_id: newUser.id })
          .then(() => console.log('Default wallets created for user:', newUser.id))
          .catch(rpcErr => console.warn('RPC default wallets creation failed:', rpcErr))

        return newUser
      } catch (err) {
        lastError = err
        console.warn(`getOrCreateUser attempt ${attempt + 1}/${maxRetries} failed:`, err)

        // Don't retry on non-network errors
        if (err.code === 'PGRST001' || err.code === '23505') {
          break
        }

        // Exponential backoff before retry
        if (attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    console.error('getOrCreateUser failed after retries:', lastError)
    return null
  },

  async ensureAllProfiles(userId, email, fullName) {
    if (!userId || userId.includes('guest-local')) return

    // 1. Ride Profile
    supabase.from('ride_profiles').upsert({
      user_id: userId,
      full_name: fullName,
      role: 'rider',
      status: 'offline',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).catch(e => console.warn('ride_profiles upsert failed:', e))

    // 2. Planning User
    supabase.from('planning_users').upsert({
      user_id: userId,
      email: email,
      name: fullName,
      status: 'active',
      role: 'member',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).catch(e => console.warn('planning_users upsert failed:', e))

    // 3. Generic Profile (if profiles table exists)
    supabase.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' }).catch(e => console.warn('profiles upsert failed:', e))
  },

  async ensureUserWallets(userId) {
    if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
      return []
    }

    try {
      // Call RPC to ensure user has wallets for all active currencies
      const { data, error } = await supabase
        .rpc('ensure_user_wallets', { p_user_id: userId })

      if (error) {
        // If function doesn't exist (404), silently continue - it may not be deployed
        if (error.code === 'PGRST202') {
          console.debug('ensure_user_wallets RPC not available, skipping wallet initialization')
          return []
        }
        console.warn('Error ensuring user wallets:', error)
        return []
      }

      console.log('Ensured wallets for user:', userId, 'Created:', data?.length || 0, 'new wallets')
      return data || []
    } catch (err) {
      console.warn('Failed to ensure user wallets:', err)
      return []
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

    if (!currencyCode || typeof currencyCode !== 'string') {
      throw new Error('Invalid currencyCode: ' + currencyCode)
    }

    // Guest-local users cannot have wallets
    if (userId.includes('guest-local')) {
      throw new Error('Guest accounts cannot create wallets. Please sign up to create wallets.')
    }

    const normalizedCode = currencyCode.toUpperCase().trim()

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
      .eq('currency_code', normalizedCode)
      .single()

    if (existing) {
      console.debug(`Wallet already exists for ${normalizedCode}`)
      return existing
    }

    // Fetch currency details to get the correct type from currencies table
    let walletType = null
    let currencyName = normalizedCode
    let symbol = null
    let decimals = 2

    try {
      const { data: currencyData, error: currencyError } = await supabase
        .from('currencies')
        .select('code, name, type, symbol, decimals, active')
        .eq('code', normalizedCode)
        .single()

      if (currencyError) {
        console.error(`Currency ${normalizedCode} not found in currencies table:`, currencyError)
        throw new Error(`Currency ${normalizedCode} does not exist in the system. Please contact support.`)
      }

      if (!currencyData) {
        throw new Error(`Currency ${normalizedCode} not found`)
      }

      // Verify currency is active
      if (currencyData.active === false) {
        throw new Error(`Currency ${normalizedCode} is not active. Please contact support.`)
      }

      // Get the type from the database (critical for fiat vs crypto distinction)
      walletType = currencyData.type
      if (!walletType || (walletType !== 'fiat' && walletType !== 'crypto' && walletType !== 'wire')) {
        throw new Error(`Currency ${normalizedCode} has invalid type: ${walletType}. Expected 'fiat', 'crypto', or 'wire'.`)
      }

      currencyName = currencyData.name || normalizedCode
      symbol = currencyData.symbol
      decimals = currencyData.decimals || 2

      console.debug(`Currency ${normalizedCode} validated: type=${walletType}, name=${currencyName}`)
    } catch (err) {
      if (err.message.includes('does not exist') || err.message.includes('not active') || err.message.includes('invalid type')) {
        throw err
      }
      console.error(`Error validating currency ${normalizedCode}:`, err)
      throw new Error(`Failed to validate currency ${normalizedCode}: ${err.message}`)
    }

    // Generate a unique account number for the wallet
    const accountNumber = await generateUniqueAccountNumber(12, 12)

    // Create new wallet with validated type
    const { data, error } = await supabase
      .from('wallets')
      .insert([
        {
          user_id: userId,
          currency_code: normalizedCode,
          balance: 0,
          total_deposited: 0,
          total_withdrawn: 0,
          is_active: true,
          account_number: accountNumber,
          type: walletType  // Explicitly set type from currency table
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
        currencyCode: normalizedCode,
        expectedType: walletType,
        fullError: JSON.stringify(error)
      }
      console.error('Wallet creation failed:', errorInfo)
      throw new Error(`Wallet creation failed: ${error.message || error.code || 'Unknown error'}`)
    }

    if (!data) {
      throw new Error(`Wallet insertion returned no data for ${normalizedCode}`)
    }

    // Verify the wallet was created with the correct type
    if (data.type !== walletType) {
      console.error(`Type mismatch for ${normalizedCode}: expected '${walletType}', got '${data.type}'`)
      throw new Error(`Wallet type mismatch. Expected ${walletType}, got ${data.type}`)
    }

    console.debug(`Wallet created successfully for ${normalizedCode} with type '${walletType}'`)
    return data
  },

  async getWallets(userId) {
    if (!userId || userId === 'null' || userId === 'undefined') return []

    // Optimize: Only fetch needed columns instead of all columns
    // Try querying the wallets table directly (more reliable than views for real-time data)
    const { data, error } = await supabase
      .from('wallets')
      .select('id,user_id,currency_code,balance,total_deposited,total_withdrawn,is_active,account_number,created_at,updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('currency_code')

    // If wallets table query fails, try the summary view as fallback
    if (error) {
      console.warn('Error querying wallets table, trying summary view:', error)
      const { data: summaryData, error: summaryError } = await supabase
        .from('user_wallets_summary')
        .select('id,user_id,currency_code,balance,total_deposited,total_withdrawn,is_active,account_number')
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

    // Get recipient user
    const { data: recipientUser, error: recipientError } = await supabase
      .from('users')
      .select('*')
      .eq('email', recipientEmail)
      .single()

    if (recipientError) throw new Error('Recipient not found')

    // Ensure wallets exist for both users
    const senderWallet = await this.getWallet(senderId, senderCurrency)
    if (!senderWallet) throw new Error('Sender wallet not found')

    let recipientWallet = await this.getWallet(recipientUser.id, recipientCurrency)
    if (!recipientWallet) {
      recipientWallet = await this.createWallet(recipientUser.id, recipientCurrency)
    }

    try {
      // Use atomic transfer function with fee handling and house syndication
      // This function atomically:
      // 1. Debits sender wallet (transfer amount + 1% fee)
      // 2. Credits recipient wallet (converted amount)
      // 3. Syndicates fee to platform house wallet
      // 4. Records all transactions in wallet_transactions (immutable ledger)
      const { data, error } = await supabase.rpc('execute_transfer_atomic', {
        p_from_user_id: senderId,
        p_to_user_id: recipientUser.id,
        p_from_wallet_id: senderWallet.id,
        p_to_wallet_id: recipientWallet.id,
        p_from_currency: senderCurrency,
        p_to_currency: recipientCurrency,
        p_from_amount: parseFloat(senderAmount),
        p_exchange_rate: parseFloat(exchangeRate),
        p_fee_percentage: 1.0,
        p_description: `Transfer to ${recipientEmail} (${recipientCurrency})`
      })

      if (error) {
        console.error('Transfer RPC error:', error)
        throw new Error(error.message || 'Transfer failed')
      }

      if (!data || !data.success) {
        throw new Error(data?.error_message || 'Transfer failed')
      }

      return {
        transfer_id: data.transfer_id,
        reference_number: data.reference_number,
        sender_amount: senderAmount,
        recipient_amount: (senderAmount * exchangeRate).toFixed(2),
        fee_amount: data.fee_amount,
        status: 'completed'
      }
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

    const fromCode = from.toUpperCase()
    const toCode = to.toUpperCase()

    try {
      // Fetch from public.pairs (unified rate table for all currencies and cryptos)
      const { data, error } = await supabase
        .from('pairs')
        .select('rate')
        .eq('from_currency', fromCode)
        .eq('to_currency', toCode)
        .maybeSingle()

      if (!error && data && typeof data.rate !== 'undefined') {
        const rate = Number(data.rate)
        // Validate rate is not 0.00 or NaN
        if (isFinite(rate) && rate > 0) {
          console.debug(`Rate from public.pairs: ${fromCode}/${toCode} = ${rate}`)
          return rate
        } else {
          console.warn(`Invalid rate from public.pairs for ${fromCode}/${toCode}: ${rate}`)
        }
      }
    } catch (e) {
      console.warn('Error fetching from public.pairs:', e.message)
    }

    try {
      // Fallback: Try converter API
      const conv = await currencyConverter.convert(1, fromCode, toCode)
      if (conv && conv.rate) {
        const rate = Number(conv.rate)
        // Validate rate is not 0.00 or NaN
        if (isFinite(rate) && rate > 0) {
          console.debug(`Rate from converter: ${fromCode}/${toCode} = ${rate}`)
          return rate
        } else {
          console.warn(`Invalid rate from converter for ${fromCode}/${toCode}: ${rate}`)
        }
      }
    } catch (e) {
      console.warn('Failed to compute exchange rate via currencyAPI', e.message)
    }

    console.warn(`Could not fetch rate for ${fromCode}/${toCode} from any source`)
    return null
  },

  async getAllExchangeRates() {
    try {
      const { data, error } = await supabase
        .from('pairs')
        .select('from_currency,to_currency,rate')

      if (!error && data) return data
    } catch (e) {
      console.warn('Failed to fetch pairs from DB', e)
    }

    // Fallback: build from currencyAPI global rates
    try {
      const globalRates = await currencyConverter.getGlobalRates()
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
  },

  // ============ Transactions =========
  async getTransactions(userId, limit = 100) {
    if (!userId) return []
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('getTransactions failed:', err)
      return []
    }
  },

  // ============ Loans =========
  async getLoans(userId) {
    if (!userId) return []
    try {
      // Optimize: Only fetch needed columns
      const { data, error } = await supabase
        .from('loans')
        .select('id,user_id,loan_type,status,remaining_balance,total_owed,currency_code,created_at,updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('getLoans failed:', err)
      return []
    }
  },

  // ============ Beneficiaries =========
  async getBeneficiaries(userId) {
    if (!userId) return []
    try {
      // Try to fetch with recipient_id first (after migration is applied)
      try {
        const { data, error } = await supabase
          .from('beneficiaries')
          .select('id,user_id,recipient_id,recipient_email,recipient_phone,recipient_name,bank_account,bank_name,country_code,relationship,is_favorite,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (!error && data) return data
      } catch (err) {
        console.debug('getBeneficiaries with recipient_id failed, trying fallback:', err.message)
      }

      // Fallback: Fetch without recipient_id if column doesn't exist
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('id,user_id,recipient_email,recipient_phone,recipient_name,bank_account,bank_name,country_code,relationship,is_favorite,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('getBeneficiaries failed:', err)
      return []
    }
  },

  // ============ Bills =========
  async getBills(userId) {
    if (!userId) return []
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('getBills failed:', err)
      return []
    }
  },

  async createBill(userId, billForm) {
    if (!userId) throw new Error('userId is required')
    const payload = {
      user_id: userId,
      biller_category: billForm.biller_category,
      biller_name: billForm.biller_name,
      account_number: billForm.account_number,
      status: 'pending'
    }
    const { data, error } = await supabase
      .from('bills')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async payBill(billId, userId, amount, currencyCode = 'PHP') {
    if (!billId || !userId || !amount || amount <= 0) throw new Error('Invalid parameters for payBill')

    // Ensure wallet exists and has funds
    const wallet = await this.getWallet(userId, currencyCode)
    if (!wallet) throw new Error(`No ${currencyCode} wallet found`)
    if (Number(wallet.balance) < Number(amount)) throw new Error('Insufficient balance')

    // 1) Record wallet withdrawal
    await supabase.rpc('record_wallet_transaction', {
      p_user_id: userId,
      p_wallet_id: wallet.id,
      p_transaction_type: 'withdrawal',
      p_amount: amount,
      p_currency_code: currencyCode,
      p_description: `Bill payment for ${billId}`,
      p_reference_id: billId
    })

    // 2) Mark bill as paid (if table exists)
    try {
      await supabase
        .from('bills')
        .update({ status: 'paid', paid_at: new Date() })
        .eq('id', billId)
    } catch (e) {
      console.warn('Failed to update bill status (continuing):', e)
    }

    return { bill_id: billId, amount, currency: currencyCode, status: 'paid' }
  }
}
