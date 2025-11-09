// Game quest and objective system
export const QUEST_TYPES = {
  main: 'main',
  side: 'side',
  daily: 'daily',
  achievement: 'achievement'
}

export const QUEST_STATUS = {
  available: 'available',
  active: 'active',
  completed: 'completed',
  failed: 'failed'
}

export const QUEST_OBJECTIVES = {
  earnMoney: { id: 'earnMoney', name: 'Earn Money' },
  completeJobs: { id: 'completeJobs', name: 'Complete Jobs' },
  reachLevel: { id: 'reachLevel', name: 'Reach Level' },
  buyProperties: { id: 'buyProperties', name: 'Buy Properties' },
  upgradeSkills: { id: 'upgradeSkills', name: 'Upgrade Skills' },
  equipItems: { id: 'equipItems', name: 'Equip Items' },
  visitLocations: { id: 'visitLocations', name: 'Visit Locations' },
  socialInteraction: { id: 'socialInteraction', name: 'Social Interaction' }
}

export const QUESTS = [
  {
    id: 'start-working',
    type: QUEST_TYPES.main,
    title: 'Get to Work',
    description: 'Complete your first job to earn money',
    reward: { money: 200, xp: 50 },
    objectives: [
      { type: QUEST_OBJECTIVES.completeJobs.id, target: 1, current: 0 }
    ]
  },
  {
    id: 'first-property',
    type: QUEST_TYPES.main,
    title: 'Own Your First Property',
    description: 'Purchase your first property to start earning passive income',
    reward: { money: 500, xp: 100 },
    prerequisites: ['start-working'],
    objectives: [
      { type: QUEST_OBJECTIVES.buyProperties.id, target: 1, current: 0 }
    ]
  },
  {
    id: 'level-5',
    type: QUEST_TYPES.main,
    title: 'Growing Stronger',
    description: 'Reach level 5 to unlock advanced jobs',
    reward: { money: 1000, xp: 200 },
    prerequisites: ['start-working'],
    objectives: [
      { type: QUEST_OBJECTIVES.reachLevel.id, target: 5, current: 0 }
    ]
  },
  {
    id: 'daily-grind',
    type: QUEST_TYPES.daily,
    title: 'Daily Grind',
    description: 'Complete 5 jobs in one day',
    reward: { money: 300, xp: 75 },
    expiresIn: 86400000, // 24 hours
    objectives: [
      { type: QUEST_OBJECTIVES.completeJobs.id, target: 5, current: 0 }
    ]
  },
  {
    id: 'wealthy-investor',
    type: QUEST_TYPES.side,
    title: 'Wealthy Investor',
    description: 'Earn 10,000 PHP in total wealth',
    reward: { money: 2000, xp: 150 },
    objectives: [
      { type: QUEST_OBJECTIVES.earnMoney.id, target: 10000, current: 0 }
    ]
  },
  {
    id: 'property-tycoon',
    type: QUEST_TYPES.side,
    title: 'Property Tycoon',
    description: 'Own 5 properties',
    reward: { money: 3000, xp: 200 },
    prerequisites: ['first-property'],
    objectives: [
      { type: QUEST_OBJECTIVES.buyProperties.id, target: 5, current: 0 }
    ]
  },
  {
    id: 'skill-master',
    type: QUEST_TYPES.side,
    title: 'Skill Master',
    description: 'Upgrade any skill to level 5',
    reward: { money: 1500, xp: 250 },
    objectives: [
      { type: QUEST_OBJECTIVES.upgradeSkills.id, target: 5, current: 0 }
    ]
  },
  {
    id: 'fashionable',
    type: QUEST_TYPES.achievement,
    title: 'Fashion Forward',
    description: 'Equip rare or better equipment',
    reward: { money: 500, xp: 100 },
    objectives: [
      { type: QUEST_OBJECTIVES.equipItems.id, target: 3, current: 0, rarity: 'rare' }
    ]
  },
  {
    id: 'explorer',
    type: QUEST_TYPES.achievement,
    title: 'Explorer',
    description: 'Visit all available locations',
    reward: { money: 750, xp: 150 },
    objectives: [
      { type: QUEST_OBJECTIVES.visitLocations.id, target: 6, current: 0 }
    ]
  }
]

