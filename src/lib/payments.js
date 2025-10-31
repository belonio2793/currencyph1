import { supabase } from './supabaseClient'

export const wisegcashAPI = {
  // ============ User Management ============
  async getOrCreateUser(email, fullName = 'User') {
    try {
      const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error checking for existing user:', selectError)
        throw selectError
      }

      if (existingUser) {
        return existingUser
      }

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
          // Fallback: create manually (but this will skip the user check we added)
          // So we need to bypass it or handle it differently
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

    // Verify user exists in the database before creating wallet
    const { data: userExists, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (userCheckError || !userExists) {
      throw new Error('User account not found. Please try signing out and logging back in.')
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
          is_active: true
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

    const { data, error } = await supabase
      .from('user_wallets_summary')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('currency_code')

    if (error) throw error
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

  async getBeneficiaries(userId) {
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('user_id', userId)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async updateBeneficiary(beneficiaryId, updates) {
    const { data, error } = await supabase
      .from('beneficiaries')
      .update(updates)
      .eq('id', beneficiaryId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteBeneficiary(beneficiaryId) {
    const { error } = await supabase
      .from('beneficiaries')
      .delete()
      .eq('id', beneficiaryId)

    if (error) throw error
    return true
  },

  // ============ Bills ============
  async createBill(userId, billData) {
    const { data, error } = await supabase
      .from('bills')
      .insert([
        {
          user_id: userId,
          ...billData,
          reference_number: `BILL-${Date.now()}`
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getBills(userId) {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async payBill(billId, userId, amount, currencyCode = 'PHP') {
    const wallet = await this.getWallet(userId, currencyCode)
    if (!wallet || wallet.balance < amount) {
      throw new Error('Insufficient balance')
    }

    const txnId = `PAY-${Date.now()}`

    try {
      await supabase.rpc('record_wallet_transaction', {
        p_user_id: userId,
        p_wallet_id: wallet.id,
        p_transaction_type: 'purchase',
        p_amount: amount,
        p_currency_code: currencyCode,
        p_description: `Bill payment`,
        p_reference_id: txnId
      })

      const { data: payment, error } = await supabase
        .from('bill_payments')
        .insert([
          {
            bill_id: billId,
            user_id: userId,
            amount,
            currency_code: currencyCode,
            transaction_id: txnId,
            status: 'completed'
          }
        ])
        .select()
        .single()

      if (error) throw error

      await supabase
        .from('bills')
        .update({ status: 'paid', updated_at: new Date() })
        .eq('id', billId)

      return payment
    } catch (err) {
      console.error('Pay bill error:', err)
      throw err
    }
  },

  async getBillPayments(userId) {
    const { data, error } = await supabase
      .from('bill_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // ============ Wallet Transactions (NEW) ============
  async getWalletTransactions(userId, limit = 50) {
    if (!userId || userId === 'null' || userId === 'undefined') return []

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  async getWalletTransactionsByType(userId, type, limit = 50) {
    if (!userId || userId === 'null' || userId === 'undefined') return []

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  async getWalletTransactionsByCurrency(userId, currencyCode, limit = 50) {
    if (!userId || userId === 'null' || userId === 'undefined') return []

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('currency_code', currencyCode)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  // ============ Legacy Transactions (for compatibility) ============
  async createTransaction(userId, transactionType, amount, currencyCode, description, referenceNumber = null) {
    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          transaction_type: transactionType,
          amount,
          currency_code: currencyCode,
          description,
          reference_number: referenceNumber || `TXN-${Date.now()}`,
          status: 'completed'
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getTransactions(userId, limit = 20) {
    if (!userId || userId === 'null' || userId === 'undefined') return []

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  // ============ Currencies (NEW) ============
  async getCurrencies(activeOnly = true) {
    let query = supabase.from('currencies').select('*')
    
    if (activeOnly) {
      query = query.eq('active', true)
    }

    const { data, error } = await query.order('is_default', { ascending: false }).order('code')

    if (error) throw error
    return data || []
  },

  async getCurrencyByCode(code) {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('code', code)
      .single()

    if (error && error.code === 'PGRST116') return null
    if (error) throw error
    return data
  },

  // ============ Exchange Rates ============
  async getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return 1

    const { data, error } = await supabase
      .from('currency_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .single()

    if (error) {
      console.warn(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`)
      return null
    }
    if (error) throw error
    return data?.rate || null
  },

  async getExchangeRates(currencies = []) {
    if (!currencies.length) return []

    const { data, error } = await supabase
      .from('currency_rates')
      .select('*')
      .in('from_currency', currencies)

    if (error) throw error
    return data || []
  }
}
