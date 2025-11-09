import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { gameMarketplace } from '../lib/gameMarketplace'

export default function CreateMarketplaceListing({ characterId, onClose, onSuccess }) {
  const [listingType, setListingType] = useState('item') // item or property
  const [inventory, setInventory] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Item listing form
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  
  // Property listing form
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [askingPrice, setAskingPrice] = useState('')

  useEffect(() => {
    loadCharacterAssets()
  }, [characterId])

  async function loadCharacterAssets() {
    try {
      setLoading(true)
      setError('')

      // Load inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('game_inventory')
        .select(`
          id,
          character_id,
          item_id,
          quantity,
          item:game_items(id, name, description, rarity)
        `)
        .eq('character_id', characterId)
        .gt('quantity', 0)

      if (inventoryError) throw inventoryError
      setInventory(inventoryData || [])

      // Load properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('game_properties')
        .select('*')
        .eq('owner_id', characterId)
        .neq('status', 'sold')

      if (propertiesError) throw propertiesError
      setProperties(propertiesData || [])
    } catch (err) {
      console.error('Failed to load character assets:', err)
      setError(err.message || 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateItemListing(e) {
    e.preventDefault()
    
    if (!selectedItem) {
      setError('Please select an item')
      return
    }

    if (!quantity || quantity < 1) {
      setError('Quantity must be at least 1')
      return
    }

    if (!unitPrice || unitPrice < 1) {
      setError('Price must be at least 1')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      await gameMarketplace.createItemListing(
        characterId,
        selectedItem.item.id,
        parseInt(quantity),
        parseInt(unitPrice)
      )

      setError('')
      onSuccess?.()
      onClose?.()
    } catch (err) {
      console.error('Failed to create listing:', err)
      setError(err.message || 'Failed to create listing')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreatePropertyListing(e) {
    e.preventDefault()
    
    if (!selectedProperty) {
      setError('Please select a property')
      return
    }

    if (!askingPrice || askingPrice < 1) {
      setError('Price must be at least 1')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      await gameMarketplace.createPropertyListing(
        characterId,
        selectedProperty.id,
        parseInt(askingPrice)
      )

      setError('')
      onSuccess?.()
      onClose?.()
    } catch (err) {
      console.error('Failed to create listing:', err)
      setError(err.message || 'Failed to create listing')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-300">Loading your assets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Create Marketplace Listing</h1>
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
          
          {/* Listing Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">What are you selling?</label>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setListingType('item')
                  setSelectedProperty(null)
                  setAskingPrice('')
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors border-2 ${
                  listingType === 'item'
                    ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                📦 Item
              </button>
              <button
                onClick={() => {
                  setListingType('property')
                  setSelectedItem(null)
                  setQuantity(1)
                  setUnitPrice('')
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors border-2 ${
                  listingType === 'property'
                    ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                🏠 Property
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-600/10 border border-red-600/20 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* ITEM LISTING FORM */}
          {listingType === 'item' && (
            <form onSubmit={handleCreateItemListing} className="space-y-4">
              {inventory.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  You have no items in your inventory to sell
                </div>
              ) : (
                <>
                  {/* Item Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Select Item</label>
                    <select
                      value={selectedItem?.id || ''}
                      onChange={(e) => {
                        const item = inventory.find(i => i.id === e.target.value)
                        setSelectedItem(item)
                      }}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Choose an item...</option>
                      {inventory.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.item?.name} (You have {item.quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedItem && (
                    <>
                      {/* Quantity */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Quantity (You have {selectedItem.quantity})
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={selectedItem.quantity}
                          value={quantity}
                          onChange={(e) => setQuantity(Math.min(selectedItem.quantity, parseInt(e.target.value) || 1))}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Unit Price */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Price per Item (₱)</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          placeholder="Enter price per item"
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Summary */}
                      {unitPrice && (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">Total Price ({quantity} × ₱{unitPrice}):</span>
                            <span className="text-2xl font-bold text-green-400">
                              ₱{(quantity * unitPrice).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Listing expires in 30 days</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || !selectedItem || !quantity || !unitPrice}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                      >
                        {submitting ? 'Creating...' : 'Create Listing'}
                      </button>
                    </>
                  )}
                </>
              )}
            </form>
          )}

          {/* PROPERTY LISTING FORM */}
          {listingType === 'property' && (
            <form onSubmit={handleCreatePropertyListing} className="space-y-4">
              {properties.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  You don't own any properties to sell
                </div>
              ) : (
                <>
                  {/* Property Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Select Property</label>
                    <select
                      value={selectedProperty?.id || ''}
                      onChange={(e) => {
                        const prop = properties.find(p => p.id === e.target.value)
                        setSelectedProperty(prop)
                        if (prop) setAskingPrice(prop.current_value || '')
                      }}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Choose a property...</option>
                      {properties.map(prop => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name} (Current value: ₱{prop.current_value?.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProperty && (
                    <>
                      {/* Property Info */}
                      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
                        <p className="text-sm text-slate-400">
                          <span className="text-slate-300 font-medium">Location:</span> {selectedProperty.location}
                        </p>
                        <p className="text-sm text-slate-400">
                          <span className="text-slate-300 font-medium">Current Value:</span> ₱{selectedProperty.current_value?.toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-400">
                          <span className="text-slate-300 font-medium">Daily Income:</span> ₱{selectedProperty.revenue_per_day?.toLocaleString() || '0'}
                        </p>
                      </div>

                      {/* Asking Price */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Asking Price (₱)</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={askingPrice}
                          onChange={(e) => setAskingPrice(e.target.value)}
                          placeholder="Enter asking price"
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Summary */}
                      {askingPrice && (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-300">Asking Price:</span>
                              <span className="text-2xl font-bold text-green-400">₱{parseInt(askingPrice).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">vs Market Value:</span>
                              <span className={
                                parseInt(askingPrice) > selectedProperty.current_value 
                                  ? 'text-yellow-400' 
                                  : 'text-blue-400'
                              }>
                                {parseInt(askingPrice) > selectedProperty.current_value ? '+' : ''}{(parseInt(askingPrice) - selectedProperty.current_value).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Listing expires in 60 days</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || !selectedProperty || !askingPrice}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                      >
                        {submitting ? 'Creating...' : 'Create Listing'}
                      </button>
                    </>
                  )}
                </>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
