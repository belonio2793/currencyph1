import React, { useState, useEffect } from 'react'
import { gameAPI } from '../../lib/gameAPI'
import { propertyTycoonEngine } from '../../lib/propertyTycoonEngine'
import { propertyIncomeCollector } from '../../lib/propertyIncomeCollector'

export default function GameProperties({ character, properties, onPropertiesUpdate }) {
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [selectedPropertyType, setSelectedPropertyType] = useState(null)
  const [selectedPropertyForUpgrade, setSelectedPropertyForUpgrade] = useState(null)
  const [propertyName, setPropertyName] = useState('')
  const [buying, setBuying] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [collectingIncome, setCollectingIncome] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedProperties, setExpandedProperties] = useState(new Set())
  const [propertyTypes] = useState(() => propertyTycoonEngine.getPropertyTypes())
  const [upgradeTiers] = useState(() => propertyTycoonEngine.getUpgradeTiers())
  const [wealth, setWealth] = useState(null)
  const [incomeProjection, setIncomeProjection] = useState(null)

  // Load wealth and income projection
  useEffect(() => {
    if (character?.id) {
      loadCharacterWealth()
      loadIncomeProjection()
    }
  }, [character?.id, properties])

  const loadCharacterWealth = async () => {
    try {
      const w = await propertyTycoonEngine.calculateCharacterWealth(character.id)
      setWealth(w)
    } catch (err) {
      console.error('Error loading wealth:', err)
    }
  }

  const loadIncomeProjection = async () => {
    try {
      const proj = await propertyIncomeCollector.getIncomeProjection(character.id)
      setIncomeProjection(proj)
    } catch (err) {
      console.error('Error loading income projection:', err)
    }
  }

  const togglePropertyExpanded = (idx) => {
    const newExpanded = new Set(expandedProperties)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpandedProperties(newExpanded)
  }

  const handleCollectIncome = async () => {
    try {
      setCollectingIncome(true)
      setError('')
      const result = await propertyIncomeCollector.collectDailyIncome(character.id)
      
      if (result.collected) {
        setSuccess(`Income collected! ₱${(result.totalIncome || 0).toLocaleString()}`)
        setTimeout(() => setSuccess(''), 3000)
        
        // Reload character and wealth
        const updated = await gameAPI.getCharacter(character.id)
        if (updated && onPropertiesUpdate) {
          onPropertiesUpdate()
        }
        loadCharacterWealth()
      } else {
        setError(result.reason === 'already_collected_today' ? 'Already collected income today!' : result.reason)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setCollectingIncome(false)
    }
  }

  const handlePurchaseProperty = async () => {
    if (!selectedPropertyType || !propertyName.trim()) {
      setError('Please enter a property name and select a type')
      return
    }

    try {
      setBuying(true)
      setError('')
      const property = await propertyTycoonEngine.purchaseProperty(
        character.id,
        selectedPropertyType,
        {
          name: propertyName,
          city: character.current_location || 'Manila',
          province: character.current_location || 'Manila'
        }
      )

      setSuccess(`Property purchased: ${property.name}`)
      setTimeout(() => setSuccess(''), 3000)
      
      // Reset form
      setShowPurchaseDialog(false)
      setSelectedPropertyType(null)
      setPropertyName('')

      // Reload data
      const updated = await gameAPI.getCharacter(character.id)
      if (updated && onPropertiesUpdate) {
        onPropertiesUpdate()
      }
      loadCharacterWealth()
    } catch (err) {
      setError(err.message)
    } finally {
      setBuying(false)
    }
  }

  const handleUpgradeProperty = async () => {
    if (!selectedPropertyForUpgrade) return

    try {
      setUpgrading(true)
      setError('')
      const result = await propertyTycoonEngine.upgradeProperty(
        selectedPropertyForUpgrade.id,
        character.id
      )

      setSuccess(`Property upgraded to ${result.property.upgrade_level}! New income: ₱${result.newDailyIncome}/day`)
      setTimeout(() => setSuccess(''), 3000)

      setShowUpgradeDialog(false)
      setSelectedPropertyForUpgrade(null)

      // Reload data
      const updated = await gameAPI.getCharacter(character.id)
      if (updated && onPropertiesUpdate) {
        onPropertiesUpdate()
      }
      loadCharacterWealth()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpgrading(false)
    }
  }

  const getPropertySuggestions = () => {
    return propertyTycoonEngine.getPropertySuggestions(character?.money || 0)
  }

  const renderPropertyTierBadge = (upgradeLevel) => {
    const tier = upgradeTiers[upgradeLevel || 0]
    if (!tier) return null

    const colors = ['gray', 'blue', 'green', 'purple', 'yellow', 'red', 'pink', 'orange']
    const colorIndex = Math.min(upgradeLevel || 0, colors.length - 1)
    const colorMap = {
      gray: 'bg-gray-500',
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      pink: 'bg-pink-500',
      orange: 'bg-orange-500'
    }

    return (
      <span className={`px-3 py-1 ${colorMap[colors[colorIndex]]} text-white text-xs rounded-full font-bold`}>
        {tier.name} Tier
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Wealth Summary */}
      {wealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Liquid Assets</p>
            <p className="text-2xl font-bold text-green-400">₱{(character?.money || 0).toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Property Value</p>
            <p className="text-2xl font-bold text-yellow-400">₱{wealth.propertyValue.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Total Wealth</p>
            <p className="text-2xl font-bold text-blue-400">₱{wealth.totalWealth.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Monthly Income</p>
            <p className="text-2xl font-bold text-purple-400">₱{wealth.monthlyIncome.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Income Collection & Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {incomeProjection && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">Income Projection</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Daily</span>
                <span className="font-bold text-green-400">₱{incomeProjection.dailyIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Weekly</span>
                <span className="font-bold text-green-400">₱{incomeProjection.weeklyIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Monthly</span>
                <span className="font-bold text-green-400">₱{incomeProjection.monthlyIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-600">
                <span className="text-slate-400">Yearly</span>
                <span className="font-bold text-green-400">₱{incomeProjection.yearlyIncome.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={handleCollectIncome}
              disabled={collectingIncome}
              className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors font-bold"
            >
              {collectingIncome ? '⏳ Collecting...' : '🎯 Collect Income'}
            </button>
          </div>
        )}

        {/* Investment Suggestions */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">📊 Investment Suggestions</h3>
          <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {getPropertySuggestions().slice(0, 3).map((prop, idx) => (
              <div key={idx} className="bg-slate-700 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{prop.emoji} {prop.name}</span>
                  <span className="text-xs text-yellow-400">ROI: {prop.estimatedROI}%</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Cost: ₱{prop.basePrice.toLocaleString()}</span>
                  <span>Monthly: ₱{prop.monthlyIncome.toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-500">Break-even: {prop.roiMonths} months</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowPurchaseDialog(true)}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-bold"
          >
            🏗️ Buy Property
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
          ✅ {success}
        </div>
      )}

      {/* Properties List */}
      <div>
        <h3 className="text-xl font-bold mb-4">🏠 My Properties ({properties?.length || 0})</h3>
        {properties && properties.length > 0 ? (
          <div className="space-y-3">
            {properties.map((property, idx) => {
              const isExpanded = expandedProperties.has(idx)
              const typeDef = propertyTypes[property.property_type] || {}
              const upgradeTier = upgradeTiers[property.upgrade_level || 0] || {}

              return (
                <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  {/* Property Header */}
                  <div
                    onClick={() => togglePropertyExpanded(idx)}
                    className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <p className="text-3xl">{typeDef.emoji}</p>
                        <div>
                          <h3 className="text-lg font-bold">{property.name}</h3>
                          <p className="text-slate-400 text-sm">
                            {property.city}, {property.province}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-green-400 font-bold">₱{(property.revenue_per_day || 0).toLocaleString()}/day</p>
                          {renderPropertyTierBadge(property.upgrade_level)}
                        </div>
                        <button
                          className="p-2 hover:bg-slate-600 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePropertyExpanded(idx)
                          }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Property Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-700 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-700 rounded p-3">
                          <p className="text-slate-400 text-xs mb-1">Current Value</p>
                          <p className="font-bold text-yellow-400">₱{(property.current_value || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-700 rounded p-3">
                          <p className="text-slate-400 text-xs mb-1">Daily Revenue</p>
                          <p className="font-bold text-green-400">₱{(property.revenue_per_day || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-700 rounded p-3">
                          <p className="text-slate-400 text-xs mb-1">Monthly Income</p>
                          <p className="font-bold text-green-400">₱{((property.revenue_per_day || 0) * 30).toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-700 rounded p-3">
                          <p className="text-slate-400 text-xs mb-1">Tier Level</p>
                          <p className="font-bold text-purple-400">
                            {upgradeTier.name} ({property.upgrade_level || 0}/{propertyTypes[property.property_type]?.maxUpgrades || 5})
                          </p>
                        </div>
                      </div>

                      {property.workers_count > 0 && (
                        <div className="bg-slate-700 rounded p-3">
                          <p className="text-slate-400 text-xs mb-2">Workers</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">👥 {property.workers_count} / {property.max_workers}</span>
                            <div className="flex-1 ml-4 bg-slate-600 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-full rounded-full transition-all"
                                style={{ width: `${(property.workers_count / (property.max_workers || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setSelectedPropertyForUpgrade(property)
                            setShowUpgradeDialog(true)
                          }}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm font-medium"
                        >
                          ⬆️ Upgrade
                        </button>
                        <button className="flex-1 px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600 transition-colors text-sm">
                          👥 Manage
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <p className="text-slate-400 text-lg">No properties yet</p>
            <p className="text-slate-500 text-sm mt-2">Purchase your first property to start earning income!</p>
            <button
              onClick={() => setShowPurchaseDialog(true)}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-bold"
            >
              🏗️ Buy Your First Property
            </button>
          </div>
        )}
      </div>

      {/* Purchase Dialog */}
      {showPurchaseDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full p-6 border border-slate-700 max-h-96 overflow-y-auto">
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
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {Object.entries(propertyTypes).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedPropertyType(key)
                        setError('')
                      }}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        selectedPropertyType === key
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-2xl mb-1">{value.emoji}</div>
                      <p className="text-sm font-bold">{value.name}</p>
                      <p className="text-xs text-slate-400 mt-1">₱{value.basePrice.toLocaleString()}</p>
                      <p className="text-xs text-green-400 mt-1">{value.baseDailyIncome}/day</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedPropertyType && (
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
                        <span className="font-bold">₱{propertyTypes[selectedPropertyType].basePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Daily Revenue</span>
                        <span className="text-green-400 font-bold">₱{propertyTypes[selectedPropertyType].baseDailyIncome.toLocaleString()}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-600 flex justify-between">
                        <span className="text-slate-400">Your Balance</span>
                        <span className={`font-bold ${(character?.money || 0) >= propertyTypes[selectedPropertyType].basePrice ? 'text-green-400' : 'text-red-400'}`}>
                          ₱{(character?.money || 0).toLocaleString()}
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
                    setSelectedPropertyType(null)
                    setPropertyName('')
                    setError('')
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchaseProperty}
                  disabled={buying || !selectedPropertyType || !propertyName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-bold"
                >
                  {buying ? '⏳ Purchasing...' : '💳 Purchase'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Dialog */}
      {showUpgradeDialog && selectedPropertyForUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-slate-700">
            <h3 className="text-xl font-bold mb-4">⬆️ Upgrade Property</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-slate-700 rounded p-4">
                <p className="font-bold mb-2">{selectedPropertyForUpgrade.name}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Tier</span>
                    <span className="font-bold">{upgradeTiers[selectedPropertyForUpgrade.upgrade_level || 0]?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Income</span>
                    <span className="text-green-400 font-bold">₱{(selectedPropertyForUpgrade.revenue_per_day || 0).toLocaleString()}/day</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-600 pt-4">
                <p className="text-sm text-slate-400 mb-3">After Upgrade:</p>
                <div className="bg-slate-700 rounded p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">New Tier</span>
                      <span className="font-bold text-purple-400">
                        {upgradeTiers[(selectedPropertyForUpgrade.upgrade_level || 0) + 1]?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">New Income</span>
                      <span className="text-green-400 font-bold">
                        ₱{Math.floor((selectedPropertyForUpgrade.revenue_per_day || 0) * (upgradeTiers[(selectedPropertyForUpgrade.upgrade_level || 0) + 1]?.multiplier || 1.3)).toLocaleString()}/day
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-600">
                      <span className="text-slate-400">Upgrade Cost</span>
                      <span className="font-bold text-yellow-400">
                        ₱{Math.floor(
                          (propertyTypes[selectedPropertyForUpgrade.property_type]?.basePrice / 2) *
                          Math.pow(propertyTypes[selectedPropertyForUpgrade.property_type]?.upgradeCostMultiplier || 1.5, selectedPropertyForUpgrade.upgrade_level || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowUpgradeDialog(false)
                    setSelectedPropertyForUpgrade(null)
                    setError('')
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpgradeProperty}
                  disabled={upgrading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors font-bold"
                >
                  {upgrading ? '⏳ Upgrading...' : '⬆️ Upgrade'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
