import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function PerformanceMetrics({ userId }) {
  const [metrics, setMetrics] = useState(null)
  const [trades, setTrades] = useState([])
  const [timeframe, setTimeframe] = useState('7d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [userId, timeframe])

  const loadMetrics = async () => {
    try {
      setLoading(true)

      // Get date range
      const endDate = new Date()
      const startDate = new Date()
      
      if (timeframe === '7d') startDate.setDate(endDate.getDate() - 7)
      else if (timeframe === '30d') startDate.setDate(endDate.getDate() - 30)
      else if (timeframe === '90d') startDate.setDate(endDate.getDate() - 90)
      else if (timeframe === 'all') startDate.setFullYear(2020)

      // Fetch all closed trades
      const { data: allTrades } = await supabase
        .from('completed_trades')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('entry_time', { ascending: false })

      setTrades(allTrades || [])

      // Calculate metrics
      if (allTrades && allTrades.length > 0) {
        const closedTrades = allTrades.filter(t => t.status !== 'OPEN')
        const wins = closedTrades.filter(t => t.pnl_php > 0)
        const losses = closedTrades.filter(t => t.pnl_php < 0)

        const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl_php || 0), 0)
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl_php, 0) / wins.length : 0
        const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl_php, 0) / losses.length : 0

        const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (avgWin > 0 ? Infinity : 0)
        const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0

        setMetrics({
          totalTrades: closedTrades.length,
          winningTrades: wins.length,
          losingTrades: losses.length,
          totalPnL,
          winRate,
          avgWin,
          avgLoss,
          profitFactor,
          bestTrade: closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl_php)) : 0,
          worstTrade: closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl_php)) : 0
        })
      } else {
        setMetrics(null)
      }

      setLoading(false)
    } catch (err) {
      console.error('Failed to load metrics:', err)
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-slate-600">Loading metrics...</div>
  }

  if (!metrics) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-slate-600">No completed trades yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Selector */}
      <div className="flex gap-2">
        {['7d', '30d', '90d', 'all'].map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timeframe === tf
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tf === '7d' ? 'Last 7 Days' : tf === '30d' ? 'Last 30 Days' : tf === '90d' ? 'Last 90 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-slate-600">Total Trades</p>
          <p className="text-3xl font-bold text-blue-600">{metrics.totalTrades}</p>
          <p className="text-xs text-slate-600 mt-1">
            {metrics.winningTrades}W / {metrics.losingTrades}L
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${metrics.totalPnL >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-sm text-slate-600">Total P&L</p>
          <p className={`text-3xl font-bold ${metrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₱{metrics.totalPnL.toFixed(2)}
          </p>
        </div>

        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
          <p className="text-sm text-slate-600">Win Rate</p>
          <p className="text-3xl font-bold text-indigo-600">{metrics.winRate.toFixed(1)}%</p>
          <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${metrics.winRate}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-slate-600">Profit Factor</p>
          <p className="text-3xl font-bold text-purple-600">
            {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {metrics.profitFactor > 1 ? '✓ Profitable' : metrics.profitFactor > 0 ? '~ Breakeven' : '✗ Losing'}
          </p>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="font-bold text-slate-900 mb-3">Average Trade</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Average Win</span>
              <span className="font-bold text-green-600">₱{metrics.avgWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Average Loss</span>
              <span className="font-bold text-red-600">₱{metrics.avgLoss.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="text-slate-600">Risk/Reward</span>
              <span className="font-bold text-slate-900">
                {metrics.avgLoss !== 0 ? (metrics.avgWin / Math.abs(metrics.avgLoss)).toFixed(2) : '∞'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="font-bold text-slate-900 mb-3">Best & Worst</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Best Trade</span>
              <span className="font-bold text-green-600">₱{metrics.bestTrade.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Worst Trade</span>
              <span className="font-bold text-red-600">₱{metrics.worstTrade.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="text-slate-600">Range</span>
              <span className="font-bold text-slate-900">₱{(metrics.bestTrade - metrics.worstTrade).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="font-bold text-slate-900 mb-3">Trade Distribution</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-600">Winning</span>
                <span className="font-bold">{metrics.winningTrades}</span>
              </div>
              <div className="w-full bg-slate-200 rounded h-2">
                <div
                  className="bg-green-600 h-2 rounded"
                  style={{
                    width: metrics.totalTrades > 0 ? `${(metrics.winningTrades / metrics.totalTrades) * 100}%` : '0%'
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-600">Losing</span>
                <span className="font-bold">{metrics.losingTrades}</span>
              </div>
              <div className="w-full bg-slate-200 rounded h-2">
                <div
                  className="bg-red-600 h-2 rounded"
                  style={{
                    width: metrics.totalTrades > 0 ? `${(metrics.losingTrades / metrics.totalTrades) * 100}%` : '0%'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      {trades.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Trades</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left py-2 px-4">Symbol</th>
                  <th className="text-right py-2 px-4">Entry</th>
                  <th className="text-right py-2 px-4">Exit</th>
                  <th className="text-right py-2 px-4">P&L</th>
                  <th className="text-center py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 10).map(trade => (
                  <tr key={trade.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{trade.symbol}</td>
                    <td className="text-right py-3 px-4">₱{trade.entry_price.toFixed(2)}</td>
                    <td className="text-right py-3 px-4">
                      {trade.exit_price ? `₱${trade.exit_price.toFixed(2)}` : '-'}
                    </td>
                    <td className={`text-right py-3 px-4 font-bold ${trade.pnl_php >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₱{trade.pnl_php?.toFixed(2) || 0}
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.pnl_php >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
