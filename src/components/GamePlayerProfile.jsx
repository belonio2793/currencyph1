import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function GamePlayerProfile({ playerId, onClose }) {
  const [player, setPlayer] = useState(null)
  const [stats, setStats] = useState(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          if (playerId && user.id !== playerId) {
            loadFollowStatus(user.id, playerId)
            loadBlockStatus(user.id, playerId)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch current user:', err)
      }
    }
    getCurrentUser()
  }, [playerId])

  useEffect(() => {
    if (playerId) {
      loadPlayerData()
    }
  }, [playerId])

  async function loadPlayerData() {
    try {
      setLoading(true)
      setError('')

      // Load player character
      const { data: playerData, error: playerError } = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', playerId)
        .single()

      if (playerError) throw playerError
      setPlayer(playerData)

      // Load player stats from view
      const { data: statsData, error: statsError } = await supabase
        .from('player_trade_stats')
        .select('*')
        .eq('player_id', playerId)
        .single()

      if (!statsError && statsData) {
        setStats(statsData)
      }

      // Load player's active listings
      const { data: listingsData, error: listingsError } = await supabase
        .from('game_marketplace_listings')
        .select(`
          *,
          item:game_items(name, description),
          property:game_properties(name, location)
        `)
        .eq('seller_id', playerId)
        .eq('status', 'active')
        .limit(5)

      if (!listingsError) {
        setListings(listingsData || [])
      }
    } catch (err) {
      console.error('Failed to load player data:', err)
      setError(err.message || 'Failed to load player data')
    } finally {
      setLoading(false)
    }
  }

  async function loadFollowStatus(userId, targetId) {
    try {
      const { data, error } = await supabase
        .from('game_player_follows')
        .select('id')
        .eq('follower_id', userId)
        .eq('following_id', targetId)
        .single()

      if (!error && data) {
        setIsFollowing(true)
      } else {
        setIsFollowing(false)
      }
    } catch (err) {
      console.warn('Failed to load follow status:', err)
    }
  }

  async function loadBlockStatus(userId, targetId) {
    try {
      const { data, error } = await supabase
        .from('game_player_blocks')
        .select('id')
        .eq('blocker_id', userId)
        .eq('blocked_id', targetId)
        .single()

      if (!error && data) {
        setIsBlocked(true)
      } else {
        setIsBlocked(false)
      }
    } catch (err) {
      console.warn('Failed to load block status:', err)
    }
  }

  async function handleFollow() {
    if (!currentUserId || !playerId) return

    try {
      setActionLoading(true)

      if (isFollowing) {
        const { error } = await supabase
          .from('game_player_follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', playerId)

        if (error) throw error
        setIsFollowing(false)
      } else {
        const { error } = await supabase
          .from('game_player_follows')
          .insert([
            {
              follower_id: currentUserId,
              following_id: playerId,
              created_at: new Date().toISOString()
            }
          ])

        if (error) throw error
        setIsFollowing(true)
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleBlock() {
    if (!currentUserId || !playerId) return

    try {
      setActionLoading(true)

      if (isBlocked) {
        const { error } = await supabase
          .from('game_player_blocks')
          .delete()
          .eq('blocker_id', currentUserId)
          .eq('blocked_id', playerId)

        if (error) throw error
        setIsBlocked(false)
      } else {
        const { error } = await supabase
          .from('game_player_blocks')
          .insert([
            {
              blocker_id: currentUserId,
              blocked_id: playerId,
              created_at: new Date().toISOString()
            }
          ])

        if (error) throw error
        setIsBlocked(true)
      }
    } catch (err) {
      console.error('Failed to toggle block:', err)
    } finally {
      setActionLoading(false)
    }
  }

  function handleMessage() {
    if (!currentUserId || !playerId) return
    // This would navigate to a chat/messaging component
    console.log('Message functionality - navigate to chat with player:', playerId)
  }

  function handleTrade() {
    if (!currentUserId || !playerId) return
    // This would navigate to trade request component
    console.log('Trade functionality - initiate trade with player:', playerId)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-300">Loading player profile...</p>
        </div>
      </div>
    )
  }

  if (error || !player) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-sm">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Player Profile</h2>
          <p className="text-red-400 mb-4">{error || 'Player not found'}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-8 flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-24 h-24 bg-slate-800 rounded-lg overflow-hidden border-2 border-white/20 flex items-center justify-center">
              {player.appearance?.thumbnail ? (
                <img src={player.appearance.thumbnail} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                <div className="text-3xl">🎮</div>
              )}
            </div>

            {/* Info */}
            <div className="text-white">
              <h1 className="text-3xl font-bold">{player.name}</h1>
              <p className="text-purple-100 text-lg">Level {player.level || 1}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <div>
                  <p className="text-purple-200">Experience</p>
                  <p className="font-semibold">{(player.experience || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-purple-200">Wealth</p>
                  <p className="font-semibold text-green-300">₱{(player.wealth || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Trading Statistics */}
          {stats && (
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-4">Trading Statistics</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm mb-1">Total Trades</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.total_trades || 0}</p>
                </div>
                
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm mb-1">Average Rating</p>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-2xl font-bold text-yellow-400">{(stats.avg_rating || 0).toFixed(1)}</p>
                    <p className="text-xl">⭐</p>
                  </div>
                </div>
                
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm mb-1">Total Volume</p>
                  <p className="text-2xl font-bold text-green-400">₱{(stats.total_volume || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Trust Badge */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {stats && stats.total_trades > 10 ? (
                  <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-100">
                  {stats && stats.total_trades > 10 ? 'Trusted Seller' : 'New Member'}
                </p>
                <p className="text-sm text-slate-400">
                  {stats && stats.total_trades > 10
                    ? 'Verified through multiple successful trades'
                    : 'Build trust by completing trades'}
                </p>
              </div>
            </div>
          </div>

          {/* Active Listings */}
          {listings.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-4">Active Listings</h2>
              <div className="space-y-3">
                {listings.map(listing => (
                  <div key={listing.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-100">
                        {listing.listing_type === 'item' ? listing.item?.name : listing.property?.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {listing.quantity && listing.quantity > 1 ? `Qty: ${listing.quantity}` : listing.listing_type}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-green-400">₱{listing.unit_price.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Character Stats */}
          <div>
            <h2 className="text-xl font-bold text-slate-100 mb-4">Character Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-2">Joined</p>
                <p className="text-slate-100 font-semibold">
                  {player.created_at
                    ? new Date(player.created_at).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
              
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-2">Location</p>
                <p className="text-slate-100 font-semibold">{player.home_city || 'Unknown'}</p>
              </div>
              
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-2">Properties Owned</p>
                <p className="text-slate-100 font-semibold">{(player.properties || []).length}</p>
              </div>
              
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-2">Income Rate</p>
                <p className="text-slate-100 font-semibold">₱{(player.income_rate || 0).toLocaleString()}/hour</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
