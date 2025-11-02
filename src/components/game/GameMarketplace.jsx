import React, { useState, useEffect } from 'react'
import { gameAPI } from '../../lib/gameAPI'

export default function GameMarketplace({ character, onInventoryUpdate }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [buying, setBuying] = useState(null)

  useEffect(() => {
    loadListings()
  }, [filter])

  const loadListings = async () => {
    try {
      setLoading(true)
      const data = await gameAPI.getMarketplaceListings(
        filter !== 'all' ? { listing_type: filter } : {}
      )
      setListings(data)
    } catch (err) {
      setError('Failed to load listings: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (listing) => {
    if ((character.money || 0) < listing.total_price) {
      setError('Insufficient funds')
      return
    }

    try {
      setBuying(listing.id)
      await gameAPI.purchaseFromMarketplace(character.id, listing.id)
      setError('')
      onInventoryUpdate()
      await loadListings()
    } catch (err) {
      setError('Purchase failed: ' + err.message)
    } finally {
      setBuying(null)
    }
  }

  const getItemIcon = (itemType) => {
    const icons = {
      clothing: '👕',
      equipment: '💼',
      tool: '🛠️',
      consumable: '🍎',
      weapon: '💼',
      armor: '🧥',
      accessory: '💍',
      property: '🏠'
    }
    return icons[itemType] || '📦'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">🏪 Marketplace</h2>
        <div className="flex items-center justify-between">
          <p className="text-slate-400">Your Balance: <span className="text-yellow-400 font-bold">₱{(character.money || 0).toLocaleString()}</span></p>
          <p className="text-slate-400">Total Listings: <span className="font-bold">{listings.length}</span></p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'item', 'property', 'service'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">
          Loading marketplace...
        </div>
      ) : listings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing, idx) => {
            const isOwnListing = listing.seller_id === character.id
            const item = listing.game_items
            const property = listing.game_properties

            return (
              <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-3xl">{getItemIcon(listing.listing_type)}</p>
                  </div>
                  {isOwnListing && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                      Your Listing
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-lg mb-2">
                  {item?.name || property?.name || 'Unknown Item'}
                </h3>

                {item && (
                  <>
                    <p className="text-xs text-slate-400 mb-2">{item.brand || 'Unbranded'}</p>
                    <p className="text-xs text-slate-400 mb-3 line-clamp-2">{item.description}</p>
                  </>
                )}

                {property && (
                  <>
                    <p className="text-xs text-slate-400 mb-2">{property.city}, {property.province}</p>
                    <p className="text-xs text-slate-400 mb-3">Revenue: ₱{property.revenue_per_day?.toLocaleString()}/day</p>
                  </>
                )}

                <div className="bg-slate-700 rounded p-3 mb-3">
                  <p className="text-slate-400 text-xs">Seller: <span className="text-slate-200">{listing.seller?.name}</span></p>
                  <p className="text-slate-400 text-xs mt-1">Quantity: <span className="font-bold">{listing.quantity}</span></p>
                </div>

                <div className="border-t border-slate-600 pt-3 mb-3">
                  <p className="text-slate-400 text-xs">Price per Unit</p>
                  <p className="text-yellow-400 font-bold text-lg">₱{listing.unit_price?.toLocaleString()}</p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 mb-4">
                  <p className="text-slate-400 text-xs">Total Price</p>
                  <p className="text-blue-400 font-bold text-xl">₱{listing.total_price?.toLocaleString()}</p>
                </div>

                {!isOwnListing && (
                  <button
                    onClick={() => handlePurchase(listing)}
                    disabled={buying === listing.id || (character.money || 0) < listing.total_price}
                    className={`w-full px-4 py-2 rounded font-bold transition-colors ${
                      (character.money || 0) < listing.total_price
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50`}
                  >
                    {buying === listing.id ? '⏳ Purchasing...' : '💳 Buy Now'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
          <p className="text-slate-400 text-lg">No listings available</p>
          <p className="text-slate-500 text-sm mt-2">Start selling items to see them here</p>
        </div>
      )}
    </div>
  )
}
