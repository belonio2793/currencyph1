import React, { useState } from 'react'
import { gameAPI } from '../../lib/gameAPI'

export default function GameInventory({ character, inventory, onInventoryUpdate }) {
  const [selectedItem, setSelectedItem] = useState(null)
  const [sellMode, setSellMode] = useState(false)
  const [sellPrice, setSellPrice] = useState('')
  const [listing, setListing] = useState(false)
  const [error, setError] = useState('')

  const handleSellItem = async (item) => {
    if (!sellPrice || sellPrice <= 0) {
      setError('Please enter a valid price')
      return
    }

    try {
      setListing(true)
      await gameAPI.createMarketplaceListing(character.id, {
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: parseInt(sellPrice),
        total_price: item.quantity * parseInt(sellPrice),
        listing_type: 'item'
      })

      setError('')
      setSellMode(false)
      setSellPrice('')
      setSelectedItem(null)
      onInventoryUpdate()
    } catch (err) {
      setError('Failed to create listing: ' + err.message)
    } finally {
      setListing(false)
    }
  }

  const getItemLabel = (itemType) => {
    const labels = {
      clothing: 'Clothing',
      equipment: 'Equipment',
      tool: 'Tool',
      consumable: 'Consumable',
      weapon: 'Weapon',
      armor: 'Armor',
      accessory: 'Accessory'
    }
    return labels[itemType] || 'Item'
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Inventory Summary */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Inventory</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-700 rounded p-4">
            <p className="text-slate-400 text-sm">Total Items</p>
            <p className="text-3xl font-bold">{inventory.length}</p>
          </div>
          <div className="bg-slate-700 rounded p-4">
            <p className="text-slate-400 text-sm">Total Weight</p>
            <p className="text-3xl font-bold">{inventory.reduce((sum, item) => sum + (item.quantity || 0), 0)}</p>
          </div>
          <div className="bg-slate-700 rounded p-4">
            <p className="text-slate-400 text-sm">Estimated Value</p>
            <p className="text-3xl font-bold text-yellow-400">₱{inventory.reduce((sum, item) => sum + (item.game_items?.base_price || 0) * (item.quantity || 1), 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      {inventory.length > 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Items</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-700 rounded-lg p-4 border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => {
                  if (selectedItem?.id === item.id) {
                    setSelectedItem(null)
                  } else {
                    setSelectedItem(item)
                    setSellMode(false)
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-300 mb-1">{getItemLabel(item.game_items?.item_type)}</p>
                    <p className="font-bold mt-1">{item.game_items?.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.game_items?.brand || 'Unbranded'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Qty</p>
                    <p className="text-xl font-bold">{item.quantity}</p>
                  </div>
                </div>

                {item.game_items?.description && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{item.game_items.description}</p>
                )}

                <div className="mt-3 pt-3 border-t border-slate-600">
                  <p className="text-xs text-slate-400">Unit Price</p>
                  <p className="text-yellow-400 font-bold">₱{(item.game_items?.base_price || 0).toLocaleString()}</p>
                </div>

                {selectedItem?.id === item.id && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSellMode(true)
                      }}
                      className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                    >
                      Sell Item
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
          <p className="text-slate-400">Your inventory is empty. Hunt for items!</p>
        </div>
      )}

      {/* Sell Dialog */}
      {sellMode && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-slate-700">
            <h3 className="text-xl font-bold mb-4">Sell {selectedItem.game_items?.name}</h3>

            <div className="space-y-4">
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-400 text-sm">Quantity Available</p>
                <p className="text-2xl font-bold">{selectedItem.quantity}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Price per Item</label>
                <input
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="Enter price..."
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
                  min="1"
                />
              </div>

              {sellPrice && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
                  <p className="text-slate-400 text-sm">Total Value</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    ₱{(parseInt(sellPrice || 0) * selectedItem.quantity).toLocaleString()}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setSellMode(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSellItem(selectedItem)}
                  disabled={listing || !sellPrice}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {listing ? 'Listing...' : 'List Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
