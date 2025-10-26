import { supabase } from './supabaseClient'

export const wisegcashAPI = {
  // ============ User Management ============
  async getOrCreateUser(email, fullName = 'User') {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (existingUser) {
      return existingUser
    }

    const { data: newUser, error } = await supabase
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

    if (error) throw error

    // Create default wallets for new user (PHP and USD)
    await this.createWallet(newUser.id, 'PHP')
    await this.createWallet(newUser.id, 'USD')

    return newUser
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
      .single()

    if (error) throw error
    return data
  },

  // ============ Wallet Management ============
  async createWallet(userId, currencyCode) {
    const { data, error } = await supabase
      .from('wallets')
      .upsert([
        {
          user_id: userId,
          currency_code: currencyCode,
          balance: 0
        }
      ])
      .select()
      .single()

    if (error && error.code !== '23505') throw error // 23505 is unique constraint
    return data
  },

  async getWallets(userId) {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
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
      return null // Wallet doesn't exist
    }
    if (error) throw error
    return data
  },

  async addFunds(userId, currencyCode, amount) {
    const wallet = await this.getWallet(userId, currencyCode)
    if (!wallet) await this.createWallet(userId, currencyCode)

    const newBalance = (wallet?.balance || 0) + amount

    const { data, error } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date() })
      .eq('user_id', userId)
      .eq('currency_code', currencyCode)
      .select()
      .single()

    if (error) throw error

    // Record transaction
    await this.createTransaction(userId, 'add_funds', amount, currencyCode, `Added ${amount} ${currencyCode}`)

    return data
  },

  // ============ Transfers ============
  async sendMoney(senderId, recipientEmail, senderCurrency, recipientCurrency, senderAmount, exchangeRate) {
    // Get recipient user
    const { data: recipientUser, error: recipientError } = await supabase
      .from('users')
      .select('*')
      .eq('email', recipientEmail)
      .single()

    if (recipientError) throw new Error('Recipient not found')

    const recipientAmount = senderAmount * exchangeRate
    const fee = senderAmount * 0.01 // 1% fee
    const totalDebit = senderAmount + fee

    // Check sender balance
    const senderWallet = await this.getWallet(senderId, senderCurrency)
    if (!senderWallet || senderWallet.balance < totalDebit) {
      throw new Error('Insufficient balance')
    }

    // Debit sender
    await supabase
      .from('wallets')
      .update({ balance: senderWallet.balance - totalDebit, updated_at: new Date() })
      .eq('user_id', senderId)
      .eq('currency_code', senderCurrency)

    // Credit recipient
    const recipientWallet = await this.getWallet(recipientUser.id, recipientCurrency)
    const newRecipientBalance = (recipientWallet?.balance || 0) + recipientAmount

    if (recipientWallet) {
      await supabase
        .from('wallets')
        .update({ balance: newRecipientBalance, updated_at: new Date() })
        .eq('user_id', recipientUser.id)
        .eq('currency_code', recipientCurrency)
    } else {
      await this.createWallet(recipientUser.id, recipientCurrency)
      await supabase
        .from('wallets')
        .update({ balance: recipientAmount, updated_at: new Date() })
        .eq('user_id', recipientUser.id)
        .eq('currency_code', recipientCurrency)
    }

    // Record transfer
    const refNumber = `TRN-${Date.now()}`
    const { data: transfer, error } = await supabase
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

    if (error) throw error

    // Record transactions
    await this.createTransaction(senderId, 'transfer_sent', senderAmount, senderCurrency, `Sent to ${recipientEmail}`, refNumber)
    await this.createTransaction(recipientUser.id, 'transfer_received', recipientAmount, recipientCurrency, `Received from ${recipientEmail}`, refNumber)

    return transfer
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
    // Check wallet balance
    const wallet = await this.getWallet(userId, currencyCode)
    if (!wallet || wallet.balance < amount) {
      throw new Error('Insufficient balance')
    }

    // Debit wallet
    await supabase
      .from('wallets')
      .update({ balance: wallet.balance - amount, updated_at: new Date() })
      .eq('user_id', userId)
      .eq('currency_code', currencyCode)

    // Record bill payment
    const txnId = `PAY-${Date.now()}`
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

    // Update bill status
    await supabase
      .from('bills')
      .update({ status: 'paid', updated_at: new Date() })
      .eq('id', billId)

    // Record transaction
    await this.createTransaction(userId, 'bill_payment', amount, currencyCode, `Bill payment`, txnId)

    return payment
  },

  async getBillPayments(userId) {
    const { data, error } = await supabase
      .from('bill_payments')
      .select(`*`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // ============ Transactions ============
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
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
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

    return data.rate
  },

  async updateExchangeRate(fromCurrency, toCurrency, rate) {
    const { data, error } = await supabase
      .from('currency_rates')
      .upsert([
        {
          from_currency: fromCurrency,
          to_currency: toCurrency,
          rate,
          last_updated: new Date()
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getAllExchangeRates() {
    const { data, error } = await supabase
      .from('currency_rates')
      .select('*')

    if (error) throw error
    return data || []
  }
}
