import React, { useState } from 'react'

export default function PropertyManagementPanel({
  character,
  properties = [],
  market = [],
  onBuyProperty,
  onUpgradeProperty,
  onSellProperty,
  onCollectIncome,
  wealth = 0,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('inventory') // 'inventory', 'market', 'build'
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [sortBy, setSortBy] = useState('value') // 'value', 'income', 'level'

  const sortProperties = (props) => {
    const sorted = [...props]
    switch (sortBy) {
      case 'income':
        return sorted.sort((a, b) => (b.income || 0) - (a.income || 0))
      case 'level':
        return sorted.sort((a, b) => (b.upgrade_level || 0) - (a.upgrade_level || 0))
      case 'value':
      default:
        return sorted.sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
    }
  }

  const formatCurrency = (n) => `₱${Number(n || 0).toLocaleString()}`

  const totalPropertyValue = properties.reduce((sum, p) => sum + (p.current_value || 0), 0)
  const totalIncome = properties.reduce((sum, p) => sum + (p.income || 0), 0)

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-900/60 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-100">🏢 Property Empire Manager</h2>
          {onClose && <button onClick={onClose} className="text-slate-400 hover:text-slate-100">✕</button>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="p-2 bg-slate-800/40 rounded">
            <div className="text-slate-400 text-xs">Total Portfolio</div>
            <div className="font-bold text-green-400">{formatCurrency(totalPropertyValue)}</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded">
            <div className="text-slate-400 text-xs">Monthly Income</div>
            <div className="font-bold text-yellow-400">{formatCurrency(totalIncome * 36)}</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded">
            <div className="text-slate-400 text-xs">Properties Owned</div>
            <div className="font-bold text-blue-400">{properties.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-900/40">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'inventory'
              ? 'bg-slate-700 text-slate-100 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          📦 Inventory ({properties.length})
        </button>
        <button
          onClick={() => setActiveTab('market')}
          className={`flex-1 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'market'
              ? 'bg-slate-700 text-slate-100 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          🛍️ Marketplace
        </button>
        <button
          onClick={() => setActiveTab('build')}
          className={`flex-1 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'build'
              ? 'bg-slate-700 text-slate-100 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          🔨 Building Guide
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'inventory' && (
          <div className="space-y-3">
            {properties.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-4xl mb-2">🏚️</div>
                <p>No properties yet. Buy some from the marketplace!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-100">Your Properties</h3>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-100"
                  >
                    <option value="value">Sort by Value</option>
                    <option value="income">Sort by Income</option>
                    <option value="level">Sort by Level</option>
                  </select>
                </div>

                {sortProperties(properties).map((prop) => {
                  const upgradeCost = Math.floor(prop.price * (0.25 * (prop.upgrade_level + 1)))
                  const canUpgrade = wealth >= upgradeCost

                  return (
                    <div
                      key={prop.id + (prop.purchased_at || '')}
                      onClick={() => setSelectedProperty(prop)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedProperty?.id === prop.id
                          ? 'bg-emerald-600/20 border-emerald-500'
                          : 'bg-slate-900/40 border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-2">
                            <span className="text-xl">🏠</span>
                            {prop.name}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Purchased {prop.purchased_at ? new Date(prop.purchased_at).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-yellow-400">{formatCurrency(prop.current_value)}</div>
                          <div className="text-xs text-slate-400">Lvl {prop.upgrade_level || 0}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div className="bg-slate-800/60 p-2 rounded">
                          <div className="text-slate-400">Income/10s</div>
                          <div className="font-bold text-emerald-400">{formatCurrency(prop.income)}</div>
                        </div>
                        <div className="bg-slate-800/60 p-2 rounded">
                          <div className="text-slate-400">Monthly</div>
                          <div className="font-bold text-emerald-400">{formatCurrency(prop.income * 36)}</div>
                        </div>
                      </div>

                      {selectedProperty?.id === prop.id && (
                        <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onUpgradeProperty) onUpgradeProperty(prop.id)
                              setSelectedProperty(null)
                            }}
                            disabled={!canUpgrade}
                            className={`w-full px-3 py-2 rounded text-white font-medium text-sm transition-colors ${
                              canUpgrade
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : 'bg-slate-600 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            ⬆️ Upgrade (₱{upgradeCost}) {!canUpgrade && '- Need ' + formatCurrency(upgradeCost - wealth)}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onCollectIncome) onCollectIncome(prop.id)
                              setSelectedProperty(null)
                            }}
                            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white font-medium text-sm"
                          >
                            💰 Collect Income
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Sell ${prop.name} for ${formatCurrency(Math.floor(prop.price * 0.7))}?`)) {
                                if (onSellProperty) onSellProperty(prop.id)
                                setSelectedProperty(null)
                              }
                            }}
                            className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium text-sm"
                          >
                            🛑 Sell (70% refund)
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {activeTab === 'market' && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-100 mb-3">Available Properties</h3>
            {market.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No properties available in the marketplace.</p>
              </div>
            ) : (
              market.map((item) => {
                const canBuy = wealth >= item.price
                return (
                  <div key={item.id} className="p-3 bg-slate-900/40 border border-slate-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          <span className="text-xl">🏘️</span>
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Generates ₱{item.income} income every 10 seconds
                        </div>
                      </div>
                      <div className="text-right font-bold text-yellow-400">{formatCurrency(item.price)}</div>
                    </div>

                    <button
                      onClick={() => {
                        if (onBuyProperty) onBuyProperty(item)
                        setSelectedProperty(null)
                      }}
                      disabled={!canBuy}
                      className={`w-full px-3 py-2 rounded text-white font-medium text-sm transition-colors ${
                        canBuy
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-slate-600 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {canBuy ? '✓ Buy Property' : `Need ${formatCurrency(item.price - wealth)} more`}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {activeTab === 'build' && (
          <div className="space-y-4 text-slate-300 text-sm">
            <div className="p-3 bg-slate-900/40 border border-slate-700 rounded-lg">
              <h4 className="font-semibold text-slate-100 mb-2">💡 Property Empire Building Guide</h4>
              <ul className="space-y-2 text-xs">
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Start with Sari-Sari Stores</strong> - Affordable and reliable income</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Diversify Portfolio</strong> - Own different property types for stability</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Upgrade Strategically</strong> - Higher level = Higher returns</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Collect Regularly</strong> - Don't leave passive income sitting!</span>
                </li>
              </ul>
            </div>

            <div className="p-3 bg-slate-900/40 border border-slate-700 rounded-lg">
              <h4 className="font-semibold text-slate-100 mb-2">📊 Property Types</h4>
              <div className="space-y-2">
                <div className="p-2 bg-slate-800/60 rounded">
                  <div className="font-medium">Sari-Sari Store</div>
                  <div className="text-xs text-slate-400">Low risk, steady income. Perfect for beginners.</div>
                </div>
                <div className="p-2 bg-slate-800/60 rounded">
                  <div className="font-medium">Food Cart</div>
                  <div className="text-xs text-slate-400">Medium risk/reward. More profitable than stores.</div>
                </div>
                <div className="p-2 bg-slate-800/60 rounded">
                  <div className="font-medium">Tricycle Business</div>
                  <div className="text-xs text-slate-400">High reward! Requires more capital but worth it.</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
              <h4 className="font-semibold text-blue-300 mb-2">🎯 Achievement Milestones</h4>
              <ul className="space-y-1 text-xs text-blue-200">
                <li>• Own 2 properties → Unlock intermediate properties</li>
                <li>• Generate ₱100/10s income → Building master badge</li>
                <li>• Own all property types → Property empire achievement</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 p-3 bg-slate-900/40 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Current Wallet: <strong className="text-slate-100">{formatCurrency(wealth)}</strong></span>
          <span>Portfolio Health: <strong className="text-emerald-400">●●●●○</strong></span>
        </div>
      </div>
    </div>
  )
}
