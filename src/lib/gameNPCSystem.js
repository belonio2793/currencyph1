import { v4 as uuid } from 'uuid'

// NPC types
export const NPC_TYPES = {
  WORKER: 'worker',
  VENDOR: 'vendor',
  GUARD: 'guard',
  TRAVELER: 'traveler'
}

// NPC behaviors
export const NPC_BEHAVIORS = {
  IDLE: 'idle',
  WALKING: 'walking',
  WORKING: 'working',
  TRADING: 'trading'
}

// Create a pool of NPC names for variety
const NPC_NAMES = [
  'Maria', 'Juan', 'Rosa', 'Jose', 'Ana', 'Miguel', 'Carmen', 'Luis',
  'Elena', 'Carlos', 'Sofia', 'Diego', 'Isabella', 'Manuel', 'Lucia', 'Rafael'
]

// Job locations on the isometric map (in game coordinates)
export const JOB_LOCATIONS = {
  'Marketing Manager': { x: 50, y: 50, type: 'office' },
  'Fish Farmer': { x: 150, y: 80, type: 'farm' },
  'Gardener': { x: 200, y: 120, type: 'farm' },
  'Delivery Driver': { x: 100, y: 150, type: 'shop' },
  'Bartender': { x: 75, y: 100, type: 'bar' },
  'Freelance Developer': { x: 25, y: 200, type: 'office' },
  'Construction Worker': { x: 180, y: 200, type: 'site' },
  'Nurse': { x: 120, y: 180, type: 'hospital' },
  'Teacher': { x: 140, y: 220, type: 'school' },
  'Chef': { x: 90, y: 120, type: 'restaurant' }
}

// NPC class
export class NPC {
  constructor(id, name, type, behavior, position, jobName = null) {
    this.id = id
    this.name = name
    this.type = type
    this.behavior = behavior
    this.position = { ...position }
    this.target = { ...position }
    this.jobName = jobName
    this.velocity = { x: 0, y: 0 }
    this.speed = 1 + Math.random() * 0.5
    this.direction = Math.random() > 0.5 ? -1 : 1
    this.idleTimer = 0
    this.idleDuration = Math.random() * 100 + 50
    this.animationFrame = 0
    this.skinTone = ['#fdbf5f', '#e8b891', '#d4a574', '#c89458'][Math.floor(Math.random() * 4)]
    this.hairColor = ['#1a1a1a', '#2c1810', '#4a2c1a', '#6b3410'][Math.floor(Math.random() * 4)]
    this.outfitColor = ['#3f51b5', '#e91e63', '#00bcd4', '#ff9800', '#4caf50'][Math.floor(Math.random() * 5)]
  }

  update(gameWidth, gameHeight) {
    this.animationFrame++

    if (this.behavior === NPC_BEHAVIORS.IDLE) {
      this.idleTimer++
      if (this.idleTimer > this.idleDuration) {
        this.idleTimer = 0
        this.idleDuration = Math.random() * 100 + 50
        // Occasionally start walking to a random location
        if (Math.random() > 0.5) {
          this.behavior = NPC_BEHAVIORS.WALKING
          this.target = {
            x: this.position.x + (Math.random() - 0.5) * 100,
            y: this.position.y + (Math.random() - 0.5) * 100
          }
          this.target.x = Math.max(0, Math.min(gameWidth, this.target.x))
          this.target.y = Math.max(0, Math.min(gameHeight, this.target.y))
        }
      }
    } else if (this.behavior === NPC_BEHAVIORS.WALKING) {
      const dx = this.target.x - this.position.x
      const dy = this.target.y - this.position.y
      const distance = Math.hypot(dx, dy)

      if (distance < 3) {
        this.behavior = NPC_BEHAVIORS.IDLE
        this.idleTimer = 0
        this.velocity = { x: 0, y: 0 }
      } else {
        const moveSpeed = this.speed
        this.velocity.x = (dx / distance) * moveSpeed
        this.velocity.y = (dy / distance) * moveSpeed
        this.direction = dx < 0 ? -1 : 1

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y

        // Boundary checking
        this.position.x = Math.max(0, Math.min(gameWidth, this.position.x))
        this.position.y = Math.max(0, Math.min(gameHeight, this.position.y))
      }
    }
  }

