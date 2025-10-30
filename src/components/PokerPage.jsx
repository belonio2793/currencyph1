import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function PokerPage({ userId, userEmail, onShowAuth }) {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState(null)
  const [seats, setSeats] = useState([])
  const FUNCTIONS_BASE = (import.meta.env.VITE_PROJECT_URL || '').replace(/\/+$/,'') + '/functions/v1/poker-engine'

  useEffect(() => { loadTables() }, [])

  async function loadTables() {
    setLoading(true)
    try {
      const { data } = await supabase.from('poker_tables').select('*').order('created_at', { ascending: false })
      setTables(data || [])
    } catch (e) {
      console.warn('Could not load tables', e)
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

  async function handleCreate(name, stakeMin, stakeMax) {
    try {
      const { data, error } = await supabase.from('poker_tables').insert([{ name, stake_min: stakeMin, stake_max: stakeMax }]).select().single()
      if (error) throw error
      await loadTables()
      setSelectedTable(data)
    } catch (e) {
      alert('Create table failed: ' + (e.message || e))
    }
  }

  async function handleSit(tableId) {
    if (!userId || !userEmail) return onShowAuth && onShowAuth('register')
    const seatNumber = (seats.length || 0) + 1
    try {
      const res = await fetch(FUNCTIONS_BASE + '/join_table', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tableId, userId, seatNumber }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to sit')
      await openTable(tables.find(t => t.id === tableId))
    } catch (e) {
      alert('Could not join table: ' + (e.message || e))
    }
  }

  async function handleStartHand(tableId) {
    try {
      const res = await fetch(FUNCTIONS_BASE + '/start_hand', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tableId }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to start hand')
      alert('Hand started')
      await openTable(tables.find(t => t.id === tableId))
    } catch (e) {
      alert('Could not start hand: ' + (e.message || e))
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-light">Poker</h2>
        <div className="flex items-center gap-2">
          <button onClick={loadTables} className="px-3 py-2 bg-slate-50 border rounded">Refresh</button>
          <button onClick={() => { const name = prompt('Table name') || 'Table'; const min = Number(prompt('Stake min') || 1); const max = Number(prompt('Stake max') || 2); handleCreate(name, min, max) }} className="px-3 py-2 bg-blue-600 text-white rounded">Create Table</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="font-semibold mb-3">Tables</h4>
          {loading ? <div>Loading...</div> : (
            <div className="space-y-2">
              {tables.map(t => (
                <div key={t.id} className="p-3 border rounded flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.stake_min}/{t.stake_max} {t.currency_code} • Seats: {t.max_seats}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openTable(t)} className="px-3 py-2 bg-white border rounded">Open</button>
                    <button onClick={() => handleSit(t.id)} className="px-3 py-2 bg-blue-600 text-white rounded">Sit</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <h4 className="font-semibold mb-3">Table</h4>
          {selectedTable ? (
            <div className="p-4 border rounded">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold">{selectedTable.name}</div>
                  <div className="text-xs text-slate-500">Stakes: {selectedTable.stake_min}/{selectedTable.stake_max}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleStartHand(selectedTable.id)} className="px-3 py-2 bg-emerald-600 text-white rounded">Start Hand</button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: selectedTable.max_seats }).map((_, i) => {
                  const seat = seats[i]
                  return (
                    <div key={i} className={`p-3 border rounded ${seat ? 'bg-slate-50' : 'bg-white'}`}>
                      <div className="text-sm">Seat {i + 1}</div>
                      <div className="text-xs text-slate-600 mt-1">{seat ? (seat.user_id === userId ? 'You' : seat.user_id) : 'Empty'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 border rounded text-sm text-slate-500">Select a table to view seats and start hands.</div>
          )}
        </div>
      </div>
    </div>
  )
}
