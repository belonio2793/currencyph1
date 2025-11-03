import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function CurrencyMarketplace({ character, onListingCreated, onPurchaseComplete }) {
  const [listings, setListings] = useState([])
  const [myListings, setMyListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [showCreateListing, setShowCreateListing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [purchasing, setPurchasing] = useState(null)

  const [newListing, setNewListing] = useState({
    listing_type: 'item',
    item_name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    property_type: null,
    property_name: null
  })

  useEffect(() => {
    loadListings()
    loadMyListings()
  }, [filter, sort])

  const loadListings = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('game_marketplace_listings')
        .select('*')
        .eq('status', 'active')

      if (filter !== 'all') {
        query = query.eq('listing_type', filter)
      }

      if (sort === 'recent') {
        query = query.order('created_at', { ascending: false })
      } else if (sort === 'price_low') {
        query = query.order('unit_price', { ascending: true })
      } else if (sort === 'price_high') {
        query = query.order('unit_price', { ascending: false })
      }

      const { data, error: err } = await query.limit(100)

      if (err) throw err
      setListings(data || [])
    } catch (err) {
      setError('Failed to load listings: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMyListings = async () => {
    try {
      const { data, error: err } = await supabase
        .from('game_marketplace_listings')
        .select('*')
        .eq('seller_id', character.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (err) throw err
      setMyListings(data || [])
    } catch (err) {
      console.warn('Failed to load my listings:', err)
    }
  }

  const handleCreateListing = async () => {
    try {
      if (!newListing.item_name || newListing.unit_price <= 0 || newListing.quantity <= 0) {
        setError('Please fill in all required fields')
        return
      }

      const totalPrice = newListing.unit_price * newListing.quantity

      const { data, error: err } = await supabase
        .from('game_marketplace_listings')
        .insert([{
          seller_id: character.id,
          listing_type: newListing.listing_type,
          quantity: newListing.quantity,
          unit_price: newListing.unit_price,
          total_price: totalPrice,
          metadata: {
            description: newListing.description,
            item_name: newListing.item_name,
            property_type: newListing.property_type
          }
        }])
        .select()

      if (err) throw err

      setSuccess('Listing created successfully!')
      setNewListing({
        listing_type: 'item',
        item_name: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        property_type: null,
        property_name: null
      })
      setShowCreateListing(false)
      setError('')

      setTimeout(() => setSuccess(''), 3000)

      loadMyListings()
      if (onListingCreated) onListingCreated()
    } catch (err) {
      setError('Failed to create listing: ' + err.message)
    }
  }

  const handlePurchase = async (listing) => {
    try {
      if ((character.money || 0) < listing.total_price) {
        setError('Insufficient funds for this purchase')
        return
      }

      setPurchasing(listing.id)

      const charData = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', character.id)
        .single()

      if (!charData.data) throw new Error('Character not found')

      await supabase
        .from('game_characters')
        .update({
          money: (charData.data.money || 0) - listing.total_price
        })
        .eq('id', character.id)

      const sellerData = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', listing.seller_id)
        .single()

      if (sellerData.data) {
        await supabase
          .from('game_characters')
          .update({
            money: (sellerData.data.money || 0) + listing.total_price
          })
          .eq('id', listing.seller_id)
      }

      await supabase
        .from('game_transactions')
        .insert([{
          buyer_id: character.id,
          seller_id: listing.seller_id,
          quantity: listing.quantity,
          unit_price: listing.unit_price,
          total_price: listing.total_price,
          transaction_type: listing.listing_type === 'property' ? 'property_sale' : 'item_purchase'
        }])

      await supabase
        .from('game_marketplace_listings')
        .update({ status: 'sold' })
        .eq('id', listing.id)

      setSuccess('Purchase successful!')
      setError('')
      setTimeout(() => setSuccess(''), 3000)

      loadListings()
      loadMyListings()

      if (onPurchaseComplete) onPurchaseComplete(listing)
    } catch (err) {
      setError('Purchase failed: ' + err.message)
    } finally {
      setPurchasing(null)
    }
  }

  const handleCancelListing = async (listingId) => {
    try {
      await supabase
        .from('game_marketplace_listings')
        .update({ status: 'cancelled' })
        .eq('id', listingId)

      loadMyListings()
      setSuccess('Listing cancelled')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to cancel listing: ' + err.message)
    }
  }

  const getListingIcon = (type) => {
    const icons = {
      item: '📦',
      property: '🏠',
      service: '🔧',
      equipment: '⚔️'
    }
    return icons[type] || '📦'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">🏪 Marketplace</h2>
          <button
            onClick={() => setShowCreateListing(!showCreateListing)}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold transition-colors"
          >
            + Create Listing
          </button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-400">Your Balance: <span className="text-yellow-400 font-bold">₱{(character.money || 0).toLocaleString()}</span></p>
          <p className="text-slate-400">Active Listings: <span className="font-bold">{listings.length}</span></p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Create Listing Form */}
      {showCreateListing && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Create New Listing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-slate-300 text-sm block mb-2">Listing Type</label>
              <select
                value={newListing.listing_type}
                onChange={(e) => setNewListing({ ...newListing, listing_type: e.target.value })}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="item">Item</option>
                <option value="property">Property</option>
                <option value="service">Service</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-sm block mb-2">Item Name</label>
              <input
                type="text"
                value={newListing.item_name}
                onChange={(e) => setNewListing({ ...newListing, item_name: e.target.value })}
                placeholder="e.g., Nike Shoes, Prime Land"
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm block mb-2">Quantity</label>
              <input
                type="number"
                value={newListing.quantity}
                onChange={(e) => setNewListing({ ...newListing, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                min="1"
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm block mb-2">Price per Unit (₱)</label>
              <input
                type="number"
                value={newListing.unit_price}
                onChange={(e) => setNewListing({ ...newListing, unit_price: Math.max(0, parseInt(e.target.value) || 0) })}
                min="0"
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-300 text-sm block mb-2">Description</label>
              <textarea
                value={newListing.description}
                onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                placeholder="Describe your item or property..."
                rows="3"
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-700 rounded p-4 mb-4">
            <p className="text-slate-300 text-sm">Total Price: <span className="text-yellow-400 font-bold text-lg">₱{(newListing.quantity * newListing.unit_price).toLocaleString()}</span></p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCreateListing}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors"
            >
              Create Listing
            </button>
            <button
              onClick={() => setShowCreateListing(false)}
              className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* My Listings */}
      {myListings.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">📤 Your Active Listings ({myListings.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myListings.map(listing => (
              <div key={listing.id} className="bg-slate-700 rounded p-4 border border-slate-600">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-2xl">{getListingIcon(listing.listing_type)}</p>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Your Listing</span>
                </div>
                <p className="text-white font-bold text-sm mb-1">{listing.metadata?.item_name || 'Item'}</p>
                <p className="text-yellow-400 font-bold mb-3">₱{listing.unit_price?.toLocaleString()} ea</p>
                <button
                  onClick={() => handleCancelListing(listing.id)}
                  className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-bold transition-colors"
                >
                  Remove Listing
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-slate-300 text-sm block mb-2">Filter by Type</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Listings</option>
              <option value="item">Items</option>
              <option value="property">Properties</option>
              <option value="service">Services</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 text-sm block mb-2">Sort by</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="recent">Most Recent</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-4">🔄</div>
          <p>Loading marketplace...</p>
        </div>
      ) : listings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map(listing => (
            <div key={listing.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <p className="text-3xl">{getListingIcon(listing.listing_type)}</p>
                <span className={`px-2 py-1 text-xs rounded font-bold ${
                  listing.listing_type === 'property'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {listing.listing_type.charAt(0).toUpperCase() + listing.listing_type.slice(1)}
                </span>
              </div>

              <h3 className="font-bold text-white text-lg mb-1">{listing.metadata?.item_name || 'Item'}</h3>
              {listing.metadata?.description && (
                <p className="text-slate-400 text-xs mb-3 line-clamp-2">{listing.metadata.description}</p>
              )}

              <div className="bg-slate-700 rounded p-3 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Quantity:</span>
                  <span className="text-white font-bold">{listing.quantity}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-600 pt-2">
                  <span className="text-slate-400">Unit Price:</span>
                  <span className="text-yellow-400 font-bold">₱{listing.unit_price?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total:</span>
                  <span className="text-green-400 font-bold">₱{listing.total_price?.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => handlePurchase(listing)}
                disabled={purchasing === listing.id || (character.money || 0) < listing.total_price}
                className={`w-full py-2 rounded font-bold text-sm transition-colors ${
                  (character.money || 0) >= listing.total_price && purchasing !== listing.id
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
              >
                {purchasing === listing.id ? 'Processing...' : `Buy - ₱${listing.total_price?.toLocaleString()}`}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400 text-lg">No listings available matching your filters</p>
        </div>
      )}
    </div>
  )
}
