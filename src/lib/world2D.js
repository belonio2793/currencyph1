import { supabase } from './supabaseClient'
import { PHILIPPINES_CITIES } from '../data/philippinesCities'

// Convert all cities to map coordinates
export const CITY_COORDS = Object.fromEntries(
  PHILIPPINES_CITIES.map(city => [
    city.name,
    {
      lat: city.lat,
      lng: city.lng,
      mapX: ((city.lng - 116) * 200), // Scale to map
      mapY: ((city.lat - 5) * 200),
      region: city.region,
      population: city.population,
      type: city.type
    }
  ])
)

// NPC templates for conversations
const NPC_TEMPLATES = [
  { name: 'Maria', role: 'Merchant', emoji: '👩‍🏪' },
  { name: 'Juan', role: 'Businessman', emoji: '👨‍💼' },
  { name: 'Rosa', role: 'Trader', emoji: '👩‍🍳' },
  { name: 'Carlos', role: 'Vendor', emoji: '👨‍🏭' },
  { name: 'Luna', role: 'Entrepreneur', emoji: '👩‍💻' },
  { name: 'Pedro', role: 'Guide', emoji: '👨‍🎓' }
]

// City map data with buildings and spawn points
export const CITY_MAPS = {
  'Manila': {
    width: 800,
    height: 800,
    tiles: 'urban',
    buildings: [
      { x: 100, y: 100, width: 60, height: 60, name: 'Central Market', type: 'shop' },
      { x: 200, y: 150, width: 80, height: 80, name: 'Government Office', type: 'government' },
      { x: 400, y: 300, width: 100, height: 100, name: 'Bank of Manila', type: 'bank' },
      { x: 600, y: 200, width: 70, height: 70, name: 'Trading Post', type: 'trade' }
    ],
    npcSpawns: [
      { x: 150, y: 150, templateIdx: 0 },
      { x: 250, y: 200, templateIdx: 1 },
      { x: 450, y: 350, templateIdx: 2 },
      { x: 650, y: 250, templateIdx: 3 }
    ]
  },
  'Cebu': {
    width: 800,
    height: 800,
    tiles: 'tropical',
    buildings: [
      { x: 100, y: 100, width: 60, height: 60, name: 'Cebu Market', type: 'shop' },
      { x: 300, y: 200, width: 80, height: 80, name: 'Port Authority', type: 'trade' },
      { x: 500, y: 400, width: 100, height: 100, name: 'Cebu Exchange', type: 'bank' }
    ],
    npcSpawns: [
      { x: 150, y: 150, templateIdx: 0 },
      { x: 350, y: 250, templateIdx: 1 },
      { x: 550, y: 450, templateIdx: 2 }
    ]
  }
}

// World player tracking
export class WorldPlayer {
  constructor(userId, characterName, x, y, city) {
    this.userId = userId
    this.name = characterName
    this.x = x
    this.y = y
    this.city = city
    this.vx = 0
    this.vy = 0
    this.speed = 3 // pixels per frame
    this.isMoving = false
    this.targetX = x
    this.targetY = y
    this.direction = 'down' // for animation
  }

  update() {
    if (this.isMoving) {
      const dx = this.targetX - this.x
      const dy = this.targetY - this.y
      const dist = Math.hypot(dx, dy)

      if (dist < this.speed) {
        this.x = this.targetX
        this.y = this.targetY
        this.isMoving = false
        this.vx = 0
        this.vy = 0
      } else {
        this.vx = (dx / dist) * this.speed
        this.vy = (dy / dist) * this.speed
        this.x += this.vx
        this.y += this.vy

        // Set direction based on movement
        if (Math.abs(dx) > Math.abs(dy)) {
          this.direction = dx > 0 ? 'right' : 'left'
        } else {
          this.direction = dy > 0 ? 'down' : 'up'
        }
      }
    }
  }

  moveTo(x, y) {
    this.targetX = x
    this.targetY = y
    this.isMoving = true
  }

  teleport(x, y) {
    this.x = x
    this.y = y
    this.targetX = x
    this.targetY = y
    this.isMoving = false
  }
}

