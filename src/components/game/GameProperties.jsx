import React, { useState, useEffect } from 'react'
import { gameAPI } from '../../lib/gameAPI'

const PROPERTY_TYPES = {
  house: { name: 'House', emoji: '🏠', basePrice: 50000, dailyRevenue: 100 },
  business: { name: 'Business', emoji: '🏢', basePrice: 100000, dailyRevenue: 500 },
  farm: { name: 'Farm', emoji: '🌾', basePrice: 75000, dailyRevenue: 300 },
  shop: { name: 'Shop', emoji: '🏪', basePrice: 80000, dailyRevenue: 400 },
  factory: { name: 'Factory', emoji: '🏭', basePrice: 200000, dailyRevenue: 1000 }
}

export default function GameProperties({ character, properties }) {
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const [selectedType, setSelectedType] = useState(null)
  const [propertyName, setPropertyName] = useState('')
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState('')

  const handlePurchaseProperty = async () => {
    if (!selectedType || !propertyName.trim()) {
      setError('Please enter a property name')
      return
    }

    const propType = PROPERTY_TYPES[selectedType]
    if ((character.money || 0) < propType.basePrice) {
      setError('Insufficient funds')
      return
    }

    try {
      setBuying(true)
      await gameAPI.purchaseProperty(character.id, {
        property_type: selectedType,
        location_x: Math.random() * 300,
        location_y: Math.random() * 350,
        province: character.current_location,
        city: character.current_location,
        name: propertyName,
        description: `A beautiful ${propType.name.toLowerCase()}`,
        purchase_price: propType.basePrice,
        current_value: propType.basePrice,
        revenue_per_day: propType.dailyRevenue
      })

      setError('')
      setShowPurchaseDialog(false)
      setSelectedType(null)
      setPropertyName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBuying(false)
    }
  }

  const getTotalMonthlyRevenue = () => {
    return properties.reduce((sum, p) => sum + ((p.revenue_per_day || 0) * 30), 0)
  }

  const getTotalPropertyValue = () => {
    return properties.reduce((sum, p) => sum + (p.current_value || 0), 0)
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total Properties</p>
          <p className="text-3xl font-bold mt-1">{properties.length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total Value</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">
            ₱{getTotalPropertyValue().toLocaleString()}
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Monthly Revenue</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            ₱{getTotalMonthlyRevenue().toLocaleString()}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Purchase Button */}
      <button
        onClick={() => setShowPurchaseDialog(true)}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
      >
        🏗️ Purchase Property
      </button>

      {/* Properties List */}
      {properties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map((property, idx) => {
            const type = PROPERTY_TYPES[property.property_type]
            const monthlyRevenue = (property.revenue_per_day || 0) * 30

            return (
              <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-4xl">{type?.emoji}</p>
                    <h3 className="text-xl font-bold mt-2">{property.name}</h3>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded">
                    {property.status}
                  </span>
                </div>

                <p className="text-slate-400 text-sm mb-4">
                  {property.city}, {property.province}
                </p>

                <div className="space-y-2 bg-slate-700 rounded p-4 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Property Value</span>
                    <span className="font-bold text-yellow-400">₱{(property.current_value || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Daily Revenue</span>
                    <span className="font-bold text-green-400">₱{(property.revenue_per_day || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-600">
                    <span className="text-slate-400">Monthly Revenue</span>
                    <span className="font-bold text-green-400">₱{monthlyRevenue.toLocaleString()}</span>
                  </div>
                </div>

                {property.workers_count > 0 && (
                  <div className="text-sm text-slate-400 mb-4">
                    👥 {property.workers_count} / {property.max_workers} Workers
                  </div>
                )}

                <button className="w-full px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600 transition-colors text-sm">
                  ⚙️ Manage Property
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
          <p className="text-slate-400 text-lg">No properties yet</p>
          <p className="text-slate-500 text-sm mt-2">Purchase a property to generate passive income</p>
        </div>
      )}

      {/* Purchase Dialog */}
      {showPurchaseDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-slate-700">
            <h3 className="text-xl font-bold mb-4">🏗️ Purchase Property</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Property Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Property Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PROPERTY_TYPES).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedType(key)
                        setError('')
                      }}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        selectedType === key
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-2xl mb-1">{value.emoji}</div>
                      <p className="text-sm font-bold">{value.name}</p>
                      <p className="text-xs text-slate-400 mt-1">₱{value.basePrice.toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedType && (
                <>
                  {/* Property Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Property Name</label>
                    <input
                      type="text"
                      value={propertyName}
                      onChange={(e) => setPropertyName(e.target.value)}
                      placeholder="Enter property name..."
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Cost Summary */}
                  <div className="bg-slate-700 rounded p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Purchase Price</span>
                        <span className="font-bold">₱{PROPERTY_TYPES[selectedType].basePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Daily Revenue</span>
                        <span className="text-green-400 font-bold">₱{PROPERTY_TYPES[selectedType].dailyRevenue.toLocaleString()}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-600 flex justify-between">
                        <span className="text-slate-400">Your Balance</span>
                        <span className={`font-bold ${(character.money || 0) >= PROPERTY_TYPES[selectedType].basePrice ? 'text-green-400' : 'text-red-400'}`}>
                          ₱{(character.money || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowPurchaseDialog(false)
                    setSelectedType(null)
                    setPropertyName('')
                    setError('')
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchaseProperty}
                  disabled={buying || !selectedType || !propertyName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-bold"
                >
                  {buying ? '⏳ Purchasing...' : '💳 Purchase'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
