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
        .or('status=eq.waiting,status=eq.in_progress')
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

  return (
    <div className="min-h-screen bg-slate-900 text-white py-8 px-4" ref={pageRef}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-light text-white mb-8">Chess</h2>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-600 rounded-lg text-red-200 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('lobby')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'lobby'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Lobby
          </button>
          {selectedGame && (
            <button
              onClick={() => setActiveTab('board')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'board'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Game
            </button>
          )}
        </div>

        {activeTab === 'lobby' && (
          <div className="space-y-6">
            {/* Player Stats */}
            {userId && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-sm text-slate-400 mb-1">Record</p>
                  <p className="text-2xl font-bold text-white">
                    {gameStats.wins}W - {gameStats.losses}L
                  </p>
                </div>
                <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-sm text-slate-400 mb-1">Wins</p>
                  <p className="text-2xl font-bold text-emerald-400">{gameStats.wins}</p>
                </div>
                <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-sm text-slate-400 mb-1">Losses</p>
                  <p className="text-2xl font-bold text-red-400">{gameStats.losses}</p>
                </div>
                <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-4 backdrop-blur-sm">
                  <p className="text-sm text-slate-400 mb-1">Draws</p>
                  <p className="text-2xl font-bold text-slate-300">{gameStats.draws}</p>
                </div>
              </div>
            )}

            {/* Create Game Section */}
            <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg p-6 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-4">Create New Game</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <button
                  onClick={() => handleCreateGame('blitz')}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  ⚡ Blitz (3 min)
                </button>
                <button
                  onClick={() => handleCreateGame('rapid')}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  🚀 Rapid (10 min)
                </button>
                <button
                  onClick={() => handleCreateGame('classical')}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  🎓 Classical (30 min)
                </button>
                <button
                  onClick={() => handleCreateGame('unlimited')}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  ♾️ Unlimited
                </button>
              </div>
            </div>

            {/* Available Games */}
            <div className="bg-slate-800/40 border border-slate-600/30 rounded-lg backdrop-blur-sm overflow-hidden">
              <div className="p-6 border-b border-slate-600/30">
                <h3 className="text-xl font-semibold text-white">Available Games ({games.length})</h3>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400">
                  <p>Loading games...</p>
                </div>
              ) : games.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p>No games waiting. Create one to get started!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-600/30">
                  {games.map(game => (
                    <div
                      key={game.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-white font-medium">{game.white_player_email}</p>
                        <p className="text-sm text-slate-400">
                          {game.time_control === 'blitz' && '⚡ Blitz (3 min)'}
                          {game.time_control === 'rapid' && '🚀 Rapid (10 min)'}
                          {game.time_control === 'classical' && '🎓 Classical (30 min)'}
                          {game.time_control === 'unlimited' && '♾️ Unlimited'}
                          {game.status === 'waiting' && ' • Waiting for opponent'}
                          {game.status === 'in_progress' && ' • In Progress'}
                        </p>
                      </div>
                      <button
                        onClick={() => game.status === 'waiting' ? handleJoinGame(game) : setSelectedGame(game)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        {game.status === 'waiting' ? 'Join' : 'Watch'}
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
            <ChessGameBoard game={selectedGame} userId={userId} userEmail={userEmail} onClose={closeGame} />
          </div>
        )}
      </div>
    </div>
  )
}
