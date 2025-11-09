import React, { useEffect, useState, useRef, useCallback } from 'react'
import { getCityById, convertGameCoordsToLatLng } from '../../data/philippinesGeography'
import { COSMETICS, getCosmeticOption } from '../../lib/characterCosmetics'
import { NPCManager, JOB_LOCATIONS, drawEventEffect, EventSystem } from '../../lib/gameNPCSystem'
import CollapsibleMinimap from './CollapsibleMinimap'

export default function IsometricGameMap({
  properties = [],
  character = null,
  onPropertyClick = null,
  city = 'Manila',
  onCharacterMove = null,
  mapSettings = {},
  cosmetics = null,
  isWorking = false,
  workProgress = 0,
  workingJobId = null,
  initialAvatarPos = null,
  onConsumeEnergy = null,
  onJobMarkerClick = null
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [hoveredPropertyId, setHoveredPropertyId] = useState(null)
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [tooltipPos, setTooltipPos] = useState(null)
  const [tooltipData, setTooltipData] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [avatarPos, setAvatarPos] = useState(initialAvatarPos && typeof initialAvatarPos.x === 'number' && typeof initialAvatarPos.y === 'number' ? initialAvatarPos : { x: 150, y: 175 })
  const [avatarAngle, setAvatarAngle] = useState(0)
  const [avatarMoving, setAvatarMoving] = useState(false)
  const [selectedCity, setSelectedCity] = useState(city)
  const [cityData, setCityData] = useState(null)
  const [showControls, setShowControls] = useState(true)
  const [followAvatar, setFollowAvatar] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [showDistricts, setShowDistricts] = useState(true)
  const [showDecor, setShowDecor] = useState(true)
  const [placingProperty, setPlacingProperty] = useState(null) // {type, id, cost}
  const [placedBuildings, setPlacedBuildings] = useState([]) // Array of {id, type, x, y, level, workers}
  const [selectedBuilding, setSelectedBuilding] = useState(null) // Currently selected building for management
  const [buildingHovered, setBuildingHovered] = useState(null) // Hovering over a building
  const keysPressed = useRef({})
  const animationRef = useRef(null)
  const avatarAnimationFrame = useRef(0)
  const particlesRef = useRef([])
  const ambientParticlesRef = useRef([])
  const velocityRef = useRef({ x: 0, y: 0 })
  const moveTargetRef = useRef(null)
  const showControlsRef = useRef(true)
  const targetCameraRef = useRef({ x: 0, y: 0 })
  const npcManagerRef = useRef(null)
  const eventSystemRef = useRef(null)
  const lastEnergyDrainRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  // PERFORMANCE OPTIMIZATION: Refs for state tracking in animation loop to avoid re-creation
  const cameraPosRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const avatarPosRef = useRef({ x: 150, y: 175 })
  const selectedCityRef = useRef(city)
  const propertiesRef = useRef([])
  const showControlsHiddenRef = useRef(true)

  // Particle pool for reuse (max 200 particles for efficiency)
  const particlePoolRef = useRef([])
  const MAX_PARTICLES = 200

  // Gradient cache: reuse gradients instead of creating new ones every frame
  const gradientCacheRef = useRef({})

  // Helper to get or create cached gradient
  const getCachedGradient = useCallback((ctx, key, builder) => {
    if (!gradientCacheRef.current[key]) {
      gradientCacheRef.current[key] = builder(ctx)
    }
    return gradientCacheRef.current[key]
  }, [])

  // Draw a building on the map
  const drawBuilding = useCallback((ctx, isoX, isoY, buildingType, level = 1) => {
    const baseSize = 20
    const heightPerLevel = 4
    const totalHeight = baseSize + level * heightPerLevel

    // Building colors by type
    const buildingColors = {
      office: '#4F46E5', bank: '#3B82F6', corporate: '#2563EB',
      house: '#10B981', apartment: '#059669', market_stall: '#7C3AED',
      factory: '#F59E0B', warehouse: '#EA580C', workshop: '#DC2626',
      store: '#EC4899', restaurant: '#DB2777', mall: '#BE185D',
      park: '#14B8A6', garden: '#06B6D4', plaza: '#0891B2',
      museum: '#D97706', landmark: '#B45309', heritage: '#92400E'
    }
    const color = buildingColors[buildingType] || '#64748B'

    // Draw building base
    ctx.save()
    ctx.fillStyle = color
    ctx.globalAlpha = 0.9
    ctx.fillRect(isoX - baseSize/2, isoY - totalHeight, baseSize, totalHeight)

    // Building highlight
    ctx.fillStyle = adjustBrightness(color, 40)
    ctx.fillRect(isoX - baseSize/2 + 1, isoY - totalHeight + 1, baseSize * 0.5, totalHeight * 0.3)

    // Building shadow
    ctx.fillStyle = adjustBrightness(color, -50)
    ctx.fillRect(isoX - baseSize/2, isoY - 3, baseSize, 3)

    // Level indicator
    if (level > 0) {
      ctx.fillStyle = '#FFD700'
      ctx.font = `bold 9px Arial`
      ctx.textAlign = 'center'
      ctx.globalAlpha = 1
      ctx.fillText(`L${level}`, isoX, isoY - totalHeight + 8)
    }

    ctx.restore()
  }, [])

  const TILE_SIZE = 48 // Slightly smaller to fit more tiles
  const GRID_WIDTH = 40 // Much larger: from 24 to 40 (66% bigger)
  const GRID_HEIGHT = 30 // Much larger: from 18 to 30 (66% bigger)
  const AVATAR_SIZE = 32
  const MAP_WIDTH = GRID_WIDTH * TILE_SIZE // 1920px
  const MAP_HEIGHT = GRID_HEIGHT * TILE_SIZE // 1440px

  // Manila-inspired districts with characteristics
  const DISTRICTS = {
    financial: { name: 'Financial District', color: '#4F46E5', x: 5, y: 5, width: 8, height: 8, emoji: '🏢' },
    residential: { name: 'Residential', color: '#10B981', x: 15, y: 5, width: 8, height: 10, emoji: '🏠' },
    industrial: { name: 'Industrial Zone', color: '#F59E0B', x: 25, y: 8, width: 8, height: 10, emoji: '🏭' },
    commercial: { name: 'Commercial Hub', color: '#EC4899', x: 5, y: 18, width: 10, height: 8, emoji: '🛍️' },
    parks: { name: 'Parks & Recreation', color: '#14B8A6', x: 18, y: 18, width: 8, height: 8, emoji: '🌳' },
    historic: { name: 'Historic District', color: '#D97706', x: 28, y: 20, width: 8, height: 8, emoji: '🏛���' }
  }

  // Building placement zones (property types allowed in each district)
  const ZONE_RULES = {
    financial: ['office', 'bank', 'corporate'],
    residential: ['house', 'apartment', 'market_stall'],
    industrial: ['factory', 'warehouse', 'workshop'],
    commercial: ['store', 'restaurant', 'mall'],
    parks: ['park', 'garden', 'plaza'],
    historic: ['museum', 'landmark', 'heritage']
  }

  // Particle pool system: reuse particle objects instead of creating new ones
  const spawnParticle = useCallback((x, y, vx, vy, color, life = 1000) => {
    if (particlesRef.current.length >= MAX_PARTICLES) return
    particlesRef.current.push({ x, y, vx, vy, color, life, maxLife: life })
  }, [])

  // Efficient particle cleanup: keep only alive particles
  const updateAndCleanParticles = useCallback(() => {
    const now = performance.now()
    const cleaned = particlesRef.current.filter(p => {
      if (!p.spawnTime) p.spawnTime = now
      const age = now - p.spawnTime
      return age < p.life
    })
    particlesRef.current = cleaned
  }, [])

  // Viewport culling: calculate which tiles are visible to avoid drawing off-screen tiles
  const getVisibleTileBounds = useCallback((cameraX, cameraY, zoomLevel, canvasWidth = 500, canvasHeight = 500) => {
    // Calculate viewport bounds in world space
    const halfWidth = canvasWidth / (2 * zoomLevel)
    const halfHeight = canvasHeight / (2 * zoomLevel)

    return {
      minX: Math.max(0, Math.floor((cameraX - halfWidth) / TILE_SIZE) - 1),
      maxX: Math.min(GRID_WIDTH, Math.ceil((cameraX + halfWidth) / TILE_SIZE) + 1),
      minY: Math.max(0, Math.floor((cameraY - halfHeight) / TILE_SIZE) - 1),
      maxY: Math.min(GRID_HEIGHT, Math.ceil((cameraY + halfHeight) / TILE_SIZE) + 1)
    }
  }, [])

  const PROPERTY_COLORS = {
    house: '#ff9800',
    business: '#2196f3',
    farm: '#4caf50',
    shop: '#e91e63',
    factory: '#9c27b0',
    restaurant: '#ff5722',
    hotel: '#00bcd4',
    office: '#3f51b5',
    default: '#00bcd4'
  }

  const NEIGHBORHOODS = {
    Manila: { bounds: { x0: 0, y0: 0, x1: 12, y1: 9 }, color: 'rgba(33, 150, 243, 0.05)' },
    'Business District': { bounds: { x0: 12, y0: 0, x1: 24, y1: 9 }, color: 'rgba(156, 39, 176, 0.05)' },
    'Residential': { bounds: { x0: 0, y0: 9, x1: 12, y1: 18 }, color: 'rgba(76, 175, 80, 0.05)' },
    'Industrial': { bounds: { x0: 12, y0: 9, x1: 24, y1: 18 }, color: 'rgba(233, 30, 99, 0.05)' }
  }

  useEffect(() => {
    const c = getCityById(selectedCity.toLowerCase().replace(/\s+/g, '-'))
    setCityData(c || null)
  }, [selectedCity])

  // Sync refs with state for animation loop efficiency
  useEffect(() => {
    cameraPosRef.current = cameraPos
  }, [cameraPos])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    avatarPosRef.current = avatarPos
  }, [avatarPos])

  useEffect(() => {
    selectedCityRef.current = selectedCity
  }, [selectedCity])

  useEffect(() => {
    propertiesRef.current = properties
  }, [properties])

  // Keep internal city in sync with parent prop
  useEffect(() => {
    if (city && city !== selectedCity) {
      setSelectedCity(city)
      if (!initialAvatarPos) setAvatarPos({ x: 150, y: 175 })
      setCameraPos({ x: 0, y: 0 })
      targetCameraRef.current = { x: 0, y: 0 }
    }
  }, [city])

  // Apply externally provided initial avatar position
  useEffect(() => {
    if (initialAvatarPos && typeof initialAvatarPos.x === 'number' && typeof initialAvatarPos.y === 'number') {
      setAvatarPos(initialAvatarPos)
    }
  }, [initialAvatarPos])

  const gridToIsometric = useCallback((gridX, gridY) => {
    const isoX = (gridX - gridY) * (TILE_SIZE / 2)
    const isoY = (gridX + gridY) * (TILE_SIZE / 4)
    return { x: isoX, y: isoY }
  }, [])

  const isometricToGrid = useCallback((isoX, isoY) => {
    const col = isoX / (TILE_SIZE / 2)
    const row = isoY / (TILE_SIZE / 4)
    const gridX = (col + row) / 2
    const gridY = (row - col) / 2
    return { x: Math.round(gridX), y: Math.round(gridY) }
  }, [])

  const gameToIsometric = useCallback((x, y) => {
    const gridX = (x / MAP_WIDTH) * GRID_WIDTH
    const gridY = (y / MAP_HEIGHT) * GRID_HEIGHT
    return gridToIsometric(gridX, gridY)
  }, [gridToIsometric])

  const getPropertyAtGamePos = useCallback((x, y) => {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return null
    return properties.find(p => {
      if (!p.location_x || !p.location_y) return false
      const px = p.location_x % 300
      const py = p.location_y % 350
      return Math.abs(px - x) < 20 && Math.abs(py - y) < 20
    })
  }, [properties])

  const adjustBrightness = (color, percent) => {
    const num = parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) + amt
    const G = (num >> 8 & 0x00FF) + amt
    const B = (num & 0x0000FF) + amt
    return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255))
      .toString(16).slice(1)
  }

  // Seeded pseudo-random based on tile and city for consistent decoration placement
  const seededRand = (x, y, seedStr = selectedCity) => {
    const seed = Array.from(String(seedStr)).reduce((a, c) => a + c.charCodeAt(0), 0)
    let t = x * 374761393 + y * 668265263 + seed * 1442695040888963407
    t = (t ^ (t >> 13)) * 1274126177
    t = (t ^ (t >> 16)) >>> 0
    return (t % 1000) / 1000
  }

  const drawTree = (ctx, x, y) => {
    // simple low-poly tree
    ctx.save()
    ctx.fillStyle = '#2e7d32'
    ctx.beginPath()
    ctx.moveTo(x, y - 6)
    ctx.lineTo(x + 4, y + 2)
    ctx.lineTo(x - 4, y + 2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#5d4037'
    ctx.fillRect(x - 0.8, y + 2, 1.6, 3)
    ctx.restore()
  }

  const drawIsometricTile = useCallback((ctx, screenX, screenY, color, height = 0, isHovered = false) => {
    const w = TILE_SIZE / 2
    const h = TILE_SIZE / 4

    // base
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + w, screenY + h)
    ctx.lineTo(screenX, screenY + h * 2)
    ctx.lineTo(screenX - w, screenY + h)
    ctx.closePath()
    ctx.fill()

    // multi-layer highlight for depth
    const gradient = ctx.createLinearGradient(screenX - w, screenY, screenX, screenY + h * 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.12)')
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.04)')
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.06)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.18)')
    ctx.fillStyle = gradient
    ctx.fill()

    // border
    ctx.strokeStyle = isHovered ? 'rgba(255, 200, 50, 0.9)' : 'rgba(0, 0, 0, 0.25)'
    ctx.lineWidth = isHovered ? 2.5 : 1.5
    ctx.stroke()

    // glow when hovered
    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 200, 50, 0.3)'
      ctx.lineWidth = 4
      ctx.stroke()
    }

    // 3D height/depth
    if (height > 0) {
      // left side
      ctx.fillStyle = adjustBrightness(color, -30)
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(screenX, screenY - height)
      ctx.lineTo(screenX - w, screenY - height + h)
      ctx.lineTo(screenX - w, screenY + h)
      ctx.closePath()
      ctx.fill()

      // right side
      ctx.fillStyle = adjustBrightness(color, -50)
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(screenX + w, screenY + h)
      ctx.lineTo(screenX + w, screenY + h - height)
      ctx.lineTo(screenX, screenY - height)
      ctx.closePath()
      ctx.fill()

      // depth gradient on left face
      const leftGrad = ctx.createLinearGradient(screenX - w, screenY + h, screenX, screenY)
      leftGrad.addColorStop(0, 'rgba(0, 0, 0, 0.15)')
      leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = leftGrad
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(screenX, screenY - height)
      ctx.lineTo(screenX - w, screenY - height + h)
      ctx.lineTo(screenX - w, screenY + h)
      ctx.closePath()
      ctx.fill()

      // edge highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(screenX, screenY - height)
      ctx.lineTo(screenX - w, screenY - height + h)
      ctx.stroke()
    }
  }, [])

  const drawAvatar = useCallback((ctx, screenX, screenY) => {
    const size = AVATAR_SIZE
    const isRunning = avatarMoving

    const skinColor = cosmetics ? getCosmeticOption('skinTones', cosmetics.skinTone)?.hex : '#fdbf5f'
    const hairColor = cosmetics ? getCosmeticOption('hairColors', cosmetics.hairColor)?.hex : '#1a1a1a'
    const outfit = cosmetics ? COSMETICS.outfits.find(o => o.id === cosmetics.outfit) : null
    const topColor = outfit?.top || '#3f51b5'
    const bottomColor = outfit?.bottom || '#2196f3'

    ctx.save()

    // Working glow effect
    if (isWorking) {
      const glowIntensity = Math.sin(avatarAnimationFrame.current * 0.15) * 0.5 + 0.5
      const glowAlpha = 0.3 + glowIntensity * 0.3
      const glowRadius = 20 + Math.sin(avatarAnimationFrame.current * 0.1) * 5

      const glowGrad = ctx.createRadialGradient(screenX + size / 2, screenY + size / 2, 0, screenX + size / 2, screenY + size / 2, glowRadius)
      glowGrad.addColorStop(0, `rgba(255, 200, 0, ${glowAlpha})`)
      glowGrad.addColorStop(1, 'rgba(255, 200, 0, 0)')
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(screenX + size / 2, screenY + size / 2, glowRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    // soft shadow
    const shadowGrad = ctx.createRadialGradient(screenX + size / 2, screenY + size / 2, 2, screenX + size / 2, screenY + size / 2, 16)
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.25)')
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = shadowGrad
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY + size / 2, 16, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    // Apply directional rotation to character with proper flip handling
    if (isWorking) {
      const rotation = (avatarAnimationFrame.current * 0.08) % (Math.PI * 2)
      ctx.translate(screenX + size / 2, screenY + size / 2)
      ctx.rotate(rotation)
      ctx.translate(-(screenX + size / 2), -(screenY + size / 2))
    } else {
      // Full 360° rotation based on movement direction
      const normalizedAngle = ((avatarAngle % 360) + 360) % 360
      const angleRadians = (normalizedAngle * Math.PI) / 180
      ctx.translate(screenX + size / 2, screenY + size / 2)
      ctx.rotate(angleRadians)
      ctx.translate(-(screenX + size / 2), -(screenY + size / 2))
    }

    // Add idle floating effect
    const floatOffset = !isRunning && !isWorking ? Math.sin(avatarAnimationFrame.current * 0.02) * 1.5 : 0

    // shirt
    ctx.fillStyle = topColor
    ctx.fillRect(screenX + 4, screenY + floatOffset, size - 8, size / 3)

    // pants
    ctx.fillStyle = bottomColor
    ctx.fillRect(screenX + 4, screenY + size / 3 + floatOffset, size - 8, size / 3)

    // head
    ctx.fillStyle = skinColor
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 6 + floatOffset, 8, 0, Math.PI * 2)
    ctx.fill()

    // eyes with blink animation
    const blinkCycle = (avatarAnimationFrame.current % 120) // blink every 2 seconds
    const isBlinking = blinkCycle > 110 // last 10 frames of cycle
    const blinkHeight = isBlinking ? 0.5 : 2

    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(screenX + size / 2 - 2, screenY - 8 + floatOffset, blinkHeight, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(screenX + size / 2 + 2, screenY - 8 + floatOffset, blinkHeight, 0, Math.PI * 2)
    ctx.fill()

    // hair
    ctx.fillStyle = hairColor
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 10 + floatOffset, 8, Math.PI, 0, true)
    ctx.fill()

    // legs with realistic walking/running animation
    const legOffset = isRunning && !isWorking ? Math.sin(avatarAnimationFrame.current * 0.12) * 5 :
                      !isWorking ? Math.sin(avatarAnimationFrame.current * 0.04) * 2 : 0
    const idleBob = !isRunning && !isWorking ? Math.sin(avatarAnimationFrame.current * 0.025) * 0.7 : 0
    ctx.fillStyle = '#333'
    ctx.fillRect(screenX + 6, screenY + (2 * size) / 3 + idleBob, 5, size / 3 + legOffset)
    ctx.fillRect(screenX + size - 11, screenY + (2 * size) / 3 + idleBob, 5, size / 3 - legOffset)

    // footstep dust effect on movement
    if (isRunning && !isWorking && avatarAnimationFrame.current % 8 === 0) {
      const angleRad = (avatarAngle * Math.PI) / 180
      const footX = screenX + size / 2 + Math.cos(angleRad + Math.PI) * 8
      const footY = screenY + size / 2 + Math.sin(angleRad + Math.PI) * 8
      particlesRef.current.push({
        x: footX,
        y: footY,
        vx: (Math.random() - 0.5) * 1.2,
        vy: Math.random() * 0.8,
        life: 18,
        color: 'rgba(180, 160, 120, 0.5)'
      })
    }

    ctx.restore()
    ctx.restore()

    if (isRunning && !isWorking) {
      // speed trail particles - more frequent for visual impact
      if (avatarAnimationFrame.current % 3 === 0) {
        const angleRad = (avatarAngle * Math.PI) / 180
        const trailX = screenX + size / 2 + Math.cos(angleRad + Math.PI) * 10
        const trailY = screenY + size / 2 + Math.sin(angleRad + Math.PI) * 10
        particlesRef.current.push({
          x: trailX,
          y: trailY,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -1.0 - Math.random() * 0.8,
          life: 28,
          color: 'rgba(100,180,255,0.6)'
        })
      }
    }

    // Working particles - more energetic energy burst effect
    if (isWorking) {
      if (avatarAnimationFrame.current % 4 === 0) {
        particlesRef.current.push({
          x: screenX + size / 2 + (Math.random() - 0.5) * 22,
          y: screenY + (Math.random() - 0.5) * 22,
          vx: (Math.random() - 0.5) * 1.8,
          vy: (Math.random() - 0.5) * 1.8 - 0.6,
          life: 35,
          color: `rgba(255, 220, 50, ${0.7 + Math.random() * 0.3})`
        })
      }
    }
  }, [avatarAngle, avatarMoving, cosmetics, isWorking])

  const drawParticles = (ctx) => {
    const cam = { x: cameraPos.x, y: cameraPos.y, zoom }

    // Ambient particles - spawn occasionally
    if (Math.random() < 0.02) {
      ambientParticlesRef.current.push({
        x: Math.random() * ctx.canvas.width,
        y: Math.random() * ctx.canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: Math.random() * 0.2 - 0.3,
        life: 120,
        maxLife: 120,
        color: 'rgba(200, 220, 240, 0.3)',
        size: Math.random() * 1 + 0.5
      })
    }

    // Update and draw ambient particles
    const ambientToRemove = []
    ambientParticlesRef.current.forEach((p, idx) => {
      p.x += p.vx
      p.y += p.vy
      p.life -= 1
      const alpha = Math.max(0, (p.life / p.maxLife) * 0.3)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(200, 220, 240, 1)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (p.life <= 0) ambientToRemove.push(idx)
    })
    if (ambientToRemove.length > 0) {
      ambientParticlesRef.current = ambientParticlesRef.current.filter((_, i) => !ambientToRemove.includes(i))
    }

    // Main particles
    const toRemove = []
    particlesRef.current.forEach((p, idx) => {
      p.x += p.vx
      p.y += p.vy
      p.life -= 1
      const alpha = Math.max(0, p.life / 24)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (p.life <= 0) toRemove.push(idx)
    })
    if (toRemove.length > 0) {
      particlesRef.current = particlesRef.current.filter((_, i) => !toRemove.includes(i))
    }
  }


  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    // ground
    ctx.fillStyle = '#6ba54a'
    ctx.fillRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2

    // Use smooth interpolated zoom from zoomRef to avoid abrupt jumps
    const z = zoomRef.current || 1

    ctx.save()
    ctx.translate(centerX - cameraPos.x * z, centerY - cameraPos.y * z)
    ctx.scale(z, z)

    // District background rendering
    if (showDistricts) {
      for (let [key, district] of Object.entries(DISTRICTS)) {
        const topLeft = gridToIsometric(district.x, district.y)
        const bottomRight = gridToIsometric(district.x + district.width, district.y + district.height)

        // Semi-transparent district background
        ctx.fillStyle = district.color
        ctx.globalAlpha = 0.08
        ctx.fillRect(
          topLeft.x,
          topLeft.y,
          bottomRight.x - topLeft.x,
          bottomRight.y - topLeft.y
        )

        // District border
        ctx.strokeStyle = district.color
        ctx.globalAlpha = 0.25
        ctx.lineWidth = 2
        ctx.strokeRect(
          topLeft.x,
          topLeft.y,
          bottomRight.x - topLeft.x,
          bottomRight.y - topLeft.y
        )

        // District label
        const labelX = topLeft.x + (bottomRight.x - topLeft.x) / 2
        const labelY = topLeft.y + 15
        ctx.fillStyle = district.color
        ctx.globalAlpha = 0.6
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`${district.emoji} ${district.name}`, labelX, labelY)
        ctx.globalAlpha = 1
      }
    }

    // tiles and optional grid overlay with improved roads
    for (let gridX = 0; gridX < GRID_WIDTH; gridX++) {
      for (let gridY = 0; gridY < GRID_HEIGHT; gridY++) {
        const isMainRoad = gridX % 5 === 0 || gridY % 5 === 0
        const isSecondaryRoad = (gridX % 2 === 0 && gridX % 5 !== 0) || (gridY % 2 === 0 && gridY % 5 !== 0)
        const isoPos = gridToIsometric(gridX, gridY)

        if (showGrid && ((gridX % 2 === 0) || (gridY % 2 === 0))) {
          drawIsometricTile(ctx, isoPos.x, isoPos.y, '#7b8794', 0, false)
        } else if (isMainRoad) {
          // Major roads - darker asphalt
          drawIsometricTile(ctx, isoPos.x, isoPos.y, '#2d3436', 0, false)
          // Road markings
          if (gridX % 10 === 0 && gridY % 10 === 0) {
            ctx.fillStyle = '#FFD700'
            ctx.globalAlpha = 0.4
            ctx.fillRect(isoPos.x - 3, isoPos.y - 2, 6, 1)
          }
        } else if (isSecondaryRoad) {
          // Secondary roads - lighter asphalt
          drawIsometricTile(ctx, isoPos.x, isoPos.y, '#424242', 0, false)
        } else {
          const gameX = (gridX / GRID_WIDTH) * MAP_WIDTH
          const gameY = (gridY / GRID_HEIGHT) * MAP_HEIGHT
          const prop = getPropertyAtGamePos(gameX, gameY)

          if (prop) {
            const color = PROPERTY_COLORS[prop.property_type] || PROPERTY_COLORS.default
            const upgradeLevel = prop.upgrade_level || 0
            const baseHeight = 3 + upgradeLevel * 2
            const valueHeight = Math.min(10, Math.log(prop.current_value || 100000) / 10)
            const heightPx = baseHeight + valueHeight
            const isHovered = prop.id === hoveredPropertyId
            const isOwned = !!prop.owner_id

            let displayColor = color
            if (isHovered) displayColor = adjustBrightness(color, 30)
            else if (upgradeLevel > 0) displayColor = adjustBrightness(color, Math.min(40, upgradeLevel * 5))

            drawIsometricTile(ctx, isoPos.x, isoPos.y, displayColor, isOwned ? heightPx : 0, isHovered || upgradeLevel > 0)

            if (isOwned) {
              ctx.fillStyle = upgradeLevel > 0 ? '#ffd700' : 'white'
              ctx.font = `bold ${upgradeLevel > 0 ? '11px' : '10px'} Arial`
              ctx.textAlign = 'center'
              ctx.fillText(prop.name ? prop.name.substring(0, 10) : 'Prop', isoPos.x, isoPos.y - 3)
              if (upgradeLevel > 0) {
                ctx.fillStyle = '#ffd700'
                ctx.font = 'bold 8px Arial'
                ctx.fillText(`★${upgradeLevel}`, isoPos.x, isoPos.y + 5)
              }
            }
          } else {
            drawIsometricTile(ctx, isoPos.x, isoPos.y, adjustBrightness('#6ba54a', -10), 0, false)
            if (showDecor) {
              const r = seededRand(gridX, gridY)
              if (r > 0.82) {
                // draw a small tree centered on tile
                drawTree(ctx, isoPos.x, isoPos.y + (TILE_SIZE / 8))
              }
            }
          }
        }
      }
    }

    // Draw job location markers
    Object.entries(JOB_LOCATIONS).forEach(([jobName, loc]) => {
      const isoPos = gridToIsometric(loc.x / 12.5, loc.y / 14.58)
      ctx.save()
      ctx.globalAlpha = 0.7

      // Job marker circle
      const markerGradient = ctx.createRadialGradient(isoPos.x, isoPos.y, 0, isoPos.x, isoPos.y, 15)
      markerGradient.addColorStop(0, 'rgba(255, 193, 7, 0.8)')
      markerGradient.addColorStop(1, 'rgba(255, 193, 7, 0.2)')
      ctx.fillStyle = markerGradient
      ctx.beginPath()
      ctx.arc(isoPos.x, isoPos.y, 15, 0, Math.PI * 2)
      ctx.fill()

      // Marker icon
      ctx.fillStyle = '#ffc107'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('����', isoPos.x, isoPos.y)

      ctx.restore()
    })

    // Draw placed buildings/properties
    placedBuildings.forEach(building => {
      const isoPos = gridToIsometric(building.x, building.y)
      drawBuilding(ctx, isoPos.x, isoPos.y, building.type, building.level || 1)

      // Building hover effect
      if (building.id === buildingHovered) {
        ctx.globalAlpha = 0.5
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 2
        ctx.strokeRect(isoPos.x - 15, isoPos.y - 30, 30, 30)
        ctx.globalAlpha = 1
      }

      // Income indicator above building
      if (building.incomeRate) {
        ctx.fillStyle = '#10B981'
        ctx.font = 'bold 8px Arial'
        ctx.textAlign = 'center'
        ctx.globalAlpha = 0.8
        ctx.fillText(`₱${Math.round(building.incomeRate)}/s`, isoPos.x, isoPos.y - 40)
        ctx.globalAlpha = 1
      }
    })

    // Draw placement preview if placing a property
    if (placingProperty) {
      const isoPos = gameToIsometric(avatarPos.x, avatarPos.y)
      ctx.globalAlpha = 0.5
      drawBuilding(ctx, isoPos.x, isoPos.y, placingProperty.type, 1)
      ctx.globalAlpha = 1

      // Show zone validity
      const districtKey = Object.keys(DISTRICTS).find(key => {
        const d = DISTRICTS[key]
        return avatarPos.x >= d.x * TILE_SIZE && avatarPos.x < (d.x + d.width) * TILE_SIZE &&
               avatarPos.y >= d.y * TILE_SIZE && avatarPos.y < (d.y + d.height) * TILE_SIZE
      })
      const isValidZone = districtKey && ZONE_RULES[districtKey]?.includes(placingProperty.type)
      ctx.fillStyle = isValidZone ? '#10B981' : '#EF4444'
      ctx.font = '9px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(isValidZone ? '✓ Valid Zone' : '✗ Invalid Zone', isoPos.x, isoPos.y - 50)
    }

    // Draw NPCs
    if (npcManagerRef.current) {
      const npcs = npcManagerRef.current.getNPCs()
      npcs.forEach(npc => {
        const isoPos = gridToIsometric(npc.position.x / 12.5, npc.position.y / 14.58)
        npc.draw(ctx, isoPos.x, isoPos.y, { gameToIsometric, gridToIsometric })
      })
    }

    // avatar (round screen pos to reduce sub-pixel jitter)
    const avatarScreenPosRaw = gameToIsometric(avatarPos.x, avatarPos.y)
    const avatarScreenPos = { x: Math.round(avatarScreenPosRaw.x), y: Math.round(avatarScreenPosRaw.y) }
    drawAvatar(ctx, avatarScreenPos.x - AVATAR_SIZE / 2, avatarScreenPos.y - AVATAR_SIZE)

    // particles
    drawParticles(ctx)

    ctx.restore()

    // Draw event effects (outside of transforms)
    if (eventSystemRef.current) {
      const events = eventSystemRef.current.getActiveEvents()
      events.forEach(event => {
        const progress = (Date.now() - event.timestamp) / event.duration
        const isoPos = gridToIsometric(event.position.x / 12.5, event.position.y / 14.58)
        const z = zoomRef.current || 1
        const screenPos = {
          screenX: centerX - cameraPos.x * z + (isoPos.x - (centerX - cameraPos.x * z)) * z,
          screenY: centerY - cameraPos.y * z + (isoPos.y - (centerY - cameraPos.y * z)) * z
        }
        drawEventEffect(ctx, screenPos, event.type, progress)
      })
    }

    // day/night cycle overlay and vignette
    const cycle = (Date.now() % 600000) / 600000 // 10-minute cycle
    const night = Math.abs(Math.sin(cycle * Math.PI)) // 0 day, 1 night
    ctx.save()
    ctx.fillStyle = `rgba(10, 20, 40, ${0.25 * night})`
    ctx.fillRect(0, 0, width, height)
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    const g = ctx.createRadialGradient(width / 2, height * 0.45, width * 0.05, width / 2, height * 0.45, Math.max(width, height))
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.6, 'rgba(0,0,0,0.12)')
    g.addColorStop(1, 'rgba(0,0,0,0.5)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    ctx.restore()

  }, [cameraPos, hoveredPropertyId, properties, gridToIsometric, gameToIsometric, getPropertyAtGamePos, drawIsometricTile, drawAvatar, avatarPos, npcManagerRef, eventSystemRef])

  const moveAvatar = useCallback((direction) => {
    const speed = (mapSettings.avatarSpeed ?? 1.3) * 180

    // Set velocity and angle based on direction
    switch (direction) {
      case 'up':
        velocityRef.current.y = -speed
        velocityRef.current.x = 0
        setAvatarAngle(270)
        break
      case 'down':
        velocityRef.current.y = speed
        velocityRef.current.x = 0
        setAvatarAngle(90)
        break
      case 'left':
        velocityRef.current.x = -speed
        velocityRef.current.y = 0
        setAvatarAngle(180)
        break
      case 'right':
        velocityRef.current.x = speed
        velocityRef.current.y = 0
        setAvatarAngle(0)
        break
      default:
        break
    }

    setAvatarMoving(true)
  }, [mapSettings])

  const stopMovement = useCallback(() => {
    velocityRef.current.x = 0
    velocityRef.current.y = 0
    setAvatarMoving(false)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e) => {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    }

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const clientX = e.clientX - rect.left
      const clientY = e.clientY - rect.top

      if (isDragging) {
        const deltaX = (e.clientX - dragStart.x) / zoom
        const deltaY = (e.clientY - dragStart.y) / zoom
        setCameraPos(prev => {
          const n = { x: prev.x - deltaX, y: prev.y - deltaY }
          targetCameraRef.current = n
          return n
        })
        setDragStart({ x: e.clientX, y: e.clientY })
      } else {
        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const isoX = (clientX - centerX) / zoom + cameraPos.x
        const isoY = (clientY - centerY) / zoom + cameraPos.y

        const gridPos = isometricToGrid(isoX, isoY)
        const gameX = (gridPos.x / GRID_WIDTH) * MAP_WIDTH
        const gameY = (gridPos.y / GRID_HEIGHT) * MAP_HEIGHT
        const prop = getPropertyAtGamePos(gameX, gameY)

        if (prop) {
          setHoveredPropertyId(prop.id)
          setTooltipData({
            name: prop.name || 'Property',
            type: prop.property_type || 'property',
            income: prop.income || 0,
            value: prop.current_value || 0,
            upgrade: prop.upgrade_level || 0,
            owned: !!prop.owner_id
          })
          setTooltipPos({ x: clientX + 12, y: clientY + 12 })
        } else {
          setHoveredPropertyId(null)
          setTooltipData(null)
          setTooltipPos(null)
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const handleClick = (e) => {
      if (isDragging) return
      const rect = canvas.getBoundingClientRect()
      const clientX = e.clientX - rect.left
      const clientY = e.clientY - rect.top

      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const isoX = (clientX - centerX) / zoom + cameraPos.x
      const isoY = (clientY - centerY) / zoom + cameraPos.y

      // Check job marker proximity first
      const markerRadius = 22
      let clickedJob = null
      Object.entries(JOB_LOCATIONS).forEach(([jobName, loc]) => {
        const mPos = gridToIsometric(loc.x / 12.5, loc.y / 14.58)
        const dx = isoX - mPos.x
        const dy = isoY - mPos.y
        if (!clickedJob && Math.hypot(dx, dy) <= markerRadius) clickedJob = jobName
      })
      if (clickedJob && typeof onPropertyClick !== 'string' && typeof onJobMarkerClick === 'function') {
        try { onJobMarkerClick(clickedJob) } catch (e) {}
      }

      const gridPos = isometricToGrid(isoX, isoY)
      const gameX = (gridPos.x / GRID_WIDTH) * MAP_WIDTH
      const gameY = (gridPos.y / GRID_HEIGHT) * MAP_HEIGHT
      const prop = getPropertyAtGamePos(gameX, gameY)

      if (prop && onPropertyClick) {
        onPropertyClick(prop)
      } else {
        // click-to-move to arbitrary point
        moveTargetRef.current = { x: Math.max(0, Math.min(MAP_WIDTH, gameX)), y: Math.max(0, Math.min(MAP_HEIGHT, gameY)) }
        if (followAvatar) targetCameraRef.current = { x: moveTargetRef.current.x - 75, y: moveTargetRef.current.y - 87 }
      }
    }

    const handleWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.92 : 1.08 // smoother zoom increments
      setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)))
    }

    const handleKeyDown = (e) => {
      // Ignore movement keys when typing in inputs or when a modal has focus
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return

      keysPressed.current[e.key.toLowerCase()] = true

      // cancel click-to-move on manual input
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
        moveTargetRef.current = null
      }

      // Prevent default scroll behavior for movement keys
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
    }

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false
      // When all keys released, stop continuous movement
      const isMoving = keysPressed.current['w'] || keysPressed.current['arrowup'] ||
                       keysPressed.current['s'] || keysPressed.current['arrowdown'] ||
                       keysPressed.current['a'] || keysPressed.current['arrowleft'] ||
                       keysPressed.current['d'] || keysPressed.current['arrowright']
      if (!isMoving) velocityRef.current = { x: 0, y: 0 }
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    const animate = () => {
      // Time step for smooth, frame-rate independent movement
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000)
      lastTimeRef.current = now

      // Smoothly interpolate zoom towards target state (frame-rate independent)
      const zoomTarget = zoom
      zoomRef.current += (zoomTarget - zoomRef.current) * Math.min(1, dt * 8)

      // Determine velocity from keys or click-to-move (pixels per second)
      const baseSpeed = (mapSettings.avatarSpeed ?? 1.3) * 180
      const canSprint = (character && typeof character.energy === 'number') ? character.energy > 0 : true
      const sprint = (keysPressed.current['shift'] && canSprint) ? 2.2 : 1
      const moveSpeed = baseSpeed * sprint
      let vx = 0, vy = 0
      if (keysPressed.current['w'] || keysPressed.current['arrowup']) vy -= moveSpeed
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) vy += moveSpeed
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) vx -= moveSpeed
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) vx += moveSpeed

      // Calculate angle from velocity (0 = right, 90 = down, 180 = left, 270 = up)
      if (vx !== 0 || vy !== 0) {
        const targetAngle = Math.atan2(vy, vx) * (180 / Math.PI)
        // Very responsive angle interpolation for immediate direction changes
        setAvatarAngle(prev => {
          let diff = targetAngle - prev
          if (diff > 180) diff -= 360
          if (diff < -180) diff += 360
          // Time-based interpolation: rotate faster at higher dt but clamp
          const rotSpeed = Math.min(1, dt * 8) // larger multiplier = faster turning
          const newAngle = prev + diff * Math.min(0.9, rotSpeed + 0.2)
          return (newAngle + 360) % 360
        })
      }

      // Normalize diagonal movement
      if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071 }

      // Energy drain while sprinting
      if (onConsumeEnergy && sprint > 1 && (vx !== 0 || vy !== 0)) {
        const now = performance.now()
        if (now - lastEnergyDrainRef.current > 400) {
          try { onConsumeEnergy(1) } catch (e) {}
          lastEnergyDrainRef.current = now
        }
      }

      // If no keys, use click-to-move target
      if (vx === 0 && vy === 0 && moveTargetRef.current) {
        const dx = moveTargetRef.current.x - avatarPos.x
        const dy = moveTargetRef.current.y - avatarPos.y
        const dist = Math.hypot(dx, dy)
        if (dist < 2) {
          moveTargetRef.current = null
          vx = 0; vy = 0
        } else {
          vx = (dx / dist) * baseSpeed
          vy = (dy / dist) * baseSpeed
          const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI)
          setAvatarAngle(prev => {
            let diff = targetAngle - prev
            if (diff > 180) diff -= 360
            if (diff < -180) diff += 360
            const rotSpeed = Math.min(1, dt * 6)
            const newAngle = prev + diff * Math.min(0.85, rotSpeed + 0.15)
            return (newAngle + 360) % 360
          })
        }
      }
      velocityRef.current.x = vx
      velocityRef.current.y = vy
      setAvatarMoving(vx !== 0 || vy !== 0)

      // Apply velocity to avatar position
      setAvatarPos(prev => {
        const maxX = MAP_WIDTH
        const maxY = MAP_HEIGHT
        const newX = Math.max(0, Math.min(maxX, prev.x + velocityRef.current.x))
        const newY = Math.max(0, Math.min(maxY, prev.y + velocityRef.current.y))

        if ((newX !== prev.x || newY !== prev.y) && onCharacterMove) {
          if (cityData) {
            const latLng = convertGameCoordsToLatLng(newX, newY, cityData, MAP_WIDTH, MAP_HEIGHT)
            onCharacterMove({ x: newX, y: newY, lat: latLng.lat, lng: latLng.lng, city: selectedCity })
          } else {
            onCharacterMove({ x: newX, y: newY, city: selectedCity })
          }
        }

        // Update camera target when following avatar
        if (followAvatar) targetCameraRef.current = { x: newX - 75, y: newY - 87 }
        return { x: newX, y: newY }
      })

      // smooth camera approach with adaptive easing (faster when far, slower when close for precision)
      setCameraPos(prev => {
        let tx = targetCameraRef.current.x
        let ty = targetCameraRef.current.y
        // Clamp to world bounds
        tx = Math.max(0, Math.min(MAP_WIDTH, tx))
        ty = Math.max(0, Math.min(MAP_HEIGHT, ty))
        const dx = tx - prev.x
        const dy = ty - prev.y
        const dist = Math.hypot(dx, dy)
        // Adaptive easing: slightly faster for more responsive feel
        const easeFactor = dist < 5 ? 0.1 : 0.2
        const nx = prev.x + dx * easeFactor
        const ny = prev.y + dy * easeFactor
        return { x: nx, y: ny }
      })

      // stop running state gradually if no velocity
      if (avatarMoving && velocityRef.current.x === 0 && velocityRef.current.y === 0) {
        if (avatarAnimationFrame.current % 10 === 0) setAvatarMoving(false)
      }

      avatarAnimationFrame.current++

      // Update NPCs and events
      if (npcManagerRef.current) {
        npcManagerRef.current.update()
      }
      if (eventSystemRef.current) {
        eventSystemRef.current.update()
      }

      draw()
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(animationRef.current)
    }
  }, [draw, isometricToGrid, getPropertyAtGamePos, onPropertyClick, followAvatar])
  // PERFORMANCE NOTE: Reduced dependencies by moving frequently-updated values to refs.
  // This prevents the effect from re-running on every camera/zoom/avatar change,
  // while still allowing the draw function and key logic to remain stable.
  // Dynamic values (cameraPos, zoom, etc) are read from refs inside the animation loop.

  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        canvasRef.current.width = rect.width
        canvasRef.current.height = rect.height
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  // Initialize NPC manager and event system
  useEffect(() => {
    if (!npcManagerRef.current) {
      npcManagerRef.current = new NPCManager(MAP_WIDTH, MAP_HEIGHT)
      eventSystemRef.current = new EventSystem()
    }
  }, [])

  const handleCityChange = (cityName) => {
    setSelectedCity(cityName)
    setAvatarPos({ x: 150, y: 175 })
    setCameraPos({ x: 0, y: 0 })
    targetCameraRef.current = { x: 0, y: 0 }
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div ref={containerRef} className="flex-1 relative bg-gradient-to-b from-green-300 to-green-100" style={{ overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-grab active:cursor-grabbing"
          style={{ display: 'block' }}
          onContextMenu={(e) => e.preventDefault()}
        />


        {/* Collapsible Minimap */}
        <CollapsibleMinimap
          properties={properties}
          character={character}
          avatarPos={avatarPos}
          avatarAngle={avatarAngle}
          zoom={zoom}
          cameraPos={cameraPos}
          onMinimapClick={(coords) => {
            const targetX = Math.max(0, Math.min(MAP_WIDTH, coords.x))
            const targetY = Math.max(0, Math.min(MAP_HEIGHT, coords.y))
            moveTargetRef.current = { x: targetX, y: targetY }
            if (followAvatar) targetCameraRef.current = { x: targetX - 75, y: targetY - 87 }
            else targetCameraRef.current = { x: targetX, y: targetY }
          }}
          city={selectedCity}
        />

        {/* Working Indicator */}
        {isWorking && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-slate-900/90 border border-yellow-500/50 rounded-lg shadow-lg p-4 w-64">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-semibold text-yellow-300">{workingJobId}</span>
                </div>
                <span className="text-xs text-slate-400">{workProgress}%</span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-yellow-300 h-full rounded-full transition-all duration-100"
                  style={{ width: `${workProgress}%` }}
                ></div>
              </div>
              <div className="mt-2 text-center">
                <div className="text-[10px] text-slate-400">Character is working...</div>
              </div>
            </div>
          </div>
        )}

        {/* Top-right quick controls */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, Math.min(3, z * 0.9)))}
            className="px-2 py-1 text-xs bg-slate-700 text-white border border-slate-600 rounded hover:bg-slate-600 transition-colors"
            title="Zoom out"
          >−</button>
          <button
            onClick={() => setZoom(z => Math.max(0.5, Math.min(3, z * 1.1)))}
            className="px-2 py-1 text-xs bg-slate-700 text-white border border-slate-600 rounded hover:bg-slate-600 transition-colors"
            title="Zoom in"
          >+</button>
          <button
            onClick={() => { setCameraPos({ x: avatarPos.x, y: avatarPos.y }); setFollowAvatar(true); }}
            className="px-3 py-1 text-xs bg-emerald-600 text-white border border-emerald-700 rounded hover:bg-emerald-700 transition-colors font-medium"
            title="Center map on character"
          >⊙ Center</button>
        </div>

        {/* Enhanced Property Tooltip */}
        {tooltipPos && tooltipData && (
          <div
            className="absolute z-30 bg-gradient-to-b from-slate-900 to-slate-800 border border-purple-500/40 rounded-lg p-3 text-xs text-slate-200 shadow-2xl min-w-48"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-slate-100 text-sm">{tooltipData.name}</div>
              <div className="text-[10px] px-2 py-0.5 bg-purple-600/30 rounded text-purple-300 capitalize">{tooltipData.type}</div>
            </div>

            {tooltipData.owned ? (
              <div className="space-y-1.5 border-t border-slate-700 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">💰 Income:</span>
                  <span className="font-semibold text-emerald-300">₱{Number(tooltipData.income || 0).toLocaleString()}/10s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">📈 Value:</span>
                  <span className="font-semibold text-yellow-300">��{Number(tooltipData.value || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">⭐ Level:</span>
                  <span className="font-semibold text-purple-300">{tooltipData.upgrade || 0}</span>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-700 pt-2">
                <div className="text-slate-400 text-[10px]">Available for purchase</div>
              </div>
            )}
          </div>
        )}

        {/* Energy overlay */}
        {character && typeof character.energy === 'number' && (
          <div className="absolute left-2 bottom-2 z-20 bg-slate-900/70 border border-slate-700 rounded px-3 py-2 text-[10px] text-slate-200">
            <div className="mb-1">Energy</div>
            <div className="w-40 h-2 bg-slate-700 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300"
                style={{ width: `${Math.max(0, Math.min(100, (character.energy / (character.max_energy || 100)) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
