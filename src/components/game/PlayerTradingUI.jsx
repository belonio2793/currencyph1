import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function PlayerTradingUI({ character, onClose, onTradeComplete }) {
  const [activeTab, setActiveTab] = useState('send') // send, receive, history
  const [trades, setTrades] = useState([])
  const [incomingTrades, setIncomingTrades] = useState([])
  const [tradeHistory, setTradeHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState([])
  const [targetCharacterId, setTargetCharacterId] = useState('')
  const [searchPlayers, setSearchPlayers] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    loadTrades()
  }, [character?.id])

  async function loadTrades() {
    try {
      setLoading(true)
      
      // Load outgoing trades
      const { data: outgoing } = await supabase
        .from('game_player_trades')
        .select('*')
        .eq('initiator_id', character.id)
        .order('initiated_at', { ascending: false })

      // Load incoming trades
      const { data: incoming } = await supabase
        .from('game_player_trades')
        .select('*')
        .eq('receiver_id', character.id)
        .eq('status', 'pending')
        .order('initiated_at', { ascending: false })

      // Load trade history
      const { data: history } = await supabase
        .from('game_trade_history')
        .select('*')
        .or(`player1_id.eq.${character.id},player2_id.eq.${character.id}`)
        .order('completed_at', { ascending: false })
        .limit(20)

      setTrades(outgoing || [])
      setIncomingTrades(incoming || [])
      setTradeHistory(history || [])
    } catch (err) {
      console.error('Failed to load trades:', err)
    } finally {
      setLoading(false)
    }
  }

  async function searchForPlayer(name) {
    if (!name.trim()) {
      setSearchPlayers([])
      return
    }

    try {
      setSearching(true)
      const { data } = await supabase
        .from('game_characters')
        .select('id, name, level, wealth')
        .ilike('name', `%${name}%`)
        .neq('id', character.id)
        .limit(5)

      setSearchPlayers(data || [])
    } catch (err) {
      console.error('Failed to search players:', err)
    } finally {
      setSearching(false)
    }
  }

  async function initiateTradeRequest() {
    if (!targetCharacterId || selectedItems.length === 0) {
      alert('Please select a player and items to trade')
      return
    }

    try {
      const { error } = await supabase
        .from('game_player_trades')
        .insert([{
          initiator_id: character.id,
          receiver_id: targetCharacterId,
          initiator_items: selectedItems,
          status: 'pending'
        }])

      if (error) throw error
      
      alert('Trade request sent!')
      setTargetCharacterId('')
      setSelectedItems([])
      loadTrades()
    } catch (err) {
      console.error('Failed to initiate trade:', err)
      alert('Failed to send trade request')
    }
  }

  async function respondToTrade(tradeId, accepted) {
    try {
      const { error } = await supabase
        .from('game_player_trades')
        .update({
          status: accepted ? 'completed' : 'declined',
          completed_at: accepted ? new Date().toISOString() : null
        })
        .eq('id', tradeId)

      if (error) throw error

      if (accepted && onTradeComplete) {
        onTradeComplete()
      }

      loadTrades()
    } catch (err) {
      console.error('Failed to respond to trade:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Trading System</h2>
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
        <div className="flex gap-4 p-4 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('send')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === 'send'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Send Trade
          </button>
          <button
            onClick={() => setActiveTab('receive')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === 'receive'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Incoming ({incomingTrades.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            History
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : activeTab === 'send' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Search for a player
                </label>
                <input
                  type="text"
                  placeholder="Enter player name..."
                  onChange={(e) => searchForPlayer(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
                />
              </div>

              {searchPlayers.length > 0 && (
                <div className="space-y-2">
                  {searchPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => {
                        setTargetCharacterId(player.id)
                        setSearchPlayers([])
                      }}
                      className={`w-full p-3 rounded border transition-colors ${
                        targetCharacterId === player.id
                          ? 'bg-blue-600/20 border-blue-500'
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-medium text-white">{player.name}</div>
                        <div className="text-xs text-slate-400">
                          Level {player.level} • ₱{Number(player.wealth).toLocaleString()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {targetCharacterId && (
                <div className="p-4 bg-slate-800 rounded border border-slate-700">
                  <div className="font-medium text-white mb-3">Selected Items to Trade</div>
                  <div className="text-sm text-slate-400 mb-4">
                    (Feature: Select items from your inventory)
                  </div>
                  <button
                    onClick={initiateTradeRequest}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                  >
                    Send Trade Request
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === 'receive' ? (
            <div className="space-y-4">
              {incomingTrades.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No incoming trade requests
                </div>
              ) : (
                incomingTrades.map(trade => (
                  <div key={trade.id} className="p-4 bg-slate-800 rounded border border-slate-700">
                    <div className="font-medium text-white mb-2">Trade Request</div>
                    <div className="text-sm text-slate-400 mb-4">
                      {trade.initiator_items.length} items offered
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondToTrade(trade.id, true)}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respondToTrade(trade.id, false)}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {tradeHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No trade history
                </div>
              ) : (
                tradeHistory.map(trade => (
                  <div key={trade.id} className="p-4 bg-slate-800 rounded border border-slate-700">
                    <div className="text-sm text-slate-400">
                      Completed: {new Date(trade.completed_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
