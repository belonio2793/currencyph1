import { supabase } from './supabaseClient'
import { gameAPI } from './gameAPI'

export const gameMarketplace = {
  // ITEM LISTINGS
  async createItemListing(sellerId, itemId, quantity, unitPrice) {
    try {
      // Verify seller has the item
      const { data: inventory } = await supabase
        .from('game_inventory')
        .select('quantity')
        .eq('character_id', sellerId)
        .eq('item_id', itemId)
        .single()

      if (!inventory || inventory.quantity < quantity) {
        throw new Error('Insufficient items to list')
      }

      const { data, error } = await supabase
        .from('game_marketplace_listings')
        .insert([{
          seller_id: sellerId,
          item_id: itemId,
          quantity,
          unit_price: unitPrice,
          total_price: unitPrice * quantity,
          listing_type: 'item',
          status: 'active',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error creating item listing:', err)
      throw err
    }
  },

  async createPropertyListing(sellerId, propertyId, askingPrice) {
    try {
      // Verify seller owns the property
      const { data: property } = await supabase
        .from('game_properties')
        .select('owner_id, current_value')
        .eq('id', propertyId)
        .single()

      if (property?.owner_id !== sellerId) {
        throw new Error('You do not own this property')
      }

      const { data, error } = await supabase
        .from('game_marketplace_listings')
        .insert([{
          seller_id: sellerId,
          property_id: propertyId,
          quantity: 1,
          unit_price: askingPrice,
          total_price: askingPrice,
          listing_type: 'property',
          status: 'active',
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days for properties
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error creating property listing:', err)
      throw err
    }
  },

  async cancelListing(listingId, userId) {
    try {
      const { data: listing } = await supabase
        .from('game_marketplace_listings')
        .select('seller_id, status')
        .eq('id', listingId)
        .single()

      if (listing?.seller_id !== userId) {
        throw new Error('You can only cancel your own listings')
      }

      if (listing?.status !== 'active') {
        throw new Error('This listing is no longer active')
      }

      const { data, error } = await supabase
        .from('game_marketplace_listings')
        .update({ status: 'cancelled' })
        .eq('id', listingId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error canceling listing:', err)
      throw err
    }
  },

  // MARKETPLACE BROWSING
  async getListings(filters = {}) {
    try {
      let query = supabase
        .from('game_marketplace_listings')
        .select(`
          *,
          game_items(*),
          game_properties(*),
          seller:game_characters(id, name)
        `)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())

      if (filters.listing_type) {
        query = query.eq('listing_type', filters.listing_type)
      }

      if (filters.min_price) {
        query = query.gte('unit_price', filters.min_price)
      }

      if (filters.max_price) {
        query = query.lte('unit_price', filters.max_price)
      }

      if (filters.search) {
        // Search in item names or property names
        query = query.or(`game_items.name.ilike.%${filters.search}%,game_properties.name.ilike.%${filters.search}%`)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(filters.limit || 50)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching listings:', err)
      return []
    }
  },

  async getSellerListings(sellerId) {
    try {
      const { data, error } = await supabase
        .from('game_marketplace_listings')
        .select(`
          *,
          game_items(*),
          game_properties(*)
        `)
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching seller listings:', err)
      return []
    }
  },

  // ITEM PURCHASE
  async purchaseItem(buyerId, listingId, quantity = null) {
    try {
      const { data: listing, error: listingError } = await supabase
        .from('game_marketplace_listings')
        .select('*')
        .eq('id', listingId)
        .eq('listing_type', 'item')
        .eq('status', 'active')
        .single()

      if (listingError || !listing) {
        throw new Error('Listing not found or expired')
      }

      const purchaseQuantity = quantity || listing.quantity
      if (purchaseQuantity > listing.quantity) {
        throw new Error('Not enough items available')
      }

      const totalCost = listing.unit_price * purchaseQuantity
      const buyer = await gameAPI.getCharacter(buyerId)

      if ((buyer?.money || 0) < totalCost) {
        throw new Error('Insufficient funds')
      }

      // Add item to buyer inventory
      await gameAPI.addItemToInventory(buyerId, listing.item_id, purchaseQuantity)

      // Deduct from buyer
      await gameAPI.updateCharacterStats(buyerId, {
        money: (buyer?.money || 0) - totalCost
      })

      // Add to seller
      const { data: seller } = await supabase
        .from('game_characters')
        .select('money')
        .eq('id', listing.seller_id)
        .single()

      await gameAPI.updateCharacterStats(listing.seller_id, {
        money: (seller?.money || 0) + totalCost
      })

      // Update listing
      let newStatus = 'sold'
      let newQuantity = listing.quantity - purchaseQuantity

      if (newQuantity > 0) {
        newStatus = 'active'
      }

      await supabase
        .from('game_marketplace_listings')
        .update({
          quantity: newQuantity,
          status: newStatus,
          total_price: listing.unit_price * newQuantity
        })
        .eq('id', listingId)

      // Log transaction
      await supabase
        .from('game_transactions')
        .insert([{
          buyer_id: buyerId,
          seller_id: listing.seller_id,
          item_id: listing.item_id,
          quantity: purchaseQuantity,
          unit_price: listing.unit_price,
          total_price: totalCost,
          transaction_type: 'marketplace_purchase',
          status: 'completed'
        }])

      // Add experience
      await gameAPI.addExperience(buyerId, 10 + purchaseQuantity, 'marketplace_trade', listingId)

      return { success: true, totalCost, quantity: purchaseQuantity }
    } catch (err) {
      console.error('Error purchasing item:', err)
      throw err
    }
  },

  // PROPERTY PURCHASE
  async purchaseProperty(buyerId, listingId) {
    try {
      const { data: listing, error: listingError } = await supabase
        .from('game_marketplace_listings')
        .select('*')
        .eq('id', listingId)
        .eq('listing_type', 'property')
        .eq('status', 'active')
        .single()

      if (listingError || !listing) {
        throw new Error('Property listing not found or expired')
      }

      const buyer = await gameAPI.getCharacter(buyerId)
      if ((buyer?.money || 0) < listing.total_price) {
        throw new Error('Insufficient funds')
      }

      // Deduct from buyer
      await gameAPI.updateCharacterStats(buyerId, {
        money: (buyer?.money || 0) - listing.total_price
      })

      // Add to seller
      const { data: seller } = await supabase
        .from('game_characters')
        .select('money')
        .eq('id', listing.seller_id)
        .single()

      await gameAPI.updateCharacterStats(listing.seller_id, {
        money: (seller?.money || 0) + listing.total_price
      })

      // Transfer property ownership
      await supabase
        .from('game_properties')
        .update({ owner_id: buyerId })
        .eq('id', listing.property_id)

      // Mark listing as sold
      await supabase
        .from('game_marketplace_listings')
        .update({ status: 'sold' })
        .eq('id', listingId)

      // Log transaction
      await supabase
        .from('game_transactions')
        .insert([{
          buyer_id: buyerId,
          seller_id: listing.seller_id,
          total_price: listing.total_price,
          transaction_type: 'property_marketplace_purchase',
          status: 'completed'
        }])

      // Add experience and bonus for large transactions
      const expReward = Math.min(500, Math.floor(listing.total_price / 1000))
      await gameAPI.addExperience(buyerId, expReward, 'property_trade', listingId)

      return { success: true, totalPrice: listing.total_price }
    } catch (err) {
      console.error('Error purchasing property:', err)
      throw err
    }
  },

  // PRICE HISTORY & ANALYTICS
  async getPriceHistory(itemId = null, limit = 100) {
    try {
      let query = supabase
        .from('game_transactions')
        .select('*')
        .eq('status', 'completed')

      if (itemId) {
        query = query.eq('item_id', itemId)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching price history:', err)
      return []
    }
  },

  // TRENDING ITEMS
  async getTrendingListings(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('game_marketplace_listings')
        .select(`
          *,
          game_items(*)
        `)
        .eq('status', 'active')
        .eq('listing_type', 'item')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching trending:', err)
      return []
    }
  },

  // TRADE OFFERS
  async createTradeOffer(listingId, buyerId, sellerId, offeredPrice, offeredItems = []) {
    try {
      const { data, error } = await supabase
        .from('game_trade_offers')
        .insert([{
          listing_id: listingId,
          buyer_id: buyerId,
          seller_id: sellerId,
          offered_price: offeredPrice,
          offered_items: offeredItems,
          status: 'pending'
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error creating trade offer:', err)
      throw err
    }
  },

  async acceptTradeOffer(offerId, acceptorId) {
    try {
      const { data: offer, error: offerError } = await supabase
        .from('game_trade_offers')
        .select(`
          *,
          listing:game_marketplace_listings(*)
        `)
        .eq('id', offerId)
        .single()

      if (offerError || !offer) {
        throw new Error('Trade offer not found')
      }

      if (offer.seller_id !== acceptorId && offer.buyer_id !== acceptorId) {
        throw new Error('You cannot accept this offer')
      }

      // Determine buyer and seller
      const isBuyer = offer.buyer_id === acceptorId
      const buyerId = isBuyer ? offer.buyer_id : offer.seller_id
      const sellerId = isBuyer ? offer.seller_id : offer.buyer_id
      const offerAmount = offer.offered_price

      // Get both parties
      const buyer = await gameAPI.getCharacter(buyerId)
      const seller = await gameAPI.getCharacter(sellerId)

      if ((buyer?.money || 0) < offerAmount) {
        throw new Error('Buyer has insufficient funds')
      }

      // Transfer money
      await gameAPI.updateCharacterStats(buyerId, {
        money: (buyer?.money || 0) - offerAmount
      })

      await gameAPI.updateCharacterStats(sellerId, {
        money: (seller?.money || 0) + offerAmount
      })

      // If listing is a property, transfer ownership
      if (offer.listing.listing_type === 'property') {
        await supabase
          .from('game_properties')
          .update({ owner_id: buyerId })
          .eq('id', offer.listing.property_id)
      } else if (offer.listing.listing_type === 'item') {
        // Transfer items from seller to buyer
        await gameAPI.addItemToInventory(buyerId, offer.listing.item_id, offer.listing.quantity)

        // Remove from seller inventory or reduce quantity
        await gameAPI.removeItemFromInventory(sellerId, offer.listing.item_id, offer.listing.quantity)
      }

      // Mark listing as sold
      await supabase
        .from('game_marketplace_listings')
        .update({ status: 'sold' })
        .eq('id', offer.listing.id)

      // Mark offer as completed
      await supabase
        .from('game_trade_offers')
        .update({ status: 'completed' })
        .eq('id', offerId)

      // Log trade completion
      await supabase
        .from('game_trades_completed')
        .insert([{
          buyer_id: buyerId,
          seller_id: sellerId,
          item_type: offer.listing.item_type,
          description: offer.listing.description,
          price_paid: offerAmount,
          buyer_rating: 5,
          seller_rating: 5
        }])

      // Award experience
      await gameAPI.addExperience(buyerId, 20, 'trade_completed', offerId)
      await gameAPI.addExperience(sellerId, 20, 'trade_completed', offerId)

      return { success: true }
    } catch (err) {
      console.error('Error accepting trade offer:', err)
      throw err
    }
  },

  async rejectTradeOffer(offerId, rejectingUserId) {
    try {
      const { data: offer } = await supabase
        .from('game_trade_offers')
        .select('seller_id, buyer_id')
        .eq('id', offerId)
        .single()

      if (offer.seller_id !== rejectingUserId && offer.buyer_id !== rejectingUserId) {
        throw new Error('You cannot reject this offer')
      }

      const { error } = await supabase
        .from('game_trade_offers')
        .update({ status: 'rejected' })
        .eq('id', offerId)

      if (error) throw error
      return { success: true }
    } catch (err) {
      console.error('Error rejecting trade offer:', err)
      throw err
    }
  },

  async getTradeOffers(userId) {
    try {
      const { data, error } = await supabase
        .from('game_trade_offers')
        .select(`
          *,
          listing:game_marketplace_listings(*)
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching trade offers:', err)
      return []
    }
  },

  // MARKET STATISTICS
  async getMarketStats() {
    try {
      const { data: transactions } = await supabase
        .from('game_transactions')
        .select('total_price, created_at')
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      const totalVolume = transactions?.reduce((sum, t) => sum + (t.total_price || 0), 0) || 0
      const avgPrice = transactions && transactions.length > 0 ? totalVolume / transactions.length : 0
      const transactionCount = transactions?.length || 0

      return {
        totalVolume,
        averagePrice: Math.floor(avgPrice),
        transactionCount,
        period: '7_days'
      }
    } catch (err) {
      console.error('Error getting market stats:', err)
      return { totalVolume: 0, averagePrice: 0, transactionCount: 0 }
    }
  }
}