// NPC with AI behavior
export class NPC {
  constructor(id, x, y, template) {
    this.id = id
    this.x = x
    this.y = y
    this.name = template.name
    this.role = template.role
    this.emoji = template.emoji
    this.vx = 0
    this.vy = 0
    this.speed = 1
    this.isMoving = false
    this.targetX = x
    this.targetY = y
    this.walkRadius = 150
    this.lastMoveTime = Date.now()
    this.moveInterval = 3000 + Math.random() * 3000 // Random walk timing
    this.conversationHistory = []
  }

  update() {
    const now = Date.now()
    
    // Random pathing AI
    if (now - this.lastMoveTime > this.moveInterval) {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * this.walkRadius
      this.targetX = this.x + Math.cos(angle) * distance
      this.targetY = this.y + Math.sin(angle) * distance
      this.isMoving = true
      this.lastMoveTime = now
    }

    if (this.isMoving) {
      const dx = this.targetX - this.x
      const dy = this.targetY - this.y
      const dist = Math.hypot(dx, dy)

      if (dist < this.speed) {
        this.x = this.targetX
        this.y = this.targetY
        this.isMoving = false
      } else {
        this.vx = (dx / dist) * this.speed
        this.vy = (dy / dist) * this.speed
        this.x += this.vx
        this.y += this.vy
      }
    }
  }

  getDistance(x, y) {
    return Math.hypot(this.x - x, this.y - y)
  }

  isNear(x, y, radius = 50) {
    return this.getDistance(x, y) < radius
  }
}

// World manager
export class World2D {
  constructor(cityName, userId, characterName) {
    this.cityName = cityName
    this.mapData = CITY_MAPS[cityName] || this.generateDefaultMap(cityName)
    this.player = new WorldPlayer(userId, characterName, 400, 400, cityName)
    this.npcs = new Map()
    this.otherPlayers = new Map()
    this.lastUpdateTime = Date.now()
    
    this.spawnNPCs()
  }

  generateDefaultMap(cityName) {
    return {
      width: 800,
      height: 800,
      tiles: 'urban',
      buildings: [
        { x: 100, y: 100, width: 60, height: 60, name: 'Market', type: 'shop' },
        { x: 400, y: 400, width: 80, height: 80, name: 'Trading Hub', type: 'trade' }
      ],
      npcSpawns: [
        { x: 150, y: 150, templateIdx: 0 },
        { x: 450, y: 450, templateIdx: 1 }
      ]
    }
  }

  spawnNPCs() {
    this.mapData.npcSpawns.forEach((spawn, idx) => {
      const template = NPC_TEMPLATES[spawn.templateIdx % NPC_TEMPLATES.length]
      const npc = new NPC(`npc_${idx}`, spawn.x, spawn.y, template)
      this.npcs.set(npc.id, npc)
    })
  }

  update() {
    this.player.update()
    this.npcs.forEach(npc => npc.update())
  }

  movePlayer(x, y) {
    const clampedX = Math.max(0, Math.min(this.mapData.width - 20, x))
    const clampedY = Math.max(0, Math.min(this.mapData.height - 20, y))
    this.player.moveTo(clampedX, clampedY)
  }

  getNearbyNPCs(radius = 100) {
    const nearby = []
    this.npcs.forEach(npc => {
      if (npc.isNear(this.player.x, this.player.y, radius)) {
        nearby.push(npc)
      }
    })
    return nearby
  }

  getNearbyPlayers(radius = 200) {
    const nearby = []
    this.otherPlayers.forEach(player => {
      const dist = Math.hypot(player.x - this.player.x, player.y - this.player.y)
      if (dist < radius) {
        nearby.push(player)
      }
    })
    return nearby
  }

  isColliding(x, y, radius = 15) {
    for (const building of this.mapData.buildings) {
      const dx = Math.max(building.x - x, 0, x - (building.x + building.width))
      const dy = Math.max(building.y - y, 0, y - (building.y + building.height))
      if (Math.hypot(dx, dy) < radius) {
        return true
      }
    }
    return false
  }
}
