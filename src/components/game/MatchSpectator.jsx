import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function MatchSpectator({ onClose }) {
  const [activeMatches, setActiveMatches] = useState([])
  const [watchingMatch, setWatchingMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    loadActiveMatches()
    const subs = supabase
      .channel('game_matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_matches' }, () => {
        loadActiveMatches()
      })
      .subscribe()

    setSubscription(subs)
    return () => {
      subs.unsubscribe()
    }
  }, [])

  async function loadActiveMatches() {
    try {
      setLoading(true)

      // Load ongoing matches from realtime channels or active matches
      const { data: matches } = await supabase
        .from('game_matches')
        .select(`
          *,
          player1:game_characters!player1_id(name, level),
          player2:game_characters!player2_id(name, level)
        `)
        .is('winner_id', null) // Only ongoing matches
        .order('created_at', { ascending: false })
        .limit(10)

      setActiveMatches(matches || [])
    } catch (err) {
      console.error('Failed to load active matches:', err)
    } finally {
      setLoading(false)
    }
  }

  async function watchMatch(match) {
    try {
      setWatchingMatch(match)
      // Subscribe to match updates
      const matchChannel = supabase.channel(`match_${match.session_id}`)
      matchChannel
        .on('broadcast', { event: 'match_action' }, ({ payload }) => {
          setWatchingMatch(prev => ({
            ...prev,
            ...payload
          }))
        })
        .subscribe()
    } catch (err) {
      console.error('Failed to watch match:', err)
    }
  }

  if (watchingMatch) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full my-8">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <h2 className="text-2xl font-bold text-white">👁️ Spectating Match</h2>
            <button
              onClick={() => setWatchingMatch(null)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Match Info */}
          <div className="p-6 space-y-6">
            {/* Player Stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Player 1 */}
              <div className="p-4 bg-slate-800 rounded border border-slate-700">
                <h3 className="font-bold text-white mb-2">{watchingMatch.player1?.name || 'Player 1'}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Level</span>
                    <span className="text-white font-medium">{watchingMatch.player1?.level}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">HP</span>
                    <span className="text-white font-medium">{watchingMatch.player1_final_hp}/100</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded h-4 overflow-hidden">
                    <div
                      className="bg-green-500 h-full transition-all"
                      style={{ width: `${Math.max(0, (watchingMatch.player1_final_hp / 100) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Player 2 */}
              <div className="p-4 bg-slate-800 rounded border border-slate-700">
                <h3 className="font-bold text-white mb-2">{watchingMatch.player2?.name || 'Player 2'}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Level</span>
                    <span className="text-white font-medium">{watchingMatch.player2?.level}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">HP</span>
                    <span className="text-white font-medium">{watchingMatch.player2_final_hp}/100</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded h-4 overflow-hidden">
                    <div
                      className="bg-green-500 h-full transition-all"
                      style={{ width: `${Math.max(0, (watchingMatch.player2_final_hp / 100) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Match Stats */}
            <div className="p-4 bg-slate-800 rounded border border-slate-700">
              <h4 className="font-bold text-white mb-3">Match Stats</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-slate-400 mb-1">Duration</div>
                  <div className="font-bold text-white">{watchingMatch.duration_seconds}s</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Rounds</div>
                  <div className="font-bold text-white">{watchingMatch.total_rounds}</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Status</div>
                  <div className="font-bold text-amber-400">{watchingMatch.status}</div>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded text-sm text-blue-200">
              💡 You're watching this match live. Match updates appear automatically.
            </div>

            <button
              onClick={() => setWatchingMatch(null)}
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"
            >
              Stop Watching
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">👁️ Spectate Matches</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading active matches...</div>
          ) : activeMatches.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="text-lg mb-2">No active matches to spectate</div>
              <p className="text-sm">Check back soon when players are dueling!</p>
            </div>
          ) : (
            activeMatches.map(match => (
              <button
                key={match.id}
                onClick={() => watchMatch(match)}
                className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 hover:border-slate-600 transition-colors text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <h3 className="font-bold text-white">
                      {match.player1?.name} vs {match.player2?.name}
                    </h3>
                  </div>
                  <div className="text-sm text-amber-400 font-bold">LIVE</div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <div>
                    Lvl {match.player1?.level} vs Lvl {match.player2?.level}
                  </div>
                  <div>
                    Round {match.total_rounds} • {match.duration_seconds}s
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
