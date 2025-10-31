import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import ChessEngine from '../lib/chessEngine'

const PIECE_SYMBOLS = {
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '���'
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

  const engine = new ChessEngine(game.fen)
  const isWhitePlayer = game.white_player_id === userId
  const isBlackPlayer = game.black_player_id === userId
  const isMyTurn = (engine.isWhiteTurn() && isWhitePlayer) || (!engine.isWhiteTurn() && isBlackPlayer)

  function getInitialTime(timeControl) {
    const times = { blitz: 3, rapid: 10, classical: 30 }
    return (times[timeControl] || 10) * 60
  }

  useEffect(() => {
    const moves = engine.getLegalMoves()
    const movesMap = {}
    moves.forEach(move => {
      movesMap[move.from] = (movesMap[move.from] || []).concat(move.to)
    })
    setLegalMoves(movesMap)

    const status = engine.getGameStatus()
    setGameStatus(status)
  }, [engine])

  useEffect(() => {
    if (!game.time_control || game.time_control === 'unlimited') return

    const timer = setInterval(() => {
      if (engine.isWhiteTurn() && whiteTime > 0) {
        setWhiteTime(t => Math.max(0, t - 1))
      } else if (!engine.isWhiteTurn() && blackTime > 0) {
        setBlackTime(t => Math.max(0, t - 1))
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [engine, whiteTime, blackTime, game.time_control])

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
    if (!seconds) return '∞'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const board = engine.getBoard()

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-600 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chessboard */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-6 backdrop-blur-sm">
            {/* Black Player Info */}
            <div className="mb-4 p-3 bg-slate-700/30 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-white font-medium">{currentGame.black_player_email || 'Waiting for opponent...'}</p>
                <p className="text-xs text-slate-400">Black</p>
              </div>
              <div className={`text-xl font-mono font-bold ${blackTime !== null && blackTime < 60 ? 'text-red-400' : 'text-white'}`}>
                {formatTime(blackTime)}
              </div>
            </div>

            {/* Board */}
            <div className="bg-slate-900 p-1 rounded-lg mb-4 aspect-square max-w-md mx-auto">
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
                        flex items-center justify-center text-3xl font-bold transition-colors
                        ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                        ${isSelected ? 'ring-4 ring-green-400' : ''}
                        ${isHighlighted ? 'ring-4 ring-blue-400' : ''}
                        ${isLastMove ? (isLight ? 'bg-yellow-200' : 'bg-yellow-600') : ''}
                        hover:opacity-80 cursor-pointer
                      `}
                    >
                      {piece && PIECE_SYMBOLS[piece]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* White Player Info */}
            <div className="p-3 bg-slate-700/30 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-white font-medium">{currentGame.white_player_email}</p>
                <p className="text-xs text-slate-400">White</p>
              </div>
              <div className={`text-xl font-mono font-bold ${whiteTime !== null && whiteTime < 60 ? 'text-red-400' : 'text-white'}`}>
                {formatTime(whiteTime)}
              </div>
            </div>

            {/* Game Status */}
            {gameStatus !== 'in_progress' && (
              <div className="mt-4 p-4 bg-blue-900/30 border border-blue-600/30 rounded-lg text-center">
                <p className="text-blue-200 font-semibold">
                  {gameStatus === 'white_checkmate' && 'White is checkmated - Black wins!'}
                  {gameStatus === 'black_checkmate' && 'Black is checkmated - White wins!'}
                  {gameStatus === 'stalemate' && "Game is a draw - Stalemate"}
                  {gameStatus === 'insufficient_material' && "Game is a draw - Insufficient material"}
                  {gameStatus === 'check' && 'Check!'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Move History & Info */}
        <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-6 backdrop-blur-sm h-fit">
          <h3 className="text-lg font-semibold text-white mb-4">Move History</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {currentGame.moves && currentGame.moves.length > 0 ? (
              currentGame.moves.map((move, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-sm ${
                    idx % 2 === 0
                      ? 'bg-slate-700/30 text-slate-300'
                      : 'bg-slate-600/20 text-slate-400'
                  }`}
                >
                  <span className="font-mono font-semibold">{idx + 1}.</span> {move.from}{move.to}
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm">No moves yet</p>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-600/30">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
