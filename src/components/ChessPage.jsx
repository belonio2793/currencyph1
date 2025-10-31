import React, { useRef, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ChessGameBoard from './ChessGameBoard'
import { preferencesManager } from '../lib/preferencesManager'

export default function ChessPage({ userId, userEmail, onShowAuth }) {
  const pageRef = useRef(null)
  const gameViewRef = useRef(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('lobby')
  const [gameStats, setGameStats] = useState({ wins: 0, losses: 0, draws: 0 })

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
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
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

  async function handleJoinGame(game) {
    if (!userId || !userEmail) return onShowAuth && onShowAuth('register')
    if (game.white_player_id === userId) {
      setSelectedGame(game)
      setActiveTab('board')
      return
    }

    try {
      const { error } = await supabase
        .from('chess_games')
        .update({
          black_player_id: userId,
          black_player_email: userEmail,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', game.id)

      if (error) throw new Error(error.message)

      const updatedGame = { ...game, black_player_id: userId, black_player_email: userEmail, status: 'in_progress' }
      setSelectedGame(updatedGame)
      setActiveTab('board')
      loadGames()
    } catch (e) {
      setError(`Failed to join game: ${e.message}`)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" ref={pageRef}>
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-5xl font-bold text-slate-900 mb-2">Play Chess</h1>
        <p className="text-lg text-slate-600 mb-12">Challenge players and improve your skills</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {activeTab === 'lobby' && (
          <div className="space-y-8">
            {/* Player Stats */}
            {userId && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
                  <p className="text-sm font-medium text-slate-600 mb-2">Record</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {gameStats.wins}W - {gameStats.losses}L
                  </p>
                  <p className="text-xs text-slate-500 mt-2">{gameStats.draws} draws</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
                  <p className="text-sm font-medium text-slate-600 mb-2">Wins</p>
                  <p className="text-3xl font-bold text-green-600">{gameStats.wins}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
                  <p className="text-sm font-medium text-slate-600 mb-2">Losses</p>
                  <p className="text-3xl font-bold text-red-600">{gameStats.losses}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
                  <p className="text-sm font-medium text-slate-600 mb-2">Draws</p>
                  <p className="text-3xl font-bold text-slate-600">{gameStats.draws}</p>
                </div>
              </div>
            )}

            {/* Create Game Section */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Create New Game</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {['blitz', 'rapid', 'classical', 'unlimited'].map(tc => (
                  <button
                    key={tc}
                    onClick={() => handleCreateGame(tc)}
                    className="px-4 py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-semibold transition-all duration-200 border border-slate-300 hover:border-slate-400"
                  >
                    {timeControlLabels[tc]}
                  </button>
                ))}
              </div>
            </div>

            {/* Available Games */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-2xl font-bold text-slate-900">Available Games</h2>
                <p className="text-sm text-slate-600 mt-1">{games.length} game{games.length !== 1 ? 's' : ''} waiting for an opponent</p>
              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-500">
                  <p className="text-lg">Loading games...</p>
                </div>
              ) : games.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-slate-600 text-lg mb-4">No games waiting. Create one to get started!</p>
                  <button
                    onClick={() => handleCreateGame('rapid')}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Create Game
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {games.map(game => (
                    <div
                      key={game.id}
                      className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-slate-900 font-semibold">{game.white_player_email}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {timeControlLabels[game.time_control]} • Waiting for opponent
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoinGame(game)}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        Join Game
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'board' && selectedGame && (
          <div ref={gameViewRef}>
            <button
              onClick={closeGame}
              className="mb-6 px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
            >
              ← Back to Lobby
            </button>
            <ChessGameBoard game={selectedGame} userId={userId} userEmail={userEmail} onClose={closeGame} />
          </div>
        )}
      </div>
    </div>
  )
}
