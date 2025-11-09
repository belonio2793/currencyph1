import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function TradingMarket({ characterId, onClose }) {
  const [listings, setListings] = useState([])
  const [myListings, setMyListings] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateListing, setShowCreateListing] = useState(false)
  const [newListing, setNewListing] = useState({
    itemType: 'property', // 'property', 'item', 'currency'
    description: '',
    askPrice: 0
  })
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('browse') // 'browse', 'myListings'

  useEffect(() => {
    loadListings()
    loadMyListings()
  }, [characterId])

  const loadListings = async () => {
    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('game_marketplace_listings')
        .select(`
          id,
          seller_id,
          item_type,
          description,
          ask_price,
          created_at,
          seller:game_characters(name, level)
        `)
        .eq('status', 'active')
        .neq('seller_id', characterId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (err) throw err
      setListings(data || [])
    } catch (err) {
      console.error('Error loading listings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMyListings = async () => {
    try {
      const { data, error: err } = await supabase
        .from('game_marketplace_listings')
        .select('*')
        .eq('seller_id', characterId)
        .order('created_at', { ascending: false })

      if (err) throw err
      setMyListings(data || [])
    } catch (err) {
      console.error('Error loading my listings:', err)
    }
  }

  const handleCreateListing = async (e) => {
    e.preventDefault()
    
    if (!newListing.description.trim() || newListing.askPrice <= 0) {
      setError('Please fill in all fields with valid values')
      return
    }

    try {
      setLoading(true)
      const { error: err } = await supabase
        .from('game_marketplace_listings')
        .insert([{
          seller_id: characterId,
          item_type: newListing.itemType,
          description: newListing.description,
          ask_price: newListing.askPrice,
          status: 'active'
        }])

      if (err) throw err

      setNewListing({ itemType: 'property', description: '', askPrice: 0 })
      setShowCreateListing(false)
      setError('')
      await Promise.all([loadListings(), loadMyListings()])
    } catch (err) {
      setError(err.message || 'Failed to create listing')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelListing = async (listingId) => {
    try {
      const { error: err } = await supabase
        .from('game_marketplace_listings')
        .update({ status: 'cancelled' })
        .eq('id', listingId)

      if (err) throw err
      await loadMyListings()
    } catch (err) {
      setError(err.message || 'Failed to cancel listing')
    }
  }

  const handleMakeTrade = async (listing) => {
    const tradeMessage = `I would like to trade for: ${listing.description}`
    // In a full implementation, this would open a trade negotiation modal
    alert(`Trade offer for: ${listing.description}\n\nAsking price: ${listing.ask_price} credits\n\nYou would need to contact: ${listing.seller.name}`)
  }

  const getItemIcon = (itemType) => {
    const icons = {
      property: '🏠',
      item: '📦',
      currency: '💰'
    }
    return icons[itemType] || '📦'
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">🤝 Trading Market</h2>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
        >
          Close
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === 'browse'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Browse Listings ({listings.length})
        </button>
        <button
          onClick={() => setActiveTab('myListings')}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === 'myListings'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          My Listings ({myListings.length})
        </button>
      </div>

      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <div>
          {loading ? (
            <div className="text-center text-slate-400 py-8">Loading listings...</div>
          ) : listings.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No active listings available. Check back later!
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {listings.map(listing => (
                <div key={listing.id} className="p-4 bg-slate-900/30 border border-slate-700 rounded hover:border-slate-600">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getItemIcon(listing.item_type)}</span>
                      <div>
                        <div className="font-semibold text-slate-100">{listing.description}</div>
                        <div className="text-xs text-slate-400">
                          Seller: {listing.seller.name} (Lvl {listing.seller.level})
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-yellow-300">{listing.ask_price}</div>
                      <div className="text-xs text-slate-400">credits</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleMakeTrade(listing)}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
                  >
                    Make Offer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Listings Tab */}
      {activeTab === 'myListings' && (
        <div>
          {!showCreateListing && (
            <button
              onClick={() => setShowCreateListing(true)}
              className="w-full mb-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white font-medium"
            >
              + Create New Listing
            </button>
          )}

          {showCreateListing && (
            <form onSubmit={handleCreateListing} className="mb-4 p-4 bg-slate-900/30 border border-slate-700 rounded">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Item Type</label>
                  <select
                    value={newListing.itemType}
                    onChange={(e) => setNewListing({ ...newListing, itemType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
                  >
                    <option value="property">Property</option>
                    <option value="item">Item</option>
                    <option value="currency">Currency Bundle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={newListing.description}
                    onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                    placeholder="e.g., Sari-Sari Store at Makati"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Ask Price (Credits)</label>
                  <input
                    type="number"
                    value={newListing.askPrice}
                    onChange={(e) => setNewListing({ ...newListing, askPrice: Number(e.target.value) })}
                    placeholder="0"
                    min="1"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white disabled:opacity-50"
                  >
                    Create Listing
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateListing(false)}
                    className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {myListings.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No active listings. Create one to start trading!
            </div>
          ) : (
            <div className="space-y-3">
              {myListings
                .filter(l => l.status === 'active')
                .map(listing => (
                  <div key={listing.id} className="p-4 bg-slate-900/30 border border-emerald-600/30 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-slate-100">{listing.description}</div>
                        <div className="text-xs text-slate-400">{listing.item_type}</div>
                      </div>
                      <div className="text-lg font-bold text-yellow-300">{listing.ask_price}</div>
                    </div>
                    <button
                      onClick={() => handleCancelListing(listing.id)}
                      className="w-full px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-sm"
                    >
                      Cancel Listing
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-slate-900/30 rounded border border-slate-700 text-xs text-slate-400">
        <strong>Trading Tips:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>List properties, items, or currency bundles for trade</li>
          <li>Other players can make offers on your listings</li>
          <li>All trades are negotiable - both parties must agree</li>
          <li>The Trading Market is community-driven and trust-based</li>
        </ul>
      </div>
    </div>
  )
}
