import { supabase } from './supabaseClient'

/**
 * Quick Access Card Manager
 * Handles the state and ordering of quick access cards with drag-and-drop support
 * Now syncs with database for persistence across sessions and devices
 */

const CARD_KEYS = [
  'receipts',
  'deposit',
  'nearby',
  'messages',
  'p2p',
  'poker',
  'networkBalances',
  'myBusiness'
]

const DEFAULT_ORDER = [
  'deposit',
  'nearby',
  'receipts',
  'messages',
  'p2p',
  'poker',
  'networkBalances',
  'myBusiness'
]

const DEFAULT_VISIBILITY = {
  receipts: true,
  deposit: true,
  nearby: true,
  messages: false,
  p2p: false,
  poker: false,
  networkBalances: false,
  myBusiness: false
}

export const quickAccessManager = {
  /**
   * Load card order from database, fallback to localStorage
   */
  async loadCardOrderFromDB(userId) {
    if (!userId) return DEFAULT_ORDER

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('quick_access_card_order')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.warn('Failed to load card order from DB:', error)
        return this.getCardOrder(userId)
      }

      if (data?.quick_access_card_order) {
        const order = data.quick_access_card_order
        if (this.isValidOrder(order)) {
          return order
        }
      }
    } catch (e) {
      console.warn('Error loading card order from DB:', e)
    }

    return this.getCardOrder(userId)
  },

  /**
   * Get card order from localStorage
   */
  getCardOrder(userId) {
    try {
      const saved = localStorage.getItem(`quick-access-order-${userId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        return Array.isArray(parsed) ? parsed : DEFAULT_ORDER
      }
    } catch (e) {
      console.error('Failed to parse card order:', e)
    }
    return DEFAULT_ORDER
  },

  /**
   * Save card order to localStorage and sync to database
   */
  async setCardOrder(userId, order) {
    try {
      // Save to localStorage immediately
      localStorage.setItem(`quick-access-order-${userId}`, JSON.stringify(order))
      
      // Sync to database if user is logged in
      if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        await supabase
          .from('user_preferences')
          .update({
            quick_access_card_order: order,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
      }
      
      this.notifyUpdate(userId)
      return true
    } catch (e) {
      console.error('Failed to save card order:', e)
      return false
    }
  },

  /**
   * Load card visibility from database, fallback to localStorage
   */
  async loadCardVisibilityFromDB(userId) {
    if (!userId) return DEFAULT_VISIBILITY

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('quick_access_visibility')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.warn('Failed to load card visibility from DB:', error)
        return this.getCardVisibility(userId)
      }

      if (data?.quick_access_visibility) {
        const visibility = data.quick_access_visibility
        if (visibility && typeof visibility === 'object') {
          return { ...DEFAULT_VISIBILITY, ...visibility }
        }
      }
    } catch (e) {
      console.warn('Error loading card visibility from DB:', e)
    }

    return this.getCardVisibility(userId)
  },

  /**
   * Get card visibility from localStorage
   */
  getCardVisibility(userId) {
    try {
      const saved = localStorage.getItem(`quick-access-cards-${userId}`)
      if (saved) {
        return { ...DEFAULT_VISIBILITY, ...JSON.parse(saved) }
      }
    } catch (e) {
      console.error('Failed to parse card visibility:', e)
    }
    return { ...DEFAULT_VISIBILITY }
  },

  /**
   * Set card visibility in localStorage and sync to database
   */
  async setCardVisibility(userId, visibility) {
    try {
      // Save to localStorage immediately
      localStorage.setItem(`quick-access-cards-${userId}`, JSON.stringify(visibility))
      
      // Sync to database if user is logged in
      if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        await supabase
          .from('user_preferences')
          .update({
            quick_access_visibility: visibility,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
      }
      
      this.notifyUpdate(userId)
      return true
    } catch (e) {
      console.error('Failed to save card visibility:', e)
      return false
    }
  },

  /**
   * Get enabled cards in order
   */
  async getEnabledCardsInOrder(userId) {
    const visibility = await this.loadCardVisibilityFromDB(userId)
    const order = await this.loadCardOrderFromDB(userId)
    
    return order.filter(cardKey => visibility[cardKey] === true)
  },

  /**
   * Get enabled cards in order (synchronous version for initial load)
   */
  getEnabledCardsInOrderSync(userId) {
    const visibility = this.getCardVisibility(userId)
    const order = this.getCardOrder(userId)
    
    return order.filter(cardKey => visibility[cardKey] === true)
  },

  /**
   * Reorder cards
   */
  async reorderCards(userId, fromIndex, toIndex) {
    const order = await this.loadCardOrderFromDB(userId)
    const newOrder = [...order]
    
    // Remove from old position
    const [movedCard] = newOrder.splice(fromIndex, 1)
    // Insert at new position
    newOrder.splice(toIndex, 0, movedCard)
    
    await this.setCardOrder(userId, newOrder)
    return newOrder
  },

  /**
   * Get a card's current position
   */
  async getCardPosition(userId, cardKey) {
    const order = await this.loadCardOrderFromDB(userId)
    return order.indexOf(cardKey)
  },

  /**
   * Toggle card visibility
   */
  async toggleCardVisibility(userId, cardKey) {
    const visibility = await this.loadCardVisibilityFromDB(userId)
    visibility[cardKey] = !visibility[cardKey]
    await this.setCardVisibility(userId, visibility)
    return visibility
  },

  /**
   * Reset to default order
   */
  async resetToDefaultOrder(userId) {
    await this.setCardOrder(userId, [...DEFAULT_ORDER])
    return [...DEFAULT_ORDER]
  },

  /**
   * Notify listeners of updates
   */
  notifyUpdate(userId) {
    try {
      window.dispatchEvent(new CustomEvent('quick-access-updated', { detail: { userId } }))
    } catch (e) {
      console.debug('Failed to dispatch quick-access-updated event:', e)
    }
  },

  /**
   * Get all card keys
   */
  getAllCardKeys() {
    return [...CARD_KEYS]
  },

  /**
   * Validate card order (ensure all cards are present and unique)
   */
  isValidOrder(order) {
    if (!Array.isArray(order)) return false
    if (order.length !== CARD_KEYS.length) return false
    
    const uniqueCards = new Set(order)
    return uniqueCards.size === order.length && order.every(key => CARD_KEYS.includes(key))
  }
}
