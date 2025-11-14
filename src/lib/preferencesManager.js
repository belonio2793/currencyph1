import { supabase } from './supabaseClient'

export const preferencesManager = {
  // Load or create user preferences from database
  async loadUserPreferences(userId) {
    if (!userId) return null
    
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        console.warn('Failed to load user preferences from DB:', error)
        return null
      }
      
      if (!data) {
        // Create default preferences for new user
        const defaultPrefs = {
          user_id: userId,
          auto_scroll_enabled: true,
          quick_access_card_order: ['deposit', 'nearby', 'receipts', 'messages', 'p2p', 'poker', 'networkBalances', 'myBusiness'],
          quick_access_visibility: {
            receipts: true,
            deposit: true,
            nearby: true,
            messages: false,
            p2p: false,
            poker: false,
            networkBalances: false,
            myBusiness: false
          },
          other_preferences: {}
        }
        
        const { data: createdData, error: createError } = await supabase
          .from('user_preferences')
          .insert(defaultPrefs)
          .select()
          .single()
        
        if (createError) {
          console.warn('Failed to create user preferences:', createError)
          return defaultPrefs
        }
        
        return createdData
      }
      
      return data
    } catch (e) {
      console.warn('Error loading user preferences:', e)
      return null
    }
  },

  getAutoScrollToTop: (userId) => {
    try {
      // Try to get from localStorage first (for immediate access)
      const key = userId ? `preferences_${userId}_autoScroll` : 'preferences_guest_autoScroll'
      const stored = localStorage.getItem(key)
      const result = stored !== null ? stored === 'true' : true
      return result
    } catch (e) {
      console.warn('Failed to read preference:', e)
      return true
    }
  },

  setAutoScrollToTop: async (userId, enabled) => {
    try {
      // Save to localStorage immediately for UX
      const key = userId ? `preferences_${userId}_autoScroll` : 'preferences_guest_autoScroll'
      localStorage.setItem(key, String(enabled))
      
      // If logged in, also sync to database
      if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        const { error } = await supabase
          .from('user_preferences')
          .update({ auto_scroll_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        
        if (error) {
          console.warn('Failed to sync auto scroll preference to DB:', error)
        }
      }
    } catch (e) {
      console.warn('Failed to save preference:', e)
    }
  },

  getAllPreferences: (userId) => {
    try {
      const key = userId ? `preferences_${userId}` : 'preferences_guest'
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : {}
    } catch (e) {
      console.warn('Failed to read preferences:', e)
      return {}
    }
  },

  setPreferences: async (userId, preferences) => {
    try {
      const key = userId ? `preferences_${userId}` : 'preferences_guest'
      localStorage.setItem(key, JSON.stringify(preferences))
      
      // If logged in, also sync to database
      if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        const { error } = await supabase
          .from('user_preferences')
          .update({ 
            other_preferences: preferences,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
        
        if (error) {
          console.warn('Failed to sync preferences to DB:', error)
        }
      }
    } catch (e) {
      console.warn('Failed to save preferences:', e)
    }
  },

  // New method to sync quick access settings to database
  async syncQuickAccessToDB(userId, cardOrder, cardVisibility) {
    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return false
    }

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({
          quick_access_card_order: cardOrder,
          quick_access_visibility: cardVisibility,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        console.warn('Failed to sync quick access settings to DB:', error)
        return false
      }
      return true
    } catch (e) {
      console.warn('Error syncing quick access to DB:', e)
      return false
    }
  },

  // Method to load quick access settings from database
  async loadQuickAccessFromDB(userId) {
    if (!userId) return null

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('quick_access_card_order, quick_access_visibility')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.warn('Failed to load quick access from DB:', error)
        return null
      }

      return data
    } catch (e) {
      console.warn('Error loading quick access from DB:', e)
      return null
    }
  }
}
