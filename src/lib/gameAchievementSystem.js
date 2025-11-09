// Game achievement system

export const ACHIEVEMENTS = {
  // Wealth achievements
  first_thousand: {
    id: 'first_thousand',
    title: 'First Thousand',
    description: 'Earn 1,000 pesos',
    icon: '💰',
    category: 'wealth',
    unlock: (stats) => stats.totalEarned >= 1000
  },
  first_million: {
    id: 'first_million',
    title: 'Millionaire',
    description: 'Reach 1,000,000 pesos wealth',
    icon: '💎',
    category: 'wealth',
    unlock: (stats) => stats.totalWealth >= 1000000
  },
  billionaire: {
    id: 'billionaire',
    title: 'Billionaire',
    description: 'Reach 1,000,000,000 pesos wealth',
    icon: '👑',
    category: 'wealth',
    unlock: (stats) => stats.totalWealth >= 1000000000
  },

  // Experience achievements
  level_5: {
    id: 'level_5',
    title: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    category: 'experience',
    unlock: (stats) => stats.level >= 5
  },
  level_10: {
    id: 'level_10',
    title: 'Expert',
    description: 'Reach level 10',
    icon: '🎯',
    category: 'experience',
    unlock: (stats) => stats.level >= 10
  },
  level_50: {
    id: 'level_50',
    title: 'Legend',
    description: 'Reach level 50',
    icon: '🏛️',
    category: 'experience',
    unlock: (stats) => stats.level >= 50
  },

  // Work achievements
  first_job: {
    id: 'first_job',
    title: 'Employee',
    description: 'Complete your first job',
    icon: '💼',
    category: 'work',
    unlock: (stats) => stats.jobsCompleted >= 1
  },
  jobs_100: {
    id: 'jobs_100',
    title: 'Workaholic',
    description: 'Complete 100 jobs',
    icon: '⚙️',
    category: 'work',
    unlock: (stats) => stats.jobsCompleted >= 100
  },
  jobs_500: {
    id: 'jobs_500',
    title: 'Career Master',
    description: 'Complete 500 jobs',
    icon: '🔧',
    category: 'work',
    unlock: (stats) => stats.jobsCompleted >= 500
  },

  // Property achievements
  first_property: {
    id: 'first_property',
    title: 'Property Owner',
    description: 'Buy your first property',
    icon: '🏠',
    category: 'property',
    unlock: (stats) => stats.propertiesOwned >= 1
  },
  property_5: {
    id: 'property_5',
    title: 'Landlord',
    description: 'Own 5 properties',
    icon: '🏢',
    category: 'property',
    unlock: (stats) => stats.propertiesOwned >= 5
  },
  property_10: {
    id: 'property_10',
    title: 'Real Estate Tycoon',
    description: 'Own 10 properties',
    icon: '🏗️',
    category: 'property',
    unlock: (stats) => stats.propertiesOwned >= 10
  },

  // Skill achievements
  skill_maxed: {
    id: 'skill_maxed',
    title: 'Master Craftsman',
    description: 'Max out one skill',
    icon: '🎓',
    category: 'skills',
    unlock: (stats) => stats.maxedSkills >= 1
  },
  all_skills: {
    id: 'all_skills',
    title: 'Jack of All Trades',
    description: 'Max out all skills',
    icon: '🌟',
    category: 'skills',
    unlock: (stats) => stats.maxedSkills >= 6
  },

  // Social achievements
  first_friend: {
    id: 'first_friend',
    title: 'Social Butterfly',
    description: 'Add your first friend',
    icon: '👥',
    category: 'social',
    unlock: (stats) => stats.friends >= 1
  },
  friends_10: {
    id: 'friends_10',
    title: 'Popular',
    description: 'Have 10 friends',
    icon: '🎉',
    category: 'social',
    unlock: (stats) => stats.friends >= 10
  },

  // Exploration achievements
  all_cities: {
    id: 'all_cities',
    title: 'World Traveler',
    description: 'Visit all cities',
    icon: '🗺️',
    category: 'exploration',
    unlock: (stats) => stats.citiesVisited >= 5
  },

  // Combo achievements
  seven_day_streak: {
    id: 'seven_day_streak',
    title: 'Dedicated',
    description: 'Maintain a 7-day login streak',
    icon: '🔥',
    category: 'combo',
    unlock: (stats) => stats.loginStreak >= 7
  },
  daily_collector: {
    id: 'daily_collector',
    title: 'Daily Collector',
    description: 'Collect daily rewards 30 times',
    icon: '📅',
    category: 'combo',
    unlock: (stats) => stats.dailyRewardsCollected >= 30
  }
}

