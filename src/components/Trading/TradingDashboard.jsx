import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { coinsPhApi } from '../../lib/coinsPhApi'
import { TradingBotOrchestrator, getBotInstance } from '../../lib/tradingBotOrchestrator'
import MarketAnalysis from './MarketAnalysis'
import StrategyManager from './StrategyManager'
import PositionsMonitor from './PositionsMonitor'
import PerformanceMetrics from './PerformanceMetrics'
import CoinsPhAccountDetails from './CoinsPhAccountDetails'

export default function TradingDashboard({ userId, onClose }) {
  const [activeTab, setActiveTab] = useState('account')
  const [bot, setBot] = useState(null)
  const [tradingEnabled, setTradingEnabled] = useState(false)
  const [paperTradingMode, setPaperTradingMode] = useState(true)
  const [accountBalance, setAccountBalance] = useState(null)
  const [activeOrders, setActiveOrders] = useState([])
  const [openPositions, setOpenPositions] = useState([])
  const [dailyPnL, setDailyPnL] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadTradingData()
  }, [userId])

  const loadTradingData = async () => {
    try {
      setLoading(true)
      
      // Load trading settings
      const { data: settings } = await supabase
        .from('trading_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (settings) {
        setTradingEnabled(settings.trading_enabled)
        setPaperTradingMode(settings.paper_trading_mode)
      }

      // Initialize bot
      const botInstance = await getBotInstance(userId, settings?.paper_trading_mode || true)
      setBot(botInstance)

      // Load account balance
      try {
        const account = await coinsPhApi.getAccount()
        setAccountBalance(account)
      } catch (err) {
        console.warn('Could not fetch account from API (might be paper trading)', err)
      }

      // Load open orders
      const { data: orders } = await supabase
        .from('bot_orders')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'OPEN')
      setActiveOrders(orders || [])

      // Load open positions
      const { data: positions } = await supabase
        .from('completed_trades')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'OPEN')
      setOpenPositions(positions || [])

      // Calculate daily PnL
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data: todayTrades } = await supabase
        .from('completed_trades')
        .select('pnl_php')
        .eq('user_id', userId)
        .gte('created_at', todayStart.toISOString())

      const total = todayTrades?.reduce((sum, t) => sum + (t.pnl_php || 0), 0) || 0
      setDailyPnL(total)

      setLoading(false)
    } catch (err) {
      setError(err.message || 'Failed to load trading data')
      setLoading(false)
    }
  }

  const toggleTrading = async () => {
    try {
      await supabase
        .from('trading_settings')
        .update({ trading_enabled: !tradingEnabled })
        .eq('user_id', userId)

      setTradingEnabled(!tradingEnabled)
      setSuccess(tradingEnabled ? 'Trading disabled' : 'Trading enabled')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const togglePaperTrading = async () => {
    try {
      await supabase
        .from('trading_settings')
        .update({ paper_trading_mode: !paperTradingMode })
        .eq('user_id', userId)

      setPaperTradingMode(!paperTradingMode)
      if (bot) {
        bot.paperTradingMode = !paperTradingMode
      }
      setSuccess(`Switched to ${!paperTradingMode ? 'REAL' : 'PAPER'} trading mode`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const executeBot = async () => {
    try {
      if (!bot) return
      setLoading(true)
      const results = await bot.executeAll()
      setSuccess(`Executed ${results.length} strategies`)
      setTimeout(() => loadTradingData(), 1000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !bot) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-slate-600">Loading trading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Trading Bot Dashboard</h1>
            <p className="text-blue-100">
              {paperTradingMode ? 'Paper Trading Mode' : 'REAL TRADING MODE'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-500 p-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 m-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 m-4">
          {success}
        </div>
      )}

      {/* Controls */}
      <div className="p-6 border-b border-slate-200 bg-slate-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={toggleTrading}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              tradingEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-400 text-white hover:bg-gray-500'
            }`}
          >
            {tradingEnabled ? 'Trading ON' : 'Trading OFF'}
          </button>

          <button
            onClick={togglePaperTrading}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              paperTradingMode
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {paperTradingMode ? 'Paper Trading' : 'Real Trading'}
          </button>

          <button
            onClick={executeBot}
            disabled={loading || !tradingEnabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ▶ Execute Now
          </button>

          <div className="text-right">
            <p className="text-sm text-slate-600">Daily P&L</p>
            <p className={`text-2xl font-bold ${dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₱{dailyPnL.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('account')}
          className={`px-6 py-4 font-medium transition whitespace-nowrap ${
            activeTab === 'account'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Account
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-4 font-medium transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('market')}
          className={`px-6 py-4 font-medium transition whitespace-nowrap ${
            activeTab === 'market'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Market Analysis
        </button>
        <button
          onClick={() => setActiveTab('strategies')}
          className={`px-6 py-4 font-medium transition ${
            activeTab === 'strategies'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Strategies
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-6 py-4 font-medium transition ${
            activeTab === 'positions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Positions
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-6 py-4 font-medium transition ${
            activeTab === 'performance'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Performance
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'account' && (
          <CoinsPhAccountDetails userId={userId} />
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Account Info */}
            {accountBalance && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {accountBalance.balances?.slice(0, 3).map(balance => (
                  <div key={balance.asset} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-600 font-medium">{balance.asset}</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {parseFloat(balance.free).toFixed(8)}
                    </p>
                    {parseFloat(balance.locked) > 0 && (
                      <p className="text-xs text-slate-500">
                        Locked: {parseFloat(balance.locked).toFixed(8)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Active Orders */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Active Orders</h3>
              {activeOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-4">Symbol</th>
                        <th className="text-left py-2 px-4">Side</th>
                        <th className="text-right py-2 px-4">Price</th>
                        <th className="text-right py-2 px-4">Qty</th>
                        <th className="text-left py-2 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOrders.map(order => (
                        <tr key={order.id} className="border-b border-slate-100">
                          <td className="py-3 px-4 font-medium">{order.symbol}</td>
                          <td className={`py-3 px-4 ${order.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                            {order.side}
                          </td>
                          <td className="text-right py-3 px-4">₱{parseFloat(order.price || 0).toFixed(2)}</td>
                          <td className="text-right py-3 px-4">{parseFloat(order.quantity || 0).toFixed(8)}</td>
                          <td className="py-3 px-4 text-slate-600">{order.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-600">No active orders</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'market' && <MarketAnalysis userId={userId} />}
        {activeTab === 'strategies' && <StrategyManager userId={userId} bot={bot} onRefresh={loadTradingData} />}
        {activeTab === 'positions' && <PositionsMonitor userId={userId} positions={openPositions} />}
        {activeTab === 'performance' && <PerformanceMetrics userId={userId} />}
      </div>
    </div>
  )
}
