import React, { useState, useEffect } from 'react'

export default function EnhancedLeaderboard({ leaderboard = [], currentUserId = null }) {
  const [selectedSeason, setSelectedSeason] = useState('all-time')
  const [selectedCategory, setSelectedCategory] = useState('wealth')
  const [searchQuery, setSearchQuery] = useState('')

  const seasons = [
    { id: 'all-time', label: 'All Time', icon: '🏆' },
    { id: 'season-1', label: 'Season 1', icon: '🌟', dateRange: 'Jan-Mar 2024' },
    { id: 'season-2', label: 'Season 2', icon: '⭐', dateRange: 'Apr-Jun 2024' },
    { id: 'season-3', label: 'Season 3', icon: '✨', dateRange: 'Jul-Sep 2024' },
    { id: 'monthly', label: 'This Month', icon: '📅' },
    { id: 'weekly', label: 'This Week', icon: '📊' }
  ]

  const categories = [
    { id: 'wealth', label: 'Richest', icon: '💰', getValue: (p) => p.wealth || 0 },
    { id: 'level', label: 'Highest Level', icon: '⭐', getValue: (p) => p.level || 1 },
    { id: 'properties', label: 'Most Properties', icon: '🏠', getValue: (p) => p.properties_count || 0 },
    { id: 'income', label: 'Highest Income', icon: '📈', getValue: (p) => p.daily_income || 0 },
    { id: 'jobs', label: 'Most Jobs', icon: '💼', getValue: (p) => p.jobs_completed || 0 },
    { id: 'xp', label: 'Most XP', icon: '✨', getValue: (p) => p.xp || 0 }
  ]

  const getCategory = (id) => categories.find(c => c.id === id)
  const getSeason = (id) => seasons.find(s => s.id === id)

  const sortedLeaderboard = [...(leaderboard || [])]
    .filter(player => !searchQuery || player.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const category = getCategory(selectedCategory)
      if (!category) return 0
      return category.getValue(b) - category.getValue(a)
    })
    .slice(0, 100)

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `${rank}.`
  }

  const getColorByRank = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600'
    if (rank === 2) return 'from-slate-300 to-slate-500'
    if (rank === 3) return 'from-orange-400 to-orange-600'
    return 'from-slate-700 to-slate-800'
  }

  const getTextColorByRank = (rank) => {
    if (rank === 1) return 'text-yellow-300'
    if (rank === 2) return 'text-slate-200'
    if (rank === 3) return 'text-orange-300'
    return 'text-slate-300'
  }

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toLocaleString()
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-6 border border-cyan-500/30">
        <h2 className="text-2xl font-bold text-cyan-300 flex items-center gap-2 mb-4">
          🏆 Leaderboard
        </h2>

        {/* Season selector */}
        <div className="space-y-3">
          <label className="text-sm text-slate-300">Season</label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {seasons.map(season => (
              <button
                key={season.id}
                onClick={() => setSelectedSeason(season.id)}
                className={`px-4 py-2 rounded whitespace-nowrap transition ${
                  selectedSeason === season.id
                    ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-300'
                    : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {season.icon} {season.label}
                {season.dateRange && <span className="text-xs ml-2 opacity-70">{season.dateRange}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category selector and search */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-green-500/30 border border-green-400 text-green-300'
                  : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search player..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 rounded bg-slate-800/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      {/* Leaderboard list */}
      <div className="space-y-2">
        {sortedLeaderboard.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p>No players found</p>
          </div>
        ) : (
          sortedLeaderboard.map((player, idx) => {
            const rank = idx + 1
            const isCurrentUser = player.user_id === currentUserId
            const category = getCategory(selectedCategory)
            const value = category?.getValue(player) || 0

            return (
              <div
                key={player.user_id || player.id}
                className={`p-4 rounded border transition ${
                  isCurrentUser
                    ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 border-cyan-400/50'
                    : `bg-gradient-to-r ${getColorByRank(rank)}/20 border-slate-700/50 hover:bg-slate-700/30`
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Rank and name */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`font-bold text-xl min-w-[50px] ${getTextColorByRank(rank)}`}>
                      {getMedalEmoji(rank)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-bold ${isCurrentUser ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {player.name}
                        {isCurrentUser && <span className="text-xs ml-2 bg-cyan-500/30 px-2 py-1 rounded">YOU</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        {player.level && `Level ${player.level}`}
                        {player.properties_count !== undefined && ` • ${player.properties_count} properties`}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <div className={`font-bold text-lg ${getTextColorByRank(rank)}`}>
                      {category?.id === 'wealth' && `₱${formatNumber(value)}`}
                      {category?.id === 'income' && `₱${formatNumber(value)}/day`}
                      {category?.id === 'xp' && `${formatNumber(value)} XP`}
                      {!['wealth', 'income', 'xp'].includes(category?.id) && formatNumber(value)}
                    </div>

                    {/* Trend indicator */}
                    {player.trend && (
                      <div className={`text-xs ${player.trend > 0 ? 'text-green-400' : player.trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {player.trend > 0 && `↑ ${player.trend}`}
                        {player.trend < 0 && `↓ ${Math.abs(player.trend)}`}
                        {player.trend === 0 && '→ same'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar for context */}
                {rank <= 10 && (
                  <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getColorByRank(rank)}`}
                      style={{
                        width: `${(value / (sortedLeaderboard[0]?.wealth || value || 1)) * 100}%`
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Current user highlight if not in top 100 */}
      {leaderboard && !sortedLeaderboard.find(p => p.user_id === currentUserId) && (
        <div className="bg-slate-800/50 rounded p-4 border border-cyan-500/30 text-center">
          <p className="text-sm text-slate-300">
            You're not in the top 100 yet. Keep grinding! 💪
          </p>
        </div>
      )}

      {/* Reward info */}
      <div className="bg-slate-800/50 rounded p-4 border border-amber-500/30 text-sm space-y-2">
        <div className="font-bold text-amber-300 flex items-center gap-2">
          🎁 Seasonal Rewards
        </div>
        <div className="text-slate-300">
          <div>🥇 #1: 10,000 bonus credits</div>
          <div>🥈 #2-3: 5,000 bonus credits</div>
          <div>🥉 #4-10: 2,000 bonus credits</div>
        </div>
      </div>
    </div>
  )
}
