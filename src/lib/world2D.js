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
  { name: 'Maria', role: 'Merchant' },
  { name: 'Juan', role: 'Businessman' },
  { name: 'Rosa', role: 'Trader' },
  { name: 'Carlos', role: 'Vendor' },
  { name: 'Luna', role: 'Entrepreneur' },
  { name: 'Pedro', role: 'Guide' }
]

// Dynamic city map generation based on city data
export function generateCityMap(city) {
  const density = city.type === 'metropolis' ? 3 : city.type === 'city' ? 2 : 1
  const width = 800 + (density * 200)
  const height = 800 + (density * 200)

  const buildings = generateBuildings(city, density)
  const npcSpawns = generateNPCSpawns(buildings, 5 + density * 3)

  return {
    width,
    height,
    tiles: city.region.includes('Visayas') || city.region === 'Mimaropa' ? 'tropical' : 'urban',
    buildings,
    npcSpawns,
    cityName: city.name,
    region: city.region
  }
}

function generateBuildings(city, density) {
  const buildings = []
  const buildingTypes = [
    { name: 'Market', type: 'shop', count: 2 + density },
    { name: 'Bank', type: 'bank', count: 1 + density },
    { name: 'Trading Post', type: 'trade', count: 1 + density },
    { name: 'Restaurant', type: 'restaurant', count: 2 + density },
    { name: 'Government Office', type: 'government', count: 1 },
    { name: 'Hospital', type: 'hospital', count: 1 },
    { name: 'School', type: 'school', count: 1 + Math.floor(density / 2) },
    { name: 'Port', type: 'port', count: city.name.includes('Cebu') || city.name.includes('Manila') ? 1 : 0 }
  ]

  let xPos = 100
  let yPos = 100

  buildingTypes.forEach(buildingType => {
    for (let i = 0; i < buildingType.count; i++) {
      buildings.push({
        x: xPos + Math.random() * 400,
        y: yPos + Math.random() * 400,
        width: 50 + Math.random() * 50,
        height: 50 + Math.random() * 50,
        name: `${buildingType.name} #${i + 1}`,
        type: buildingType.type
      })
    }
  })

  return buildings
}

function generateNPCSpawns(buildings, count) {
  const spawns = []
  for (let i = 0; i < count; i++) {
    const building = buildings[Math.floor(Math.random() * buildings.length)]
    spawns.push({
      x: building.x + building.width / 2,
      y: building.y + building.height / 2,
      templateIdx: i % NPC_TEMPLATES.length
    })
  }
  return spawns
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
export const CITY_MAPS = Object.fromEntries(
  PHILIPPINES_CITIES.map(city => [city.name, generateCityMap(city)])
)

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
