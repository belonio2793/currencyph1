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

      // Fetch wallets without relationship join first (more reliable)
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id, user_id, currency_code, balance, total_deposited, total_withdrawn, is_active, created_at, updated_at, account_number, type')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('currency_code')

      if (walletError) {
        console.warn('Error fetching user wallets:', walletError)
        console.warn('Error details:', {
          code: walletError.code,
          message: walletError.message,
          details: walletError.details,
          hint: walletError.hint
        })
        // Return empty array - user may not have wallets yet
        return []
      }

      if (!walletData || walletData.length === 0) {
        console.debug('No wallets found for user:', userId)
        return []
      }

      console.debug('Wallets fetched successfully:', {
        count: walletData.length,
        walletCodes: walletData.map(w => w.currency_code),
        walletTypes: walletData.map(w => ({ code: w.currency_code, type: w.type }))
      })

      // Now fetch currency details separately
      const currencyCodes = [...new Set(walletData.map(w => w.currency_code))]
      let currencyMap = {}

      if (currencyCodes.length > 0) {
        const { data: currencyData, error: currencyError } = await supabase
          .from('currencies')
          .select('code, name, type, symbol, decimals')
          .in('code', currencyCodes)

        if (currencyError) {
          console.warn('Error fetching currencies:', currencyError)
        } else if (currencyData) {
          currencyData.forEach(c => {
            currencyMap[c.code] = c
          })
        }
      }

      // Transform data to match expected format
      const wallets = walletData.map(w => {
        const currencyInfo = currencyMap[w.currency_code]

        // Use wallet's type column directly (set via database trigger)
        // Fall back to currency info if type is missing, then default to fiat
        let currencyType = w.type || currencyInfo?.type || 'fiat'
        let currencyName = currencyInfo?.name || w.currency_code || 'Unknown'

        // Debug: Log wallets where type might be missing
        if (!w.type && !currencyInfo?.type) {
          console.warn(`Wallet ${w.currency_code} (${w.id}) has no type - defaulting to fiat`, {
            wallet_type_column: w.type,
            currency_info: currencyInfo
          })
        }

        return {
          id: w.id,
          wallet_id: w.id,
          user_id: w.user_id,
          currency_code: w.currency_code,
          currency_name: currencyName,
          currency_type: currencyType,
          symbol: currencyInfo?.symbol,
          decimals: currencyInfo?.decimals || 2,
          balance: w.balance,
          total_deposited: w.total_deposited,
          total_withdrawn: w.total_withdrawn,
          is_active: w.is_active,
          created_at: w.created_at,
          updated_at: w.updated_at,
          account_number: w.account_number
        }
      })

      console.debug('Wallets after transformation:', {
        count: wallets.length,
        walletDetails: wallets.map(w => ({
          code: w.currency_code,
          type: w.currency_type,
          dbType: walletData.find(wd => wd.currency_code === w.currency_code)?.type,
          id: w.id
        }))
      })

      return wallets
    } catch (err) {
      console.warn('Failed to fetch user wallets with details:', err)
      return []
    }
  },

  // Create a wallet for a user and currency
  async createWallet(userId, currencyCode) {
    try {
      // Input validation
      if (!userId || userId === 'null' || userId === 'undefined') {
        throw new Error('Invalid userId: ' + userId)
      }

      if (!currencyCode || typeof currencyCode !== 'string') {
        throw new Error('Invalid currencyCode: ' + currencyCode)
      }

      const normalizedCode = currencyCode.toUpperCase().trim()

      // Fetch currency details to get the correct type from the currencies table
      let currencyType = null
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
          // Currency not found in table
          console.error(`Currency ${normalizedCode} not found in currencies table:`, currencyError)
          throw new Error(`Currency ${normalizedCode} does not exist in the system. Please contact support.`)
        }

        if (!currencyData) {
          throw new Error(`Currency ${normalizedCode} not found in currencies table`)
        }

        // Verify currency is active
        if (currencyData.active === false) {
          throw new Error(`Currency ${normalizedCode} is not active. Please contact support.`)
        }

        // Get the type directly from the database (this is critical)
        currencyType = currencyData.type
        if (!currencyType || (currencyType !== 'fiat' && currencyType !== 'crypto' && currencyType !== 'wire')) {
          throw new Error(`Currency ${normalizedCode} has invalid type: ${currencyType}. Expected 'fiat', 'crypto', or 'wire'.`)
        }

        currencyName = currencyData.name || normalizedCode
        symbol = currencyData.symbol
        decimals = currencyData.decimals || 2

        console.debug(`Currency ${normalizedCode} validated: type=${currencyType}, name=${currencyName}, symbol=${symbol}`)
      } catch (err) {
        // Re-throw validation errors
        if (err.message.includes('does not exist') || err.message.includes('not active') || err.message.includes('invalid type')) {
          throw err
        }
        // For other errors, log and throw a generic message
        console.error(`Error validating currency ${normalizedCode}:`, err)
        throw new Error(`Failed to validate currency ${normalizedCode}: ${err.message}`)
      }

      // Create the wallet with the validated type
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
            type: currencyType  // Explicitly set type from currency table
          }
        ])
        .select('id, user_id, currency_code, balance, total_deposited, total_withdrawn, is_active, created_at, updated_at, account_number, type')
        .single()

      if (error) {
        console.error(`Failed to insert wallet for ${normalizedCode}:`, error)
        throw new Error(`Failed to create wallet: ${error.message}`)
      }

      if (!data) {
        throw new Error(`Wallet insertion returned no data for ${normalizedCode}`)
      }

      // Verify the wallet was created with the correct type
      if (data.type !== currencyType) {
        console.error(`Type mismatch for ${normalizedCode}: expected '${currencyType}', got '${data.type}'`)
        throw new Error(`Wallet type mismatch. Expected ${currencyType}, got ${data.type}`)
      }

      console.debug(`Wallet created successfully: ${normalizedCode} with type '${currencyType}'`)

      return {
        id: data.id,
        wallet_id: data.id,
        user_id: data.user_id,
        currency_code: data.currency_code,
        currency_name: currencyName,
        currency_type: data.type,
        symbol: symbol,
        decimals: decimals,
        balance: data.balance,
        total_deposited: data.total_deposited,
        total_withdrawn: data.total_withdrawn,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at,
        account_number: data.account_number
      }
    } catch (err) {
      console.error('Error creating wallet:', err.message)
      throw err
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
      'BTC': '₿', 'ETH': 'Ξ', 'XRP': 'XRP', 'ADA': 'ADA', 'SOL': 'SOL',
      'DOGE': 'Ð', 'MATIC': 'MATIC', 'LINK': 'LINK', 'LTC': 'Ł', 'BCH': 'BCH',
      'USDT': 'USDT', 'USDC': 'USDC', 'BUSD': 'BUSD', 'SHIB': 'SHIB',
      'AVAX': 'AVAX', 'DOT': 'DOT', 'BNB': 'BNB', 'XLM': 'XLM', 'TRX': 'TRX',
      'HBAR': 'HBAR', 'TON': 'TON', 'SUI': 'SUI', 'PYUSD': 'PYUSD', 'WLD': 'WLD',
      'XAUT': 'XAUT', 'PEPE': 'PEPE', 'HYPE': 'HYPE', 'ASTER': 'ASTER', 'ENA': 'ENA',
      'SKY': 'SKY'
    }
    
    return fallbackSymbols[currency.code || currency] || null
  }
}
