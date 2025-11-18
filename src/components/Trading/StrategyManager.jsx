import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function StrategyManager({ userId, bot, onRefresh }) {
  const [strategies, setStrategies] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    strategy_type: 'sma_crossover',
    category: 'signals',
    symbols: ['BTCPHP', 'ETHPHP'],
    timeframe: '1h',
    position_size_php: 1000,
    max_open_positions: 3,
    enabled: false
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadStrategies()
  }, [userId])

  const loadStrategies = async () => {
    try {
      const { data } = await supabase
        .from('trading_strategies')
        .select('*')
        .eq('user_id', userId)
      
      setStrategies(data || [])
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const createStrategy = async (e) => {
    e.preventDefault()
    try {
      const { data, error: err } = await supabase
        .from('trading_strategies')
        .insert({
          user_id: userId,
          ...formData
        })
        .select()
        .single()

      if (err) throw err

      setStrategies([...strategies, data])
      setSuccess('Strategy created successfully')
      setFormData({
        name: '',
        description: '',
        strategy_type: 'sma_crossover',
        category: 'signals',
        symbols: ['BTCPHP', 'ETHPHP'],
        timeframe: '1h',
        position_size_php: 1000,
        max_open_positions: 3,
        enabled: false
      })
      setShowForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleStrategy = async (id, enabled) => {
    try {
      await supabase
        .from('trading_strategies')
        .update({ enabled: !enabled })
        .eq('id', id)

      setStrategies(strategies.map(s => 
        s.id === id ? { ...s, enabled: !enabled } : s
      ))

      if (bot) {
        await bot.loadActiveStrategies()
      }

      setSuccess(!enabled ? 'Strategy enabled' : 'Strategy disabled')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteStrategy = async (id) => {
    if (!window.confirm('Delete this strategy?')) return

    try {
      await supabase
        .from('trading_strategies')
        .delete()
        .eq('id', id)

      setStrategies(strategies.filter(s => s.id !== id))
      setSuccess('Strategy deleted')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const strategyTypes = {
    signals: [
      { id: 'sma_crossover', name: 'SMA Crossover + RSI' },
      { id: 'macd_cross', name: 'MACD Crossover' },
      { id: 'rsi_oversold', name: 'RSI Oversold/Overbought' }
    ],
    execution: [
      { id: 'support_bounce', name: 'Support Bounce' },
      { id: 'dca_on_dips', name: 'DCA on Dips' },
      { id: 'breakdown_sell', name: 'Breakdown Sell' }
    ],
    risk_management: [
      { id: 'trailing_stop', name: 'Trailing Stop Loss' },
      { id: 'circuit_breaker', name: 'Circuit Breaker' }
    ]
  }

  if (loading) {
    return <div className="text-center text-slate-600">Loading strategies...</div>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4">
          {success}
        </div>
      )}

      <button
        onClick={() => setShowForm(!showForm)}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        + New Strategy
      </button>

      {showForm && (
        <form onSubmit={createStrategy} className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Strategy Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="signals">Signals</option>
                <option value="execution">Execution</option>
                <option value="risk_management">Risk Management</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Strategy Type
              </label>
              <select
                value={formData.strategy_type}
                onChange={(e) => setFormData({ ...formData, strategy_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {strategyTypes[formData.category]?.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Timeframe
              </label>
              <select
                value={formData.timeframe}
                onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Position Size (PHP)
              </label>
              <input
                type="number"
                value={formData.position_size_php}
                onChange={(e) => setFormData({ ...formData, position_size_php: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max Open Positions
              </label>
              <input
                type="number"
                value={formData.max_open_positions}
                onChange={(e) => setFormData({ ...formData, max_open_positions: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min="1"
                max="10"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Create Strategy
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Strategies List */}
      <div className="space-y-3">
        {strategies.length > 0 ? (
          strategies.map(strategy => (
            <div
              key={strategy.id}
              className="bg-white p-4 rounded-lg border border-slate-200 hover:border-blue-300 transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">{strategy.name}</h4>
                  <p className="text-sm text-slate-600 mb-2">{strategy.description}</p>
                  <div className="flex gap-4 text-xs text-slate-600">
                    <span>{strategy.strategy_type}</span>
                    <span>{strategy.timeframe}</span>
                    <span>₱{strategy.position_size_php}</span>
                    <span>Max {strategy.max_open_positions} positions</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleStrategy(strategy.id, strategy.enabled)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      strategy.enabled
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-400 text-white hover:bg-gray-500'
                    }`}
                  >
                    {strategy.enabled ? '✓ ON' : '✕ OFF'}
                  </button>
                  <button
                    onClick={() => deleteStrategy(strategy.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-slate-600 py-8">
            No strategies yet. Create one to get started!
          </p>
        )}
      </div>
    </div>
  )
}
