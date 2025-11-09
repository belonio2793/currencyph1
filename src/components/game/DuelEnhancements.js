// Ability definitions and mechanics
export const ABILITIES = {
  attack: {
    name: 'Attack',
    cost: 10,
    cooldown: 0,
    energy: 10,
    icon: '⚔️',
    description: 'Basic attack dealing 5-20 damage',
    execute: () => {
      const damage = 5 + Math.floor(Math.random() * 16)
      return { damage, energy: 10, type: 'attack' }
    }
  },
  powerStrike: {
    name: 'Power Strike',
    cost: 20,
    cooldown: 3,
    energy: 25,
    icon: '💥',
    description: 'Devastating strike dealing 15-40 damage. Cooldown: 3 turns.',
    execute: (stats) => {
      const baseDamage = 15 + Math.floor(Math.random() * 26)
      const bonus = Math.floor((stats?.level || 1) * 1.5)
      return { damage: baseDamage + bonus, energy: 25, type: 'powerStrike' }
    }
  },
  counterAttack: {
    name: 'Counter',
    cost: 15,
    cooldown: 2,
    energy: 20,
    icon: '🛡️',
    description: 'Defensive stance that blocks next attack & counters for damage. Cooldown: 2 turns.',
    execute: () => {
      return { damage: 10, block: true, shield: 50, energy: 20, type: 'counter' }
    }
  },
  powerHeal: {
    name: 'Heal',
    cost: 15,
    cooldown: 4,
    energy: 20,
    icon: '💚',
    description: 'Restore 30-50 HP. Cooldown: 4 turns.',
    execute: (stats) => {
      const heal = 30 + Math.floor(Math.random() * 21)
      return { heal, energy: 20, type: 'heal' }
    }
  },
  execute: {
    name: 'Execute',
    cost: 30,
    cooldown: 6,
    energy: 40,
    icon: '⚡',
    description: 'Ultimate ability: deal 25-50 damage. Cooldown: 6 turns.',
    execute: (stats) => {
      const damage = 25 + Math.floor(Math.random() * 26)
      return { damage, energy: 40, type: 'execute', critical: true }
    }
  }
}

// Status effect definitions
export const STATUS_EFFECTS = {
  stun: {
    name: 'Stun',
    icon: '💫',
    duration: 1,
    canAct: false,
    description: 'Cannot act this turn'
  },
  bleed: {
    name: 'Bleeding',
    icon: '🩸',
    duration: 3,
    damagePerTurn: 5,
    description: 'Takes 5 damage per turn'
  },
  shield: {
    name: 'Shield',
    icon: '🛡️',
    duration: 2,
    reduceDamagePercent: 50,
    description: 'Reduces damage by 50%'
  },
  poison: {
    name: 'Poison',
    icon: '☠️',
    duration: 3,
    damagePerTurn: 3,
    description: 'Takes 3 damage per turn'
  },
  regen: {
    name: 'Regeneration',
    icon: '✨',
    duration: 2,
    healPerTurn: 10,
    description: 'Restores 10 HP per turn'
  }
}

// Combat calculation engine
export const combatEngine = {
  calculateDamage(ability, attacker, defender) {
    if (!ability || !ability.execute) return 0
    
    const result = ability.execute(attacker)
    let damage = result.damage || 0
    
    // Apply defender shield
    if (defender.activeEffects?.shield) {
      const reduction = damage * (defender.activeEffects.shield.reduceDamagePercent / 100)
      damage = Math.max(0, damage - reduction)
    }
    
    // Critical hit bonus (25% chance for 1.5x damage)
    if (result.critical || Math.random() < 0.15) {
      damage = Math.floor(damage * 1.5)
    }
    
    return Math.max(1, Math.floor(damage))
  },

  applyStatusEffect(target, effect, duration = 1) {
    if (!target.activeEffects) target.activeEffects = {}
    target.activeEffects[effect] = {
      ...STATUS_EFFECTS[effect],
      turnsRemaining: duration
    }
    return target
  },

  updateStatusEffects(combatant) {
    if (!combatant.activeEffects) combatant.activeEffects = {}
    
    const effects = combatant.activeEffects
    let damageThisTurn = 0
    let healThisTurn = 0

    // Process each active effect
    Object.keys(effects).forEach(effectKey => {
      const effect = effects[effectKey]
      if (!effect) return

      // Apply damage effects
      if (effect.damagePerTurn) {
        damageThisTurn += effect.damagePerTurn
      }

      // Apply healing effects
      if (effect.healPerTurn) {
        healThisTurn += effect.healPerTurn
      }

      // Decrease duration
      effect.turnsRemaining -= 1
      if (effect.turnsRemaining <= 0) {
        delete effects[effectKey]
      }
    })

    return { damageThisTurn, healThisTurn }
  },

  getActiveCooldown(combatant, abilityKey) {
    if (!combatant.abilityCooldowns) combatant.abilityCooldowns = {}
    return combatant.abilityCooldowns[abilityKey] || 0
  },

  reduceCooldowns(combatant) {
    if (!combatant.abilityCooldowns) combatant.abilityCooldowns = {}
    Object.keys(combatant.abilityCooldowns).forEach(key => {
      if (combatant.abilityCooldowns[key] > 0) {
        combatant.abilityCooldowns[key] -= 1
      }
    })
  },

  applyCooldown(combatant, abilityKey) {
    if (!combatant.abilityCooldowns) combatant.abilityCooldowns = {}
    const ability = ABILITIES[abilityKey]
    if (ability && ability.cooldown > 0) {
      combatant.abilityCooldowns[abilityKey] = ability.cooldown
    }
  }
}

// Animation utilities
export const animations = {
  createDamageAnimation(damage, isPlayer) {
    return {
      id: Math.random(),
      type: 'damage',
      damage,
      isPlayer,
      duration: 800,
      startTime: Date.now()
    }
  },

  createHealAnimation(amount, isPlayer) {
    return {
      id: Math.random(),
      type: 'heal',
      amount,
      isPlayer,
      duration: 600,
      startTime: Date.now()
    }
  },

  createEffectAnimation(effect, isPlayer) {
    return {
      id: Math.random(),
      type: 'effect',
      effect,
      isPlayer,
      duration: 500,
      startTime: Date.now()
    }
  }
}

// Timer utility
export const TimerManager = {
  start() {
    return Date.now()
  },

  remaining(startTime, duration) {
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, duration - elapsed)
    return Math.ceil(remaining / 1000)
  },

  isExpired(startTime, duration) {
    return (Date.now() - startTime) >= duration
  }
}
