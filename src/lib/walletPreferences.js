import { supabase } from './supabaseClient'

const PREFERENCES_KEY = 'wallet_display_preferences'

/**
 * Get wallet display preferences for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of currency codes to display
 */
export async function getWalletDisplayPreferences(userId) {
  try {
    if (!userId || userId === 'null' || userId === 'undefined') {
      return ['PHP'] // Default to PHP only
    }

    // Try to fetch from preferences table
    const { data, error } = await supabase
      .from('user_preferences')
      .select('wallet_display_currencies')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.warn('Error fetching preferences:', error)
      return ['PHP']
    }

    if (data && data.wallet_display_currencies) {
      return data.wallet_display_currencies
    }

    // Fall back to localStorage if preferences table doesn't exist
    const stored = localStorage.getItem(`${PREFERENCES_KEY}_${userId}`)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.warn('Failed to parse stored preferences')
        return ['PHP']
      }
    }

    return ['PHP']
  } catch (err) {
    console.warn('Error getting wallet preferences:', err)
    return ['PHP']
  }
}

/**
 * Set wallet display preferences for a user
 * @param {string} userId - User UUID
 * @param {Array<string>} currencyCodes - Array of currency codes to display
 * @returns {Promise<boolean>} Success status
 */
export async function setWalletDisplayPreferences(userId, currencyCodes) {
  try {
    if (!userId || userId === 'null' || userId === 'undefined') {
      return false
    }

    // Ensure PHP is always included
    const codes = ['PHP', ...currencyCodes.filter(c => c !== 'PHP')]

    // Try to update preferences table
    const { error: upsertError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        wallet_display_currencies: codes,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (upsertError) {
      // If table doesn't exist, fall back to localStorage
      if (upsertError.code === 'PGRST116' || upsertError.message.includes('not found')) {
        localStorage.setItem(`${PREFERENCES_KEY}_${userId}`, JSON.stringify(codes))
        return true
      }
      console.warn('Error saving preferences:', upsertError)
      localStorage.setItem(`${PREFERENCES_KEY}_${userId}`, JSON.stringify(codes))
      return true
    }

    // Also save to localStorage as backup
    localStorage.setItem(`${PREFERENCES_KEY}_${userId}`, JSON.stringify(codes))
    return true
  } catch (err) {
    console.warn('Error setting wallet preferences:', err)
    // Fall back to localStorage
    const codes = ['PHP', ...currencyCodes.filter(c => c !== 'PHP')]
    localStorage.setItem(`${PREFERENCES_KEY}_${userId}`, JSON.stringify(codes))
    return true
  }
}

/**
 * Add a currency to wallet display preferences
 * @param {string} userId - User UUID
 * @param {string} currencyCode - Currency code to add
 * @returns {Promise<Array>} Updated preferences
 */
export async function addWalletDisplayCurrency(userId, currencyCode) {
  const current = await getWalletDisplayPreferences(userId)
  if (!current.includes(currencyCode)) {
    const updated = [...current, currencyCode]
    await setWalletDisplayPreferences(userId, updated)
    return updated
  }
  return current
}

/**
 * Remove a currency from wallet display preferences
 * @param {string} userId - User UUID
 * @param {string} currencyCode - Currency code to remove
 * @returns {Promise<Array>} Updated preferences
 */
export async function removeWalletDisplayCurrency(userId, currencyCode) {
  if (currencyCode === 'PHP') {
    // Don't allow removing PHP
    return await getWalletDisplayPreferences(userId)
  }

  const current = await getWalletDisplayPreferences(userId)
  const updated = current.filter(c => c !== currencyCode)
  await setWalletDisplayPreferences(userId, updated)
  return updated
}
