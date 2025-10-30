import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function PokerModal({ open, onClose, userId, userEmail, onShowAuth }) {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [seats, setSeats] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const FUNCTIONS_BASE = (import.meta.env.VITE_PROJECT_URL || '').replace(/\/+$/,'') + '/functions/v1/poker-engine'

  useEffect(() => {
    if (!open) return
    loadTables()
  }, [open])

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
    setSelected(table)
    setTableLoading(true)
    try {
      const { data } = await supabase.from('poker_seats').select('*').eq('table_id', table.id).order('seat_number')
      setSeats(data || [])
    } catch (e) {
      console.warn('Could not load seats', e)
      setSeats([])
    } finally { setTableLoading(false) }
  }

  async function handleSit(tableId) {
    if (!userId || !userEmail) return onShowAuth && onShowAuth('register')
    const seatNumber = (seats.length || 0) + 1
    try {
      const res = await fetch(FUNCTIONS_BASE + '/join_table', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tableId, userId, seatNumber })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to sit')
      // refresh seats
      await openTable(tables.find(t => t.id === tableId))
    } catch (e) {
      alert('Could not join table: ' + (e.message || e))
    }
  }

  async function handleStartHand(tableId) {
    try {
      const res = await fetch(FUNCTIONS_BASE + '/start_hand', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tableId })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to start hand')
      alert('Hand started')
      // refresh seats/hands
      await openTable(tables.find(t => t.id === tableId))
    } catch (e) {
      alert('Could not start hand: ' + (e.message || e))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Poker Lobby</h3>
          <button onClick={onClose} className="p-2">Close</button>
        </div>
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">Play virtual PHP poker with other users. Deposit to your wallet to get balance.</div>
            <div>
              <button onClick={loadTables} className="px-3 py-2 bg-slate-50 border rounded">Refresh</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Tables</h4>
              {loading ? <div>Loading...</div> : (
                <div className="space-y-2">
                  {tables.map(t => (
                    <div key={t.id} className="p-3 border rounded flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-xs text-slate-500">Stakes: {t.stake_min}/{t.stake_max} {t.currency_code} • Seats: {t.max_seats}</div>
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

            <div>
              <h4 className="font-medium mb-2">Table</h4>
              {selected ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{selected.name}</div>
                      <div className="text-xs text-slate-500">Stakes: {selected.stake_min}/{selected.stake_max}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleStartHand(selected.id)} className="px-3 py-2 bg-emerald-600 text-white rounded">Start Hand</button>
                    </div>
                  </div>

                  {tableLoading ? <div>Loading seats...</div> : (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: selected.max_seats }).map((_, i) => {
                        const seat = seats[i]
                        return (
                          <div key={i} className={`p-2 border rounded ${seat ? 'bg-slate-50' : 'bg-white'}`}>
                            <div className="text-sm">Seat {i + 1}</div>
                            <div className="text-xs text-slate-600 mt-1">{seat ? (seat.user_id === userId ? 'You' : seat.user_id) : 'Empty'}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : <div className="text-sm text-slate-500">Open a table to view seats and actions.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
