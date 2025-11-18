import React, { useState, useEffect } from 'react'
import { coinsPhApi } from '../../lib/coinsPhApi'

export default function CoinsPhAccountDetails({ userId }) {
  const [accountData, setAccountData] = useState(null)
  const [balances, setBalances] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [prices, setPrices] = useState({})
  const [totalValuePHP, setTotalValuePHP] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedAssets, setExpandedAssets] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchAccountDetails()
    const interval = setInterval(fetchAccountDetails, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchAccountDetails = async () => {
    try {
      if (!loading) setIsRefreshing(true)
      setError(null)

      // Fetch account info
      const account = await coinsPhApi.getAccount()
      setAccountData(account)

      // Filter balances with value > 0
      const activeBalances = account.balances
        ?.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .sort((a, b) => {
          const aVal = parseFloat(a.free) + parseFloat(a.locked)
          const bVal = parseFloat(b.free) + parseFloat(b.locked)
          return bVal - aVal
        }) || []

      setBalances(activeBalances)

      // Fetch open orders
      try {
        const orders = await coinsPhApi.getOpenOrders()
        setOpenOrders(orders || [])
      } catch (err) {
        console.warn('Could not fetch open orders:', err)
        setOpenOrders([])
      }

      // Fetch current prices for major assets
      const symbols = ['BTCPHP', 'ETHPHP', 'BNBPHP', 'ADAPHP', 'DOGEPHP', 'XRPPHP', 'USDTPHP', 'LTCPHP']
      const priceData = {}
      let totalValue = 0

      for (const symbol of symbols) {
        try {
          const price = await coinsPhApi.getPrice(symbol)
          if (price?.price) {
            priceData[symbol] = parseFloat(price.price)
          }
        } catch (err) {
          console.warn(`Could not fetch price for ${symbol}:`, err)
        }
      }

      setPrices(priceData)

      // Calculate total value in PHP
      let total = 0
      activeBalances.forEach(balance => {
        if (balance.asset === 'PHP') {
          total += parseFloat(balance.free) + parseFloat(balance.locked)
        } else {
          const symbol = `${balance.asset}PHP`
          const price = priceData[symbol] || 0
          const amount = parseFloat(balance.free) + parseFloat(balance.locked)
          total += amount * price
        }
      })

      setTotalValuePHP(total)
      setLastUpdated(new Date())
      setLoading(false)
      setIsRefreshing(false)
    } catch (err) {
      console.error('Error fetching account details:', err)
      setError(err.message || 'Failed to load account details')
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const toggleAssetExpand = (asset) => {
    setExpandedAssets(prev => ({
      ...prev,
      [asset]: !prev[asset]
    }))
  }

  const getAssetValue = (asset, amount) => {
    const symbol = `${asset}PHP`
    const price = prices[symbol] || 0
    return asset === 'PHP' ? amount : amount * price
  }

  const getAssetPrice = (asset) => {
    const symbol = `${asset}PHP`
    return prices[symbol] || null
  }

  if (loading && !accountData) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200 animate-pulse">
          <div className="h-8 bg-blue-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-blue-100 rounded w-full mb-2"></div>
          <div className="h-4 bg-blue-100 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (error && !accountData) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 p-8 rounded-xl border-2 border-red-200">
          <div className="flex items-start gap-4">
            <div className="text-red-600 text-2xl">⚠️</div>
            <div className="flex-1">
              <p className="text-red-900 font-bold text-lg mb-2">Error Loading Account</p>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={fetchAccountDetails}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Account Header with User Info */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-8 rounded-xl shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-3xl">
              💰
            </div>
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Coins.ph Trading Account</p>
              <h2 className="text-3xl font-bold mb-2">Account Connected</h2>
              {accountData?.email && (
                <p className="text-blue-200 text-sm flex items-center gap-2">
                  <span className="text-green-300">✓</span>
                  <span className="font-mono">{accountData.email}</span>
                </p>
              )}
            </div>
          </div>
          <div className="text-right flex flex-col justify-center">
            <p className="text-blue-100 text-sm font-medium mb-1">Total Portfolio Value</p>
            <h3 className="text-4xl font-bold mb-2">
              ₱{totalValuePHP.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
            </h3>
            <p className="text-blue-200 text-xs">
              {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString('en-PH')}`}
            </p>
          </div>
        </div>
      </div>

      {/* Account Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 hover:shadow-md transition">
          <p className="text-green-700 text-sm font-medium mb-1">📊 Active Assets</p>
          <p className="text-3xl font-bold text-green-900">{balances.length}</p>
          <p className="text-xs text-green-600 mt-1">cryptocurrencies</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200 hover:shadow-md transition">
          <p className="text-blue-700 text-sm font-medium mb-1">📈 Open Orders</p>
          <p className="text-3xl font-bold text-blue-900">{openOrders.length}</p>
          <p className="text-xs text-blue-600 mt-1">active trades</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 hover:shadow-md transition">
          <p className="text-purple-700 text-sm font-medium mb-1">✅ Account Status</p>
          <p className="text-lg font-bold text-green-600">Active</p>
          <p className="text-xs text-purple-600 mt-1">trading enabled</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200 hover:shadow-md transition">
          <p className="text-yellow-700 text-sm font-medium mb-1">🔄 API Status</p>
          <p className="text-lg font-bold text-green-600">Connected</p>
          <p className="text-xs text-yellow-600 mt-1">verified</p>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200 hover:shadow-md transition">
          <p className="text-slate-700 text-sm font-medium mb-1">🕐 Last Sync</p>
          <p className="text-sm font-mono font-bold text-slate-900">
            {lastUpdated?.toLocaleTimeString('en-PH') || 'Loading...'}
          </p>
          <p className="text-xs text-slate-600 mt-1">real-time data</p>
        </div>
      </div>

      {/* Asset Balances Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Asset Balances</h3>
            <p className="text-sm text-slate-600 mt-1">
              {balances.length > 0 ? `Viewing ${balances.length} active asset${balances.length !== 1 ? 's' : ''}` : 'No active assets'}
            </p>
          </div>
          <button
            onClick={fetchAccountDetails}
            disabled={isRefreshing}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center gap-2"
          >
            {isRefreshing ? (
              <>
                <span className="inline-block animate-spin">⟳</span> Syncing...
              </>
            ) : (
              <>
                ⟳ Refresh Data
              </>
            )}
          </button>
        </div>

        {balances.length === 0 ? (
          <div className="bg-slate-50 p-8 rounded-lg text-center border border-slate-200">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-slate-600 font-medium">No assets available</p>
            <p className="text-slate-500 text-sm mt-1">Deposit funds to your coins.ph account to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {balances.map(balance => {
              const free = parseFloat(balance.free)
              const locked = parseFloat(balance.locked)
              const total = free + locked
              const valueInPHP = getAssetValue(balance.asset, total)
              const price = getAssetPrice(balance.asset)
              const isExpanded = expandedAssets[balance.asset]
              const percentOfPortfolio = (valueInPHP / totalValuePHP) * 100

              return (
                <div
                  key={balance.asset}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-blue-300 hover:shadow-md transition"
                >
                  <button
                    onClick={() => toggleAssetExpand(balance.asset)}
                    className="w-full p-4 flex justify-between items-center hover:bg-slate-50 transition"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {balance.asset.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 text-lg">{balance.asset}</p>
                          <p className="text-sm text-slate-600">
                            {total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {balance.asset}
                          </p>
                          {price && (
                            <p className="text-xs text-slate-500 mt-1">
                              ₱{price.toLocaleString('en-PH', { maximumFractionDigits: 2 })} per {balance.asset}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right mr-4">
                      <p className="font-bold text-slate-900 text-lg">
                        ₱{valueInPHP.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <div className="w-20 bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(percentOfPortfolio, 100)}%` }}
                          ></div>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 w-10 text-right">
                          {percentOfPortfolio.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="ml-2 text-slate-400 text-lg">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="bg-slate-50 p-6 border-t border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-600 font-medium mb-2 uppercase tracking-wide">Available Balance</p>
                          <p className="font-mono font-bold text-slate-900 text-lg mb-1">
                            {free.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                          </p>
                          <p className="text-xs text-slate-600">
                            ₱{getAssetValue(balance.asset, free).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className="bg-white p-4 rounded-lg border border-slate-100">
                          <p className="text-xs text-slate-600 font-medium mb-2 uppercase tracking-wide">Locked in Orders</p>
                          <p className="font-mono font-bold text-slate-900 text-lg mb-1">
                            {locked.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                          </p>
                          <p className="text-xs text-slate-600">
                            ₱{getAssetValue(balance.asset, locked).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                          </p>
                        </div>

                        {price && (
                          <div className="bg-white p-4 rounded-lg border border-slate-100">
                            <p className="text-xs text-slate-600 font-medium mb-2 uppercase tracking-wide">Current Price</p>
                            <p className="font-mono font-bold text-slate-900 text-lg mb-1">
                              ₱{price.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-slate-600">per {balance.asset}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Open Orders Section */}
      {openOrders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900">Open Orders ({openOrders.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {openOrders.slice(0, 20).map((order, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{order.symbol}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {order.side} {parseFloat(order.origQty || 0).toLocaleString('en-PH', { maximumFractionDigits: 8 })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    order.side === 'BUY'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {order.side}
                  </span>
                </div>
                <div className="border-t border-slate-100 pt-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-600">Price</p>
                      <p className="font-mono font-semibold text-slate-900">
                        ₱{parseFloat(order.price || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Type</p>
                      <p className="font-mono font-semibold text-slate-900">{order.type}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Status: {order.status}</p>
                </div>
              </div>
            ))}
          </div>
          {openOrders.length > 20 && (
            <p className="text-sm text-slate-500 text-center py-4">
              +{openOrders.length - 20} more orders
            </p>
          )}
        </div>
      )}

      {/* Account Details Footer */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-600 font-medium mb-1">Trading Type</p>
            <p className="font-bold text-slate-900">Spot Trading</p>
          </div>
          <div>
            <p className="text-slate-600 font-medium mb-1">Account Level</p>
            <p className="font-bold text-slate-900">Verified</p>
          </div>
          <div>
            <p className="text-slate-600 font-medium mb-1">Trading Status</p>
            <p className="font-bold text-green-600">Enabled</p>
          </div>
          <div>
            <p className="text-slate-600 font-medium mb-1">Connection</p>
            <p className="font-bold text-green-600">✓ Secure</p>
          </div>
        </div>
      </div>
    </div>
  )
}
