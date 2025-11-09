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
  const [placingProperty, setPlacingProperty] = useState(null)
  const [placedBuildings, setPlacedBuildings] = useState([])
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  const [buildingHovered, setBuildingHovered] = useState(null)
  
  const keysPressed = useRef({})
  const animationRef = useRef(null)
  const avatarAnimationFrame = useRef(0)
  const particlesRef = useRef([])
  const ambientParticlesRef = useRef([])
  const velocityRef = useRef({ x: 0, y: 0 })
  const moveTargetRef = useRef(null)
  const targetCameraRef = useRef({ x: 0, y: 0 })
  const npcManagerRef = useRef(null)
  const eventSystemRef = useRef(null)
  const lastEnergyDrainRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  const cameraPosRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const avatarPosRef = useRef({ x: 150, y: 175 })
  const selectedCityRef = useRef(city)
  const propertiesRef = useRef([])

  const TILE_SIZE = 48
  const GRID_WIDTH = 40
  const GRID_HEIGHT = 30
  const AVATAR_SIZE = 40
  const MAP_WIDTH = GRID_WIDTH * TILE_SIZE
  const MAP_HEIGHT = GRID_HEIGHT * TILE_SIZE

  const PROPERTY_COLORS = {
    sari_sari: '#F97316', food_cart: '#EF4444', tricycle: '#3B82F6',
    residential: '#10B981', commercial: '#EC4899', industrial: '#F59E0B',
    office: '#4F46E5', default: '#94A3B8'
  }

  const DISTRICTS = {
    financial: { name: 'Financial District', color: '#4F46E5', x: 5, y: 5, width: 8, height: 8, emoji: '🏢' },
    residential: { name: 'Residential', color: '#10B981', x: 15, y: 5, width: 8, height: 10, emoji: '🏠' },
    industrial: { name: 'Industrial Zone', color: '#F59E0B', x: 25, y: 8, width: 8, height: 10, emoji: '🏭' },
    commercial: { name: 'Commercial Hub', color: '#EC4899', x: 5, y: 18, width: 10, height: 8, emoji: '🛍️' },
    parks: { name: 'Parks & Recreation', color: '#14B8A6', x: 18, y: 18, width: 8, height: 8, emoji: '🌳' },
    historic: { name: 'Historic District', color: '#D97706', x: 28, y: 20, width: 8, height: 8, emoji: '🏛️' }
  }

  useEffect(() => {
    const c = getCityById(selectedCity.toLowerCase().replace(/\s+/g, '-'))
    setCityData(c || null)
  }, [selectedCity])

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

  useEffect(() => {
    if (city && city !== selectedCity) {
      setSelectedCity(city)
      if (!initialAvatarPos) setAvatarPos({ x: 150, y: 175 })
      setCameraPos({ x: 0, y: 0 })
      targetCameraRef.current = { x: 0, y: 0 }
    }
  }, [city])

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

  const seededRand = (x, y, seedStr = selectedCity) => {
    const seed = Array.from(String(seedStr)).reduce((a, c) => a + c.charCodeAt(0), 0)
    let t = x * 374761393 + y * 668265263 + seed * 1442695040888963407
    t = (t ^ (t >> 13)) * 1274126177
    t = (t ^ (t >> 16)) >>> 0
    return (t % 1000) / 1000
  }

  const drawImprovedAvatar = useCallback((ctx, screenX, screenY) => {
    const size = AVATAR_SIZE
    const isRunning = avatarMoving
    const skinColor = cosmetics ? getCosmeticOption('skinTones', cosmetics.skinTone)?.hex : '#fdbf5f'
    const hairColor = cosmetics ? getCosmeticOption('hairColors', cosmetics.hairColor)?.hex : '#1a1a1a'
    const outfit = cosmetics ? COSMETICS.outfits.find(o => o.id === cosmetics.outfit) : null
    const topColor = outfit?.top || '#3f51b5'
    const bottomColor = outfit?.bottom || '#2196f3'

    ctx.save()

    // Working/glow effect
    if (isWorking) {
      const glowIntensity = Math.sin(avatarAnimationFrame.current * 0.15) * 0.5 + 0.5
      const glowAlpha = 0.4 + glowIntensity * 0.3
      const glowRadius = 22 + Math.sin(avatarAnimationFrame.current * 0.1) * 6
      const glowGrad = ctx.createRadialGradient(screenX + size / 2, screenY + size / 2, 0, screenX + size / 2, screenY + size / 2, glowRadius)
      glowGrad.addColorStop(0, `rgba(255, 220, 80, ${glowAlpha})`)
      glowGrad.addColorStop(1, 'rgba(255, 200, 0, 0)')
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(screenX + size / 2, screenY + size / 2, glowRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Shadow
    const shadowGrad = ctx.createRadialGradient(screenX + size / 2, screenY + size / 2 + 2, 2, screenX + size / 2, screenY + size / 2 + 2, 18)
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)')
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = shadowGrad
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY + size / 2 + 2, 18, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    if (isWorking) {
      const rotation = (avatarAnimationFrame.current * 0.08) % (Math.PI * 2)
      ctx.translate(screenX + size / 2, screenY + size / 2)
      ctx.rotate(rotation)
      ctx.translate(-(screenX + size / 2), -(screenY + size / 2))
    } else {
      const normalizedAngle = ((avatarAngle % 360) + 360) % 360
      const angleRadians = (normalizedAngle * Math.PI) / 180
      ctx.translate(screenX + size / 2, screenY + size / 2)
      ctx.rotate(angleRadians)
      ctx.translate(-(screenX + size / 2), -(screenY + size / 2))
    }

    const floatOffset = !isRunning && !isWorking ? Math.sin(avatarAnimationFrame.current * 0.02) * 1.2 : 0
    const legOffset = isRunning && !isWorking ? Math.sin(avatarAnimationFrame.current * 0.12) * 4 : 0

    // Improved body with better proportions
    ctx.fillStyle = topColor
    ctx.fillRect(screenX + 6, screenY + 4 + floatOffset, size - 12, size * 0.35)

    // Pants with better styling
    ctx.fillStyle = bottomColor
    ctx.fillRect(screenX + 6, screenY + size * 0.39 + floatOffset, size - 12, size * 0.32)

    // Shoes
    ctx.fillStyle = '#2c2c2c'
    ctx.fillRect(screenX + 8, screenY + size * 0.7 + legOffset + floatOffset, 6, 5)
    ctx.fillRect(screenX + size - 14, screenY + size * 0.7 - legOffset + floatOffset, 6, 5)

    // Head with better shading
    ctx.fillStyle = skinColor
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 4 + floatOffset, 9, 0, Math.PI * 2)
    ctx.fill()

    // Head shine
    ctx.fillStyle = adjustBrightness(skinColor, 35)
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.arc(screenX + size / 2 - 2, screenY - 6 + floatOffset, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // Eyes - animated blink
    const blinkCycle = (avatarAnimationFrame.current % 120)
    const isBlinking = blinkCycle > 110
    const blinkHeight = isBlinking ? 0.5 : 2.2

    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(screenX + size / 2 - 3, screenY - 6 + floatOffset, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(screenX + size / 2 + 3, screenY - 6 + floatOffset, 2.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(screenX + size / 2 - 3, screenY - 6 + floatOffset, blinkHeight, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(screenX + size / 2 + 3, screenY - 6 + floatOffset, blinkHeight, 0, Math.PI * 2)
    ctx.fill()

    // Mouth
    if (!isBlinking) {
      ctx.strokeStyle = '#8b6f47'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(screenX + size / 2, screenY - 2 + floatOffset, 2, 0, Math.PI, false)
      ctx.stroke()
    }

    // Hair with depth
    ctx.fillStyle = hairColor
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 10 + floatOffset, 9, Math.PI, 0, true)
    ctx.fill()

    // Hair shine
    ctx.fillStyle = adjustBrightness(hairColor, 25)
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.arc(screenX + size / 2 - 3, screenY - 12 + floatOffset, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.restore()

    // Particle effects
    if (isRunning && !isWorking && avatarAnimationFrame.current % 5 === 0) {
      particlesRef.current.push({
        x: screenX + size / 2,
        y: screenY + size / 2 + 8,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 1.2,
        life: 20,
        color: 'rgba(160, 180, 200, 0.6)',
        size: Math.random() * 1.5 + 0.5
      })
    }

    if (isWorking) {
      if (avatarAnimationFrame.current % 3 === 0) {
        particlesRef.current.push({
          x: screenX + size / 2 + (Math.random() - 0.5) * 24,
          y: screenY + (Math.random() - 0.5) * 24,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2 - 0.8,
          life: 40,
          color: `rgba(255, 220, 60, ${0.8 + Math.random() * 0.2})`,
          size: Math.random() * 2 + 1
        })
      }
    }

    ctx.restore()
  }, [avatarAngle, avatarMoving, cosmetics, isWorking])

  const drawParticles = (ctx) => {
    if (Math.random() < 0.015) {
      ambientParticlesRef.current.push({
        x: Math.random() * ctx.canvas.width,
        y: Math.random() * ctx.canvas.height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: Math.random() * 0.15 - 0.2,
        life: 140,
        maxLife: 140,
        color: 'rgba(180, 200, 220, 0.4)',
        size: Math.random() * 0.8 + 0.3
      })
    }

    const ambientToRemove = []
    ambientParticlesRef.current.forEach((p, idx) => {
      p.x += p.vx
      p.y += p.vy
      p.life -= 1
      const alpha = Math.max(0, (p.life / p.maxLife) * 0.35)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(180, 200, 220, 1)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (p.life <= 0) ambientToRemove.push(idx)
    })
    if (ambientToRemove.length > 0) {
      ambientParticlesRef.current = ambientParticlesRef.current.filter((_, i) => !ambientToRemove.includes(i))
    }

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
      ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (p.life <= 0) toRemove.push(idx)
    })
    if (toRemove.length > 0) {
      particlesRef.current = particlesRef.current.filter((_, i) => !toRemove.includes(i))
    }
  }

  const drawBuilding = useCallback((ctx, isoX, isoY, buildingType, level = 1, isProperty = false) => {
    const baseSize = 22
    const heightPerLevel = 5
    const totalHeight = baseSize + level * heightPerLevel

    const buildingColors = {
      sari_sari: '#F97316', food_cart: '#EF4444', tricycle: '#3B82F6',
      office: '#4F46E5', bank: '#3B82F6', corporate: '#2563EB',
      house: '#10B981', apartment: '#059669', market_stall: '#7C3AED',
      factory: '#F59E0B', warehouse: '#EA580C', workshop: '#DC2626',
      store: '#EC4899', restaurant: '#DB2777', mall: '#BE185D',
      park: '#14B8A6', garden: '#06B6D4', plaza: '#0891B2',
      museum: '#D97706', landmark: '#B45309', heritage: '#92400E',
      default: '#64748B'
    }
    const color = buildingColors[buildingType] || buildingColors.default

    ctx.save()
    ctx.fillStyle = color
    ctx.globalAlpha = isProperty ? 0.95 : 0.85
    ctx.fillRect(isoX - baseSize / 2, isoY - totalHeight, baseSize, totalHeight)

    ctx.fillStyle = adjustBrightness(color, 40)
    ctx.globalAlpha = isProperty ? 0.7 : 0.5
    ctx.fillRect(isoX - baseSize / 2 + 1, isoY - totalHeight + 1, baseSize * 0.5, totalHeight * 0.3)

    ctx.fillStyle = adjustBrightness(color, -50)
    ctx.globalAlpha = 0.8
    ctx.fillRect(isoX - baseSize / 2, isoY - 3, baseSize, 3)

    if (level > 0) {
      ctx.fillStyle = '#FFD700'
      ctx.globalAlpha = 1
      ctx.font = 'bold 10px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`L${level}`, isoX, isoY - totalHeight + 9)
    }

    ctx.restore()
  }, [adjustBrightness])

  const drawTile = useCallback((ctx, screenX, screenY, color, isHovered = false) => {
    const w = TILE_SIZE / 2
    const h = TILE_SIZE / 4

    // Base tile
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + w, screenY + h)
    ctx.lineTo(screenX, screenY + h * 2)
    ctx.lineTo(screenX - w, screenY + h)
    ctx.closePath()
    ctx.fill()

    // Depth gradient
    const gradient = ctx.createLinearGradient(screenX - w, screenY, screenX, screenY + h * 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)')
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.04)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)')
    ctx.fillStyle = gradient
    ctx.fill()

    // Border
    ctx.strokeStyle = isHovered ? 'rgba(255, 220, 100, 0.9)' : 'rgba(0, 0, 0, 0.2)'
    ctx.lineWidth = isHovered ? 2 : 1.2
    ctx.stroke()

    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 220, 100, 0.2)'
      ctx.lineWidth = 3.5
      ctx.stroke()
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear with gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
    bgGradient.addColorStop(0, '#4a7c59')
    bgGradient.addColorStop(0.5, '#5a9c69')
    bgGradient.addColorStop(1, '#3a6c49')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2
    const z = zoomRef.current || 1

    ctx.save()
    ctx.translate(centerX - cameraPos.x * z, centerY - cameraPos.y * z)
    ctx.scale(z, z)

    // Districts
    if (showDistricts) {
      for (let [key, district] of Object.entries(DISTRICTS)) {
        const topLeft = gridToIsometric(district.x, district.y)
        const bottomRight = gridToIsometric(district.x + district.width, district.y + district.height)

        ctx.fillStyle = district.color
        ctx.globalAlpha = 0.06
        ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
        ctx.globalAlpha = 1

        ctx.strokeStyle = district.color
        ctx.globalAlpha = 0.2
        ctx.lineWidth = 1.5
        ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
        ctx.globalAlpha = 1

        const labelX = topLeft.x + (bottomRight.x - topLeft.x) / 2
        const labelY = topLeft.y + 12
        ctx.fillStyle = district.color
        ctx.globalAlpha = 0.5
        ctx.font = 'bold 10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`${district.emoji} ${district.name}`, labelX, labelY)
        ctx.globalAlpha = 1
      }
    }

    // Tiles
    for (let gridX = 0; gridX < GRID_WIDTH; gridX++) {
      for (let gridY = 0; gridY < GRID_HEIGHT; gridY++) {
        const isMainRoad = gridX % 5 === 0 || gridY % 5 === 0
        const isSecondaryRoad = (gridX % 2 === 0 && gridX % 5 !== 0) || (gridY % 2 === 0 && gridY % 5 !== 0)
        const isoPos = gridToIsometric(gridX, gridY)

        if (showGrid && ((gridX % 2 === 0) || (gridY % 2 === 0))) {
          drawTile(ctx, isoPos.x, isoPos.y, '#6b8e7f', false)
        } else if (isMainRoad) {
          drawTile(ctx, isoPos.x, isoPos.y, '#1f2937', false)
          if (gridX % 10 === 0 && gridY % 10 === 0) {
            ctx.fillStyle = '#FFD700'
            ctx.globalAlpha = 0.3
            ctx.fillRect(isoPos.x - 3, isoPos.y - 2, 6, 1)
            ctx.globalAlpha = 1
          }
        } else if (isSecondaryRoad) {
          drawTile(ctx, isoPos.x, isoPos.y, '#374151', false)
        } else {
          drawTile(ctx, isoPos.x, isoPos.y, adjustBrightness('#5a9c69', -8), false)

          // Check for properties at this location
          const gameX = (gridX / GRID_WIDTH) * MAP_WIDTH
          const gameY = (gridY / GRID_HEIGHT) * MAP_HEIGHT
          const prop = properties.find(p => {
            if (!p.location_x || !p.location_y) return false
            const px = p.location_x % 300
            const py = p.location_y % 350
            return Math.abs(px - gameX) < 25 && Math.abs(py - gameY) < 25
          })

          if (prop) {
            const color = PROPERTY_COLORS[prop.property_type] || PROPERTY_COLORS.default
            const upgradeLevel = prop.upgrade_level || 0
            const isHovered = prop.id === hoveredPropertyId
            let displayColor = color
            if (isHovered) displayColor = adjustBrightness(color, 35)
            else if (upgradeLevel > 0) displayColor = adjustBrightness(color, Math.min(45, upgradeLevel * 6))
            drawBuilding(ctx, isoPos.x, isoPos.y, prop.property_type, upgradeLevel > 0 ? upgradeLevel : 1, true)

            if (prop.owner_id) {
              ctx.fillStyle = upgradeLevel > 0 ? '#ffd700' : '#e0e7ff'
              ctx.font = `bold ${upgradeLevel > 0 ? '10px' : '9px'} Arial`
              ctx.textAlign = 'center'
              ctx.fillText(prop.name ? prop.name.substring(0, 8) : 'Prop', isoPos.x, isoPos.y - 3)
              if (upgradeLevel > 0) {
                ctx.fillStyle = '#ffd700'
                ctx.font = 'bold 8px Arial'
                ctx.fillText(`★${upgradeLevel}`, isoPos.x, isoPos.y + 5)
              }
            }
          } else if (showDecor && seededRand(gridX, gridY) > 0.85) {
            // Decorative trees
            ctx.save()
            ctx.fillStyle = '#2d5a3d'
            ctx.beginPath()
            ctx.moveTo(isoPos.x, isoPos.y + 4 - 7)
            ctx.lineTo(isoPos.x + 5, isoPos.y + 4 + 3)
            ctx.lineTo(isoPos.x - 5, isoPos.y + 4 + 3)
            ctx.closePath()
            ctx.fill()
            ctx.fillStyle = '#6b4423'
            ctx.fillRect(isoPos.x - 1, isoPos.y + 4 + 3, 2, 3)
            ctx.restore()
          }
        }
      }
    }

    // Job markers
    Object.entries(JOB_LOCATIONS).forEach(([jobName, loc]) => {
      const isoPos = gridToIsometric(loc.x / 12.5, loc.y / 14.58)
      ctx.save()
      ctx.globalAlpha = 0.75

      const markerGradient = ctx.createRadialGradient(isoPos.x, isoPos.y, 0, isoPos.x, isoPos.y, 16)
      markerGradient.addColorStop(0, 'rgba(255, 193, 7, 0.85)')
      markerGradient.addColorStop(1, 'rgba(255, 193, 7, 0.15)')
      ctx.fillStyle = markerGradient
      ctx.beginPath()
      ctx.arc(isoPos.x, isoPos.y, 16, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffc107'
      ctx.font = 'bold 13px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('⚙️', isoPos.x, isoPos.y)

      ctx.restore()
    })

    // Avatar
    const avatarScreenPosRaw = gameToIsometric(avatarPos.x, avatarPos.y)
    const avatarScreenPos = { x: Math.round(avatarScreenPosRaw.x), y: Math.round(avatarScreenPosRaw.y) }
    drawImprovedAvatar(ctx, avatarScreenPos.x - AVATAR_SIZE / 2, avatarScreenPos.y - AVATAR_SIZE)

    // Particles
    drawParticles(ctx)

    ctx.restore()

    // Day/night cycle
    const cycle = (Date.now() % 600000) / 600000
    const night = Math.abs(Math.sin(cycle * Math.PI))
    ctx.save()
    ctx.fillStyle = `rgba(20, 30, 50, ${0.15 * night})`
    ctx.fillRect(0, 0, width, height)
    ctx.restore()

    // Vignette
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    const vignetteGrad = ctx.createRadialGradient(width / 2, height * 0.45, width * 0.05, width / 2, height * 0.45, Math.max(width, height))
    vignetteGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
    vignetteGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)')
    vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)')
    ctx.fillStyle = vignetteGrad
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }, [cameraPos, gridToIsometric, gameToIsometric, drawTile, drawBuilding, drawImprovedAvatar, avatarPos, showDistricts, showGrid, showDecor, properties, hoveredPropertyId])

  const moveAvatar = useCallback((direction) => {
    const speed = (mapSettings.avatarSpeed ?? 1.3) * 180
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
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const handleClick = (e) => {
      if (isDragging) return
    }

    const handleWheel = (e) => {
      e.preventDefault()
      const zoomSpeed = 0.1
      const newZoom = Math.max(0.5, Math.min(3, zoom + (e.deltaY > 0 ? -zoomSpeed : zoomSpeed)))
      setZoom(newZoom)
    }

    const handleKeyDown = (e) => {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return

      keysPressed.current[e.key.toLowerCase()] = true

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        moveTargetRef.current = null
        e.preventDefault()
      }
    }

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false
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
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000)
      lastTimeRef.current = now

      const zoomTarget = zoom
      zoomRef.current += (zoomTarget - zoomRef.current) * Math.min(1, dt * 8)

      const baseSpeed = (mapSettings.avatarSpeed ?? 1.3) * 180
      const canSprint = (character && typeof character.energy === 'number') ? character.energy > 0 : true
      const sprint = (keysPressed.current['shift'] && canSprint) ? 2.2 : 1
      const moveSpeed = baseSpeed * sprint
      let vx = 0, vy = 0
      if (keysPressed.current['w'] || keysPressed.current['arrowup']) vy -= moveSpeed
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) vy += moveSpeed
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) vx -= moveSpeed
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) vx += moveSpeed

      if (vx !== 0 || vy !== 0) {
        const targetAngle = Math.atan2(vy, vx) * (180 / Math.PI)
        setAvatarAngle(prev => {
          let diff = targetAngle - prev
          if (diff > 180) diff -= 360
          if (diff < -180) diff += 360
          const rotSpeed = Math.min(1, dt * 8)
          const newAngle = prev + diff * Math.min(0.9, rotSpeed + 0.2)
          return (newAngle + 360) % 360
        })
      }

      if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071 }

      if (onConsumeEnergy && sprint > 1 && (vx !== 0 || vy !== 0)) {
        const now = performance.now()
        if (now - lastEnergyDrainRef.current > 400) {
          try { onConsumeEnergy(1) } catch (e) {}
          lastEnergyDrainRef.current = now
        }
      }

      if (vx === 0 && vy === 0 && moveTargetRef.current) {
        const dx = moveTargetRef.current.x - avatarPos.x
        const dy = moveTargetRef.current.y - avatarPos.y
        const dist = Math.hypot(dx, dy)
        if (dist < 2) {
          moveTargetRef.current = null
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

        if (followAvatar) targetCameraRef.current = { x: newX - 75, y: newY - 87 }
        return { x: newX, y: newY }
      })

      setCameraPos(prev => {
        let tx = targetCameraRef.current.x
        let ty = targetCameraRef.current.y
        tx = Math.max(0, Math.min(MAP_WIDTH, tx))
        ty = Math.max(0, Math.min(MAP_HEIGHT, ty))
        const dx = tx - prev.x
        const dy = ty - prev.y
        const dist = Math.hypot(dx, dy)
        const easeFactor = dist < 5 ? 0.1 : 0.2
        const nx = prev.x + dx * easeFactor
        const ny = prev.y + dy * easeFactor
        return { x: nx, y: ny }
      })

      if (avatarMoving && velocityRef.current.x === 0 && velocityRef.current.y === 0) {
        if (avatarAnimationFrame.current % 10 === 0) setAvatarMoving(false)
      }

      avatarAnimationFrame.current++

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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isDragging, zoom, mapSettings, character, followAvatar, onCharacterMove, cityData, selectedCity, draw, onConsumeEnergy])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    })

    resizeObserver.observe(canvas)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-900 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ display: 'block', touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
      />

      {tooltipData && tooltipPos && (
        <div
          className="fixed bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-100 pointer-events-none shadow-lg"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            maxWidth: '200px',
            zIndex: 50
          }}
        >
          <div className="font-bold">{tooltipData.name}</div>
          <div className="text-slate-400">{tooltipData.type}</div>
          {tooltipData.owned && <div className="text-emerald-400 mt-1">✓ Owned</div>}
        </div>
      )}

      {/* Game Controls HUD */}
      <div className="absolute top-4 right-4 flex gap-2">
        <div className="bg-slate-800/80 border border-slate-600 rounded px-3 py-2 text-xs text-slate-300 backdrop-blur">
          <div className="font-semibold mb-1">Zoom: {(zoom * 100).toFixed(0)}%</div>
          <div className="text-slate-400">Scroll wheel to adjust</div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 text-xs text-slate-300 bg-slate-800/60 backdrop-blur border border-slate-600 rounded px-3 py-3">
        <div className="font-semibold mb-2">Controls</div>
        <div className="space-y-1 text-slate-400">
          <div>📍 <kbd className="bg-slate-700 px-1.5 rounded">WASD</kbd> or <kbd className="bg-slate-700 px-1.5 rounded">Arrows</kbd> - Move</div>
          <div>⚡ <kbd className="bg-slate-700 px-1.5 rounded">Shift</kbd> + Move - Sprint</div>
          <div>🔍 Scroll wheel - Zoom in/out</div>
          <div>👆 Drag - Pan camera</div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setZoom(prev => Math.min(3, prev + 0.2))}
          className="w-10 h-10 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded flex items-center justify-center text-white font-bold transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
          className="w-10 h-10 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded flex items-center justify-center text-white font-bold transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setFollowAvatar(!followAvatar)}
          className={`w-10 h-10 border rounded flex items-center justify-center font-bold transition-colors ${
            followAvatar
              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400'
              : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-400'
          }`}
          title={followAvatar ? 'Follow enabled' : 'Follow disabled'}
        >
          👁️
        </button>
      </div>
    </div>
  )
}
