import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function PokerModal({ open, onClose, userId, userEmail, onShowAuth }) {
  const { isMobile } = useDevice()
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
      await openTable(tables.find(t => t.id === tableId))
    } catch (e) {
      alert('Could not start hand: ' + (e.message || e))
    }
  }

  const footer = (
    <div className="flex gap-2 w-full">
      <button
        onClick={loadTables}
        className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
      >
        Refresh
      </button>
      <button
        onClick={onClose}
        className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
      >
        Close
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={open}
      onClose={onClose}
      title="Poker Lobby"
      size={isMobile ? 'fullscreen' : 'xl'}
      footer={footer}
      defaultExpanded={!isMobile}
    >
      <div className="mb-4">
        <div className="text-sm text-slate-600 mb-4">
          Play virtual PHP poker with other users. Deposit to your wallet to get balance.
        </div>

        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
          {/* Tables List */}
          <div>
            <h4 className="font-medium mb-3">Tables</h4>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading tables...</div>
            ) : tables.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No tables available</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tables.map(t => (
                  <div key={t.id} className="p-3 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Stakes: {t.stake_min}/{t.stake_max} {t.currency_code} • Seats: {t.max_seats}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openTable(t)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleSit(t.id)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm"
                      >
                        Sit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Table Details */}
          <div>
            <h4 className="font-medium mb-3">Table Details</h4>
            {selected ? (
              <div className="space-y-4">
                <div className="p-3 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{selected.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Stakes: {selected.stake_min}/{selected.stake_max}
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartHand(selected.id)}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors text-sm whitespace-nowrap"
                    >
                      Start Hand
                    </button>
                  </div>
                </div>

                {/* Seats Grid */}
                {tableLoading ? (
                  <div className="text-center py-8 text-slate-500">Loading seats...</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: selected.max_seats }).map((_, i) => {
                      const seat = seats[i]
                      return (
                        <div
                          key={i}
                          className={`p-2 border rounded-lg text-center ${
                            seat ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="text-sm font-medium text-slate-700">Seat {i + 1}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            {seat ? (seat.user_id === userId ? '👤 You' : '👤 Player') : '⭕ Empty'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Open a table to view seats and actions
              </div>
            )}
          </div>
        </div>
      </div>
    </ExpandableModal>
  )
}