  draw(ctx, screenX, screenY, isometricHelper) {
    const size = 24
    const floatOffset = this.behavior === NPC_BEHAVIORS.IDLE ? Math.sin(this.animationFrame * 0.02) * 0.5 : 0

    ctx.save()

    // Draw vendor booth/stall for vendor NPCs
    if (this.type === NPC_TYPES.VENDOR) {
      // Booth background
      ctx.fillStyle = 'rgba(139, 69, 19, 0.8)'
      ctx.fillRect(screenX - 15, screenY + 5, 40, 20)

      // Booth roof
      ctx.fillStyle = '#d2691e'
      ctx.beginPath()
      ctx.moveTo(screenX - 15, screenY + 5)
      ctx.lineTo(screenX + 25, screenY + 5)
      ctx.lineTo(screenX + 10, screenY - 5)
      ctx.lineTo(screenX - 5, screenY - 5)
      ctx.closePath()
      ctx.fill()

      // Booth border
      ctx.strokeStyle = '#a0522d'
      ctx.lineWidth = 1
      ctx.strokeRect(screenX - 15, screenY + 5, 40, 20)
    }

    // Shadow
    const shadowGrad = ctx.createRadialGradient(screenX + size / 2, screenY + size / 2, 2, screenX + size / 2, screenY + size / 2, 10)
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.2)')
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = shadowGrad
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY + size / 2, 10, 0, Math.PI * 2)
    ctx.fill()

    if (this.direction === -1) {
      ctx.scale(-1, 1)
      screenX = -screenX - size
    }

    // Head
    ctx.fillStyle = this.skinTone
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 4 + floatOffset, 5, 0, Math.PI * 2)
    ctx.fill()

    // Hair
    ctx.fillStyle = this.hairColor
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 6 + floatOffset, 5, Math.PI, 0, true)
    ctx.fill()

    // Body
    ctx.fillStyle = this.outfitColor
    ctx.fillRect(screenX + 5, screenY + 1 + floatOffset, size - 10, size / 2 - 2)

    // Walking animation
    const walkCycle = Math.sin(this.animationFrame * 0.15)
    const bobOffset = this.behavior === NPC_BEHAVIORS.WALKING ? Math.abs(walkCycle) * 0.5 : 0
    const bodyBob = floatOffset + bobOffset

    // Arms (swing with walking animation)
    const armSwing = this.behavior === NPC_BEHAVIORS.WALKING ? walkCycle * 2 : 0
    ctx.fillStyle = this.skinTone
    // Left arm
    ctx.fillRect(screenX + 2, screenY + 2 + bodyBob + armSwing, 3, 5)
    // Right arm
    ctx.fillRect(screenX + 19, screenY + 2 + bodyBob - armSwing, 3, 5)

    // Legs (walking animation)
    const legOffset = this.behavior === NPC_BEHAVIORS.WALKING ? Math.sin(this.animationFrame * 0.15) * 1.5 : 0
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(screenX + 7, screenY + 10 + bodyBob + legOffset, 4, 6)
    ctx.fillRect(screenX + 13, screenY + 10 + bodyBob - legOffset, 4, 6)

    // Shoes
    ctx.fillStyle = '#000'
    ctx.fillRect(screenX + 7, screenY + 16 + bodyBob, 4, 2)
    ctx.fillRect(screenX + 13, screenY + 16 + bodyBob, 4, 2)

    // Name label (for vendors)
    if (this.type === NPC_TYPES.VENDOR) {
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 8px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(this.name, screenX + size / 2, screenY - 20)
    }

    ctx.restore()
  }
}

// NPC Manager class
export class NPCManager {
  constructor(gameWidth, gameHeight) {
    this.gameWidth = gameWidth
    this.gameHeight = gameHeight
    this.npcs = new Map()
    this.spawnPoints = []
    this.events = []
    this.eventTimer = 0
    this.frameCounter = 0
    this.updateStep = 2 // only run full NPC updates every N frames to reduce CPU/network
    this.initializeSpawns()
  }

