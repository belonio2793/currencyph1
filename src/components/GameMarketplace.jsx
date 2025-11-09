import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { gameAPI } from '../lib/gameAPI'
import { gameMarketplace } from '../lib/gameMarketplace'

export default function GameMarketplace({ userId, characterId, onClose }) {
  const [activeTab, setActiveTab] = useState('browse') // browse, myListings, myOffers, history
  const [listings, setListings] = useState([])
  const [myListings, setMyListings] = useState([])
  const [myOffers, setMyOffers] = useState([])
  const [tradeHistory, setTradeHistory] = useState([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all') // all, items, properties
  const [sortBy, setSortBy] = useState('recent') // recent, price-low, price-high
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [selectedListing, setSelectedListing] = useState(null)
  const [showListingDetail, setShowListingDetail] = useState(false)
  const [showCreateListing, setShowCreateListing] = useState(false)
  const [showCreateOffer, setShowCreateOffer] = useState(false)
  const [sellerInfo, setSellerInfo] = useState(null)

  useEffect(() => {
    loadMarketplaceData()
    const subscription = setupRealtimeUpdates()
    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [characterId])

  async function loadMarketplaceData() {
    try {
      setLoading(true)
      setError('')
      
      // Load all active listings
      const { data: allListings, error: listingsError } = await supabase
        .from('game_marketplace_listings')
        .select(`
          *,
          seller:game_characters(id, name, level),
          item:game_items(id, name, description),
          property:game_properties(id, name, current_value, location)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (listingsError) throw listingsError
      setListings(allListings || [])

      // Load user's listings
      if (characterId) {
        const { data: userListings, error: userListingsError } = await supabase
          .from('game_marketplace_listings')
          .select(`
            *,
            item:game_items(id, name, description),
            property:game_properties(id, name, current_value, location)
          `)
          .eq('seller_id', characterId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })

        if (userListingsError) throw userListingsError
        setMyListings(userListings || [])

        // Load user's offers
        const { data: offers, error: offersError } = await supabase
          .from('game_trade_offers')
          .select(`
            *,
            listing:game_marketplace_listings(
              id, item_id, property_id, seller_id, unit_price, total_price, listing_type,
              seller:game_characters(id, name, level),
              item:game_items(id, name),
              property:game_properties(id, name)
            )
          `)
          .or(`buyer_id.eq.${characterId},seller_id.eq.${characterId}`)
          .order('created_at', { ascending: false })

        if (offersError) throw offersError
        setMyOffers(offers || [])

        // Load trade history
        const { data: history, error: historyError } = await supabase
          .from('game_trades_completed')
          .select(`
            *,
            buyer:game_characters!buyer_id(id, name, level),
            seller:game_characters!seller_id(id, name, level)
          `)
          .or(`buyer_id.eq.${characterId},seller_id.eq.${characterId}`)
          .order('completed_at', { ascending: false })
          .limit(20)

        if (historyError) throw historyError
        setTradeHistory(history || [])
      }
    } catch (err) {
      console.error('Failed to load marketplace data:', err)
      setError(err.message || 'Failed to load marketplace')
    } finally {
      setLoading(false)
    }
  }

  function setupRealtimeUpdates() {
    return supabase
      .channel('marketplace-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_marketplace_listings' },
        () => loadMarketplaceData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_trade_offers' },
        () => loadMarketplaceData()
      )
      .subscribe()
  }

  async function handleViewListing(listing) {
    setSelectedListing(listing)
    setShowListingDetail(true)
    
    // Load seller info
    if (listing.seller_id) {
      const { data: seller } = await gameAPI.getCharacter(listing.seller_id)
      setSellerInfo(seller)
    }
  }

  async function handleMakeOffer(listing, offerAmount) {
    try {
      if (!characterId) {
        setError('You must select a character to make an offer')
        return
      }

      const { data, error: offerError } = await supabase
        .from('game_trade_offers')
        .insert([{
          listing_id: listing.id,
          buyer_id: characterId,
          seller_id: listing.seller_id,
          offered_price: offerAmount,
          offered_items: [],
          status: 'pending'
        }])
        .select()
        .single()

      if (offerError) throw offerError

      setSuccess(`Offer of ₱${offerAmount.toLocaleString()} sent to ${listing.seller.name}`)
      setShowCreateOffer(false)
      setTimeout(() => setSuccess(''), 3000)
      await loadMarketplaceData()
    } catch (err) {
      console.error('Failed to make offer:', err)
      setError(err.message || 'Failed to make offer')
    }
  }

  async function handleAcceptOffer(offer) {
    try {
      // Transfer money and items
      await gameMarketplace.acceptTradeOffer(offer.id, characterId)
      
      setSuccess(`Trade accepted! You received ₱${offer.offered_price.toLocaleString()}`)
      setTimeout(() => setSuccess(''), 3000)
      await loadMarketplaceData()
    } catch (err) {
      console.error('Failed to accept offer:', err)
      setError(err.message || 'Failed to accept offer')
    }
  }

  async function handleRejectOffer(offerId) {
    try {
      const { error } = await supabase
        .from('game_trade_offers')
        .update({ status: 'rejected' })
        .eq('id', offerId)

      if (error) throw error
      setSuccess('Offer rejected')
      setTimeout(() => setSuccess(''), 3000)
      await loadMarketplaceData()
    } catch (err) {
      console.error('Failed to reject offer:', err)
      setError(err.message || 'Failed to reject offer')
    }
  }

  async function handleCancelListing(listingId) {
    try {
      await gameMarketplace.cancelListing(listingId, characterId)
      setSuccess('Listing cancelled')
      setTimeout(() => setSuccess(''), 3000)
      await loadMarketplaceData()
    } catch (err) {
      console.error('Failed to cancel listing:', err)
      setError(err.message || 'Failed to cancel listing')
    }
  }

  const filteredListings = listings.filter(l => {
    const matchesSearch = !searchQuery || 
      l.item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.property?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.item_type?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesType = filterType === 'all' || l.listing_type === filterType
    
    return matchesSearch && matchesType
  }).sort((a, b) => {
    if (sortBy === 'price-low') return a.unit_price - b.unit_price
    if (sortBy === 'price-high') return b.unit_price - a.unit_price
    return new Date(b.created_at) - new Date(a.created_at)
  })

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-300">Loading marketplace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Game Marketplace</h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700 bg-slate-800/50 px-6 flex gap-8 overflow-x-auto">
          {['browse', 'myListings', 'myOffers', 'history'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'browse' && 'Browse Listings'}
              {tab === 'myListings' && 'My Listings'}
              {tab === 'myOffers' && 'My Offers'}
              {tab === 'history' && 'Trade History'}
            </button>
          ))}
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-600/10 border border-red-600/20 rounded text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-600/10 border border-green-600/20 rounded text-green-300 text-sm">
            {success}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          
          {/* BROWSE TAB */}
          {activeTab === 'browse' && (
            <div>
              <div className="mb-6 space-y-4">
                <input
                  type="text"
                  placeholder="Search items or properties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                
                <div className="flex gap-4">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="items">Items Only</option>
                    <option value="properties">Properties Only</option>
                  </select>
                  
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {filteredListings.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No listings found
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredListings.map(listing => (
                    <div
                      key={listing.id}
                      onClick={() => handleViewListing(listing)}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-blue-500 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-100">
                            {listing.listing_type === 'item' ? listing.item?.name : listing.property?.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">by {listing.seller?.name}</p>
                        </div>
                        <span className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded">
                          {listing.listing_type}
                        </span>
                      </div>

                      {listing.listing_type === 'items' && (
                        <p className="text-sm text-slate-300 mb-3">Quantity: {listing.quantity}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-green-400">₱{listing.unit_price.toLocaleString()}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedListing(listing)
                            setShowCreateOffer(true)
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                        >
                          Offer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MY LISTINGS TAB */}
          {activeTab === 'myListings' && (
            <div>
              <button
                onClick={() => setShowCreateListing(true)}
                className="mb-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium"
              >
                + Create Listing
              </button>

              {myListings.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  You haven't created any listings yet
                </div>
              ) : (
                <div className="space-y-3">
                  {myListings.map(listing => (
                    <div key={listing.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-100">
                            {listing.item?.name || listing.property?.name}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {listing.listing_type} • {listing.status} • ₱{listing.unit_price.toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelListing(listing.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MY OFFERS TAB */}
          {activeTab === 'myOffers' && (
            <div>
              {myOffers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No trade offers yet
                </div>
              ) : (
                <div className="space-y-3">
                  {myOffers.map(offer => (
                    <div key={offer.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-100">
                            {offer.listing?.item?.name || offer.listing?.property?.name}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {offer.buyer_id === characterId ? 'Your offer:' : 'From'} ₱{offer.offered_price.toLocaleString()} • {offer.status}
                          </p>
                        </div>
                      </div>

                      {offer.seller_id === characterId && offer.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptOffer(offer)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectOffer(offer.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div>
              {tradeHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No trade history yet
                </div>
              ) : (
                <div className="space-y-3">
                  {tradeHistory.map(trade => (
                    <div key={trade.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-100">{trade.item_type}</h3>
                          <p className="text-sm text-slate-400">
                            {trade.buyer_id === characterId ? 'Purchased from' : 'Sold to'} {
                              trade.buyer_id === characterId ? trade.seller?.name : trade.buyer?.name
                            } • ₱{trade.price_paid.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-300">Rating</p>
                          <p className="font-semibold text-yellow-400">
                            {trade.buyer_id === characterId ? trade.buyer_rating : trade.seller_rating} ⭐
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
