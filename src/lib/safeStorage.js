export function safeSetItem(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    window.localStorage.setItem(key, value)
    return true
  } catch (err) {
    try {
      // If quota exceeded, fallback to sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value)
        console.warn('[safeStorage] localStorage failed, saved to sessionStorage for key:', key)
        return true
      }
    } catch (e) {}
    console.warn('[safeStorage] Failed to persist key:', key, err && err.message)
    return false
  }
}

export function safeRemoveItem(key) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
      try { window.sessionStorage.removeItem(key) } catch (e) {}
    }
  } catch (e) {}
}