export class AchievementTracker {
  constructor(characterId) {
    this.characterId = characterId
    this.unlockedAchievements = new Set()
    this.stats = {
      level: 1,
      totalEarned: 0,
      totalWealth: 0,
      jobsCompleted: 0,
      propertiesOwned: 0,
      maxedSkills: 0,
      friends: 0,
      citiesVisited: 0,
      loginStreak: 0,
      dailyRewardsCollected: 0
    }
  }

  updateStats(newStats) {
    this.stats = { ...this.stats, ...newStats }
    return this.checkAchievements()
  }

  checkAchievements() {
    const newlyUnlocked = []

    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
      if (!this.unlockedAchievements.has(id) && achievement.unlock(this.stats)) {
        this.unlockedAchievements.add(id)
        newlyUnlocked.push({ ...achievement, id })
      }
    }

    return newlyUnlocked
  }

  isUnlocked(achievementId) {
    return this.unlockedAchievements.has(achievementId)
  }

  getProgress(achievementId) {
    const achievement = ACHIEVEMENTS[achievementId]
    if (!achievement) return 0

    // Calculate progress percentage
    switch (achievementId) {
      case 'first_thousand':
        return Math.min(100, (this.stats.totalEarned / 1000) * 100)
      case 'first_million':
        return Math.min(100, (this.stats.totalWealth / 1000000) * 100)
      case 'billionaire':
        return Math.min(100, (this.stats.totalWealth / 1000000000) * 100)
      case 'level_5':
        return Math.min(100, (this.stats.level / 5) * 100)
      case 'level_10':
        return Math.min(100, (this.stats.level / 10) * 100)
      case 'level_50':
        return Math.min(100, (this.stats.level / 50) * 100)
      case 'jobs_100':
        return Math.min(100, (this.stats.jobsCompleted / 100) * 100)
      case 'jobs_500':
        return Math.min(100, (this.stats.jobsCompleted / 500) * 100)
      case 'property_5':
        return Math.min(100, (this.stats.propertiesOwned / 5) * 100)
      case 'property_10':
        return Math.min(100, (this.stats.propertiesOwned / 10) * 100)
      case 'friends_10':
        return Math.min(100, (this.stats.friends / 10) * 100)
      case 'all_cities':
        return Math.min(100, (this.stats.citiesVisited / 5) * 100)
      case 'seven_day_streak':
        return Math.min(100, (this.stats.loginStreak / 7) * 100)
      case 'daily_collector':
        return Math.min(100, (this.stats.dailyRewardsCollected / 30) * 100)
      default:
        return this.unlockedAchievements.has(achievementId) ? 100 : 0
    }
  }

  getAchievementsByCategory(category) {
    return Object.entries(ACHIEVEMENTS)
      .filter(([, achievement]) => achievement.category === category)
      .map(([id, achievement]) => ({
        ...achievement,
        id,
        unlocked: this.unlockedAchievements.has(id),
        progress: this.getProgress(id)
      }))
  }

  getAllAchievements() {
    return Object.entries(ACHIEVEMENTS)
      .map(([id, achievement]) => ({
        ...achievement,
        id,
        unlocked: this.unlockedAchievements.has(id),
        progress: this.getProgress(id)
      }))
  }

  getUnlockedCount() {
    return this.unlockedAchievements.size
  }

  getTotalCount() {
    return Object.keys(ACHIEVEMENTS).length
  }

  getCompletionPercentage() {
    return (this.getUnlockedCount() / this.getTotalCount()) * 100
  }
}
