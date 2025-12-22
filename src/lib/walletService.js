import { supabase } from './supabaseClient'

export const walletService = {
  // Fetch all active currencies from the database
  async getAllCurrencies() {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('code, name, type, symbol, decimals, is_default')
        .eq('active', true)
        .order('type')
        .order('code')

      if (error) {
        console.warn('Error fetching currencies:', error)
        return []
      }

      return data || []
    } catch (err) {
      console.warn('Failed to fetch currencies from database:', err)
      return []
    }
  },

  // Fetch all currencies grouped by type
  async getCurrenciesGrouped() {
    try {
      const currencies = await this.getAllCurrencies()
      
      const grouped = {
        fiat: [],
        crypto: []
      }

      currencies.forEach(curr => {
        if (curr.type === 'crypto') {
          grouped.crypto.push(curr)
        } else if (curr.type === 'fiat') {
          grouped.fiat.push(curr)
        }
      })

      return grouped
    } catch (err) {
      console.warn('Failed to group currencies:', err)
      return { fiat: [], crypto: [] }
    }
  },

  // Fetch user wallets with currency details
  async getUserWalletsWithDetails(userId) {
    try {
      if (!userId || userId === 'null' || userId === 'undefined') {
        console.debug('getUserWalletsWithDetails: Invalid userId:', userId)
        return []
      }

      // Get current auth session to debug RLS issues
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.warn('Error checking auth session:', sessionError)
      }

      const authUserId = session?.user?.id
      console.debug('getUserWalletsWithDetails debug:', {
        userId,
        authUserId,
        sessionExists: !!session,
        userIdMatchesAuth: userId === authUserId
      })

      // Fetch directly from wallets table with currency join
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id, user_id, currency_code, balance, total_deposited, total_withdrawn, is_active, created_at, updated_at, account_number, currencies(name, type, symbol, decimals)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('currency_code')

      if (walletError) {
        console.warn('Error fetching user wallets with details:', walletError)
        console.warn('Error details:', {
          code: walletError.code,
          message: walletError.message,
          details: walletError.details,
          hint: walletError.hint
        })
        // Return empty array - user may not have wallets yet
        return []
      }

      console.debug('Wallets fetched successfully:', {
        count: walletData?.length || 0,
        walletCodes: walletData?.map(w => w.currency_code) || []
      })

      // Transform data to match expected format
      const wallets = (walletData || []).map(w => ({
        id: w.id,
        wallet_id: w.id,
        user_id: w.user_id,
        currency_code: w.currency_code,
        currency_name: w.currencies?.name || w.currency_code,
        currency_type: w.currencies?.type || 'fiat',
        symbol: w.currencies?.symbol,
        decimals: w.currencies?.decimals,
        balance: w.balance,
        total_deposited: w.total_deposited,
        total_withdrawn: w.total_withdrawn,
        is_active: w.is_active,
        created_at: w.created_at,
        updated_at: w.updated_at,
        account_number: w.account_number
      }))

      return wallets
    } catch (err) {
      console.warn('Failed to fetch user wallets with details:', err)
      return []
    }
  },

  // Create a wallet for a user and currency
  async createWallet(userId, currencyCode) {
    try {
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
        .select('id, user_id, currency_code, balance, total_deposited, total_withdrawn, is_active, created_at, updated_at, account_number, currencies(name, type, symbol, decimals)')
        .single()

      if (error) {
        console.warn(`Failed to create wallet for ${currencyCode}:`, error)
        return null
      }

      return {
        id: data.id,
        wallet_id: data.id,
        user_id: data.user_id,
        currency_code: data.currency_code,
        currency_name: data.currencies?.name || data.currency_code,
        currency_type: data.currencies?.type || 'fiat',
        symbol: data.currencies?.symbol,
        decimals: data.currencies?.decimals,
        balance: data.balance,
        total_deposited: data.total_deposited,
        total_withdrawn: data.total_withdrawn,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at,
        account_number: data.account_number
      }
    } catch (err) {
      console.warn('Error creating wallet:', err)
      return null
    }
  },

  // Ensure user has a PHP wallet via edge function
  async ensurePhpWallet(userId) {
    try {
      if (!userId || userId === 'null' || userId === 'undefined') {
        return null
      }

      // Call the edge function to ensure PHP wallet
      const { data, error } = await supabase.functions.invoke('ensure_user_wallets', {
        body: { user_id: userId }
      })

      if (error) {
        console.warn('Edge function error:', error)
        // Fallback: try to create locally
        return await this.createWallet(userId, 'PHP')
      }

      return data
    } catch (err) {
      console.warn('Error ensuring PHP wallet:', err)
      // Fallback: try to create locally
      return await this.createWallet(userId, 'PHP').catch(() => null)
    }
  },

  // Build complete wallet list with placeholders for missing currencies
  async buildCompleteWalletList(userId, filters = {}) {
    try {
      // Fetch all currencies and user wallets
      const [allCurrencies, userWallets] = await Promise.all([
        this.getAllCurrencies(),
        this.getUserWalletsWithDetails(userId)
      ])

      // Create a map of existing wallets
      const walletMap = {}
      userWallets.forEach(w => {
        walletMap[w.currency_code] = w
      })

      // Build complete list with placeholders
      const completeList = allCurrencies.map(currency => {
        if (walletMap[currency.code]) {
          return {
            ...walletMap[currency.code],
            is_placeholder: false
          }
        }

        // Return placeholder for missing wallet
        return {
          id: `placeholder-${currency.code}`,
          user_id: userId,
          wallet_id: null,
          currency_code: currency.code,
          currency_name: currency.name,
          currency_type: currency.type,
          symbol: currency.symbol,
          decimals: currency.decimals,
          balance: 0,
          total_deposited: 0,
          total_withdrawn: 0,
          is_active: true,
          created_at: null,
          updated_at: null,
          account_number: null,
          is_placeholder: true
        }
      })

      // Apply filters
      let filtered = completeList

      if (filters.type) {
        filtered = filtered.filter(w => w.currency_type === filters.type)
      }

      if (filters.currencyCode) {
        filtered = filtered.filter(w => w.currency_code === filters.currencyCode)
      }

      if (filters.search) {
        const query = filters.search.toLowerCase()
        filtered = filtered.filter(w => 
          w.currency_code.toLowerCase().includes(query) ||
          (w.currency_name && w.currency_name.toLowerCase().includes(query))
        )
      }

      return filtered
    } catch (err) {
      console.warn('Failed to build complete wallet list:', err)
      return []
    }
  },

  // Get symbol for currency (with fallback)
  getSymbol(currency) {
    if (!currency) return ''
    
    if (typeof currency === 'string') {
      // Just the code
      return null
    }
    
    if (currency.symbol) {
      return currency.symbol
    }
    
    // Fallback symbols if not in database
    const fallbackSymbols = {
      'PHP': '₱', 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
      'CNY': '¥', 'INR': '₹', 'AUD': '$', 'CAD': '$', 'CHF': 'CHF',
      'SEK': 'kr', 'NZD': '$', 'SGD': '$', 'HKD': '$', 'IDR': 'Rp',
      'MYR': 'RM', 'THB': '฿', 'VND': '₫', 'KRW': '₩', 'ZAR': 'R',
      'BRL': 'R$', 'MXN': '$', 'NOK': 'kr', 'DKK': 'kr', 'AED': 'د.إ',
      'BTC': 'BTC', 'ETH': 'ETH', 'XRP': 'XRP', 'ADA': 'ADA', 'SOL': 'SOL',
      'DOGE': 'DOGE', 'MATIC': 'MATIC', 'LINK': 'LINK', 'LTC': 'LTC', 'BCH': 'BCH',
      'USDT': 'USDT', 'USDC': 'USDC', 'BUSD': 'BUSD', 'SHIB': 'SHIB',
      'AVAX': 'AVAX', 'DOT': 'DOT'
    }
    
    return fallbackSymbols[currency.code || currency] || null
  }
}
