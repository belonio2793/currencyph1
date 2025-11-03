import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { monopolyGameEngine } from '../../lib/monopolyGameEngine'

export default function PropertyMarket({ userId, character, onPropertyUpdate }) {
  const [properties, setProperties] = useState([])
  const [ownedProperties, setOwnedProperties] = useState([])
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [activeTab, setActiveTab] = useState('available')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Load available and owned properties
  useEffect(() => {
    if (!userId || !character) return
    loadProperties()
  }, [userId, character])

  async function loadProperties() {
    setLoading(true)
    try {
      const available = await monopolyGameEngine.getAvailableProperties(userId)
      setProperties(available || [])

      const owned = await monopolyGameEngine.getPlayerProperties(userId)
      setOwnedProperties(owned || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleBuyProperty(propertyId) {
    try {
      setError('')
      await monopolyGameEngine.purchaseProperty(userId, propertyId)
      setSuccess('Property purchased!')
      setTimeout(() => setSuccess(''), 3000)
      await loadProperties()
      onPropertyUpdate?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpgradeProperty(ownershipId) {
    try {
      setError('')
      await monopolyGameEngine.upgradeProperty(userId, ownershipId)
      setSuccess('Property upgraded!')
      setTimeout(() => setSuccess(''), 3000)
      await loadProperties()
      onPropertyUpdate?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleMortgageProperty(ownershipId) {
    try {
      setError('')
      if (confirm('Mortgage this property for half its value?')) {
        await monopolyGameEngine.mortgageProperty(userId, ownershipId)
        setSuccess('Property mortgaged!')
        setTimeout(() => setSuccess(''), 3000)
        await loadProperties()
        onPropertyUpdate?.()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUnmortgageProperty(ownershipId) {
    try {
      setError('')
      if (confirm('Unmortgage this property? (costs 10% interest)')) {
        await monopolyGameEngine.unmortgageProperty(userId, ownershipId)
        setSuccess('Property unmortgaged!')
        setTimeout(() => setSuccess(''), 3000)
        await loadProperties()
        onPropertyUpdate?.()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
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

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('available')}
          className={`px-4 py-3 font-semibold transition ${
            activeTab === 'available'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Available Properties ({properties.length})
        </button>
        <button
          onClick={() => setActiveTab('owned')}
          className={`px-4 py-3 font-semibold transition ${
            activeTab === 'owned'
              ? 'border-b-2 border-green-500 text-white'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          My Properties ({ownedProperties.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading properties...</div>
      ) : activeTab === 'available' ? (
        // Available Properties
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.length === 0 ? (
            <div className="text-slate-400 col-span-2">No available properties for your level</div>
          ) : (
            properties.map(prop => (
              <div
                key={prop.id}
                onClick={() => setSelectedProperty(prop)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                  selectedProperty?.id === prop.id
                    ? 'bg-slate-700/50 border-blue-500'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                {/* Color bar */}
                <div
                  className="w-full h-2 rounded mb-3"
                  style={{ backgroundColor: prop.icon_color || '#666' }}
                />

                <h3 className="font-bold text-white mb-2">{prop.name}</h3>
                <p className="text-xs text-slate-400 mb-3">{prop.location_city}, {prop.location_district}</p>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Purchase Price</span>
                    <span className="font-bold text-yellow-400">₱{prop.base_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Base Income</span>
                    <span className="font-bold text-green-400">₱{prop.base_income}/hour</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">House Cost</span>
                    <span className="font-bold">₱{(prop.house_cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-700">
                    <span className="text-slate-400">Your Balance</span>
                    <span className={`font-bold ${(character?.money || 0) >= prop.base_price ? 'text-green-400' : 'text-red-400'}`}>
                      ₱{(character?.money || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBuyProperty(prop.id)
                  }}
                  disabled={(character?.money || 0) < prop.base_price}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-semibold transition"
                >
                  Buy Property
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        // Owned Properties
        <div className="space-y-4">
          {ownedProperties.length === 0 ? (
            <div className="text-center py-12 text-slate-400">You don't own any properties yet</div>
          ) : (
            ownedProperties.map(ownership => (
              <div key={ownership.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                {/* Property Header */}
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{ownership.monopoly_properties.name}</h3>
                      <p className="text-sm text-slate-400">
                        {ownership.monopoly_properties.location_city}, {ownership.monopoly_properties.location_district}
                      </p>
                    </div>
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: ownership.monopoly_properties.icon_color || '#666' }}
                    />
                  </div>

                  {/* Status Indicators */}
                  <div className="flex gap-2">
                    {ownership.mortgaged && (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded font-semibold">
                        Mortgaged
                      </span>
                    )}
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                      {ownership.houses === 5 ? 'Hotel' : `${ownership.houses} House${ownership.houses !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>

                {/* Property Stats */}
                <div className="p-4 grid grid-cols-3 gap-3 bg-slate-700/30 border-b border-slate-700">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Passive Income</p>
                    <p className="text-lg font-bold text-green-400">₱{ownership.passive_income_rate.toFixed(0)}/h</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Total Earned</p>
                    <p className="text-lg font-bold text-blue-400">₱{ownership.total_income_earned.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Purchased</p>
                    <p className="text-sm text-slate-300">{new Date(ownership.acquired_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 flex gap-2">
                  {!ownership.mortgaged && ownership.houses < 5 && (
                    <button
                      onClick={() => handleUpgradeProperty(ownership.id)}
                      disabled={(character?.money || 0) < (ownership.monopoly_properties.house_cost || 0)}
                      className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded font-semibold transition text-sm"
                    >
                      Upgrade (₱{(ownership.monopoly_properties.house_cost || 0).toLocaleString()})
                    </button>
                  )}

                  {!ownership.mortgaged ? (
                    <button
                      onClick={() => handleMortgageProperty(ownership.id)}
                      className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold transition text-sm"
                    >
                      Mortgage
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnmortgageProperty(ownership.id)}
                      className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-semibold transition text-sm"
                    >
                      Unmortgage
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
