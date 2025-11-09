// Game inventory and equipment system
export const EQUIPMENT_TYPES = {
  headgear: 'headgear',
  chest: 'chest',
  legs: 'legs',
  feet: 'feet',
  hands: 'hands',
  accessory: 'accessory'
}

export const EQUIPMENT_RARITY = {
  common: { name: 'Common', color: '#94a3b8', dropRate: 0.5 },
  uncommon: { name: 'Uncommon', color: '#22c55e', dropRate: 0.3 },
  rare: { name: 'Rare', color: '#3b82f6', dropRate: 0.15 },
  epic: { name: 'Epic', color: '#a855f7', dropRate: 0.04 },
  legendary: { name: 'Legendary', color: '#f59e0b', dropRate: 0.01 }
}

export const EQUIPMENT_ITEMS = [
  {
    id: 'worker-helmet',
    name: 'Worker Helmet',
    type: EQUIPMENT_TYPES.headgear,
    rarity: 'common',
    stats: { strength: 2 },
    description: 'A sturdy helmet for laborers'
  },
  {
    id: 'thinking-cap',
    name: 'Thinking Cap',
    type: EQUIPMENT_TYPES.headgear,
    rarity: 'uncommon',
    stats: { intelligence: 3 },
    description: 'Enhances mental clarity'
  },
  {
    id: 'crown-of-intellect',
    name: 'Crown of Intellect',
    type: EQUIPMENT_TYPES.headgear,
    rarity: 'rare',
    stats: { intelligence: 7, experience_bonus: 0.1 },
    description: 'Ancient crown that increases all learning'
  },
  {
    id: 'running-shoes',
    name: 'Running Shoes',
    type: EQUIPMENT_TYPES.feet,
    rarity: 'uncommon',
    stats: { agility: 3, movespeed: 0.2 },
    description: 'Lightweight and fast'
  },
  {
    id: 'work-gloves',
    name: 'Work Gloves',
    type: EQUIPMENT_TYPES.hands,
    rarity: 'common',
    stats: { strength: 2 },
    description: 'Protective gloves for manual labor'
  },
  {
    id: 'silk-vest',
    name: 'Silk Vest',
    type: EQUIPMENT_TYPES.chest,
    rarity: 'uncommon',
    stats: { charisma: 3 },
    description: 'Increases social appeal'
  },
  {
    id: 'golden-necklace',
    name: 'Golden Necklace',
    type: EQUIPMENT_TYPES.accessory,
    rarity: 'rare',
    stats: { luck: 4, income_bonus: 0.08 },
    description: 'Brings fortune to the wearer'
  },
  {
    id: 'lucky-bracelet',
    name: 'Lucky Bracelet',
    type: EQUIPMENT_TYPES.accessory,
    rarity: 'uncommon',
    stats: { luck: 2 },
    description: 'A small charm for better fortune'
  },
  {
    id: 'warrior-armor',
    name: 'Warrior Armor',
    type: EQUIPMENT_TYPES.chest,
    rarity: 'epic',
    stats: { strength: 6, endurance: 5, defense: 0.15 },
    description: 'Legendary armor of ancient warriors'
  },
  {
    id: 'sage-robes',
    name: 'Sage Robes',
    type: EQUIPMENT_TYPES.chest,
    rarity: 'epic',
    stats: { intelligence: 7, experience_bonus: 0.15 },
    description: 'Robes worn by great scholars'
  }
]

export class Inventory {
  constructor(items = [], equipment = {}) {
    this.items = items
    this.equipment = equipment // { headgear, chest, legs, feet, hands, accessory }
    this.maxCapacity = 20
  }

  addItem(item, quantity = 1) {
    const existingItem = this.items.find(i => i.id === item.id)
    if (existingItem) {
      existingItem.quantity += quantity
    } else {
      this.items.push({ ...item, quantity })
    }
    return this.isFull() ? false : true
  }

  removeItem(itemId, quantity = 1) {
    const item = this.items.find(i => i.id === itemId)
    if (!item) return false

    item.quantity -= quantity
    if (item.quantity <= 0) {
      this.items = this.items.filter(i => i.id !== itemId)
    }
    return true
  }

  equipItem(itemId, slot = null) {
    const item = EQUIPMENT_ITEMS.find(i => i.id === itemId)
    if (!item) return false

    const equipSlot = slot || item.type
    const previouslyEquipped = this.equipment[equipSlot]

    if (previouslyEquipped) {
      this.addItem(previouslyEquipped, 1)
    }

    this.equipment[equipSlot] = item
    this.removeItem(itemId, 1)
    return true
  }

  unequipItem(slot) {
    const item = this.equipment[slot]
    if (!item) return false

    this.addItem(item, 1)
    delete this.equipment[slot]
    return true
  }

  getEquippedStats() {
    const stats = {
      strength: 0,
      intelligence: 0,
      agility: 0,
      charisma: 0,
      luck: 0,
      endurance: 0,
      income_bonus: 0,
      experience_bonus: 0,
      defense: 0,
      movespeed: 0
    }

    Object.values(this.equipment).forEach(item => {
      if (item && item.stats) {
        Object.entries(item.stats).forEach(([stat, value]) => {
          stats[stat] = (stats[stat] || 0) + value
        })
      }
    })

    return stats
  }

  isFull() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0) >= this.maxCapacity
  }

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0)
  }

  getAllItems() {
    return {
      items: this.items,
      equipment: this.equipment,
      stats: this.getEquippedStats()
    }
  }
}

export function generateRandomLoot(itemLevel = 1) {
  const rarity = selectRandomRarity()
  const availableItems = EQUIPMENT_ITEMS.filter(i => EQUIPMENT_RARITY[i.rarity])
  const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)]

  return {
    ...randomItem,
    foundAt: Date.now(),
    quality: itemLevel
  }
}

export function selectRandomRarity() {
  const rand = Math.random()
  let cumulative = 0

  for (const [rarity, config] of Object.entries(EQUIPMENT_RARITY)) {
    cumulative += config.dropRate
    if (rand < cumulative) return rarity
  }

  return 'common'
}

export function getItemsByRarity(rarity) {
  return EQUIPMENT_ITEMS.filter(item => item.rarity === rarity)
}