  initializeSpawns() {
    // Create NPCs at job locations
    Object.entries(JOB_LOCATIONS).forEach(([jobName, loc]) => {
      const npcId = uuid()
      const npcName = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)]
      const npc = new NPC(
        npcId,
        npcName,
        NPC_TYPES.VENDOR,
        NPC_BEHAVIORS.IDLE,
        { x: loc.x, y: loc.y },
        jobName
      )
      this.npcs.set(npcId, npc)
    })

    // Add some wandering NPCs
    for (let i = 0; i < 5; i++) {
      const npcId = uuid()
      const npcName = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)]
      const npc = new NPC(
        npcId,
        npcName,
        NPC_TYPES.TRAVELER,
        NPC_BEHAVIORS.WALKING,
        {
          x: Math.random() * this.gameWidth,
          y: Math.random() * this.gameHeight
        }
      )
      this.npcs.set(npcId, npc)
    }
  }

  update() {
    // Update all NPCs
    this.npcs.forEach(npc => {
      npc.update(this.gameWidth, this.gameHeight)
    })

    // Random events with 15% chance every frame (roughly every 6 seconds)
    if (Math.random() < 0.0015) {
      this.spawnRandomEvent()
    }

    // Clean up old events
    const now = Date.now()
    this.events = this.events.filter(e => now - e.createdAt < 3000)
  }

  spawnRandomEvent() {
    const eventTypes = [
      { type: 'market_boom', intensity: 0.3 },
      { type: 'market_crash', intensity: 0.2 },
      { type: 'opportunity', intensity: 0.4 },
      { type: 'challenge', intensity: 0.5 }
    ]
    const eventData = eventTypes[Math.floor(Math.random() * eventTypes.length)]
    const event = {
      type: eventData.type,
      intensity: eventData.intensity,
      position: {
        x: Math.random() * this.gameWidth,
        y: Math.random() * this.gameHeight
      },
      createdAt: Date.now()
    }
    this.events.push(event)
  }

  getNPCs() {
    return Array.from(this.npcs.values())
  }

  getEvents() {
    return this.events.filter(e => Date.now() - e.createdAt < e.duration * 16)
  }

  getNPCAtPosition(x, y, radius = 20) {
    for (let npc of this.npcs.values()) {
      const dist = Math.hypot(npc.position.x - x, npc.position.y - y)
      if (dist < radius) return npc
    }
    return null
  }
}

// Random events system
export class EventSystem {
  constructor() {
    this.events = []
    this.eventHistory = []
  }

  triggerEvent(eventType, position, data = {}) {
    const event = {
      id: uuid(),
      type: eventType,
      position,
      data,
      timestamp: Date.now(),
      duration: 3000
    }
    this.events.push(event)
    this.eventHistory.push(event)
    return event
  }

  update() {
    const now = Date.now()
    this.events = this.events.filter(e => now - e.timestamp < e.duration)
  }

  getActiveEvents() {
    return this.events
  }

  getEventHistory() {
    return this.eventHistory.slice(-20) // Last 20 events
  }
}

export function drawEventEffect(ctx, position, type, progress) {
  const screenX = position.screenX
  const screenY = position.screenY
  const easeProgress = Math.sin(progress * Math.PI)
  const alpha = Math.max(0, 1 - progress)

  ctx.save()
  ctx.globalAlpha = alpha

  if (type === 'market_boom') {
    // Green particles expanding outward
    ctx.fillStyle = '#4caf50'
    const size = 10 + easeProgress * 30
    const particleCount = 5
    for (let i = 0; i < particleCount; i++) {
      const angle = (i * Math.PI * 2 / particleCount) + (progress * Math.PI * 4)
      const radius = size + progress * 20
      const pX = screenX + Math.cos(angle) * radius
      const pY = screenY + Math.sin(angle) * radius
      ctx.beginPath()
      ctx.arc(pX, pY, 3 + progress * 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#7cb342'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('📈', screenX, screenY - progress * 20)
  } else if (type === 'market_crash') {
    // Red particles falling
    ctx.fillStyle = '#f44336'
    for (let i = 0; i < 4; i++) {
      const pX = screenX + (Math.random() - 0.5) * 30
      const pY = screenY + progress * 40
      ctx.beginPath()
      ctx.arc(pX, pY, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('📉', screenX, screenY + progress * 20)
  } else if (type === 'opportunity') {
    // Gold sparkle effect
    ctx.fillStyle = '#ffd700'
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'
    ctx.shadowBlur = 10
    const size = 15 + easeProgress * 10
    ctx.beginPath()
    ctx.arc(screenX, screenY, size, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2 / 8) + progress * Math.PI
      const radius = 20 + easeProgress * 10
      const pX = screenX + Math.cos(angle) * radius
      const pY = screenY + Math.sin(angle) * radius
      ctx.beginPath()
      ctx.arc(pX, pY, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✨', screenX, screenY)
  } else if (type === 'challenge') {
    // Lightning/electric effect
    ctx.fillStyle = '#ff9800'
    ctx.strokeStyle = '#ffb74d'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      const startX = screenX + (Math.random() - 0.5) * 20
      const startY = screenY
      const endX = screenX + (Math.random() - 0.5) * 20
      const endY = screenY + 20 + progress * 10
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
    }
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('⚡', screenX, screenY)
  }

  ctx.restore()
}
