import React, { useState, useEffect } from 'react'
import { coinsPhApi } from '../../lib/coinsPhApi'

export default function CoinsPhAccountDetails({ userId }) {
  const [accountData, accountData] = useState(null)
  const [balances, setBalances] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [prices, setPrices] = useState({})
  const [totalValuePHP, setTotalValuePHP] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedAssets, setExpandedAssets] = useState({})

  useEffect(() => {
    fetchAccountDetails()
    const interval = setInterval(fetchAccountDetails, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchAccountDetails = async () => {
    try {
      setLoading(true)
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
      const symbols = ['BTCPHP', 'ETHPHP', 'BNBPHP', 'ADAPHP', 'DOGEEPHP']
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
      setLoading(false)
    } catch (err) {
      console.error('Error fetching account details:', err)
      setError(err.message || 'Failed to load account details')
      setLoading(false)
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

  if (loading && !accountData) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200 animate-pulse">
        <div className="h-8 bg-blue-200 rounded w-48 mb-4"></div>
        <div className="h-4 bg-blue-100 rounded w-full mb-2"></div>
        <div className="h-4 bg-blue-100 rounded w-3/4"></div>
      </div>
    )
  }

  if (error && !accountData) {
    return (
      <div className="bg-red-50 p-6 rounded-lg border border-red-200">
        <p className="text-red-700 font-semibold mb-2">Error Loading Account</p>
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={fetchAccountDetails}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-blue-100 text-sm mb-1">Coins.ph Account</p>
            <h2 className="text-2xl font-bold">Account Connected</h2>
            {accountData?.email && (
              <p className="text-blue-200 text-sm mt-2">{accountData.email}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm mb-1">Total Portfolio Value</p>
            <h3 className="text-3xl font-bold">₱{totalValuePHP.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</h3>
            <p className="text-blue-200 text-xs mt-2">Across all assets</p>
          </div>
        </div>
      </div>

      {/* Account Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="text-slate-600 text-sm">Total Balances</p>
          <p className="text-2xl font-bold text-slate-900">{balances.length}</p>
          <p className="text-xs text-slate-500 mt-1">Active assets</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="text-slate-600 text-sm">Open Orders</p>
          <p className="text-2xl font-bold text-slate-900">{openOrders.length}</p>
          <p className="text-xs text-slate-500 mt-1">Active trades</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="text-slate-600 text-sm">Account Status</p>
          <p className="text-lg font-bold text-green-600">Active</p>
          <p className="text-xs text-slate-500 mt-1">Trading enabled</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="text-slate-600 text-sm">Last Updated</p>
          <p className="text-xs font-mono text-slate-900">
            {new Date().toLocaleTimeString('en-PH')}
          </p>
          <p className="text-xs text-slate-500 mt-1">Live data</p>
        </div>
      </div>

      {/* Asset Balances */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Asset Balances</h3>
          <button
            onClick={fetchAccountDetails}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>

        {balances.length === 0 ? (
          <div className="bg-slate-50 p-6 rounded-lg text-center text-slate-500">
            <p>No assets available. Deposit funds to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {balances.map(balance => {
              const free = parseFloat(balance.free)
              const locked = parseFloat(balance.locked)
              const total = free + locked
              const valueInPHP = getAssetValue(balance.asset, total)
              const isExpanded = expandedAssets[balance.asset]

              return (
                <div
                  key={balance.asset}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-blue-300 transition"
                >
                  <button
                    onClick={() => toggleAssetExpand(balance.asset)}
                    className="w-full p-4 flex justify-between items-center hover:bg-slate-50 transition"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {balance.asset.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{balance.asset}</p>
                          <p className="text-xs text-slate-500">
                            {total.toFixed(8)} {balance.asset}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        ₱{valueInPHP.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {((valueInPHP / totalValuePHP) * 100).toFixed(1)}% of portfolio
                      </p>
                    </div>

                    <div className="ml-4 text-slate-400">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="bg-slate-50 p-4 border-t border-slate-200 grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Available</p>
                        <p className="font-mono font-semibold text-slate-900">
                          {free.toFixed(8)}
                        </p>
                        <p className="text-xs text-slate-500">
                          ₱{getAssetValue(balance.asset, free).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-600 mb-1">Locked in Orders</p>
                        <p className="font-mono font-semibold text-slate-900">
                          {locked.toFixed(8)}
                        </p>
                        <p className="text-xs text-slate-500">
                          ₱{getAssetValue(balance.asset, locked).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      {balance.asset !== 'PHP' && prices[`${balance.asset}PHP`] && (
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Current Price</p>
                          <p className="font-mono font-semibold text-slate-900">
                            ₱{prices[`${balance.asset}PHP`].toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-slate-500">per {balance.asset}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Open Orders */}
      {openOrders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Open Orders ({openOrders.length})</h3>
          <div className="space-y-2">
            {openOrders.slice(0, 10).map((order, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-slate-900">{order.symbol}</p>
                    <p className="text-xs text-slate-500">
                      {order.side} {order.origQty} @ ₱{parseFloat(order.price).toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    order.side === 'BUY'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {order.side}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Status: {order.status} | Type: {order.type}
                </p>
              </div>
            ))}
            {openOrders.length > 10 && (
              <p className="text-xs text-slate-500 p-4 text-center">
                +{openOrders.length - 10} more orders
              </p>
            )}
          </div>
        </div>
      )}

      {/* Account Details Footer */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-600">API Status</p>
            <p className="font-semibold text-green-600">Connected</p>
          </div>
          <div>
            <p className="text-slate-600">Can Trade</p>
            <p className="font-semibold text-green-600">Enabled</p>
          </div>
          <div>
            <p className="text-slate-600">Account Type</p>
            <p className="font-semibold text-slate-900">Spot</p>
          </div>
          <div>
            <p className="text-slate-600">Last Refresh</p>
            <p className="font-semibold text-slate-900 text-xs">
              {new Date().toLocaleTimeString('en-PH')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
