import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { coinsPhApi } from '../../lib/coinsPhApi'

export default function PositionsMonitor({ userId, positions = [] }) {
  const [updatedPositions, setUpdatedPositions] = useState(positions)
  const [priceData, setPriceData] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    updatePrices()
    const interval = setInterval(updatePrices, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [updatedPositions])

  const updatePrices = async () => {
    if (updatedPositions.length === 0) return

    try {
      const prices = {}
      
      for (const position of updatedPositions) {
        try {
          const data = await coinsPhApi.getPrice(position.symbol)
          prices[position.symbol] = parseFloat(data.price)
        } catch (err) {
          console.error(`Failed to get price for ${position.symbol}:`, err)
        }
      }

      setPriceData(prices)
    } catch (err) {
      console.error('Failed to update prices:', err)
    }
  }

  const closePosition = async (positionId, symbol) => {
    try {
      if (!window.confirm(`Close ${symbol} position?`)) return

      setLoading(true)

      const currentPrice = priceData[symbol] || 0
      const position = updatedPositions.find(p => p.id === positionId)

      const pnl = (currentPrice - position.entry_price) * position.quantity
      const pnlPercent = (pnl / (position.entry_price * position.quantity)) * 100

      await supabase
        .from('completed_trades')
        .update({
          exit_price: currentPrice,
          exit_time: new Date(),
          pnl_php: pnl,
          pnl_percent: pnlPercent,
          status: 'CLOSED'
        })
        .eq('id', positionId)

      setUpdatedPositions(updatedPositions.filter(p => p.id !== positionId))
      setLoading(false)
    } catch (err) {
      console.error('Failed to close position:', err)
      setLoading(false)
    }
  }

  const totalPositions = updatedPositions.length
  const totalPnL = updatedPositions.reduce((sum, pos) => {
    const currentPrice = priceData[pos.symbol] || pos.entry_price
    return sum + ((currentPrice - pos.entry_price) * pos.quantity)
  }, 0)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-slate-600">Total Positions</p>
          <p className="text-3xl font-bold text-blue-600">{totalPositions}</p>
        </div>
        <div className={`p-4 rounded-lg border ${totalPnL >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-sm text-slate-600">Total P&L</p>
          <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₱{totalPnL.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600">Avg P&L %</p>
          <p className="text-3xl font-bold text-slate-900">
            {totalPositions > 0 
              ? (updatedPositions.reduce((sum, p) => sum + ((priceData[p.symbol] || p.entry_price - p.entry_price) / p.entry_price) * 100, 0) / totalPositions).toFixed(2)
              : '0.00'
            }%
          </p>
        </div>
      </div>

      {/* Positions Table */}
      {updatedPositions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="text-left py-3 px-4 font-bold text-slate-900">Symbol</th>
                <th className="text-right py-3 px-4 font-bold text-slate-900">Entry Price</th>
                <th className="text-right py-3 px-4 font-bold text-slate-900">Current Price</th>
                <th className="text-right py-3 px-4 font-bold text-slate-900">Quantity</th>
                <th className="text-right py-3 px-4 font-bold text-slate-900">P&L (PHP)</th>
                <th className="text-right py-3 px-4 font-bold text-slate-900">P&L %</th>
                <th className="text-center py-3 px-4 font-bold text-slate-900">Entry Time</th>
                <th className="text-center py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {updatedPositions.map((position) => {
                const currentPrice = priceData[position.symbol] || position.entry_price
                const pnl = (currentPrice - position.entry_price) * position.quantity
                const pnlPercent = ((currentPrice - position.entry_price) / position.entry_price) * 100

                return (
                  <tr
                    key={position.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${
                      pnl >= 0 ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-900">{position.symbol}</td>
                    <td className="text-right py-3 px-4">₱{position.entry_price.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 font-bold">₱{currentPrice.toFixed(2)}</td>
                    <td className="text-right py-3 px-4">{position.quantity.toFixed(8)}</td>
                    <td className={`text-right py-3 px-4 font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₱{pnl.toFixed(2)}
                    </td>
                    <td className={`text-right py-3 px-4 font-bold ${pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pnlPercent > 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </td>
                    <td className="text-center py-3 px-4 text-slate-600">
                      {new Date(position.entry_time).toLocaleDateString()} {new Date(position.entry_time).toLocaleTimeString()}
                    </td>
                    <td className="text-center py-3 px-4">
                      <button
                        onClick={() => closePosition(position.id, position.symbol)}
                        disabled={loading}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium disabled:opacity-50"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-slate-600">No open positions</p>
        </div>
      )}
    </div>
  )
}
