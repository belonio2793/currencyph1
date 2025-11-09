import React, { useState, useEffect } from 'react'
import { showReward } from './FloatingRewards'
import { playSounds } from '../../lib/gameSoundSystem'

export default function PropertyManagementOverlay({
  properties = [],
  character = null,
  onBuyProperty = null,
  onUpgradeProperty = null,
  onSellProperty = null,
  onClose = null
}) {
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [selling, setSelling] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  const PROPERTY_TYPES = [
    { type: 'house', name: 'House', basePrice: 50000, baseIncome: 500, icon: '🏠', color: 'from-orange-400 to-orange-600' },
    { type: 'business', name: 'Small Business', basePrice: 100000, baseIncome: 1500, icon: '🏪', color: 'from-blue-400 to-blue-600' },
    { type: 'farm', name: 'Farm', basePrice: 75000, baseIncome: 1000, icon: '🌾', color: 'from-green-400 to-green-600' },
    { type: 'restaurant', name: 'Restaurant', basePrice: 200000, baseIncome: 3000, icon: '🍽️', color: 'from-red-400 to-red-600' },
    { type: 'hotel', name: 'Hotel', basePrice: 500000, baseIncome: 8000, icon: '🏨', color: 'from-cyan-400 to-cyan-600' },
    { type: 'factory', name: 'Factory', basePrice: 300000, baseIncome: 5000, icon: '🏭', color: 'from-purple-400 to-purple-600' }
  ]

  const UPGRADE_TIERS = [
    { level: 1, multiplier: 1, name: 'Standard', costMultiplier: 1, incomeMultiplier: 1 },
    { level: 2, multiplier: 1.5, name: 'Enhanced', costMultiplier: 0.3, incomeMultiplier: 1.5 },
    { level: 3, multiplier: 2, name: 'Premium', costMultiplier: 0.5, incomeMultiplier: 2 },
    { level: 4, multiplier: 2.5, name: 'Luxury', costMultiplier: 0.75, incomeMultiplier: 2.5 },
    { level: 5, multiplier: 3, name: 'Legendary', costMultiplier: 1.25, incomeMultiplier: 3 }
  ]

  const getPropertyType = (type) => PROPERTY_TYPES.find(p => p.type === type)
  const getTierInfo = (level) => UPGRADE_TIERS.find(t => t.level === level) || UPGRADE_TIERS[0]

  const handleBuyProperty = (type) => {
    const propType = getPropertyType(type)
    if (!propType || !character) return

    const cost = propType.basePrice
    if (character.wealth < cost) {
      alert(`Not enough money! Need ₱${cost.toLocaleString()}, you have ₱${character.wealth.toLocaleString()}`)
      return
    }

    if (onBuyProperty) {
      onBuyProperty({
        type,
        name: propType.name,
        price: cost,
        income: propType.baseIncome,
        upgrade_level: 1
      })

      showReward('property', propType.name, { text: `Bought ${propType.name}!` })
      playSounds.property()
    }
  }

  const handleUpgradeProperty = (propertyId) => {
    if (!selectedProperty) return

    const currentLevel = selectedProperty.upgrade_level || 1
    const nextLevel = currentLevel + 1

    if (nextLevel > 5) {
      alert('Property is already at max level!')
      return
    }

    const currentTier = getTierInfo(currentLevel)
    const nextTier = getTierInfo(nextLevel)

    const basePrice = getPropertyType(selectedProperty.property_type)?.basePrice || 50000
    const upgradeCost = Math.floor(basePrice * nextTier.costMultiplier)

    if (character.wealth < upgradeCost) {
      alert(`Not enough money! Need ₱${upgradeCost.toLocaleString()}, you have ₱${character.wealth.toLocaleString()}`)
      return
    }

    if (onUpgradeProperty) {
      onUpgradeProperty(propertyId, {
        upgrade_level: nextLevel,
        current_value: basePrice * nextTier.multiplier,
        income_per_day: (getPropertyType(selectedProperty.property_type)?.baseIncome || 0) * nextTier.incomeMultiplier
      })

      showReward('property', nextTier.name, { text: `Upgraded to ${nextTier.name}!` })
      playSounds.property()
      setShowUpgradeModal(false)
      setSelectedProperty(null)
    }
  }

  const handleSellProperty = (propertyId) => {
    if (!selectedProperty) return

    if (onSellProperty) {
      const sellPrice = selectedProperty.current_value || 50000
      onSellProperty(propertyId, sellPrice)

      showReward('money', Math.floor(sellPrice), { text: `Sold for ₱${sellPrice.toLocaleString()}!` })
      playSounds.property()
      setSelectedProperty(null)
    }
  }

  const getTotalIncome = () => {
    return (properties || []).reduce((sum, p) => sum + ((p.income_per_day || p.income || 0)), 0)
  }

  const getTotalValue = () => {
    return (properties || []).reduce((sum, p) => sum + ((p.current_value || p.price || 0)), 0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg border border-cyan-500/30 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-b border-cyan-500/20 flex justify-between items-center">
          <h2 className="text-xl font-bold text-cyan-300 flex items-center gap-2">
            🏠 Property Management
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
              <div className="text-sm text-slate-400">Properties</div>
              <div className="text-2xl font-bold text-cyan-300">{properties?.length || 0}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
              <div className="text-sm text-slate-400">Daily Income</div>
              <div className="text-2xl font-bold text-green-300">₱{getTotalIncome().toLocaleString()}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
              <div className="text-sm text-slate-400">Total Value</div>
              <div className="text-2xl font-bold text-yellow-300">₱{getTotalValue().toLocaleString()}</div>
            </div>
          </div>

          {/* Your properties */}
          {properties && properties.length > 0 && (
            <div>
              <h3 className="text-cyan-300 font-bold mb-3">Your Properties</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {properties.map((prop, idx) => {
                  const propType = getPropertyType(prop.property_type)
                  const tier = getTierInfo(prop.upgrade_level || 1)

                  return (
                    <div
                      key={prop.id || idx}
                      onClick={() => setSelectedProperty(prop)}
                      className={`p-3 rounded cursor-pointer transition ${
                        selectedProperty?.id === prop.id
                          ? 'bg-cyan-500/20 border border-cyan-400'
                          : 'bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{propType?.icon || '🏠'}</span>
                          <div>
                            <div className="font-bold text-slate-200">{prop.name}</div>
                            <div className="text-xs text-slate-400">Level {prop.upgrade_level || 1} • {tier.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-300">+₱{(prop.income_per_day || prop.income || 0).toLocaleString()}</div>
                          <div className="text-xs text-slate-400">₱{(prop.current_value || prop.price || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected property actions */}
          {selectedProperty && (
            <div className="bg-slate-800/50 rounded p-4 border border-cyan-500/20 space-y-3">
              <h4 className="font-bold text-cyan-300">{selectedProperty.name}</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowUpgradeModal(true)
                  }}
                  disabled={selectedProperty.upgrade_level >= 5}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm font-bold transition"
                >
                  ⬆️ Upgrade
                </button>
                <button
                  onClick={() => handleSellProperty(selectedProperty.id)}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded text-sm font-bold transition"
                >
                  💸 Sell
                </button>
              </div>
            </div>
          )}

          {/* Buy new property */}
          <div>
            <h3 className="text-cyan-300 font-bold mb-3">Buy Property</h3>
            <div className="grid grid-cols-2 gap-3">
              {PROPERTY_TYPES.map(prop => (
                <button
                  key={prop.type}
                  onClick={() => handleBuyProperty(prop.type)}
                  disabled={!character || character.wealth < prop.basePrice}
                  className={`p-3 rounded border transition ${
                    character && character.wealth >= prop.basePrice
                      ? `bg-gradient-to-b ${prop.color} border-${prop.color.split('-')[1]}-400/50 hover:opacity-80 text-white`
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl mb-1">{prop.icon}</div>
                  <div className="font-bold text-xs">{prop.name}</div>
                  <div className="text-xs">₱{prop.basePrice.toLocaleString()}</div>
                  <div className="text-xs opacity-75">+₱{prop.baseIncome}/day</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade modal */}
      {showUpgradeModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowUpgradeModal(false)}>
          <div
            className="bg-slate-900 rounded-lg border border-cyan-500/30 p-6 max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-cyan-300 mb-4">Upgrade {selectedProperty.name}</h3>
            <div className="space-y-3 mb-6">
              {UPGRADE_TIERS.slice(selectedProperty.upgrade_level || 1).map(tier => {
                const basePrice = getPropertyType(selectedProperty.property_type)?.basePrice || 50000
                const cost = Math.floor(basePrice * tier.costMultiplier)
                const income = Math.floor((getPropertyType(selectedProperty.property_type)?.baseIncome || 0) * tier.incomeMultiplier)

                return (
                  <div key={tier.level} className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                    <div className="font-bold text-slate-200">{tier.name}</div>
                    <div className="text-sm text-slate-400">
                      Cost: ₱{cost.toLocaleString()} | Income: +₱{income}/day
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  handleUpgradeProperty(selectedProperty.id)
                  setShowUpgradeModal(false)
                }}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold transition"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-bold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
