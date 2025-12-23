import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { preferencesManager } from '../lib/preferencesManager'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'
import ActionTimer from './ActionTimer'
import BettingControls from './BettingControls'
import PlayerSeats from './PlayerSeats'
import GameChat from './GameChat'

export default function PokerGameModal({ open, onClose, table, userId, userEmail, onShowAuth, onLeaveTable }) {
  const { isMobile } = useDevice()
  
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
  const isGuestLocal = userId && userId.includes('guest-local')

  // Scroll to top when modal opens (if preference is enabled)
  useEffect(() => {
    if (open && contentScrollRef.current) {
      const autoScroll = preferencesManager.getAutoScrollToTop(userId)
      if (autoScroll) {
        contentScrollRef.current.scrollTop = 0
        setTimeout(() => {
          if (contentScrollRef.current) {
            contentScrollRef.current.scrollTop = 0
          }
        }, 0)
      }
    }
  }, [open, userId])

  // Load initial data
  useEffect(() => {
    if (!table) return
    loadGameData()
    subscribeToRealtime()

    return () => {
      unsubscribeFromRealtime()
    }
  }, [table?.id])

  // Refresh player chip balance
  useEffect(() => {
    if (!userId) return

    const refreshBalance = async () => {
      try {
        if (isGuestLocal) {
          const storedChips = localStorage.getItem(`poker_chips_${userId}`)
          setPlayerBalance(Number(storedChips || 0))
        } else {
          const { data, error } = await supabase
            .from('player_poker_chips')
            .select('total_chips')
            .eq('user_id', userId)
            .single()

          if (error && error.code !== 'PGRST116') throw error
          setPlayerBalance(Number(data?.total_chips || 0))
        }
      } catch (err) {
        const errorMsg = err?.message || err?.error_description || JSON.stringify(err)
        console.error('Error loading chip balance:', errorMsg)
      }
    }

    refreshBalance()
    const interval = setInterval(refreshBalance, 2000)
    return () => clearInterval(interval)
  }, [userId, isGuestLocal])

  // Determine if it's current player's turn
  useEffect(() => {
    if (!hand || !myPosition || !userId || !currentPlayerSeat) {
      setActionRequired(false)
      return
    }

    if (hand.current_player_seat === currentPlayerSeat && hand.stage !== 'finished') {
      setActionRequired(true)
    } else {
      setActionRequired(false)
    }
  }, [hand?.current_player_seat, hand?.stage, currentPlayerSeat, myPosition, userId])

  // Load game data
  async function loadGameData() {
    try {
      if (!table) return

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      // Get table seats
      const seatsRes = await fetch(FUNCTIONS_BASE + '/get_seats', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ tableId: table.id })
      })

      if (seatsRes.ok) {
        const seatsData = await seatsRes.json()
        setSeats(seatsData || [])

        const myCurrentSeat = seatsData?.find((s) => s.user_id === userId)
        if (myCurrentSeat) setCurrentPlayerSeat(myCurrentSeat.seat_number)
      }

      // Get current hand
      const handsRes = await fetch(FUNCTIONS_BASE + '/get_current_hand', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ tableId: table.id })
      })

      if (handsRes.ok) {
        const handData = await handsRes.json()
        setHand(handData)
        setGameState(handData?.stage || 'waiting')
        setPot(handData?.pot || 0)
        setCommunityCards(handData?.community_cards || [])
        if (handData?.stage === 'waiting') {
          setWaitingForPlayers(seatsData?.length < 2)
        } else {
          setWaitingForPlayers(false)
        }
      }
    } catch (err) {
      console.error('Error loading game data:', err)
      setError('Failed to load game')
    }
  }

  // Subscribe to real-time updates
  function subscribeToRealtime() {
    if (!table) return

    handsUnsubscribeRef.current = supabase
      .channel(`poker_hands:table_id=eq.${table.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_hands' }, loadGameData)
      .subscribe()

    seatsUnsubscribeRef.current = supabase
      .channel(`poker_seats:table_id=eq.${table.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_seats' }, loadGameData)
      .subscribe()
  }

  // Unsubscribe
  function unsubscribeFromRealtime() {
    handsUnsubscribeRef.current?.unsubscribe()
    seatsUnsubscribeRef.current?.unsubscribe()
    betsUnsubscribeRef.current?.unsubscribe()
  }

  // Submit player action
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

  // Sit at table
  async function sitAtTable(seatNumber) {
    if (!userId || !userEmail) {
      onShowAuth?.('register')
      return
    }

    setLoading(true)
    try {
      const targetSeat = seatNumber || (seats.length + 1)

      // Fetch user's wallet balance
      const { data: wallets, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .limit(1)

      if (walletError) {
        console.error('Wallet fetch error:', walletError)
        throw new Error(walletError.message || 'Failed to load wallet')
      }

      const currentBalance = wallets && wallets.length > 0 ? Number(wallets[0].balance || 0) : 0

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(FUNCTIONS_BASE + '/join_table', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ tableId: table.id, userId, seatNumber: targetSeat, startingBalance: currentBalance })
      })

      if (!res.ok) {
        let errorMsg = 'Failed to join table'
        try {
          const json = await res.json()
          errorMsg = json.error || json.message || errorMsg
        } catch (parseErr) {
          console.warn('Could not parse error response:', parseErr)
          errorMsg = res.statusText || errorMsg
        }
        throw new Error(errorMsg)
      }

      await loadGameData()
      setError(null)
    } catch (err) {
      const errorMessage = err?.message || String(err) || 'Could not join table'
      setError(errorMessage)
      console.error('Error sitting at table:', err)
    } finally {
      setLoading(false)
    }
  }

  // Start hand
  async function startHand() {
    if (!userId || !table) return
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
        const json = await res.json()
        throw new Error(json.error || 'Failed to start hand')
      }

      await loadGameData()
    } catch (err) {
      setError(err.message || 'Could not start hand')
      console.error('Error starting hand:', err)
    }
  }

  // Leave seat
  function leaveSeat() {
    if (!userId || !table) return
    onLeaveTable?.(table.id)
    setTimeout(() => {
      onClose?.()
    }, 500)
  }

  const isSigned = !!userId && !!userEmail
  const isSeated = seats.some(s => s.user_id === userId)
  const tableStatusText = waitingForPlayers ? `Waiting for ${2 - seats.length} more player(s)...` : gameState || 'Initializing'

  if (!open || !table) return null

  const footer = (
    <div className="flex gap-2 w-full">
      {isSeated && (
        <button
          onClick={leaveSeat}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
        >
          Leave Seat
        </button>
      )}
      <button
        onClick={onClose}
        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
      >
        Close
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={open}
      onClose={onClose}
      title={table.name}
      icon="♠️"
      size="fullscreen"
      footer={footer}
      defaultExpanded={true}
      showCloseButton={false}
    >
      <div ref={contentScrollRef} className="space-y-4 pb-4">
        {/* Header Info */}
        <div className="flex items-center justify-between gap-4 p-3 bg-slate-100 rounded-lg">
          <div className="flex-1">
            <p className="text-xs text-slate-600">Stakes</p>
            <p className="font-semibold text-slate-900">
              {table.stake_min}/{table.stake_max}
            </p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs text-slate-600">Status</p>
            <p className="font-semibold text-emerald-600 text-sm">{tableStatusText}</p>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs text-slate-600">Pot</p>
            <p className="font-bold text-amber-600 text-lg">{pot.toLocaleString()}</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-600 hover:text-red-700 mt-1 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Game Area */}
        <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
          <PlayerSeats
            seats={seats}
            table={table}
            userId={userId}
            gameState={gameState}
            currentPlayerSeat={currentPlayerSeat}
            dealerSeat={dealerSeat}
            onSitClick={sitAtTable}
          />
        </div>

        {/* Community Cards */}
        {gameState && gameState !== 'waiting' && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-600 font-semibold mb-3">Community Cards</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {communityCards.length === 0 ? (
                <p className="text-sm text-slate-500">Waiting for cards...</p>
              ) : (
                communityCards.map((card, i) => (
                  <div
                    key={i}
                    className="w-12 h-16 bg-white rounded border-2 border-slate-300 flex items-center justify-center font-bold text-sm"
                  >
                    {card}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Action Controls */}
        {gameState && gameState !== 'waiting' && gameState !== 'finished' ? (
          <div className="space-y-3">
            {actionRequired && (
              <>
                <ActionTimer actionRequired={actionRequired} onExpired={() => submitAction('fold')} />
                {isSigned && isSeated && (
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
              </>
            )}

            {(!isSigned || !isSeated) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                {!isSigned ? (
                  <button
                    onClick={() => onShowAuth?.('login')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium underline"
                  >
                    Sign in to play
                  </button>
                ) : (
                  <p className="text-sm text-slate-600">Join the table to participate</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-center">
            {!isSigned ? (
              <>
                <p className="text-sm text-slate-600">Sign in to play poker</p>
                <button
                  onClick={() => onShowAuth?.('login')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Sign In / Register
                </button>
              </>
            ) : !isSeated ? (
              <>
                <p className="text-sm text-slate-600">Join the table to play</p>
                <button
                  onClick={() => sitAtTable()}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {loading ? 'Taking Seat...' : 'Take a Seat'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">Ready to play?</p>
                <button
                  onClick={startHand}
                  disabled={loading || waitingForPlayers}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {waitingForPlayers ? `Waiting for players (${seats.length}/2)...` : loading ? 'Starting...' : 'Start Hand'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Player Info */}
        {isSigned && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div>
              <p className="text-xs text-slate-600 font-semibold">Your Chip Balance</p>
              <p className="text-2xl font-bold text-amber-600">{playerBalance.toLocaleString()}</p>
            </div>
            {isSeated && (
              <div className="pt-2 border-t border-slate-300">
                <p className="text-xs text-emerald-600 font-medium">✓ Seated at Table</p>
              </div>
            )}
          </div>
        )}

        {/* Game Chat */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className="w-full px-4 py-3 flex items-center justify-between bg-slate-100 hover:bg-slate-200 transition border-b border-slate-200 font-semibold text-sm"
          >
            <span>Table Chat</span>
            <span className="text-xs">{chatCollapsed ? '▶' : '▼'}</span>
          </button>
          {!chatCollapsed && (
            <div className="p-3 max-h-60 overflow-y-auto">
              <GameChat tableId={table.id} userId={userId} />
            </div>
          )}
        </div>

        {/* Bet History */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-600 font-semibold mb-2">Recent Bets</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {betHistory.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No bets yet</p>
            ) : (
              betHistory.slice(-5).reverse().map((bet, i) => (
                <div key={i} className="text-xs text-slate-700 flex justify-between">
                  <span>{bet.action}</span>
                  <span className="text-amber-600">{bet.amount} chips</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ExpandableModal>
  )
}
