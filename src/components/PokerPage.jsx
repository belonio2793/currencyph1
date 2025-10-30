import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import RakeModal from './RakeModal'
import HouseBalanceTab from './HouseBalanceTab'
import PokerGameModal from './PokerGameModal'

export default function PokerPage({ userId, userEmail, onShowAuth }) {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState(null)
  const [seats, setSeats] = useState([])
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('lobby')
  const [rakeModal, setRakeModal] = useState({ open: false, startingBalance: 0, endingBalance: 0, tableId: null, currencyCode: 'PHP' })
  const [gameModalOpen, setGameModalOpen] = useState(false)
  const [gameModalTable, setGameModalTable] = useState(null)
  const FUNCTIONS_BASE = (import.meta.env.VITE_PROJECT_URL || '').replace(/\/+$/,'') + '/functions/v1/poker-engine'

  useEffect(() => { loadTables() }, [])

  async function loadTables() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.from('poker_tables').select('*').order('created_at', { ascending: false })
      if (err) {
        console.error('Load tables error:', err)
        setError(`Failed to load tables: ${err.message}`)
        setTables([])
      } else {
        setTables(data || [])
      }
    } catch (e) {
      console.error('Could not load tables', e)
      setError(`Error: ${e.message}`)
      setTables([])
    } finally { setLoading(false) }
  }

  async function openTable(table) {
    setSelectedTable(table)
    try {
      const { data } = await supabase.from('poker_seats').select('*').eq('table_id', table.id).order('seat_number')
      setSeats(data || [])
    } catch (e) {
      console.warn('Could not load seats', e)
      setSeats([])
    }
  }

  function openGameModal(table) {
    setGameModalTable(table)
    setGameModalOpen(true)
  }

  function closeGameModal() {
    setGameModalOpen(false)
    setTimeout(() => setGameModalTable(null), 300)
  }

  async function handleCreate(name, stakeMin, stakeMax) {
    if (!userId || !userEmail) return onShowAuth && onShowAuth('register')
    try {
      const { data: table, error } = await supabase.from('poker_tables').insert([{ name, stake_min: stakeMin, stake_max: stakeMax, currency_code: 'PHP', created_by: userId, is_default: false }]).select().single()
      if (error) {
        console.error('Create table error:', error)
        throw new Error(error.message)
      }

      // Auto-sit creator at seat 1
      const { error: seatError } = await supabase.from('poker_seats').insert([{ table_id: table.id, user_id: userId, seat_number: 1 }])
      if (seatError) {
        console.warn('Could not auto-sit creator:', seatError)
        setError(`Table created but could not auto-seat: ${seatError.message}`)
      }

      setError(null)
      await loadTables()
      setSelectedTable(table)
    } catch (e) {
      console.error('Create table error:', e)
      setError(`Create table failed: ${e.message}`)
      alert('Create table failed: ' + (e.message || e))
    }
  }

  async function handleSit(tableId) {
    if (!userId || !userEmail) return onShowAuth && onShowAuth('register')
    const seatNumber = (seats.length || 0) + 1

    try {
      // Get current wallet balance
      const { data: wallets } = await supabase.from('wallets').select('*').eq('user_id', userId)
      const currentBalance = wallets && wallets.length > 0 ? Number(wallets[0].balance) : 0

      // Join table with starting balance
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(FUNCTIONS_BASE + '/join_table', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ tableId, userId, seatNumber, startingBalance: currentBalance })
      })

      if (!res.ok) {
        let errorMsg = 'Failed to sit'
        try {
          const json = await res.json()
          errorMsg = json.error || errorMsg
        } catch (e) {
          // Could not parse JSON error response
        }
        throw new Error(errorMsg)
      }

      const json = await res.json()
      await openTable(tables.find(t => t.id === tableId))
    } catch (e) {
      alert('Could not join table: ' + (e.message || e))
    }
  }

  async function handleStartHand(tableId) {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(FUNCTIONS_BASE + '/start_hand', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ tableId })
      })

      if (!res.ok) {
        let errorMsg = 'Failed to start hand'
        try {
          const json = await res.json()
          errorMsg = json.error || errorMsg
        } catch (e) {
          // Could not parse JSON error response
        }
        throw new Error(errorMsg)
      }

      const json = await res.json()
      alert('Hand started')
      await openTable(tables.find(t => t.id === tableId))
    } catch (e) {
      alert('Could not start hand: ' + (e.message || e))
    }
  }

  async function handleLeaveTable(tableId) {
    if (!userId) return
    try {
      // Get seat info with starting balance
      const { data: seatData } = await supabase.from('poker_seats').select('*').eq('table_id', tableId).eq('user_id', userId).single()
      if (!seatData) {
        alert('Seat not found')
        return
      }

      // Get current wallet balance
      const { data: wallets } = await supabase.from('wallets').select('*').eq('user_id', userId)
      const endingBalance = wallets && wallets.length > 0 ? Number(wallets[0].balance) : 0
      const currencyCode = wallets && wallets.length > 0 ? wallets[0].currency_code : 'PHP'
      const startingBalance = Number(seatData.starting_balance) || 0

      // Show rake modal
      setRakeModal({
        open: true,
        startingBalance,
        endingBalance,
        tableId,
        currencyCode
      })
    } catch (e) {
      alert('Could not leave table: ' + (e.message || e))
    }
  }

  async function handleRakeProcessed(data) {
    // Reload tables after rake is processed
    setSelectedTable(null)
    await loadTables()
  }

  const getTableStatusColor = (table) => {
    const openSeats = table.max_seats - seats.filter(s => s.table_id === table.id).length
    if (openSeats === 0) return 'bg-red-50'
    if (openSeats <= 2) return 'bg-yellow-50'
    return 'bg-green-50'
  }

  const getFilteredTables = () => {
    if (activeTab === 'my-tables') {
      return tables.filter(t => t.created_by === userId)
    } else if (activeTab === 'lobby') {
      return tables.filter(t => t.created_by !== userId || !t.created_by)
    }
    return tables
  }

  const getFeltColor = () => {
    if (activeTab === 'my-tables') {
      return 'from-blue-800 to-blue-900'
    } else if (activeTab === 'lobby') {
      return 'from-purple-800 to-purple-900'
    }
    return 'from-slate-700 to-slate-800'
  }

  const filteredTables = getFilteredTables()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {error && (
          <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
            <div className="font-semibold">Error:</div>
            <div className="text-sm mt-1">{error}</div>
            <button onClick={() => setError(null)} className="mt-2 text-xs underline">Dismiss</button>
          </div>
        )}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-4xl font-light text-white">Poker</h2>
          {(activeTab === 'my-tables' || activeTab === 'lobby') && (
            <div className="flex items-center gap-2">
              <button onClick={loadTables} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">Refresh</button>
              <button onClick={() => { const name = prompt('Table name') || 'Table'; const min = Number(prompt('Stake min') || 1); const max = Number(prompt('Stake max') || 2); handleCreate(name, min, max) }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">Create Table</button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex items-center gap-2 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('lobby')}
            className={`px-6 py-3 font-semibold transition ${activeTab === 'lobby' ? 'border-b-2 border-purple-400 text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Lobby
          </button>
          <button
            onClick={() => setActiveTab('my-tables')}
            className={`px-6 py-3 font-semibold transition ${activeTab === 'my-tables' ? 'border-b-2 border-blue-400 text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            My Tables
          </button>
          <button
            onClick={() => setActiveTab('network-balances')}
            className={`px-6 py-3 font-semibold transition ${activeTab === 'network-balances' ? 'border-b-2 border-amber-500 text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Network Balances
          </button>
        </div>

        {(activeTab === 'my-tables' || activeTab === 'other-tables') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tables Lobby */}
          <div className="lg:col-span-1 bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">{activeTab === 'my-tables' ? 'My Tables' : 'Available Tables'}</h3>
            {loading ? (
              <div className="text-slate-400 text-center py-8">Loading tables...</div>
            ) : filteredTables.length === 0 ? (
              activeTab === 'my-tables' ? (
                <div className="text-center py-16 flex flex-col items-center justify-center">
                  <div className="text-slate-400 mb-3 text-sm font-medium">You have no created tables</div>
                  <button
                    onClick={() => { const name = prompt('Table name') || 'Table'; const min = Number(prompt('Stake min') || 1); const max = Number(prompt('Stake max') || 2); handleCreate(name, min, max) }}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-semibold"
                  >
                    Create a Table
                  </button>
                </div>
              ) : (
                <div className="text-slate-400 text-center py-8">No other tables available</div>
              )
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredTables.map(t => {
                  const tableSeats = seats.filter(s => s.table_id === t.id)
                  const openSeats = t.max_seats - tableSeats.length
                  const isSelected = selectedTable?.id === t.id

                  return (
                    <div
                      key={t.id}
                      onClick={() => openTable(t)}
                      className={`p-4 rounded-lg cursor-pointer transition border ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 shadow-lg'
                          : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className={`font-semibold ${isSelected ? 'text-white' : 'text-slate-100'}`}>{t.name}</div>
                          <div className={`text-xs mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {t.stake_min}/{t.stake_max} {t.currency_code}
                          </div>
                          <div className={`text-xs mt-1 font-medium ${
                            openSeats === 0 ? 'text-red-300' :
                            openSeats <= 2 ? 'text-yellow-300' :
                            'text-green-300'
                          }`}>
                            {openSeats}/{t.max_seats} seats open
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSit(t.id)
                          }}
                          className="w-full mt-3 px-3 py-2 bg-white text-slate-900 font-semibold rounded-lg hover:bg-slate-100 transition relative overflow-hidden group"
                        >
                          <span className="relative z-10">Take a Seat</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 animate-pulse"></div>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Table Visualization */}
          <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-8">
            <h3 className="text-xl font-semibold text-white mb-6">Table View</h3>
            {selectedTable ? (
              <div className="space-y-6">
                {/* Table Info */}
                <div className="bg-slate-700 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-white">{selectedTable.name}</div>
                    <div className="text-sm text-slate-300 mt-1">Stakes: {selectedTable.stake_min}/{selectedTable.stake_max} {selectedTable.currency_code}</div>
                    {userId && seats.some(s => s.user_id === userId) && (
                      <div className="text-xs text-emerald-400 mt-1 font-semibold">✓ You are seated at this table</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openGameModal(selectedTable)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition"
                    >
                      Open Table
                    </button>
                    {userId && seats.some(s => s.user_id === userId) && (
                      <button
                        onClick={() => handleLeaveTable(selectedTable.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
                      >
                        Leave Table
                      </button>
                    )}
                  </div>
                </div>

                {/* Poker Table */}
                <div className="flex justify-center py-8">
                  <div className="relative w-full max-w-md h-80">
                    {/* Elliptical table background */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid meet">
                      <defs>
                        <linearGradient id="tableGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          {activeTab === 'my-tables' ? (
                            <>
                              <stop offset="0%" style={{ stopColor: '#1e40af', stopOpacity: 1 }} />
                              <stop offset="100%" style={{ stopColor: '#0f172a', stopOpacity: 1 }} />
                            </>
                          ) : activeTab === 'other-tables' ? (
                            <>
                              <stop offset="0%" style={{ stopColor: '#5b21b6', stopOpacity: 1 }} />
                              <stop offset="100%" style={{ stopColor: '#2e1065', stopOpacity: 1 }} />
                            </>
                          ) : (
                            <>
                              <stop offset="0%" style={{ stopColor: '#1e3a1f', stopOpacity: 1 }} />
                              <stop offset="100%" style={{ stopColor: '#0f2310', stopOpacity: 1 }} />
                            </>
                          )}
                        </linearGradient>
                      </defs>
                      {/* Outer rim */}
                      <ellipse cx="200" cy="160" rx="180" ry="140" fill="#0a0a0a" opacity="0.5" />
                      {/* Table surface */}
                      <ellipse cx="200" cy="160" rx="160" ry="120" fill="url(#tableGradient)" stroke="#4b5563" strokeWidth="2" />
                      {/* Dealer position circle */}
                      <circle cx="200" cy="160" r="20" fill="none" stroke="#4b5563" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
                    </svg>

                    {/* Seats arranged around table edges */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative" style={{ width: '420px', height: '340px' }}>
                        {Array.from({ length: selectedTable.max_seats }).map((_, i) => {
                          const angle = (i / selectedTable.max_seats) * Math.PI * 2 - Math.PI / 2
                          const radiusX = 200
                          const radiusY = 150
                          const x = Math.cos(angle) * radiusX
                          const y = Math.sin(angle) * radiusY
                          const rotateDeg = (angle * 180 / Math.PI) + 90

                          const seat = seats.find(s => s.seat_number === i + 1)

                          return (
                            <div
                              key={i}
                              className="absolute flex flex-col items-center justify-start"
                              style={{
                                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotateDeg}deg)`,
                                left: '50%',
                                top: '50%',
                              }}
                            >
                              <div
                                className={`w-16 h-20 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-semibold transition ${
                                  seat
                                    ? 'bg-amber-600 border-amber-500 text-white shadow-lg'
                                    : 'bg-slate-600 border-slate-500 text-slate-300 hover:bg-slate-500'
                                }`}
                                style={{ transform: `rotate(${-rotateDeg}deg)` }}
                              >
                                <div className="text-center">
                                  {seat ? (
                                    <>
                                      <div className="text-xs font-bold">{seat.user_id === userId ? 'You' : 'Player'}</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-xs">Seat</div>
                                      <div className="text-xs">{i + 1}</div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seat Status Summary */}
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-white">{seats.filter(s => s.table_id === selectedTable.id).length}</div>
                      <div className="text-xs text-slate-400 mt-1">Seated</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">{selectedTable.max_seats - seats.filter(s => s.table_id === selectedTable.id).length}</div>
                      <div className="text-xs text-slate-400 mt-1">Available</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">{selectedTable.max_seats}</div>
                      <div className="text-xs text-slate-400 mt-1">Capacity</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="text-slate-400 text-lg">Select a table to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'network-balances' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
          <HouseBalanceTab />
        </div>
        )}
      </div>

      <RakeModal
        open={rakeModal.open}
        onClose={() => setRakeModal({ ...rakeModal, open: false })}
        startingBalance={rakeModal.startingBalance}
        endingBalance={rakeModal.endingBalance}
        userId={userId}
        tableId={rakeModal.tableId}
        currencyCode={rakeModal.currencyCode}
        onRakeProcessed={handleRakeProcessed}
      />

      <PokerGameModal
        open={gameModalOpen}
        onClose={closeGameModal}
        table={gameModalTable}
        userId={userId}
        userEmail={userEmail}
        onShowAuth={onShowAuth}
        onLeaveTable={handleLeaveTable}
      />
    </div>
  )
}
