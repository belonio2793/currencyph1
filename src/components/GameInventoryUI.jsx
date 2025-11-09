import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function GameInventoryUI({ characterId, onClose }) {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRarity, setFilterRarity] = useState('all')

  useEffect(() => {
    if (characterId) {
      loadInventory()
      const subscription = setupRealtimeUpdates()
      return () => {
        if (subscription) subscription.unsubscribe()
      }
    }
  }, [characterId])

  async function loadInventory() {
    try {
      setLoading(true)
      setError('')

      const { data, error: inventoryError } = await supabase
        .from('game_inventory')
        .select(`
          id,
          character_id,
          item_id,
          quantity,
          item:game_items(
            id,
            name,
            description,
            rarity,
            category,
            icon,
            base_value
          )
        `)
        .eq('character_id', characterId)
        .gt('quantity', 0)
        .order('quantity', { ascending: false })

      if (inventoryError) throw inventoryError
      setInventory(data || [])
    } catch (err) {
      console.error('Failed to load inventory:', err)
      setError(err.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  function setupRealtimeUpdates() {
    return supabase
      .channel(`inventory-${characterId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_inventory', filter: `character_id=eq.${characterId}` },
        () => loadInventory()
      )
      .subscribe()
  }

  const filteredInventory = inventory.filter(inv => {
    const matchesSearch = !searchQuery || 
      inv.item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.item?.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRarity = filterRarity === 'all' || inv.item?.rarity === filterRarity
    
    return matchesSearch && matchesRarity
  })

  const rarityColors = {
    common: { bg: 'bg-slate-700', border: 'border-slate-600', text: 'text-slate-100' },
    uncommon: { bg: 'bg-green-700', border: 'border-green-600', text: 'text-green-100' },
    rare: { bg: 'bg-blue-700', border: 'border-blue-600', text: 'text-blue-100' },
    epic: { bg: 'bg-purple-700', border: 'border-purple-600', text: 'text-purple-100' },
    legendary: { bg: 'bg-yellow-700', border: 'border-yellow-600', text: 'text-yellow-100' }
  }

  const rarityEmojis = {
    common: '🔲',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    legendary: '⭐'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-300">Loading inventory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-4 space-y-3">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterRarity('all')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                filterRarity === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All Items
            </button>
            {Object.entries(rarityColors).map(([rarity]) => (
              <button
                key={rarity}
                onClick={() => setFilterRarity(rarity)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  filterRarity === rarity
                    ? `${rarityColors[rarity].bg} ${rarityColors[rarity].text}`
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {rarityEmojis[rarity]} {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-600/10 border border-red-600/20 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Inventory Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              {searchQuery || filterRarity !== 'all' ? 'No items match your search' : 'Your inventory is empty'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInventory.map(inv => {
                const rarity = inv.item?.rarity || 'common'
                const colors = rarityColors[rarity]
                return (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedItem(selectedItem?.id === inv.id ? null : inv)}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      selectedItem?.id === inv.id
                        ? 'border-blue-500 bg-slate-800'
                        : `${colors.border} bg-slate-800 hover:border-blue-400`
                    }`}
                  >
                    {/* Icon and Rarity */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-4xl">{inv.item?.icon || '📦'}</div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${colors.bg} ${colors.text}`}>
                        {rarityEmojis[rarity]} {rarity}
                      </span>
                    </div>

                    {/* Item Name and Category */}
                    <h3 className="font-bold text-slate-100 mb-1">{inv.item?.name}</h3>
                    {inv.item?.category && (
                      <p className="text-xs text-slate-400 mb-2">{inv.item.category}</p>
                    )}

                    {/* Quantity */}
                    <div className="mb-3 pt-3 border-t border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Quantity</span>
                        <span className="text-lg font-bold text-blue-400">{inv.quantity}</span>
                      </div>
                    </div>

                    {/* Value */}
                    {inv.item?.base_value && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Base Value</span>
                        <span className="text-slate-100 font-semibold">₱{inv.item.base_value.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Description */}
                    {inv.item?.description && selectedItem?.id === inv.id && (
                      <p className="text-xs text-slate-300 mt-3 pt-3 border-t border-slate-700">
                        {inv.item.description}
                      </p>
                    )}

                    {/* Total Value */}
                    {inv.item?.base_value && (
                      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                        <span className="text-slate-300 font-medium text-sm">Total Value</span>
                        <span className="text-lg font-bold text-green-400">
                          ₱{(inv.item.base_value * inv.quantity).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="bg-slate-800/50 border-t border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-slate-300">
              Total Items: <span className="font-bold text-slate-100">{filteredInventory.reduce((sum, i) => sum + i.quantity, 0)}</span>
            </div>
            <div className="text-slate-300">
              Total Value: <span className="font-bold text-green-400">
                ₱{filteredInventory.reduce((sum, i) => sum + (i.item?.base_value || 0) * i.quantity, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
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
