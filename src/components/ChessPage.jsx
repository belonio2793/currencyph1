import React, { useRef, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ChessGameBoard from './ChessGameBoard'
import { preferencesManager } from '../lib/preferencesManager'

const PIECE_SYMBOLS = {
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚'
}

const STARTING_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export default function ChessPage({ userId, userEmail, onShowAuth }) {
  const pageRef = useRef(null)
  const gameViewRef = useRef(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [joinModalGame, setJoinModalGame] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('lobby')
  const [gameStats, setGameStats] = useState({ wins: 0, losses: 0, draws: 0 })
  const [board, setBoard] = useState(fenToBoard(STARTING_BOARD))
  const [joiningGame, setJoiningGame] = useState(false)

  function fenToBoard(fen) {
    const boardArray = Array(64).fill(null)
    const boardFen = fen.split(' ')[0]
    const rows = boardFen.split('/')
    
    rows.forEach((row, rowIndex) => {
      let col = 0
      for (let char of row) {
        if (/[0-9]/.test(char)) {
          col += parseInt(char)
        } else {
          boardArray[rowIndex * 8 + col] = char
          col++
        }
      }
    })
    return boardArray
  }

  useEffect(() => {
    loadGames()
    if (userId) loadGameStats()
  }, [userId])

  async function loadGames() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('chess_games')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })

      if (err) {
        console.error('Load games error:', err)
        setError(`Failed to load games: ${err.message}`)
        setGames([])
      } else {
        setGames(data || [])
      }
    } catch (e) {
      console.error('Could not load games', e)
      setError(`Error: ${e.message}`)
      setGames([])
    } finally {
      setLoading(false)
    }
  }

  async function loadGameStats() {
    try {
      const { data: stats } = await supabase
        .from('chess_games')
        .select('result')
        .or(`white_player_id=eq.${userId},black_player_id=eq.${userId}`)
        .eq('status', 'completed')

      if (stats) {
        let wins = 0, losses = 0, draws = 0
        stats.forEach(game => {
          if (game.result === 'draw') draws++
          else if ((game.white_player_id === userId && game.result === 'white_wins') ||
                   (game.black_player_id === userId && game.result === 'black_wins')) {
            wins++
          } else {
            losses++
          }
        })
        setGameStats({ wins, losses, draws })
      }
    } catch (e) {
      console.warn('Could not load stats', e)
    }
  }

  async function handleCreateGame(timeControl) {
    if (!userId || !userEmail) return onShowAuth && onShowAuth('register')
    try {
      const { data: game, error } = await supabase
        .from('chess_games')
        .insert([{
          white_player_id: userId,
          white_player_email: userEmail,
          status: 'waiting',
          time_control: timeControl,
          moves: [],
          fen: STARTING_BOARD
        }])
        .select()
        .single()

      if (error) throw new Error(error.message)

      setSelectedGame(game)
      setActiveTab('board')
      setTimeout(() => {
        if (gameViewRef.current) {
          gameViewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    } catch (e) {
      setError(`Failed to create game: ${e.message}`)
    }
  }

  async function handleJoinGame() {
    if (!joinModalGame) return
    if (!userId || !userEmail) return onShowAuth && onShowAuth('register')

    setJoiningGame(true)
    try {
      const { error } = await supabase
        .from('chess_games')
        .update({
          black_player_id: userId,
          black_player_email: userEmail,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', joinModalGame.id)

      if (error) throw new Error(error.message)

      const updatedGame = { ...joinModalGame, black_player_id: userId, black_player_email: userEmail, status: 'in_progress' }
      setSelectedGame(updatedGame)
      setJoinModalGame(null)
      setActiveTab('board')
      loadGames()
    } catch (e) {
      setError(`Failed to join game: ${e.message}`)
    } finally {
      setJoiningGame(false)
    }
  }

  function closeGame() {
    setSelectedGame(null)
    setActiveTab('lobby')
    loadGames()
  }

  const timeControlLabels = {
    blitz: 'Blitz (3 min)',
    rapid: 'Rapid (10 min)',
    classical: 'Classical (30 min)',
    unlimited: 'Unlimited'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900" ref={pageRef}>
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-5xl font-bold text-white mb-2">Play Chess</h1>
        <p className="text-lg text-slate-300 mb-12">Challenge players and improve your skills</p>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {activeTab === 'lobby' && (
          <div className="space-y-8">
            {/* Main Layout: Board Left, Sidebar Right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chess Board Left (col-span 2) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-900/40 backdrop-blur-md rounded-lg shadow-sm border border-slate-700/50 p-6">
                  <h2 className="text-xl font-bold text-white mb-6">Game Board</h2>
                  {/* Display Chess Board */}
                  <div className="mx-auto max-w-lg">
                    <div className="aspect-square grid grid-cols-8 gap-0 border-2 border-slate-700/50 rounded-lg overflow-hidden">
                      {board.map((piece, index) => {
                        const row = Math.floor(index / 8)
                        const col = index % 8
                        const isLight = (row + col) % 2 === 0

                        return (
                          <div
                            key={index}
                            className={`
                              aspect-square flex items-center justify-center p-0 leading-none
                              ${isLight ? 'bg-emerald-700' : 'bg-emerald-900'}
                              transition-all
                            `}
                          >
                            {piece && (
                              <span
                                className={`${piece === piece.toUpperCase() ? 'text-slate-100' : 'text-slate-900'} text-5xl md:text-6xl`}
                                style={{ WebkitTextStroke: piece === piece.toUpperCase() ? '2px #0f172a' : '1.5px #e2e8f0', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))' }}
                              >
                                {PIECE_SYMBOLS[piece]}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Player Stats Below Board */}
                <div className="bg-slate-900/40 backdrop-blur-md rounded-lg shadow-sm border border-slate-700/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-6">Record</h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-slate-300 font-medium">Wins</p>
                      <p className="text-2xl font-bold text-green-400 mt-2">{gameStats.wins}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300 font-medium">Losses</p>
                      <p className="text-2xl font-bold text-red-400 mt-2">{gameStats.losses}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300 font-medium">Draws</p>
                      <p className="text-2xl font-bold text-slate-200 mt-2">{gameStats.draws}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Right */}
              <div className="space-y-6">
                {/* Create Game Section */}
                <div className="bg-slate-900/40 backdrop-blur-md rounded-lg shadow-sm border border-slate-700/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Create Game</h3>
                  <div className="space-y-3">
                    {['blitz', 'rapid', 'classical', 'unlimited'].map(tc => (
                      <button
                        key={tc}
                        onClick={() => handleCreateGame(tc)}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200"
                      >
                        {timeControlLabels[tc]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Available Games */}
                <div className="bg-slate-900/40 backdrop-blur-md rounded-lg shadow-sm border border-slate-700/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Available Games</h3>
                  <p className="text-sm text-slate-300 mb-4">
                    {games.length} game{games.length !== 1 ? 's' : ''} waiting
                  </p>

                  {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : games.length === 0 ? (
                    <p className="text-sm text-slate-500">No games available</p>
                  ) : (
                    <div className="space-y-3">
                      {games.slice(0, 5).map(game => (
                        <div
                          key={game.id}
                          className="p-3 border border-slate-700/50 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <p className="text-sm font-semibold text-white truncate">{game.white_player_email}</p>
                          <p className="text-xs text-slate-300 mb-2">
                            {timeControlLabels[game.time_control]}
                          </p>
                          <button
                            onClick={() => setJoinModalGame(game)}
                            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-semibold transition-colors"
                          >
                            Join
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'board' && selectedGame && (
          <div ref={gameViewRef}>
            <button
              onClick={closeGame}
              className="mb-6 px-4 py-2 text-slate-300 hover:text-white font-medium"
            >
              ← Back to Lobby
            </button>
            <ChessGameBoard game={selectedGame} userId={userId} userEmail={userEmail} onClose={closeGame} />
          </div>
        )}

        {/* Join Game Modal */}
        {joinModalGame && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900/70 backdrop-blur-md rounded-lg shadow-lg max-w-sm w-full p-8 border border-slate-700/50">
              <h3 className="text-2xl font-bold text-white mb-4">Join Game</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm text-slate-300 font-medium mb-1">Opponent</p>
                  <p className="text-lg font-semibold text-white">{joinModalGame.white_player_email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-300 font-medium mb-1">Time Control</p>
                  <p className="text-lg font-semibold text-white">{timeControlLabels[joinModalGame.time_control]}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-300 font-medium mb-1">Color</p>
                  <p className="text-lg font-semibold text-white">Black</p>
                </div>
              </div>

              <div className="space-y-3 flex gap-3">
                <button
                  onClick={() => setJoinModalGame(null)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-colors border border-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinGame}
                  disabled={joiningGame}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {joiningGame ? 'Joining...' : 'Join Game'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
