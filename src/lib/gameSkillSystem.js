// Game skill and progression system
export const SKILLS = {
  strength: { id: 'strength', name: 'Strength', icon: '💪', description: 'Physical power and endurance' },
  intelligence: { id: 'intelligence', name: 'Intelligence', icon: '🧠', description: 'Mental acuity and problem-solving' },
  agility: { id: 'agility', name: 'Agility', icon: '🏃', description: 'Speed and reflexes' },
  charisma: { id: 'charisma', name: 'Charisma', icon: '🎭', description: 'Social influence and persuasion' },
  luck: { id: 'luck', name: 'Luck', icon: '🍀', description: 'Fortune and critical hits' },
  endurance: { id: 'endurance', name: 'Endurance', icon: '❤️', description: 'Stamina and resilience' }
}

export const SKILL_JOBS = {
  strength: ['delivery-driver', 'builder'],
  intelligence: ['data-annotator', 'analyst', 'programmer'],
  agility: ['delivery-driver', 'athlete', 'dancer'],
  charisma: ['tourist-guide', 'salesman', 'content-creator'],
  luck: ['gambler', 'trader'],
  endurance: ['athlete', 'delivery-driver', 'construction-worker']
}

export const STAT_EFFECTS = {
  strength: {
    carry_capacity: 1,
    heavy_job_reward: 0.05,
    stamina_regen: 0.02
  },
  intelligence: {
    skill_learning_speed: 0.05,
    minigame_bonus: 0.08,
    research_speed: 0.1
  },
  agility: {
    dodge_chance: 0.02,
    movespeed: 0.05,
    reaction_time: -50
  },
  charisma: {
    social_reward_bonus: 0.07,
    npc_discount: 0.03,
    friend_capacity: 2
  },
  luck: {
    critical_hit_chance: 0.03,
    rare_find_chance: 0.05,
    income_variance: 0.1
  },
  endurance: {
    stamina_pool: 10,
    stamina_regen: 0.05,
    fatigue_resistance: 0.05
  }
}

// Experience thresholds for leveling (XP required for each level)
export const LEVEL_THRESHOLDS = Array.from({ length: 100 }, (_, i) => {
  const level = i + 1
  return Math.floor(100 * (level ** 1.5))
})

export class CharacterProgression {
  constructor(character) {
    this.character = character
    this.skills = this.initializeSkills(character.skills)
    this.level = character.level || 1
    this.experience = character.experience || 0
    this.stamina = character.stamina || 100
    this.maxStamina = character.max_stamina || 100
  }

  initializeSkills(skills) {
    const defaultSkills = {}
    Object.keys(SKILLS).forEach(key => {
      defaultSkills[key] = {
        level: 1,
        experience: 0,
        progress: 0
      }
    })
    return { ...defaultSkills, ...skills }
  }

  gainExperience(amount, skillType = null) {
    this.experience += amount
    
    if (skillType && SKILLS[skillType]) {
      this.skills[skillType].experience += Math.floor(amount / 2)
      this.checkSkillLevelUp(skillType)
    }

    this.checkLevelUp()
    return this.getProgressionData()
  }

  checkLevelUp() {
    const currentThreshold = LEVEL_THRESHOLDS[this.level - 1] || 0
    const nextThreshold = LEVEL_THRESHOLDS[this.level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]

    if (this.experience >= nextThreshold) {
      this.level++
      return { levelUp: true, newLevel: this.level }
    }

    return { levelUp: false, progress: (this.experience - currentThreshold) / (nextThreshold - currentThreshold) }
  }

  checkSkillLevelUp(skillType) {
    const skill = this.skills[skillType]
    const skillThreshold = skill.level * 100
    
    if (skill.experience >= skillThreshold) {
      skill.level++
      skill.experience = 0
      return { skillLevelUp: true, skill: skillType, newLevel: skill.level }
    }
    return { skillLevelUp: false }
  }

  addStamina(amount) {
    this.stamina = Math.min(this.maxStamina, this.stamina + amount)
  }

  consumeStamina(amount) {
    if (this.stamina < amount) return false
    this.stamina -= amount
    return true
  }

  recoverStamina(dt) {
    const recoveryRate = 0.5 + (this.character.stats?.endurance || 1) * 0.05
    this.addStamina(recoveryRate * dt / 1000)
  }

  getProgressionData() {
    const currentThreshold = LEVEL_THRESHOLDS[this.level - 1] || 0
    const nextThreshold = LEVEL_THRESHOLDS[this.level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
    const progress = Math.max(0, Math.min(1, (this.experience - currentThreshold) / (nextThreshold - currentThreshold)))

    return {
      level: this.level,
      experience: this.experience,
      progress,
      nextLevelAt: nextThreshold,
      skills: this.skills,
      stamina: this.stamina,
      maxStamina: this.maxStamina
    }
  }

  applySkillBonus(jobDifficulty, skillType = null) {
    let bonus = 1.0
    
    if (skillType && this.skills[skillType]) {
      const skillLevel = this.skills[skillType].level
      bonus += (skillLevel - 1) * 0.1
    }

    // Level scaling
    bonus *= (1 + (this.level - 1) * 0.05)

    return bonus
  }

  getStatModifiers() {
    const modifiers = {}
    Object.entries(SKILLS).forEach(([skillId, skill]) => {
      const skillLevel = this.skills[skillId]?.level || 1
      modifiers[skillId] = {
        level: skillLevel,
        modifier: 1 + (skillLevel - 1) * 0.05
      }
    })
    return modifiers
  }
}

export function calculateRewardWithSkills(baseReward, baseXP, character, skillType) {
  const progression = new CharacterProgression(character)
  const skillBonus = progression.applySkillBonus(character.level, skillType)
  const levelMultiplier = 1 + (character.level - 1) * 0.15

  return {
    money: Math.floor(baseReward * skillBonus * levelMultiplier),
    xp: Math.floor(baseXP * levelMultiplier)
  }
}
