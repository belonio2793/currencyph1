import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { achievementEngine } from '../../lib/achievementEngine'

export default function PlayerProfile({ characterId, onClose }) {
  const [character, setCharacter] = useState(null)
  const [stats, setStats] = useState(null)
  const [achievements, setAchievements] = useState([])
  const [achievementProgress, setAchievementProgress] = useState(null)
  const [seasonalData, setSeasonalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          if (characterId && user.id !== characterId) {
            loadFollowStatus(user.id, characterId)
            loadBlockStatus(user.id, characterId)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch current user:', err)
      }
    }
    getCurrentUser()
  }, [characterId])

  useEffect(() => {
    if (!characterId) return
    loadProfileData()
  }, [characterId])

  const loadFollowStatus = async (userId, targetId) => {
    try {
      const { data, error } = await supabase
        .from('game_player_follows')
        .select('id')
        .eq('follower_id', userId)
        .eq('following_id', targetId)
        .single()

      if (!error && data) {
        setIsFollowing(true)
      } else {
        setIsFollowing(false)
      }
    } catch (err) {
      console.warn('Failed to load follow status:', err)
    }
  }

  const loadBlockStatus = async (userId, targetId) => {
    try {
      const { data, error } = await supabase
        .from('game_player_blocks')
        .select('id')
        .eq('blocker_id', userId)
        .eq('blocked_id', targetId)
        .single()

      if (!error && data) {
        setIsBlocked(true)
      } else {
        setIsBlocked(false)
      }
    } catch (err) {
      console.warn('Failed to load block status:', err)
    }
  }

  const handleFollow = async () => {
    if (!currentUserId || !characterId) return

    try {
      setActionLoading(true)

      if (isFollowing) {
        const { error } = await supabase
          .from('game_player_follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', characterId)

        if (error) throw error
        setIsFollowing(false)
      } else {
        const { error } = await supabase
          .from('game_player_follows')
          .insert([
            {
              follower_id: currentUserId,
              following_id: characterId,
              created_at: new Date().toISOString()
            }
          ])

        if (error) throw error
        setIsFollowing(true)
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlock = async () => {
    if (!currentUserId || !characterId) return

    try {
      setActionLoading(true)

      if (isBlocked) {
        const { error } = await supabase
          .from('game_player_blocks')
          .delete()
          .eq('blocker_id', currentUserId)
          .eq('blocked_id', characterId)

        if (error) throw error
        setIsBlocked(false)
      } else {
        const { error } = await supabase
          .from('game_player_blocks')
          .insert([
            {
              blocker_id: currentUserId,
              blocked_id: characterId,
              created_at: new Date().toISOString()
            }
          ])

        if (error) throw error
        setIsBlocked(true)
      }
    } catch (err) {
      console.error('Failed to toggle block:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleMessage = () => {
    if (!currentUserId || !characterId) return
    console.log('Message functionality - navigate to chat with player:', characterId)
  }

  const handleTrade = () => {
    if (!currentUserId || !characterId) return
    console.log('Trade functionality - initiate trade with player:', characterId)
  }

  const loadProfileData = async () => {
    try {
      setLoading(true)
      setError('')

      // Load character data
      const { data: charData } = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', characterId)
        .single()

      if (charData) setCharacter(charData)

      // Load stats
      const { data: statsData } = await supabase
        .from('game_player_stats')
        .select('*')
        .eq('character_id', characterId)
        .single()

      if (statsData) setStats(statsData)

      // Load achievements
      const achievements = await achievementEngine.getPlayerAchievements(characterId)
      setAchievements(achievements)

      // Load achievement progress
      const progress = await achievementEngine.getAchievementProgress(characterId)
      setAchievementProgress(progress)

      // Load seasonal leaderboard data
      const { data: seasonal } = await supabase
        .from('game_seasonal_leaderboard')
        .select('*')
        .eq('character_id', characterId)
        .order('season_number', { ascending: false })
        .limit(1)
        .single()

      if (seasonal) setSeasonalData(seasonal)
    } catch (err) {
      console.error('Error loading profile:', err)
      setError(err.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'bg-slate-600',
      uncommon: 'bg-green-600',
      rare: 'bg-blue-600',
      epic: 'bg-purple-600',
      legendary: 'bg-yellow-600'
    }
    return colors[rarity] || colors.common
  }

  const getWinRate = () => {
    if (!stats || stats.total_matches === 0) return 0
    return ((stats.total_wins / stats.total_matches) * 100).toFixed(1)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-100">
          <div className="text-lg">Loading profile...</div>
        </div>
      </div>
    )
  }

  if (!character) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-100">
          <div className="text-lg text-red-400">Character not found</div>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/60 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full p-6 text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{character.name}</h1>
            <p className="text-slate-400">Level {character.level || 1}</p>
          </div>
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded">
            Close
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/30 p-4 rounded border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Matches</div>
            <div className="text-2xl font-bold text-blue-400">{stats?.total_matches || 0}</div>
          </div>
          <div className="bg-slate-800/30 p-4 rounded border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-emerald-400">{getWinRate()}%</div>
          </div>
          <div className="bg-slate-800/30 p-4 rounded border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Wins / Losses</div>
            <div className="text-2xl font-bold text-slate-200">
              {stats?.total_wins || 0} / {stats?.total_losses || 0}
            </div>
          </div>
          <div className="bg-slate-800/30 p-4 rounded border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Wealth</div>
            <div className="text-2xl font-bold text-yellow-400">{character.wealth || 0}</div>
          </div>
        </div>

        {/* Best Streaks */}
        {stats && (stats.best_win_streak > 0 || stats.win_streak > 0) && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {stats.best_win_streak > 0 && (
              <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 p-4 rounded border border-emerald-600/30">
                <div className="text-sm text-emerald-300 mb-1">Best Win Streak</div>
                <div className="text-3xl font-bold text-emerald-300">{stats.best_win_streak} 🔥</div>
              </div>
            )}
            {stats.win_streak > 0 && (
              <div className="bg-gradient-to-br from-amber-600/20 to-amber-900/20 p-4 rounded border border-amber-600/30">
                <div className="text-sm text-amber-300 mb-1">Current Streak</div>
                <div className="text-3xl font-bold text-amber-300">{stats.win_streak} ⚡</div>
              </div>
            )}
          </div>
        )}

        {/* Achievements Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            🏆 Achievements
            <span className="text-sm font-normal text-slate-400">
              ({achievements.length} / {achievementProgress?.total || 0})
            </span>
          </h2>

          {achievements.length === 0 ? (
            <div className="text-slate-400 text-center py-8">
              No achievements unlocked yet. Keep playing to earn badges!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {achievements.map(achievement => (
                <div
                  key={achievement.key}
                  className={`p-3 rounded border text-center cursor-pointer hover:scale-105 transition ${getRarityColor(
                    achievement.rarity
                  )} bg-opacity-20 border-opacity-40`}
                  title={achievement.description}
                >
                  <div className="text-3xl mb-1">{achievement.icon}</div>
                  <div className="text-xs font-bold text-slate-100">{achievement.name}</div>
                  {achievement.claimedReward && (
                    <div className="text-xs text-green-300 mt-1">✓ Claimed</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upcoming Achievements */}
          {achievementProgress && achievementProgress.achievements.some(a => a.canUnlock && !a.unlocked) && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-400 mb-2">Almost Unlocked</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {achievementProgress.achievements
                  .filter(a => a.canUnlock && !a.unlocked)
                  .map(achievement => (
                    <div
                      key={achievement.key}
                      className="p-3 rounded border border-yellow-600/30 bg-yellow-600/10 text-center"
                      title={achievement.description}
                    >
                      <div className="text-2xl mb-1 opacity-70">{achievement.icon}</div>
                      <div className="text-xs font-bold text-yellow-300">{achievement.name}</div>
                      <div className="text-xs text-yellow-200 mt-1">Next!</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Seasonal Leaderboard Info */}
        {seasonalData && (
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-900/20 p-4 rounded border border-purple-600/30">
            <h3 className="text-lg font-bold mb-3">🏅 Season {seasonalData.season_number}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-400">Rank</div>
                <div className="text-2xl font-bold text-purple-300">#{seasonalData.rank || 'Unranked'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Season Wins</div>
                <div className="text-2xl font-bold text-emerald-300">{seasonalData.wins || 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Final Rank</div>
                <div className="text-2xl font-bold text-amber-300">
                  {seasonalData.final_rank ? `#${seasonalData.final_rank}` : 'Active'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
