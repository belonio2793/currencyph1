import React, { useState } from 'react'

export default function PropertyManager({ properties, character, onUpgrade, onSell, onClose }) {
  const [selectedProperty, setSelectedProperty] = useState(properties[0] || null)
  const [actionType, setActionType] = useState(null)

  const getPropertyIcon = (type) => {
    const icons = {
      house: '🏠',
      business: '🏢',
      farm: '🌾',
      shop: '🛍️',
      factory: '🏭',
      restaurant: '🍽️',
      hotel: '🏨',
      office: '🖼️'
    }
    return icons[type] || '🏠'
  }

  const calculateUpgradePrice = (property) => {
    const basePrice = property.price || 100000
    const upgradeLevel = property.upgrade_level || 0
    return Math.floor(basePrice * 0.3 * ((upgradeLevel + 1) ** 1.5))
  }

  const calculateUpgradeBenefit = (property) => {
    const incomeIncrease = (property.income || 10) * 0.2
    const valueIncrease = (property.current_value || property.price || 100000) * 0.15
    return { incomeIncrease, valueIncrease }
  }

  const upgradeCost = selectedProperty ? calculateUpgradePrice(selectedProperty) : 0
  const canUpgrade = selectedProperty && character && (character.wealth || 0) >= upgradeCost

  const sortedProperties = [...properties].sort((a, b) => (b.current_value || 0) - (a.current_value || 0))

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Property Management</h2>
            <p className="text-sm text-slate-400 mt-1">Total Properties: {properties.length}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex gap-4 p-6">
          {/* Properties List */}
          <div className="w-1/3 overflow-y-auto border border-slate-700 rounded-lg p-4">
            <h3 className="font-bold text-white mb-3">Your Properties</h3>
            {sortedProperties.length === 0 ? (
              <div className="text-slate-400 text-sm">No properties yet</div>
            ) : (
              <div className="space-y-2">
                {sortedProperties.map(property => (
                  <button
                    key={property.id}
                    onClick={() => setSelectedProperty(property)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedProperty?.id === property.id
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getPropertyIcon(property.property_type)}</span>
                      <div className="flex-1">
                        <div className="font-bold">{property.name}</div>
                        <div className="text-xs">₱{(property.current_value || 0).toLocaleString()}</div>
                      </div>
                      {property.upgrade_level > 0 && (
                        <div className="text-yellow-300 font-bold text-sm">⭐ {property.upgrade_level}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Property Details */}
          <div className="w-2/3 overflow-y-auto">
            {selectedProperty ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-3xl font-bold text-white mb-2">{selectedProperty.name}</h3>
                      <p className="text-blue-100">{selectedProperty.property_type?.toUpperCase()}</p>
                    </div>
                    <span className="text-5xl">{getPropertyIcon(selectedProperty.property_type)}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <div className="text-xs text-slate-400">Current Value</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      ₱{(selectedProperty.current_value || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <div className="text-xs text-slate-400">Monthly Income</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      ₱{(selectedProperty.income || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <div className="text-xs text-slate-400">Upgrade Level</div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {selectedProperty.upgrade_level || 0}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-bold text-white mb-3">Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-400">Purchase Price</div>
                      <div className="text-white font-bold">₱{(selectedProperty.price || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Location</div>
                      <div className="text-white font-bold">{selectedProperty.location || 'Unknown'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Owned Since</div>
                      <div className="text-white font-bold">
                        {new Date(selectedProperty.purchased_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">ROI</div>
                      <div className="text-emerald-400 font-bold">
                        {((selectedProperty.income || 0) / (selectedProperty.price || 1) * 100 * 12).toFixed(1)}% annually
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upgrade Info */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="font-bold text-white mb-3">Upgrade to Level {(selectedProperty.upgrade_level || 0) + 1}</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-400">Upgrade Cost</div>
                        <div className="text-yellow-400 font-bold text-lg">₱{upgradeCost.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Benefits</div>
                        <div className="text-emerald-400 font-bold">
                          +{calculateUpgradeBenefit(selectedProperty).incomeIncrease.toFixed(0)} income/mo
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded border border-slate-700 text-xs text-slate-300">
                      <div className="mb-2">Value increases by: +₱{calculateUpgradeBenefit(selectedProperty).valueIncrease.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      onUpgrade(selectedProperty.id, upgradeCost)
                    }}
                    disabled={!canUpgrade}
                    className={`px-4 py-3 rounded-lg font-bold transition-colors ${
                      canUpgrade
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    ⭐ Upgrade (₱{upgradeCost.toLocaleString()})
                  </button>
                  <button
                    onClick={() => {
                      onSell(selectedProperty.id, selectedProperty.current_value || selectedProperty.price)
                    }}
                    className="px-4 py-3 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    🏷️ Sell
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                Select a property to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
