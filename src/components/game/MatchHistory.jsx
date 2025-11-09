import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function MatchHistory({ characterId, maxMatches = 10 }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    totalMatches: 0,
    totalWins: 0,
    winRate: 0,
    avgDuration: 0
  })

  useEffect(() => {
    if (!characterId) return
    loadMatchHistory()
  }, [characterId])

  const loadMatchHistory = async () => {
    try {
      setLoading(true)
      setError('')

      // Skip if characterId is not a valid UUID (guest users)
      const isValidUUID = typeof characterId === 'string' && /^[0-9a-fA-F-]{36}$/.test(characterId)
      if (!isValidUUID) {
        setMatches([])
        setStats({ totalMatches: 0, totalWins: 0, winRate: 0, avgDuration: 0 })
        setLoading(false)
        return
      }

      // Load player's recent matches
      const { data: playerMatches, error: matchError } = await supabase
        .from('game_matches')
        .select('*')
        .or(`player1_id.eq.${characterId},player2_id.eq.${characterId}`)
        .order('created_at', { ascending: false })
        .limit(maxMatches)

      if (matchError) throw matchError

      setMatches(playerMatches || [])

      // Calculate stats
      const wins = (playerMatches || []).filter(m => m.winner_id === characterId).length
      const total = playerMatches?.length || 0
      const avgDur = total > 0 ? Math.round((playerMatches || []).reduce((sum, m) => sum + (m.duration_seconds || 0), 0) / total) : 0

      setStats({
        totalMatches: total,
        totalWins: wins,
        winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
        avgDuration: avgDur
      })
    } catch (err) {
      console.error('Failed to load match history:', err)
      setError(err.message || 'Failed to load match history')
    } finally {
      setLoading(false)
    }
  }

  const getOpponentName = (match) => {
    // Determine who is the opponent
    if (!characterId) return 'Unknown'
    return match.player1_id === characterId ? match.player2_name : match.player1_name
  }

  const getOpponentId = (match) => {
    if (!characterId) return null
    return match.player1_id === characterId ? match.player2_id : match.player1_id
  }

  const isPlayerWinner = (match) => match.winner_id === characterId

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">Match History</h3>

      {/* Stats Summary */}
      {!loading && matches.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4 text-sm">
          <div className="bg-slate-900/30 p-2 rounded text-center">
            <div className="text-xs text-slate-400">Total Matches</div>
            <div className="text-lg font-bold text-blue-300">{stats.totalMatches}</div>
          </div>
          <div className="bg-slate-900/30 p-2 rounded text-center">
            <div className="text-xs text-slate-400">Wins</div>
            <div className="text-lg font-bold text-emerald-300">{stats.totalWins}</div>
          </div>
          <div className="bg-slate-900/30 p-2 rounded text-center">
            <div className="text-xs text-slate-400">Win Rate</div>
            <div className="text-lg font-bold text-yellow-300">{stats.winRate}%</div>
          </div>
          <div className="bg-slate-900/30 p-2 rounded text-center">
            <div className="text-xs text-slate-400">Avg Duration</div>
            <div className="text-lg font-bold text-purple-300">{formatDuration(stats.avgDuration)}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center text-slate-400 py-8">Loading match history...</div>
      )}

      {!loading && matches.length === 0 && (
        <div className="text-center text-slate-400 py-8">
          No matches yet. Start a duel to build your history!
        </div>
      )}

      {/* Match List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {matches.map((match) => (
          <div
            key={match.id}
            className={`p-3 rounded border text-sm ${
              isPlayerWinner(match)
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={isPlayerWinner(match) ? 'text-emerald-300 font-bold' : 'text-red-300 font-bold'}>
                  {isPlayerWinner(match) ? '✓ WIN' : '✗ LOSS'}
                </span>
                <span className="text-slate-300">vs {getOpponentName(match)}</span>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(match.created_at).toLocaleDateString()} {new Date(match.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Duration:</span>
                <span className="text-slate-200 ml-1">{formatDuration(match.duration_seconds || 0)}</span>
              </div>
              <div>
                <span className="text-slate-400">Rounds:</span>
                <span className="text-slate-200 ml-1">{match.total_rounds || 0}</span>
              </div>
              <div>
                <span className="text-slate-400">Reward:</span>
                <span className={isPlayerWinner(match) ? 'text-emerald-300 ml-1 font-bold' : 'text-blue-300 ml-1 font-bold'}>
                  +{isPlayerWinner(match) ? match.reward_winner : match.reward_loser}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={loadMatchHistory}
        disabled={loading}
        className="w-full mt-3 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-white text-sm"
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  )
}
