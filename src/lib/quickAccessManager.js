/**
 * Quick Access Card Manager
 * Handles the state and ordering of quick access cards with drag-and-drop support
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
   * Save card order to localStorage
   */
  setCardOrder(userId, order) {
    try {
      localStorage.setItem(`quick-access-order-${userId}`, JSON.stringify(order))
      this.notifyUpdate(userId)
      return true
    } catch (e) {
      console.error('Failed to save card order:', e)
      return false
    }
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
   * Set card visibility
   */
  setCardVisibility(userId, visibility) {
    try {
      localStorage.setItem(`quick-access-cards-${userId}`, JSON.stringify(visibility))
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
  getEnabledCardsInOrder(userId) {
    const visibility = this.getCardVisibility(userId)
    const order = this.getCardOrder(userId)
    
    return order.filter(cardKey => visibility[cardKey] === true)
  },

  /**
   * Reorder cards
   */
  reorderCards(userId, fromIndex, toIndex) {
    const order = this.getCardOrder(userId)
    const newOrder = [...order]
    
    // Remove from old position
    const [movedCard] = newOrder.splice(fromIndex, 1)
    // Insert at new position
    newOrder.splice(toIndex, 0, movedCard)
    
    return newOrder
  },

  /**
   * Get a card's current position
   */
  getCardPosition(userId, cardKey) {
    const order = this.getCardOrder(userId)
    return order.indexOf(cardKey)
  },

  /**
   * Toggle card visibility
   */
  toggleCardVisibility(userId, cardKey) {
    const visibility = this.getCardVisibility(userId)
    visibility[cardKey] = !visibility[cardKey]
    this.setCardVisibility(userId, visibility)
    return visibility
  },

  /**
   * Reset to default order
   */
  resetToDefaultOrder(userId) {
    this.setCardOrder(userId, [...DEFAULT_ORDER])
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
