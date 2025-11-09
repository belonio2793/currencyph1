import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function MarketEconomyUI({ character, onClose }) {
  const [activeTab, setActiveTab] = useState('events') // events, stocks, portfolio
  const [marketEvents, setMarketEvents] = useState([])
  const [stocks, setStocks] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStock, setSelectedStock] = useState(null)
  const [buyAmount, setBuyAmount] = useState(1)

  useEffect(() => {
    loadMarketData()
  }, [character?.id])

  async function loadMarketData() {
    try {
      setLoading(true)

      // Load active market events
      const { data: events } = await supabase
        .from('game_market_events')
        .select('*')
        .is('ended_at', null)
        .order('created_at', { ascending: false })

      setMarketEvents(events || [])

      // Load stocks
      const { data: stocksData } = await supabase
        .from('game_stocks')
        .select('*')
        .order('market_cap', { ascending: false })

      setStocks(stocksData || [])

      // Load player's portfolio
      const { data: holdings } = await supabase
        .from('game_stock_holdings')
        .select('*')
        .eq('character_id', character.id)

      setPortfolio(holdings || [])
    } catch (err) {
      console.error('Failed to load market data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function buyStock() {
    if (!selectedStock || buyAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    const totalCost = selectedStock.current_price * buyAmount
    if (character.money < totalCost) {
      alert('Insufficient funds')
      return
    }

    try {
      // Check if already holding
      const { data: existing } = await supabase
        .from('game_stock_holdings')
        .select('*')
        .eq('character_id', character.id)
        .eq('stock_id', selectedStock.id)
        .single()

      if (existing) {
        // Update quantity
        await supabase
          .from('game_stock_holdings')
          .update({
            quantity: existing.quantity + buyAmount
          })
          .eq('id', existing.id)
      } else {
        // Create new holding
        await supabase
          .from('game_stock_holdings')
          .insert([{
            character_id: character.id,
            stock_id: selectedStock.id,
            quantity: buyAmount,
            purchase_price: selectedStock.current_price
          }])
      }

      // Record transaction
      await supabase
        .from('game_stock_transactions')
        .insert([{
          character_id: character.id,
          stock_id: selectedStock.id,
          transaction_type: 'buy',
          quantity: buyAmount,
          price_per_share: selectedStock.current_price,
          total_value: totalCost
        }])

      alert('Stock purchased successfully!')
      setBuyAmount(1)
      loadMarketData()
    } catch (err) {
      console.error('Failed to buy stock:', err)
      alert('Failed to purchase stock')
    }
  }

  async function sellStock(holding) {
    const sellAmount = Math.min(holding.quantity, 1)
    const proceeds = selectedStock.current_price * sellAmount

    try {
      // Update or delete holding
      if (holding.quantity > 1) {
        await supabase
          .from('game_stock_holdings')
          .update({
            quantity: holding.quantity - sellAmount
          })
          .eq('id', holding.id)
      } else {
        await supabase
          .from('game_stock_holdings')
          .delete()
          .eq('id', holding.id)
      }

      // Record transaction
      await supabase
        .from('game_stock_transactions')
        .insert([{
          character_id: character.id,
          stock_id: holding.stock_id,
          transaction_type: 'sell',
          quantity: sellAmount,
          price_per_share: selectedStock.current_price,
          total_value: proceeds
        }])

      alert('Stock sold successfully!')
      loadMarketData()
    } catch (err) {
      console.error('Failed to sell stock:', err)
      alert('Failed to sell stock')
    }
  }

  const getEventIcon = (type) => {
    const icons = {
      boom: '📈',
      crash: '📉',
      shortage: '📦',
      abundance: '🌾',
      natural_disaster: '⚠️',
      tax_increase: '💸',
      tax_reduction: '💰'
    }
    return icons[type] || '📊'
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">📊 Market & Economy</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 p-4 border-b border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded font-medium transition-colors whitespace-nowrap ${
              activeTab === 'events'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Market Events
          </button>
          <button
            onClick={() => setActiveTab('stocks')}
            className={`px-4 py-2 rounded font-medium transition-colors whitespace-nowrap ${
              activeTab === 'stocks'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Stock Market
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-4 py-2 rounded font-medium transition-colors whitespace-nowrap ${
              activeTab === 'portfolio'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            My Portfolio
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : activeTab === 'events' ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-400 mb-4">
                Market events affect property prices and business income
              </div>
              {marketEvents.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No active market events
                </div>
              ) : (
                marketEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-4 bg-slate-800 rounded border border-slate-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-lg font-bold text-white">
                          {getEventIcon(event.event_type)} {event.description}
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{event.description}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${
                          event.price_multiplier > 1 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {event.price_multiplier > 1 ? '+' : ''}{((event.price_multiplier - 1) * 100).toFixed(0)}% Price
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      Duration: {event.duration_hours} hours
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'stocks' ? (
            <div className="space-y-4">
              {stocks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No stocks available yet
                </div>
              ) : (
                <div className="space-y-4">
                  {stocks.map(stock => (
                    <button
                      key={stock.id}
                      onClick={() => setSelectedStock(stock)}
                      className={`w-full p-4 rounded border transition-colors text-left ${
                        selectedStock?.id === stock.id
                          ? 'bg-blue-600/20 border-blue-500'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-bold text-white">{stock.business_name}</div>
                          <div className="text-sm text-slate-400">
                            {stock.total_shares} shares available
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-400">
                            ₱{Number(stock.current_price).toFixed(2)}
                          </div>
                          <div className={`text-sm font-bold ${
                            stock.current_price > stock.previous_price
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}>
                            {stock.current_price > stock.previous_price ? '↑' : '↓'}
                            {Math.abs(((stock.current_price - stock.previous_price) / stock.previous_price) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400">
                        Market Cap: ₱{Number(stock.market_cap).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedStock && (
                <div className="p-4 bg-slate-800 rounded border border-blue-600 mt-4">
                  <div className="font-bold text-white mb-3">Buy {selectedStock.business_name}</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-slate-300 mb-2 block">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div className="p-2 bg-slate-700 rounded text-sm text-slate-300">
                      Total Cost: ₱{(selectedStock.current_price * buyAmount).toLocaleString()}
                    </div>
                    <button
                      onClick={buyStock}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                    >
                      Buy Stock
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {portfolio.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  You don't own any stocks yet
                </div>
              ) : (
                portfolio.map(holding => {
                  const stock = stocks.find(s => s.id === holding.stock_id)
                  const value = stock ? stock.current_price * holding.quantity : 0
                  const gain = value - (holding.purchase_price * holding.quantity)

                  return (
                    <div key={holding.id} className="p-4 bg-slate-800 rounded border border-slate-700">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-bold text-white">
                            {stock?.business_name}
                          </div>
                          <div className="text-sm text-slate-400">
                            {holding.quantity} shares @ ₱{Number(holding.purchase_price).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ₱{Number(value).toLocaleString()}
                          </div>
                          <div className={`text-sm font-bold ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {gain >= 0 ? '+' : ''}₱{Number(gain).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => sellStock(holding)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium transition-colors"
                      >
                        Sell 1 Share
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
