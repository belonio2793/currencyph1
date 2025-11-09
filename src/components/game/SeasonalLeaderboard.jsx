import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function SeasonalLeaderboard({ onViewProfile }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [seasonInfo, setSeasonInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // 'all', 'wins', 'wealth'

  useEffect(() => {
    loadLeaderboard()
  }, [filter])

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      setError('')

      // Get current season number
      const { data: maxSeason } = await supabase
        .from('game_seasonal_leaderboard')
        .select('season_number')
        .order('season_number', { ascending: false })
        .limit(1)
        .single()

      const currentSeason = maxSeason?.season_number || 1

      setSeasonInfo({
        season: currentSeason,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Assume 30-day seasons
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      // Load leaderboard data
      const { data: leaderboardData } = await supabase
        .from('game_seasonal_leaderboard')
        .select(`
          character_id,
          rank,
          wins,
          losses,
          wealth,
          created_at
        `)
        .eq('season_number', currentSeason)
        .order('rank', { ascending: true })
        .limit(100)

      // Load character names
      const characterIds = leaderboardData?.map(l => l.character_id) || []
      const { data: characters } = await supabase
        .from('game_characters')
        .select('id, name, level')
        .in('id', characterIds)

      // Merge data
      const merged = leaderboardData?.map(entry => {
        const char = characters?.find(c => c.id === entry.character_id)
        return {
          ...entry,
          name: char?.name || 'Unknown',
          level: char?.level || 1,
          winRate: entry.losses > 0 ? ((entry.wins / (entry.wins + entry.losses)) * 100).toFixed(1) : '—'
        }
      }) || []

      // Sort based on filter
      const sorted = [...merged].sort((a, b) => {
        switch (filter) {
          case 'wins':
            return b.wins - a.wins
          case 'wealth':
            return b.wealth - a.wealth
          default:
            return a.rank - b.rank
        }
      })

      setLeaderboard(sorted)
    } catch (err) {
      console.error('Error loading leaderboard:', err)
      setError(err.message || 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getRewardColor = (rank) => {
    if (rank <= 3) return 'bg-yellow-600/20 border-yellow-600/30'
    if (rank <= 10) return 'bg-blue-600/20 border-blue-600/30'
    if (rank <= 25) return 'bg-purple-600/20 border-purple-600/30'
    return 'bg-slate-600/20 border-slate-600/30'
  }

  const getRewardAmount = (rank) => {
    if (rank === 1) return { credits: 500, badge: '👑' }
    if (rank === 2) return { credits: 300, badge: '🏆' }
    if (rank === 3) return { credits: 150, badge: '⭐' }
    if (rank <= 10) return { credits: 75, badge: '📈' }
    return null
  }

  if (loading) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-6">
        <div className="text-center text-slate-400">Loading leaderboard...</div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">🏅 Season Leaderboard</h2>
        <div className="text-sm text-slate-400">
          Season {seasonInfo?.season || 1}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded text-sm">
          {error}
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded text-sm ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          Rank
        </button>
        <button
          onClick={() => setFilter('wins')}
          className={`px-3 py-1 rounded text-sm ${
            filter === 'wins' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          Wins
        </button>
        <button
          onClick={() => setFilter('wealth')}
          className={`px-3 py-1 rounded text-sm ${
            filter === 'wealth' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          Wealth
        </button>
      </div>

      {/* Leaderboard List */}
      {leaderboard.length === 0 ? (
        <div className="text-center text-slate-400 py-8">
          No leaderboard data yet. Matches are needed to build rankings.
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {leaderboard.map((entry, idx) => {
            const reward = getRewardAmount(entry.rank)
            return (
              <div
                key={entry.character_id}
                onClick={() => onViewProfile && onViewProfile(entry.character_id)}
                className={`p-3 rounded border cursor-pointer hover:scale-101 transition ${getRewardColor(
                  entry.rank
                )}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-lg font-bold w-8 text-center">{getMedalEmoji(entry.rank)}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-100">{entry.name}</div>
                      <div className="text-xs text-slate-400">Lvl {entry.level}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-right text-sm">
                    <div>
                      <div className="text-xs text-slate-400">Wins</div>
                      <div className="font-bold text-emerald-300">{entry.wins}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">W/L</div>
                      <div className="font-bold text-slate-200">{entry.winRate}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Wealth</div>
                      <div className="font-bold text-yellow-300">{entry.wealth}</div>
                    </div>
                  </div>

                  {reward && (
                    <div className="ml-3 text-right">
                      <div className="text-2xl">{reward.badge}</div>
                      <div className="text-xs font-bold text-yellow-300">+{reward.credits}</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reward Info */}
      <div className="mt-4 p-3 bg-slate-900/30 rounded border border-slate-700 text-xs text-slate-400">
        <div className="font-bold mb-2">Season Rewards:</div>
        <div className="space-y-1">
          <div>🥇 <strong>Rank #1:</strong> 500 credits + Champion Badge</div>
          <div>🥈 <strong>Rank #2:</strong> 300 credits + Runner-up Badge</div>
          <div>🥉 <strong>Rank #3:</strong> 150 credits + Third Place Badge</div>
          <div>⭐ <strong>Top 10:</strong> 75 credits + Top 10 Badge</div>
        </div>
      </div>

      <button
        onClick={loadLeaderboard}
        className="w-full mt-4 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm"
      >
        Refresh
      </button>
    </div>
  )
}
