import { supabase } from './supabaseClient'

// Achievement definitions with unlock conditions
export const ACHIEVEMENT_DEFINITIONS = {
  first_duel: {
    key: 'first_duel',
    name: 'Rookie Fighter',
    description: 'Win your first duel',
    icon: '🥋',
    check: (stats) => stats.total_wins >= 1
  },
  five_wins: {
    key: '5_wins',
    name: '5 Victory Streak',
    description: 'Achieve 5 consecutive wins',
    icon: '⚔️',
    check: (stats) => stats.win_streak >= 5
  },
  ten_wins: {
    key: '10_wins',
    name: '10 Victory Streak',
    description: 'Achieve 10 consecutive wins',
    icon: '🔥',
    check: (stats) => stats.win_streak >= 10
  },
  win_with_counter: {
    key: 'win_with_counter',
    name: 'Defensive Master',
    description: 'Win a duel using only Counter ability',
    icon: '🛡️',
    check: (stats, matchData) => matchData?.usedOnlyCounter && matchData?.won
  },
  critical_hit_spree: {
    key: 'critical_hit_spree',
    name: 'Critical Strike',
    description: 'Land 3 critical hits in one duel',
    icon: '💥',
    check: (stats, matchData) => matchData?.criticalHits >= 3
  },
  heal_specialist: {
    key: 'heal_specialist',
    name: 'Healer',
    description: 'Win a duel using Heal ability 5+ times',
    icon: '💚',
    check: (stats, matchData) => matchData?.healCount >= 5 && matchData?.won
  },
  level_up: {
    key: 'level_up',
    name: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    check: (stats, character) => character?.level >= 5
  },
  wealth_1000: {
    key: 'wealth_1000',
    name: 'Entrepreneur',
    description: 'Accumulate 1,000 credits',
    icon: '💰',
    check: (stats, character) => character?.wealth >= 1000
  },
  wealth_10000: {
    key: 'wealth_10000',
    name: 'Mogul',
    description: 'Accumulate 10,000 credits',
    icon: '🏆',
    check: (stats, character) => character?.wealth >= 10000
  },
  match_historian: {
    key: 'match_historian',
    name: 'Veteran',
    description: 'Participate in 50 matches',
    icon: '📜',
    check: (stats) => stats.total_matches >= 50
  },
  perfect_victory: {
    key: 'perfect_victory',
    name: 'Flawless Victory',
    description: 'Win a duel without taking damage',
    icon: '✨',
    check: (stats, matchData) => matchData?.damageTaken === 0 && matchData?.won
  },
  property_owner: {
    key: 'property_owner',
    name: 'Landlord',
    description: 'Own 5 properties',
    icon: '🏠',
    check: (stats, character) => (character?.properties || []).length >= 5
  }
}

export const achievementEngine = {
  /**
   * Check all achievements for a character and unlock new ones
   */
  async checkAchievements(characterId, character, stats, matchData = null) {
    if (!characterId) return { unlocked: [], failed: [] }

    const unlocked = []
    const failed = []

    for (const [key, achievement] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
      try {
        const shouldUnlock = achievement.check(stats, character, matchData)
        
        if (!shouldUnlock) {
          failed.push(key)
          continue
        }

        // Check if already unlocked
        const { data: existing } = await supabase
          .from('game_player_achievements')
          .select('id')
          .eq('character_id', characterId)
          .eq('achievement_key', achievement.key)
          .single()

        if (existing && existing.unlocked_at) {
          // Already unlocked
          continue
        }

        // Unlock the achievement
        const { data: newAchievement, error } = await supabase
          .from('game_player_achievements')
          .upsert([{
            character_id: characterId,
            achievement_key: achievement.key,
            unlocked_at: new Date(),
            progress: 100
          }], { onConflict: 'character_id,achievement_key' })
          .select()

        if (!error && newAchievement) {
          unlocked.push({
            key: achievement.key,
            ...achievement
          })
        }
      } catch (err) {
        console.warn(`Error checking achievement ${key}:`, err)
        failed.push(key)
      }
    }

    return { unlocked, failed }
  },

  /**
   * Get player's unlocked achievements
   */
  async getPlayerAchievements(characterId) {
    try {
      const { data: achievements, error } = await supabase
        .from('game_player_achievements')
        .select(`
          achievement_key,
          unlocked_at,
          claimed_reward
        `)
        .eq('character_id', characterId)
        .not('unlocked_at', 'is', null)

      if (error) throw error

      return achievements?.map(a => ({
        ...ACHIEVEMENT_DEFINITIONS[a.achievement_key],
        unlockedAt: a.unlocked_at,
        claimedReward: a.claimed_reward
      })) || []
    } catch (err) {
      console.error('Error fetching achievements:', err)
      return []
    }
  },

  /**
   * Claim reward for an achievement
   */
  async claimAchievementReward(characterId, achievementKey) {
    try {
      const achievement = ACHIEVEMENT_DEFINITIONS[achievementKey]
      if (!achievement) throw new Error('Invalid achievement')

      // Mark as claimed
      const { error: claimError } = await supabase
        .from('game_player_achievements')
        .update({ claimed_reward: true })
        .eq('character_id', characterId)
        .eq('achievement_key', achievementKey)

      if (claimError) throw claimError

      // Award rewards to character
      if (achievement.reward_credits > 0 || achievement.reward_xp > 0) {
        const { error: rewardError } = await supabase
          .from('game_characters')
          .update({
            money: supabase.rpc('increment_money', { 
              char_id: characterId, 
              amount: achievement.reward_credits 
            }),
            wealth: supabase.rpc('increment_wealth', { 
              char_id: characterId, 
              amount: achievement.reward_credits 
            }),
            experience: supabase.rpc('increment_experience', { 
              char_id: characterId, 
              amount: achievement.reward_xp 
            })
          })
          .eq('id', characterId)

        if (rewardError) throw rewardError
      }

      return true
    } catch (err) {
      console.error('Error claiming reward:', err)
      return false
    }
  },

  /**
   * Get achievement progress for a character
   */
  async getAchievementProgress(characterId) {
    try {
      const { data: stats } = await supabase
        .from('game_player_stats')
        .select('*')
        .eq('character_id', characterId)
        .single()

      const { data: character } = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', characterId)
        .single()

      const { data: achievements } = await supabase
        .from('game_player_achievements')
        .select('achievement_key, unlocked_at')
        .eq('character_id', characterId)

      const unlockedKeys = achievements
        ?.filter(a => a.unlocked_at)
        .map(a => a.achievement_key) || []

      const progressData = []

      for (const [key, achievement] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
        const isUnlocked = unlockedKeys.includes(key)
        const progress = {
          key,
          name: achievement.name,
          icon: achievement.icon,
          unlocked: isUnlocked,
          description: achievement.description
        }

        if (!isUnlocked) {
          // Calculate progress towards unlock
          const shouldUnlock = achievement.check(stats, character)
          progress.canUnlock = shouldUnlock
        }

        progressData.push(progress)
      }

      return {
        total: progressData.length,
        unlocked: progressData.filter(p => p.unlocked).length,
        achievements: progressData
      }
    } catch (err) {
      console.error('Error fetching achievement progress:', err)
      return { total: 0, unlocked: 0, achievements: [] }
    }
  }
}
