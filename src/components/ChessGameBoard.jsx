import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import ChessEngine from '../lib/chessEngine'

const PIECE_SYMBOLS = {
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚'
}

export default function ChessGameBoard({ game, userId, userEmail, onClose }) {
  const [currentGame, setCurrentGame] = useState(game)
  const [legalMoves, setLegalMoves] = useState({})
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [lastMove, setLastMove] = useState(null)
  const [gameStatus, setGameStatus] = useState('in_progress')
  const [whiteTime, setWhiteTime] = useState(game.time_control === 'unlimited' ? null : getInitialTime(game.time_control))
  const [blackTime, setBlackTime] = useState(game.time_control === 'unlimited' ? null : getInitialTime(game.time_control))
  const [error, setError] = useState(null)
  const subscriptionRef = useRef(null)

  function getInitialTime(timeControl) {
    const times = { blitz: 3, rapid: 10, classical: 30 }
    return (times[timeControl] || 10) * 60
  }

  const engine = new ChessEngine(currentGame.fen)
  const isWhitePlayer = currentGame.white_player_id === userId
  const isBlackPlayer = currentGame.black_player_id === userId
  const isMyTurn = (engine.isWhiteTurn() && isWhitePlayer) || (!engine.isWhiteTurn() && isBlackPlayer)

  useEffect(() => {
    const moves = engine.getLegalMoves()
    const movesMap = {}
    moves.forEach(move => {
      movesMap[move.from] = (movesMap[move.from] || []).concat(move.to)
    })
    setLegalMoves(movesMap)

    const status = engine.getGameStatus()
    setGameStatus(status)
  }, [currentGame.fen])

  useEffect(() => {
    subscriptionRef.current = supabase
      .channel(`chess_game_${currentGame.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chess_games',
          filter: `id=eq.${currentGame.id}`
        },
        (payload) => {
          setCurrentGame(payload.new)
        }
      )
      .subscribe()

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [currentGame.id])

  useEffect(() => {
    if (!currentGame.time_control || currentGame.time_control === 'unlimited') return

    const timer = setInterval(() => {
      if (engine.isWhiteTurn() && whiteTime > 0) {
        setWhiteTime(t => Math.max(0, t - 1))
      } else if (!engine.isWhiteTurn() && blackTime > 0) {
        setBlackTime(t => Math.max(0, t - 1))
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [engine, whiteTime, blackTime, currentGame.time_control])

  async function handleSquareClick(square) {
    if (!isMyTurn) {
      setError('Not your turn')
      setTimeout(() => setError(null), 3000)
      return
    }

    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    if (selectedSquare && legalMoves[selectedSquare]?.includes(square)) {
      try {
        const move = { from: selectedSquare, to: square }
        const moveResult = engine.makeMove(move)

        if (moveResult) {
          const newFen = engine.getFen()
          const updatedMoves = [...(currentGame.moves || []), { ...move, timestamp: new Date().toISOString() }]

          const { error: updateError } = await supabase
            .from('chess_games')
            .update({
              fen: newFen,
              moves: updatedMoves,
              last_move_by: userId,
              last_move_at: new Date().toISOString()
            })
            .eq('id', currentGame.id)

          if (updateError) throw updateError

          setLastMove(move)
          setSelectedSquare(null)
          setError(null)

          const newStatus = engine.getGameStatus()
          setGameStatus(newStatus)
        }
      } catch (e) {
        setError(`Invalid move: ${e.message}`)
        setTimeout(() => setError(null), 3000)
      }
    } else if (legalMoves[square]) {
      setSelectedSquare(square)
    }
  }

  function formatTime(seconds) {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const board = engine.getBoard()

  const timeControlDisplay = {
    blitz: 'Blitz (3 min)',
    rapid: 'Rapid (10 min)',
    classical: 'Classical (30 min)',
    unlimited: 'Unlimited'
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chessboard */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            {/* Black Player Info */}
            <div className="mb-6 pb-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <p className="text-slate-900 font-semibold">{currentGame.black_player_email || 'Waiting for opponent...'}</p>
                <p className="text-xs text-slate-600 mt-1">Black</p>
              </div>
              <div className={`text-2xl font-mono font-bold ${blackTime !== null && blackTime < 60 ? 'text-red-600' : 'text-slate-900'}`}>
                {formatTime(blackTime)}
              </div>
            </div>

            {/* Board */}
            <div className="bg-slate-300 p-2 rounded-lg mb-6 aspect-square max-w-md mx-auto">
              <div className="grid grid-cols-8 gap-0 h-full">
                {board.map((piece, index) => {
                  const row = Math.floor(index / 8)
                  const col = index % 8
                  const square = String.fromCharCode(97 + col) + (8 - row)
                  const isLight = (row + col) % 2 === 0
                  const isSelected = selectedSquare === square
                  const isHighlighted = legalMoves[selectedSquare]?.includes(square)
                  const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square)

                  return (
                    <button
                      key={square}
                      onClick={() => handleSquareClick(square)}
                      className={`
                        flex items-center justify-center text-3xl font-bold transition-all
                        ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                        ${isSelected ? 'ring-4 ring-blue-500' : ''}
                        ${isHighlighted ? 'ring-inset ring-4 ring-green-500' : ''}
                        ${isLastMove ? (isLight ? 'bg-yellow-300' : 'bg-yellow-600') : ''}
                        hover:opacity-90 cursor-pointer
                      `}
                    >
                      {piece && PIECE_SYMBOLS[piece]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* White Player Info */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
              <div>
                <p className="text-slate-900 font-semibold">{currentGame.white_player_email}</p>
                <p className="text-xs text-slate-600 mt-1">White</p>
              </div>
              <div className={`text-2xl font-mono font-bold ${whiteTime !== null && whiteTime < 60 ? 'text-red-600' : 'text-slate-900'}`}>
                {formatTime(whiteTime)}
              </div>
            </div>

            {/* Game Status */}
            {gameStatus !== 'in_progress' && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-blue-900 font-semibold">
                  {gameStatus === 'white_checkmate' && 'White is checkmated - Black wins!'}
                  {gameStatus === 'black_checkmate' && 'Black is checkmated - White wins!'}
                  {gameStatus === 'stalemate' && 'Game is a draw - Stalemate'}
                  {gameStatus === 'insufficient_material' && 'Game is a draw - Insufficient material'}
                  {gameStatus === 'check' && 'Check!'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Move History & Info */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 h-fit">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Game Info</h3>
          
          <div className="mb-6 pb-4 border-b border-slate-200">
            <p className="text-sm text-slate-600 font-medium">Time Control</p>
            <p className="text-slate-900 font-semibold mt-1">{timeControlDisplay[currentGame.time_control]}</p>
          </div>

          <div className="mb-6">
            <p className="text-sm text-slate-600 font-medium mb-3">Move History</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {currentGame.moves && currentGame.moves.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {currentGame.moves.map((move, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-sm font-mono text-center ${
                        idx % 2 === 0
                          ? 'bg-slate-100 text-slate-900'
                          : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      {Math.floor(idx / 2) + 1}. {move.from}{move.to}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No moves yet</p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-medium transition-colors border border-slate-300"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
