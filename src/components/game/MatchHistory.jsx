import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function MatchHistory({ characterId, maxMatches = 8 }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMatches()
  }, [characterId])

  const loadMatches = async () => {
    if (!characterId) return
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('game_matches')
        .select('*')
        .or(`player1_id.eq.${characterId},player2_id.eq.${characterId}`)
        .order('created_at', { ascending: false })
        .limit(maxMatches)

      if (e) throw e
      setMatches(data || [])
    } catch (err) {
      console.warn('Failed to load match history:', err)
      setError('Could not load match history')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">Match History</h3>
        <button
          onClick={loadMatches}
          className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="text-xs text-slate-400">Loading matches...</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}

      {!loading && matches.length === 0 && (
        <div className="text-xs text-slate-400">No matches played yet. Challenge other players!</div>
      )}

      <div className="space-y-2">
        {matches.map(match => {
          const isWinner = match.winner_id === characterId
          const opponent = match.player1_id === characterId ? match.player2_name : match.player1_name
          const result = isWinner ? '✅ Win' : '❌ Loss'
          const resultColor = isWinner ? 'text-emerald-400' : 'text-red-400'

          return (
            <div
              key={match.id}
              className="flex items-center justify-between p-2 bg-slate-900/20 rounded text-xs hover:bg-slate-900/40 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1">
                <span className={`font-semibold ${resultColor}`}>{result}</span>
                <span className="text-slate-400">vs {opponent || 'Unknown'}</span>
              </div>
              <div className="text-slate-500">
                {new Date(match.created_at).toLocaleDateString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
