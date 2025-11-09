import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { gameMarketplace } from '../lib/gameMarketplace'

export default function MarketplaceWidget({ characterId, onOpenMarketplace }) {
  const [stats, setStats] = useState(null)
  const [recentListings, setRecentListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingOffers, setPendingOffers] = useState(0)

  useEffect(() => {
    if (characterId) {
      loadMarketplaceData()
      const subscription = setupRealtimeUpdates()
      return () => {
        if (subscription) subscription.unsubscribe()
      }
    }
  }, [characterId])

  async function loadMarketplaceData() {
    try {
      setLoading(true)

      // Load market stats
      const marketStats = await gameMarketplace.getMarketStats()
      setStats(marketStats)

      // Load recent trending listings
      const trending = await gameMarketplace.getTrendingListings(3)
      setRecentListings(trending || [])

      // Load pending offers count
      if (characterId) {
        const { data: offers } = await supabase
          .from('game_trade_offers')
          .select('id')
          .eq('seller_id', characterId)
          .eq('status', 'pending')

        setPendingOffers(offers?.length || 0)
      }
    } catch (err) {
      console.error('Failed to load marketplace widget data:', err)
    } finally {
      setLoading(false)
    }
  }

  function setupRealtimeUpdates() {
    return supabase
      .channel('marketplace-stats')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_marketplace_listings' },
        () => loadMarketplaceData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_trade_offers' },
        () => loadMarketplaceData()
      )
      .subscribe()
  }

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-slate-700 rounded mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded"></div>
          <div className="h-4 bg-slate-700 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span className="text-xl">🛍️</span> Marketplace
        </h3>
        <button
          onClick={onOpenMarketplace}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white font-medium transition-colors"
        >
          Open
        </button>
      </div>

      {/* Market Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-700/50 rounded p-2">
            <p className="text-xs text-slate-400 mb-1">7-Day Volume</p>
            <p className="font-bold text-green-400 text-sm">₱{(stats.totalVolume / 1000).toFixed(1)}K</p>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <p className="text-xs text-slate-400 mb-1">Avg Price</p>
            <p className="font-bold text-blue-400 text-sm">₱{stats.averagePrice.toLocaleString()}</p>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <p className="text-xs text-slate-400 mb-1">Trades</p>
            <p className="font-bold text-purple-400 text-sm">{stats.transactionCount}</p>
          </div>
        </div>
      )}

      {/* Pending Offers Badge */}
      {pendingOffers > 0 && (
        <div className="bg-amber-600/20 border border-amber-600/40 rounded-lg p-3 text-center">
          <p className="text-amber-300 font-semibold text-sm">
            🔔 {pendingOffers} pending offer{pendingOffers !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Recent Listings */}
      {recentListings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-semibold uppercase">Trending Now</p>
          <div className="space-y-1">
            {recentListings.map(listing => (
              <div
                key={listing.id}
                className="bg-slate-700/30 rounded p-2 text-xs hover:bg-slate-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 truncate">
                    {listing.item?.name || 'Item'}
                  </span>
                  <span className="text-green-400 font-semibold text-xs flex-shrink-0 ml-2">
                    ₱{listing.unit_price.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="pt-3 border-t border-slate-700 grid grid-cols-2 gap-2">
        <button
          onClick={onOpenMarketplace}
          className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 rounded text-xs text-blue-300 font-medium transition-colors"
        >
          📊 Browse
        </button>
        <button
          onClick={onOpenMarketplace}
          className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 rounded text-xs text-green-300 font-medium transition-colors"
        >
          📦 Sell Item
        </button>
      </div>
    </div>
  )
}
