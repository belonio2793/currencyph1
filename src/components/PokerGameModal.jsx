import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import ActionTimer from './ActionTimer'
import BettingControls from './BettingControls'
import PlayerSeats from './PlayerSeats'
import GameChat from './GameChat'

export default function PokerGameModal({ open, onClose, table, userId, userEmail, onShowAuth, onLeaveTable }) {
  // Game state
  const [gameState, setGameState] = useState(null)
  const [hand, setHand] = useState(null)
  const [seats, setSeats] = useState([])
  const [communityCards, setCommunityCards] = useState([])
  const [pot, setPot] = useState(0)
  const [currentPlayerSeat, setCurrentPlayerSeat] = useState(null)
  const [actionRequired, setActionRequired] = useState(false)
  const [playerBalance, setPlayerBalance] = useState(0)
  const [waitingForPlayers, setWaitingForPlayers] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Player action state
  const [selectedBet, setSelectedBet] = useState(0)
  const [betHistory, setBetHistory] = useState([])
  const [myPosition, setMyPosition] = useState(null)
  const [dealerSeat, setDealerSeat] = useState(null)

  // UI state
  const [chatCollapsed, setChatCollapsed] = useState(false)

  // Real-time sync
  const handsUnsubscribeRef = useRef(null)
  const seatsUnsubscribeRef = useRef(null)
  const betsUnsubscribeRef = useRef(null)
  const contentScrollRef = useRef(null)

  const FUNCTIONS_BASE = (import.meta.env.VITE_PROJECT_URL || '').replace(/\/+$/,'') + '/functions/v1/poker-engine'

  // Scroll to top when modal opens
  useEffect(() => {
    if (open && contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0
    }
  }, [open])

  // Load initial data
  useEffect(() => {
    if (!table) return
    loadGameData()
    subscribeToRealtime()

    return () => {
      unsubscribeFromRealtime()
    }
  }, [table?.id])

  // Refresh player balance
  useEffect(() => {
    if (!userId) return

    const refreshBalance = async () => {
      try {
        const { data: wallets } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .limit(1)

        if (wallets && wallets[0]) {
          setPlayerBalance(Number(wallets[0].balance))
        }
      } catch (err) {
        console.error('Error loading balance:', err)
      }
    }

    refreshBalance()
    const interval = setInterval(refreshBalance, 2000)
    return () => clearInterval(interval)
  }, [userId])

  // Determine if it's current player's turn
  useEffect(() => {
    if (!hand || !myPosition || !userId || !currentPlayerSeat) {
      setActionRequired(false)
      return
    }

    // Check if hand is in active state
    const isHandActive = ['preflop', 'flop', 'turn', 'river'].includes(hand.round_state)

    if (!isHandActive) {
      setActionRequired(false)
      return
    }

    // Check if it's our turn
    const isOurTurn = myPosition === currentPlayerSeat

    // Check if we've already acted
    const lastAction = betHistory.find(b => b.user_id === userId && b.round_state === hand.round_state)

    // Action required if it's our turn and we haven't acted yet
    setActionRequired(isOurTurn && !lastAction)
  }, [hand?.round_state, hand?.id, myPosition, userId, currentPlayerSeat, betHistory])

  async function loadGameData() {
    setLoading(true)
    setError(null)
    try {
      // Load seats
      const { data: seatsData, error: seatsErr } = await supabase
        .from('poker_seats')
        .select('*')
        .eq('table_id', table.id)
        .order('seat_number')
      
      if (seatsErr) throw seatsErr
      setSeats(seatsData || [])
      
      // Find my seat
      if (userId) {
        const mySeat = seatsData?.find(s => s.user_id === userId)
        setMyPosition(mySeat?.seat_number || null)
      }
      
      // Load latest hand
      const { data: handsData, error: handsErr } = await supabase
        .from('poker_hands')
        .select('*')
        .eq('table_id', table.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (handsErr) throw handsErr

      if (handsData && handsData[0]) {
        setHand(handsData[0])
        setGameState(handsData[0].round_state)
        setDealerSeat(handsData[0].dealer_seat)

        // Load cards if dealt
        const { data: holeCards } = await supabase
          .from('poker_hole_cards')
          .select('*')
          .eq('hand_id', handsData[0].id)

        // Load community cards
        if (handsData[0].community_cards) {
          setCommunityCards(handsData[0].community_cards)
        }

        // Determine who should act next (simplified - in real poker this is more complex)
        if (['preflop', 'flop', 'turn', 'river'].includes(handsData[0].round_state)) {
          const actedPlayers = betHistory.map(b => b.user_id)
          const needsToAct = seatsData?.find(s => !actedPlayers.includes(s.user_id))
          if (needsToAct) {
            setCurrentPlayerSeat(needsToAct.seat_number)
          }
        }
      } else {
        setGameState('waiting')
        setWaitingForPlayers(seatsData && seatsData.length < 2)
        setDealerSeat(null)
      }
      
      // Load bets and calculate pot
      const { data: betsData } = await supabase
        .from('poker_bets')
        .select('*')
        .eq('hand_id', hand?.id || '')
      
      if (betsData) {
        const totalPot = betsData.reduce((sum, bet) => sum + (Number(bet.amount) || 0), 0)
        setPot(totalPot)
        setBetHistory(betsData)
      }
    } catch (err) {
      console.error('Error loading game data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function subscribeToRealtime() {
    // Subscribe to hand changes
    if (table?.id) {
      handsUnsubscribeRef.current = supabase
        .channel(`poker_hands:table_id=eq.${table.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_hands', filter: `table_id=eq.${table.id}` }, (payload) => {
          if (payload.new) {
            setHand(payload.new)
            setGameState(payload.new.round_state)
            setCommunityCards(payload.new.community_cards || [])
          }
        })
        .subscribe()
    }
    
    // Subscribe to seat changes
    if (table?.id) {
      seatsUnsubscribeRef.current = supabase
        .channel(`poker_seats:table_id=eq.${table.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_seats', filter: `table_id=eq.${table.id}` }, (payload) => {
          loadGameData()
        })
        .subscribe()
    }
    
    // Subscribe to bet changes
    if (hand?.id) {
      betsUnsubscribeRef.current = supabase
        .channel(`poker_bets:hand_id=eq.${hand.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poker_bets', filter: `hand_id=eq.${hand.id}` }, (payload) => {
          if (payload.new) {
            setBetHistory(prev => [...prev, payload.new])
            setPot(prev => prev + (Number(payload.new.amount) || 0))
          }
        })
        .subscribe()
    }
  }

  function unsubscribeFromRealtime() {
    if (handsUnsubscribeRef.current) {
      supabase.removeChannel(handsUnsubscribeRef.current)
      handsUnsubscribeRef.current = null
    }
    if (seatsUnsubscribeRef.current) {
      supabase.removeChannel(seatsUnsubscribeRef.current)
      seatsUnsubscribeRef.current = null
    }
    if (betsUnsubscribeRef.current) {
      supabase.removeChannel(betsUnsubscribeRef.current)
      betsUnsubscribeRef.current = null
    }
  }

  async function startHand() {
    if (!userId) {
      onShowAuth?.('register')
      return
    }
    if (seats.length < 2) {
      setWaitingForPlayers(true)
      return
    }
    
    setLoading(true)
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(FUNCTIONS_BASE + '/start_hand', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ tableId: table.id })
      })
      
      if (!res.ok) {
        let errorMsg = 'Failed to start hand'
        try {
          const json = await res.json()
          errorMsg = json.error || errorMsg
        } catch (e) {}
        throw new Error(errorMsg)
      }
      
      const data = await res.json()
      setHand(data)
      setGameState('preflop')
      setWaitingForPlayers(false)
      await loadGameData()
    } catch (err) {
      setError(err.message)
      console.error('Error starting hand:', err)
    } finally {
      setLoading(false)
    }
  }

  async function submitAction(action, amount = 0) {
    if (!userId || !hand) return

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      let endpoint = '/post_bet'
      if (action === 'fold') {
        endpoint = '/fold'
      } else if (action === 'check') {
        endpoint = '/check'
      }

      const res = await fetch(FUNCTIONS_BASE + endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          handId: hand.id,
          userId,
          amount: action === 'fold' || action === 'check' ? 0 : amount
        })
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Action failed')
      }

      setActionRequired(false)
      setSelectedBet(0)
      await loadGameData()
    } catch (err) {
      setError(err.message)
      console.error('Error submitting action:', err)
    }
  }

  async function sitAtTable() {
    if (!userId || !userEmail) {
      onShowAuth?.('register')
      return
    }

    setLoading(true)
    try {
      const seatNumber = seats.length + 1

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
        body: JSON.stringify({ tableId: table.id, userId, seatNumber, startingBalance: currentBalance })
      })

      if (!res.ok) {
        let errorMsg = 'Failed to sit'
        try {
          const json = await res.json()
          errorMsg = json.error || errorMsg
        } catch (e) {}
        throw new Error(errorMsg)
      }

      await loadGameData()
      setError(null)
    } catch (err) {
      setError(err.message || 'Could not join table')
      console.error('Error sitting at table:', err)
    } finally {
      setLoading(false)
    }
  }

  function leaveSeat() {
    if (!userId || !table) return
    // Use the parent callback which handles rake and proper cleanup
    onLeaveTable?.(table.id)
    // Close modal after a short delay to allow cleanup
    setTimeout(() => {
      onClose?.()
    }, 500)
  }

  const isSigned = !!userId && !!userEmail
  const isSeated = seats.some(s => s.user_id === userId)
  const tableStatusText = waitingForPlayers ? `Waiting for ${2 - seats.length} more player(s)...` : gameState || 'Initializing'

  if (!open || !table) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-slate-700 shadow-2xl">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{table.name}</h2>
            <p className="text-sm text-slate-400 mt-1">
              Stakes: {table.stake_min}/{table.stake_max} {table.currency_code}
              <span className="ml-4">•</span>
              <span className="ml-4 text-emerald-400">{tableStatusText}</span>
            </p>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <div className="text-xs text-slate-400 mb-1">Current Pot</div>
              <div className="text-2xl font-bold text-amber-400">
                {pot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400">{table.currency_code}</div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition p-2 hover:bg-slate-700 rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={contentScrollRef} className="overflow-y-auto h-[calc(90vh-100px)]">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
            
            {/* Main Game Area */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Poker Table Visualization */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
                <PlayerSeats
                  seats={seats}
                  table={table}
                  userId={userId}
                  gameState={gameState}
                  currentPlayerSeat={currentPlayerSeat}
                  dealerSeat={dealerSeat}
                />
              </div>
              
              {/* Community Cards */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
                <div className="flex justify-center gap-2">
                  <div className="text-slate-400 text-sm font-semibold mr-4">Community:</div>
                  <div className="flex gap-2">
                    {communityCards.length === 0 ? (
                      <div className="text-slate-500 text-sm italic">Waiting for cards...</div>
                    ) : (
                      communityCards.map((card, i) => (
                        <div key={i} className="w-12 h-16 bg-white rounded border-2 border-slate-600 flex items-center justify-center font-bold text-sm">
                          {card}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              
              {/* Action Timer & Controls */}
              {gameState && gameState !== 'waiting' && gameState !== 'finished' ? (
                <div className="space-y-4">
                  <ActionTimer actionRequired={actionRequired} onExpired={() => submitAction('fold')} />
                  
                  {isSigned && isSeated && actionRequired && (
                    <BettingControls
                      maxBet={playerBalance}
                      onBet={(amount) => submitAction('bet', amount)}
                      onCall={() => submitAction('call')}
                      onRaise={(amount) => submitAction('raise', amount)}
                      onCheck={() => submitAction('check')}
                      onFold={() => submitAction('fold')}
                      selectedBet={selectedBet}
                      onBetChange={setSelectedBet}
                    />
                  )}
                  
                  {(!isSigned || !isSeated) && (
                    <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 text-blue-100 text-center">
                      {!isSigned ? (
                        <button
                          onClick={() => onShowAuth?.('login')}
                          className="text-blue-300 underline hover:text-blue-200"
                        >
                          Sign in to play
                        </button>
                      ) : (
                        <span>Join the table to participate in this hand</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center space-y-4">
                  {!isSigned ? (
                    <div className="space-y-3">
                      <p className="text-slate-300">Sign in to play poker</p>
                      <button
                        onClick={() => onShowAuth?.('login')}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                      >
                        Sign In / Register
                      </button>
                    </div>
                  ) : !isSeated ? (
                    <div className="space-y-3">
                      <p className="text-slate-300">Join the table to play</p>
                      <button
                        onClick={sitAtTable}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 disabled:opacity-50 text-white font-semibold rounded-lg transition"
                      >
                        {loading ? 'Taking Seat...' : 'Take a Seat'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-slate-300">Ready to play?</p>
                      <button
                        onClick={startHand}
                        disabled={loading || waitingForPlayers}
                        className="w-full px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 disabled:opacity-50 text-white font-semibold rounded-lg transition"
                      >
                        {waitingForPlayers ? `Waiting for players (${seats.length}/2)...` : loading ? 'Starting...' : 'Start Hand'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              
            </div>
            
            {/* Right Sidebar */}
            <div className="space-y-6">
              
              {/* Player Info */}
              {isSigned && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-300 mb-3">Your Balance</div>
                    <div className="text-3xl font-bold text-emerald-400">
                      {playerBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{table.currency_code}</div>
                  </div>

                  {isSeated && (
                    <div className="pt-2 space-y-2 border-t border-slate-700">
                      <div className="text-xs text-slate-400 font-semibold">Seat Status</div>
                      <div className="text-sm text-emerald-300 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                        Seated at Table
                      </div>
                      <button
                        onClick={leaveSeat}
                        className="w-full mt-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition"
                      >
                        Leave Seat
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Bet History */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="text-sm font-semibold text-slate-300 mb-3">Recent Bets</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {betHistory.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">No bets yet</div>
                  ) : (
                    betHistory.slice(-5).reverse().map((bet, i) => (
                      <div key={i} className="text-xs text-slate-300 flex justify-between">
                        <span>{bet.action}</span>
                        <span className="text-amber-400">{bet.amount} {table.currency_code}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Game Chat */}
              <div className="bg-slate-900 border-2 border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setChatCollapsed(!chatCollapsed)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-slate-800 hover:bg-slate-700 transition border-b border-slate-700"
                >
                  <span className="text-sm font-semibold text-slate-300">Table Chat</span>
                  <span className="text-xs text-slate-400">{chatCollapsed ? '▶' : '▼'}</span>
                </button>
                {!chatCollapsed && (
                  <div className="p-4">
                    <GameChat tableId={table.id} userId={userId} />
                  </div>
                )}
              </div>
              
              {/* Error Display */}
              {error && (
                <div className="bg-red-900 border border-red-700 rounded-lg p-3">
                  <p className="text-red-100 text-xs">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-red-300 hover:text-red-200 mt-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  )
}
