import { supabase } from './supabaseClient'

/**
 * Ensure user has a PHP wallet by calling the edge function
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Wallet data or null if error
 */
export async function ensureUserPhpWallet(userId) {
  try {
    if (!userId || userId === 'null' || userId === 'undefined') {
      console.warn('ensureUserPhpWallet: Invalid user ID')
      return null
    }

    const { data, error } = await supabase.functions.invoke('ensure_user_wallets', {
      body: { user_id: userId }
    })

    if (error) {
      console.error('ensureUserPhpWallet error:', error)
      return null
    }

    console.debug('PHP wallet ensured:', data)
    return data
  } catch (err) {
    console.error('ensureUserPhpWallet exception:', err)
    return null
  }
}

/**
 * Create a wallet for a specific currency
 * @param {string} userId - User UUID
 * @param {string} currencyCode - Currency code (e.g., 'USD', 'BTC')
 * @returns {Promise<Object|null>} Wallet data or null if error
 */
export async function createWalletForCurrency(userId, currencyCode) {
  try {
    if (!userId || !currencyCode) {
      console.warn('createWalletForCurrency: Missing userId or currencyCode')
      return null
    }

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
      if (error.code === '23505') {
        // Unique constraint violation - wallet already exists
        console.debug(`Wallet for ${currencyCode} already exists for user`)
        return null
      }
      console.error('createWalletForCurrency error:', error)
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
    console.error('createWalletForCurrency exception:', err)
    return null
  }
}

/**
 * Add funds to a wallet
 * @param {string} userId - User UUID
 * @param {string} currencyCode - Currency code
 * @param {number} amount - Amount to add
 * @returns {Promise<Object|null>} Updated wallet or null if error
 */
export async function addWalletFunds(userId, currencyCode, amount) {
  try {
    if (!userId || !currencyCode || !amount || amount <= 0) {
      console.warn('addWalletFunds: Invalid parameters')
      return null
    }

    // Get current balance
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .eq('currency_code', currencyCode)
      .single()

    if (fetchError) {
      console.error('addWalletFunds fetch error:', fetchError)
      return null
    }

    const currentBalance = Number(wallet.balance || 0)
    const newBalance = currentBalance + Number(amount)

    // Update balance
    const { data: updated, error: updateError } = await supabase
      .from('wallets')
      .update({
        balance: newBalance,
        total_deposited: currentBalance < 0 ? currentBalance + newBalance : Number(currentBalance) + Number(amount),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('currency_code', currencyCode)
      .select()
      .single()

    if (updateError) {
      console.error('addWalletFunds update error:', updateError)
      return null
    }

    return updated
  } catch (err) {
    console.error('addWalletFunds exception:', err)
    return null
  }
}

/**
 * Get all wallets for a user with currency details
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of wallet objects
 */
export async function getUserWallets(userId) {
  try {
    if (!userId || userId === 'null' || userId === 'undefined') {
      return []
    }

    const { data, error } = await supabase
      .from('wallets')
      .select('id, user_id, currency_code, balance, total_deposited, total_withdrawn, is_active, created_at, updated_at, account_number, currencies(name, type, symbol, decimals)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('currency_code')

    if (error) {
      console.error('getUserWallets error:', error)
      return []
    }

    return (data || []).map(w => ({
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
  } catch (err) {
    console.error('getUserWallets exception:', err)
    return []
  }
}
