export const preferencesManager = {
  getAutoScrollToTop: (userId) => {
    try {
      const key = userId ? `preferences_${userId}_autoScroll` : 'preferences_guest_autoScroll'
      const stored = localStorage.getItem(key)
      return stored !== null ? stored === 'true' : true
    } catch (e) {
      console.warn('Failed to read preference:', e)
      return true
    }
  },

  setAutoScrollToTop: (userId, enabled) => {
    try {
      const key = userId ? `preferences_${userId}_autoScroll` : 'preferences_guest_autoScroll'
      localStorage.setItem(key, String(enabled))
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

  setPreferences: (userId, preferences) => {
    try {
      const key = userId ? `preferences_${userId}` : 'preferences_guest'
      localStorage.setItem(key, JSON.stringify(preferences))
    } catch (e) {
      console.warn('Failed to save preferences:', e)
    }
  }
}
