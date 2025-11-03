import React, { useState } from 'react'

export default function PropertyInteractionModal({
  property,
  character,
  isOpen,
  onClose,
  onBuy,
  onSell,
  onUpgrade,
  isDark = true
}) {
  const [action, setAction] = useState('view')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [upgradeAmount, setUpgradeAmount] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (!isOpen || !property) return null

  const canAfford = character && (character.money || 0) >= property.purchase_price
  const isOwner = property.owner_id === character?.id
  const canUpgrade = isOwner && upgradeAmount > 0

  const handleBuy = async () => {
    if (!canAfford) {
      setError('Insufficient funds')
      return
    }
    try {
      setLoading(true)
      await onBuy(property.id, property.purchase_price || property.current_value)
      setError('')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSell = async () => {
    try {
      setLoading(true)
      const salePrice = property.current_value || property.purchase_price || 0
      await onSell(property.id, salePrice)
      setError('')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (upgradeAmount <= 0) {
      setError('Invalid upgrade amount')
      return
    }
    if ((character?.money || 0) < upgradeAmount) {
      setError('Insufficient funds for upgrade')
      return
    }
    try {
      setLoading(true)
      await onUpgrade(property.id, upgradeAmount)
      setError('')
      setUpgradeAmount(0)
      setAction('view')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getPropertyTypeLabel = (type) => {
    const labels = {
      house: 'House',
      business: 'Business',
      farm: 'Farm',
      shop: 'Shop',
      factory: 'Factory'
    }
    return labels[type] || 'Property'
  }

  const monthlyRevenue = (property.revenue_per_day || 0) * 30
  const roi = property.current_value ? ((monthlyRevenue * 12) / property.current_value * 100).toFixed(1) : 0

  if (isCollapsed) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className={`${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} rounded-lg shadow-lg w-80 overflow-hidden`}>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-colors"
            onClick={() => setIsCollapsed(false)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <p className="text-sm font-bold flex-shrink-0 text-blue-300">{getPropertyTypeLabel(property.property_type)}</p>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-sm truncate">{property.name}</h3>
                  <p className="text-blue-100 text-xs truncate">{property.city}</p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsCollapsed(false)
                  }}
                  className="text-white hover:text-blue-200 text-lg p-1"
                  title="Expand"
                >
                  ⊡
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose()
                  }}
                  className="text-white hover:text-blue-200 text-lg p-1"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Value</span>
              <span className="font-bold text-yellow-400">₱{(property.current_value || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Daily Income</span>
              <span className="font-bold text-green-400">₱{(property.revenue_per_day || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Owner</span>
              <span className="font-bold text-blue-400">{isOwner ? 'You' : (property.owner_name || 'System')}</span>
            </div>
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors"
            >
              Expand Details
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 sticky top-0 border-b border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold mb-2 text-blue-200">{getPropertyTypeLabel(property.property_type)}</p>
              <h2 className="text-2xl font-bold text-white">{property.name}</h2>
              <p className="text-blue-100 text-sm mt-1">{property.city}, {property.province}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCollapsed(true)}
                className="text-white hover:text-blue-200 text-2xl"
                title="Collapse to side panel"
              >
                ⊟
              </button>
              <button
                onClick={onClose}
                className="text-white hover:text-blue-200 text-2xl"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Property Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-slate-400 text-xs">Current Value</p>
              <p className="text-xl font-bold text-yellow-400">₱{(property.current_value || 0).toLocaleString()}</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-slate-400 text-xs">Daily Revenue</p>
              <p className="text-xl font-bold text-green-400">₱{(property.revenue_per_day || 0).toLocaleString()}</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-slate-400 text-xs">Monthly Revenue</p>
              <p className="text-lg font-bold text-green-400">₱{monthlyRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-slate-400 text-xs">Annual ROI</p>
              <p className="text-lg font-bold text-blue-400">{roi}%</p>
            </div>
          </div>

          {/* Owner Info */}
          <div className="bg-slate-700 rounded p-4">
            <p className="text-slate-400 text-sm mb-2">Owner</p>
            <p className="text-white font-bold">{isOwner ? 'You own this property' : property.owner_name || 'System'}</p>
            {property.description && (
              <p className="text-slate-400 text-sm mt-3">{property.description}</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Action Tabs */}
          <div className="flex gap-2 border-b border-slate-700">
            <button
              onClick={() => setAction('view')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                action === 'view'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Details
            </button>
            {!isOwner && (
              <button
                onClick={() => setAction('buy')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  action === 'buy'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Buy
              </button>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => setAction('upgrade')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    action === 'upgrade'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Upgrade
                </button>
                <button
                  onClick={() => setAction('sell')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    action === 'sell'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sell
                </button>
              </>
            )}
          </div>

          {/* Action Content */}
          {action === 'view' && (
            <div className="space-y-4">
              <div className="bg-slate-700 rounded p-4">
                <h3 className="font-bold text-white mb-3">Property Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Type:</span>
                    <span className="font-bold capitalize">{property.property_type}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Workers:</span>
                    <span className="font-bold">{property.workers_count || 0} / {property.max_workers || 5}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Status:</span>
                    <span className="font-bold capitalize">{property.status || 'Active'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {action === 'buy' && !isOwner && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded p-4">
                <p className="text-amber-400 font-bold text-lg">₱{(property.current_value || 0).toLocaleString()}</p>
                <p className="text-amber-200 text-sm mt-2">Purchase price for this property</p>
              </div>
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-400 text-sm mb-2">Your Balance</p>
                <p className="text-2xl font-bold text-yellow-400">₱{(character?.money || 0).toLocaleString()}</p>
              </div>
              <button
                onClick={handleBuy}
                disabled={!canAfford || loading}
                className={`w-full py-3 rounded font-bold transition-colors ${
                  canAfford && !loading
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? 'Processing...' : `Buy Property - ₱${(property.current_value || 0).toLocaleString()}`}
              </button>
            </div>
          )}

          {action === 'upgrade' && isOwner && (
            <div className="space-y-4">
              <div className="bg-slate-700 rounded p-4">
                <label className="text-slate-300 text-sm block mb-2">Upgrade Cost (₱)</label>
                <input
                  type="number"
                  value={upgradeAmount}
                  onChange={(e) => setUpgradeAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-600 text-white' : 'bg-white text-slate-900 border border-slate-300'}`}
                  placeholder="Enter upgrade cost"
                  min="0"
                />
              </div>
              {upgradeAmount > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
                  <p className="text-blue-400 text-sm mb-2">Expected Benefits:</p>
                  <p className="text-white font-bold">New Daily Revenue: ₱{Math.round((property.revenue_per_day || 0) * 1.25).toLocaleString()}</p>
                  <p className="text-blue-200 text-sm mt-2">Property value increases by upgrade cost</p>
                </div>
              )}
              <button
                onClick={handleUpgrade}
                disabled={!canUpgrade || loading}
                className={`w-full py-3 rounded font-bold transition-colors ${
                  canUpgrade && !loading
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? 'Upgrading...' : `Upgrade for ₱${upgradeAmount.toLocaleString()}`}
              </button>
            </div>
          )}

          {action === 'sell' && isOwner && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-4">
                <p className="text-emerald-400 text-sm mb-2">Sale Price</p>
                <p className="text-2xl font-bold text-emerald-400">₱{(property.current_value || 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-300 text-sm mb-2">This property generates:</p>
                <p className="text-lg font-bold text-green-400">₱{monthlyRevenue.toLocaleString()}/month</p>
              </div>
              <button
                onClick={handleSell}
                disabled={loading}
                className={`w-full py-3 rounded font-bold transition-colors ${
                  !loading
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? 'Processing...' : 'Confirm Sale'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
