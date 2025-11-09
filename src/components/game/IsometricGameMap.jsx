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
  initialAvatarPos = null
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
  const [avatarFacing, setAvatarFacing] = useState(1)
  const [avatarMoving, setAvatarMoving] = useState(false)
  const [selectedCity, setSelectedCity] = useState(city)
  const [cityData, setCityData] = useState(null)
  const [showControls, setShowControls] = useState(true)
  const [followAvatar, setFollowAvatar] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const keysPressed = useRef({})
  const animationRef = useRef(null)
  const avatarAnimationFrame = useRef(0)
  const particlesRef = useRef([])
  const ambientParticlesRef = useRef([])
  const velocityRef = useRef({ x: 0, y: 0 })
  const moveTargetRef = useRef(null)
  const showControlsRef = useRef(true)
  const targetCameraRef = useRef({ x: 0, y: 0 })

  const TILE_SIZE = 64
  const GRID_WIDTH = 24
  const GRID_HEIGHT = 18
  const AVATAR_SIZE = 32
  const MAP_WIDTH = 300
  const MAP_HEIGHT = 350

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

    if (avatarFacing === -1) {
      ctx.scale(-1, 1)
      screenX = -screenX - size
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
    // Rotate when working
    if (isWorking) {
      const rotation = (avatarAnimationFrame.current * 0.08) % (Math.PI * 2)
      ctx.translate(screenX + size / 2, screenY + size / 2)
      ctx.rotate(rotation)
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

    // legs with idle sway
    const legOffset = isRunning && !isWorking ? Math.sin(avatarAnimationFrame.current * 0.1) * 4 :
                      !isWorking ? Math.sin(avatarAnimationFrame.current * 0.03) * 1.5 : 0
    const idleBob = !isRunning && !isWorking ? Math.sin(avatarAnimationFrame.current * 0.02) * 0.5 : 0
    ctx.fillStyle = '#333'
    ctx.fillRect(screenX + 6, screenY + (2 * size) / 3 + idleBob, 5, size / 3 + legOffset)
    ctx.fillRect(screenX + size - 11, screenY + (2 * size) / 3 + idleBob, 5, size / 3 - legOffset)

    ctx.restore()
    ctx.restore()

    if (isRunning && !isWorking) {
      // speed trail particles
      particlesRef.current.push({
        x: screenX + size / 2 + (avatarFacing === -1 ? -6 : 6),
        y: screenY + size / 2,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -0.8 - Math.random() * 0.6,
        life: 24,
        color: 'rgba(59,130,246,0.7)'
      })
    }

    // Working particles - energy burst effect
    if (isWorking) {
      particlesRef.current.push({
        x: screenX + size / 2 + (Math.random() - 0.5) * 20,
        y: screenY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - 0.5,
        life: 30,
        color: `rgba(255, 200, 0, 0.8)`
      })
    }
  }, [avatarFacing, avatarMoving, cosmetics, isWorking])

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

    ctx.save()
    ctx.translate(centerX - cameraPos.x * zoom, centerY - cameraPos.y * zoom)
    ctx.scale(zoom, zoom)

    // neighborhoods background blocks
    for (let neighborhood of Object.values(NEIGHBORHOODS)) {
      const topLeft = gridToIsometric(neighborhood.bounds.x0, neighborhood.bounds.y0)
      const bottomRight = gridToIsometric(neighborhood.bounds.x1, neighborhood.bounds.y1)
      ctx.fillStyle = neighborhood.color
      ctx.fillRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      )
    }

    // tiles and optional grid overlay
    for (let gridX = 0; gridX < GRID_WIDTH; gridX++) {
      for (let gridY = 0; gridY < GRID_HEIGHT; gridY++) {
        const isRoad = gridX % 4 === 0 || gridY % 4 === 0
        const isoPos = gridToIsometric(gridX, gridY)

        if (showGrid && ((gridX % 2 === 0) || (gridY % 2 === 0))) {
          drawIsometricTile(ctx, isoPos.x, isoPos.y, '#7b8794', 0, false)
        } else if (isRoad) {
          drawIsometricTile(ctx, isoPos.x, isoPos.y, '#4a5568', 0, false)
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
          }
        }
      }
    }

    // avatar
    const avatarScreenPos = gameToIsometric(avatarPos.x, avatarPos.y)
    drawAvatar(ctx, avatarScreenPos.x - AVATAR_SIZE / 2, avatarScreenPos.y - AVATAR_SIZE)

    // particles
    drawParticles(ctx)

    ctx.restore()

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

  }, [cameraPos, zoom, hoveredPropertyId, properties, gridToIsometric, gameToIsometric, getPropertyAtGamePos, drawIsometricTile, drawAvatar, avatarPos])

  const moveAvatar = useCallback((direction) => {
    const speed = mapSettings.avatarSpeed || 3

    // Set velocity based on direction
    switch (direction) {
      case 'up':
        velocityRef.current.y = -speed
        break
      case 'down':
        velocityRef.current.y = speed
        break
      case 'left':
        velocityRef.current.x = -speed
        setAvatarFacing(-1)
        break
      case 'right':
        velocityRef.current.x = speed
        setAvatarFacing(1)
        break
      default:
        break
    }

    setAvatarMoving(true)
  }, [mapSettings, avatarFacing])

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
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)))
    }

    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true

      // cancel click-to-move on manual input
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
        moveTargetRef.current = null
      }

      // Prevent default scroll behavior
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
      // Determine velocity from keys or click-to-move
      const baseSpeed = mapSettings.avatarSpeed || 3
      const sprint = keysPressed.current['shift'] ? 1.8 : 1
      let vx = 0, vy = 0
      if (keysPressed.current['w'] || keysPressed.current['arrowup']) vy -= baseSpeed * sprint
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) vy += baseSpeed * sprint
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) { vx -= baseSpeed * sprint; setAvatarFacing(-1) }
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) { vx += baseSpeed * sprint; setAvatarFacing(1) }

      // Normalize diagonal movement
      if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071 }

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
          setAvatarFacing(dx < 0 ? -1 : 1)
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

      // smooth camera approach
      setCameraPos(prev => {
        const tx = targetCameraRef.current.x
        const ty = targetCameraRef.current.y
        const nx = prev.x + (tx - prev.x) * 0.1
        const ny = prev.y + (ty - prev.y) * 0.1
        return { x: nx, y: ny }
      })

      // stop running state gradually if no velocity
      if (avatarMoving && velocityRef.current.x === 0 && velocityRef.current.y === 0) {
        if (avatarAnimationFrame.current % 10 === 0) setAvatarMoving(false)
      }

      avatarAnimationFrame.current++
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
  }, [draw, isometricToGrid, getPropertyAtGamePos, onPropertyClick, cameraPos, zoom, isDragging, dragStart, moveAvatar, avatarMoving])

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
        />


        {/* Collapsible Minimap */}
        <CollapsibleMinimap
          properties={properties}
          character={character}
          avatarPos={avatarPos}
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
            className="px-2 py-1 text-xs bg-white/80 border border-slate-300 rounded hover:bg-white"
            title="Zoom out"
          >−</button>
          <button
            onClick={() => setZoom(z => Math.max(0.5, Math.min(3, z * 1.1)))}
            className="px-2 py-1 text-xs bg-white/80 border border-slate-300 rounded hover:bg-white"
            title="Zoom in"
          >+</button>
          <button
            onClick={() => setFollowAvatar(v => !v)}
            className={`px-2 py-1 text-xs rounded border ${followAvatar ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white/80 border-slate-300'}`}
            title="Toggle camera follow"
          >Follow</button>
          <button
            onClick={() => setShowGrid(v => !v)}
            className={`px-2 py-1 text-xs rounded border ${showGrid ? 'bg-blue-600 text-white border-blue-700' : 'bg-white/80 border-slate-300'}`}
            title="Toggle grid overlay"
          >Grid</button>
        </div>

        {/* Tooltip */}
        {tooltipPos && tooltipData && (
          <div
            className="absolute z-30 bg-slate-900/90 border border-slate-700 rounded p-2 text-xs text-slate-200 shadow-xl"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className="font-semibold text-slate-100">{tooltipData.name}</div>
            <div className="text-[10px] text-slate-400 capitalize">{tooltipData.type}</div>
            {tooltipData.owned && (
              <div className="mt-1 space-y-0.5">
                <div>Income: ₱{Number(tooltipData.income || 0).toLocaleString()}</div>
                <div>Value: ₱{Number(tooltipData.value || 0).toLocaleString()}</div>
                <div>Tier: {tooltipData.upgrade}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