export class QuestSystem {
  constructor(character = {}) {
    this.character = character
    this.activeQuests = character.activeQuests || []
    this.completedQuests = character.completedQuests || []
    this.questProgress = character.questProgress || {}
  }

  startQuest(questId) {
    const quest = QUESTS.find(q => q.id === questId)
    if (!quest) return null

    // Check prerequisites
    if (quest.prerequisites) {
      for (const prereq of quest.prerequisites) {
        if (!this.completedQuests.includes(prereq)) {
          return { error: 'Prerequisites not met', quest }
        }
      }
    }

    // Check if already active or completed
    if (this.activeQuests.includes(questId) || this.completedQuests.includes(questId)) {
      return { error: 'Quest already active or completed', quest }
    }

    this.activeQuests.push(questId)
    this.questProgress[questId] = {
      startedAt: Date.now(),
      objectives: quest.objectives.map(obj => ({ ...obj }))
    }

    return { success: true, quest }
  }

  updateQuestProgress(questId, objectiveType, amount = 1) {
    if (!this.questProgress[questId]) return null

    const progress = this.questProgress[questId]
    const objective = progress.objectives.find(obj => obj.type === objectiveType)

    if (!objective) return null

    objective.current = Math.min(objective.target, objective.current + amount)
    return this.checkQuestCompletion(questId)
  }

  checkQuestCompletion(questId) {
    const quest = QUESTS.find(q => q.id === questId)
    const progress = this.questProgress[questId]

    if (!quest || !progress) return null

    // Check if all objectives are met
    const allObjectivesMet = progress.objectives.every(obj => obj.current >= obj.target)

    if (allObjectivesMet) {
      this.completeQuest(questId)
      return { completed: true, quest, reward: quest.reward }
    }

    return {
      completed: false,
      questId,
      progress: progress.objectives.map(obj => ({
        type: obj.type,
        current: obj.current,
        target: obj.target,
        progress: Math.floor((obj.current / obj.target) * 100)
      }))
    }
  }

  completeQuest(questId) {
    const quest = QUESTS.find(q => q.id === questId)
    if (!quest) return null

    this.activeQuests = this.activeQuests.filter(id => id !== questId)
    if (!this.completedQuests.includes(questId)) {
      this.completedQuests.push(questId)
    }

    return { success: true, quest, reward: quest.reward }
  }

  getActiveQuests() {
    return this.activeQuests.map(questId => {
      const quest = QUESTS.find(q => q.id === questId)
      const progress = this.questProgress[questId]
      return { ...quest, progress }
    })
  }

  getAvailableQuests() {
    return QUESTS.filter(quest => {
      // Not already active or completed
      if (this.activeQuests.includes(quest.id) || this.completedQuests.includes(quest.id)) {
        return false
      }

      // Check prerequisites
      if (quest.prerequisites) {
        return quest.prerequisites.every(prereq => this.completedQuests.includes(prereq))
      }

      return true
    })
  }

  getDailyQuests() {
    return this.getAvailableQuests().filter(q => q.type === QUEST_TYPES.daily)
  }

  getMainQuests() {
    return this.getAvailableQuests().filter(q => q.type === QUEST_TYPES.main)
  }

  getSideQuests() {
    return this.getAvailableQuests().filter(q => q.type === QUEST_TYPES.side)
  }

  getAchievements() {
    return this.getAvailableQuests().filter(q => q.type === QUEST_TYPES.achievement)
  }

  getQuestProgress(questId) {
    return this.questProgress[questId] || null
  }

  getCompletedQuestCount() {
    return this.completedQuests.length
  }

  getTotalEarnedRewards() {
    return this.completedQuests.reduce((total, questId) => {
      const quest = QUESTS.find(q => q.id === questId)
      return total + (quest?.reward?.money || 0)
    }, 0)
  }
}
