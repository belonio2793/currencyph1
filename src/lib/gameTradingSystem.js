// Game trading and marketplace system

export class Trade {
  constructor(id, initiatorId, recipientId, items, money = 0) {
    this.id = id
    this.initiatorId = initiatorId
    this.recipientId = recipientId
    this.items = items // { giving: [], receiving: [] }
    this.money = money // positive means initiator gives money
    this.status = 'pending' // pending, accepted, rejected, completed
    this.createdAt = new Date()
    this.completedAt = null
  }

  accept() {
    this.status = 'accepted'
    this.completedAt = new Date()
  }

  reject() {
    this.status = 'rejected'
    this.completedAt = new Date()
  }

  isValid() {
    return (
      this.items.giving.length > 0 || this.items.receiving.length > 0 || this.money !== 0
    )
  }
}

export class TradingSystem {
  constructor() {
    this.trades = new Map()
    this.tradeHistory = []
    this.tradeIdCounter = 1
  }

  createTrade(initiatorId, recipientId, itemsToGive, itemsToReceive, moneyToGive = 0) {
    if (initiatorId === recipientId) {
      throw new Error('Cannot trade with yourself')
    }

    const trade = new Trade(
      `trade_${this.tradeIdCounter++}`,
      initiatorId,
      recipientId,
      {
        giving: itemsToGive || [],
        receiving: itemsToReceive || []
      },
      moneyToGive
    )

    if (!trade.isValid()) {
      throw new Error('Trade must include at least one item or money')
    }

    this.trades.set(trade.id, trade)
    return trade
  }

  acceptTrade(tradeId) {
    const trade = this.trades.get(tradeId)
    if (!trade) {
      throw new Error('Trade not found')
    }

    if (trade.status !== 'pending') {
      throw new Error('Trade is no longer pending')
    }

    trade.accept()
    this.tradeHistory.push({
      ...trade,
      completedAt: new Date()
    })
    this.trades.delete(tradeId)

    return trade
  }

  rejectTrade(tradeId) {
    const trade = this.trades.get(tradeId)
    if (!trade) {
      throw new Error('Trade not found')
    }

    if (trade.status !== 'pending') {
      throw new Error('Trade is no longer pending')
    }

    trade.reject()
    this.trades.delete(tradeId)

    return trade
  }

  getPendingTradesForPlayer(playerId) {
    return Array.from(this.trades.values())
      .filter(t => t.recipientId === playerId && t.status === 'pending')
  }

  getTradersForPlayer(playerId) {
    return Array.from(this.trades.values())
      .filter(t => t.initiatorId === playerId && t.status === 'pending')
  }

  getTradeHistory(playerId, limit = 20) {
    return this.tradeHistory
      .filter(t => t.initiatorId === playerId || t.recipientId === playerId)
      .slice(-limit)
      .reverse()
  }

  calculateTradeValue(trade) {
    const givingValue = trade.items.giving.reduce((sum, item) => sum + (item.value || 0), 0)
    const receivingValue = trade.items.receiving.reduce((sum, item) => sum + (item.value || 0), 0)

    return {
      givingTotal: givingValue + Math.abs(trade.money),
      receivingTotal: receivingValue,
      difference: (givingValue + Math.abs(trade.money)) - receivingValue
    }
  }

  isTradeBalanced(trade) {
    const value = this.calculateTradeValue(trade)
    return Math.abs(value.difference) < 1
  }
}

export class MarketplaceItem {
  constructor(sellerId, item, price, quantity = 1) {
    this.id = `item_${Date.now()}_${Math.random()}`
    this.sellerId = sellerId
    this.item = item
    this.price = price
    this.quantity = quantity
    this.listedAt = new Date()
  }
}

export class Marketplace {
  constructor() {
    this.listings = new Map()
    this.history = []
  }

  listItem(sellerId, item, price, quantity = 1) {
    const listing = new MarketplaceItem(sellerId, item, price, quantity)
    this.listings.set(listing.id, listing)
    return listing
  }

  buyItem(buyerId, listingId, quantity = 1) {
    const listing = this.listings.get(listingId)
    if (!listing) {
      throw new Error('Listing not found')
    }

    if (listing.quantity < quantity) {
      throw new Error('Not enough quantity available')
    }

    const totalPrice = listing.price * quantity

    // Record transaction
    this.history.push({
      type: 'purchase',
      buyerId,
      sellerId: listing.sellerId,
      item: listing.item,
      quantity,
      pricePerUnit: listing.price,
      totalPrice,
      timestamp: new Date()
    })

    // Update listing
    listing.quantity -= quantity
    if (listing.quantity <= 0) {
      this.listings.delete(listingId)
    }

    return {
      listing,
      totalPrice,
      quantity
    }
  }

  delistItem(listingId, sellerId) {
    const listing = this.listings.get(listingId)
    if (!listing) {
      throw new Error('Listing not found')
    }

    if (listing.sellerId !== sellerId) {
      throw new Error('You cannot delist items you did not list')
    }

    this.listings.delete(listingId)
    return listing
  }

  getListingsForItem(itemId) {
    return Array.from(this.listings.values())
      .filter(l => l.item.id === itemId)
      .sort((a, b) => a.price - b.price)
  }

  getListingsBySeller(sellerId) {
    return Array.from(this.listings.values())
      .filter(l => l.sellerId === sellerId)
  }

  getAveragePrice(itemId) {
    const listings = this.getListingsForItem(itemId)
    if (listings.length === 0) return null

    const totalPrice = listings.reduce((sum, l) => sum + (l.price * l.quantity), 0)
    const totalQuantity = listings.reduce((sum, l) => sum + l.quantity, 0)

    return totalPrice / totalQuantity
  }

  getPriceHistory(itemId, limit = 50) {
    return this.history
      .filter(t => t.item.id === itemId && t.type === 'purchase')
      .slice(-limit)
      .map(t => ({
        price: t.pricePerUnit,
        quantity: t.quantity,
        timestamp: t.timestamp
      }))
  }

  getMarketStats() {
    const stats = {
      totalListings: this.listings.size,
      totalTransactions: this.history.length,
      totalVolume: 0,
      mostTradedItem: null,
      maxPrice: 0,
      minPrice: Infinity
    }

    // Calculate stats
    let itemFrequency = new Map()
    for (const transaction of this.history) {
      stats.totalVolume += transaction.totalPrice
      stats.maxPrice = Math.max(stats.maxPrice, transaction.pricePerUnit)
      stats.minPrice = Math.min(stats.minPrice, transaction.pricePerUnit)

      const itemId = transaction.item.id
      itemFrequency.set(itemId, (itemFrequency.get(itemId) || 0) + 1)
    }

    // Find most traded item
    let maxFreq = 0
    for (const [itemId, freq] of itemFrequency) {
      if (freq > maxFreq) {
        maxFreq = freq
        stats.mostTradedItem = itemId
      }
    }

    if (stats.minPrice === Infinity) {
      stats.minPrice = 0
    }

    return stats
  }
}

// Global instances
export const tradingSystem = new TradingSystem()
export const marketplace = new Marketplace()
