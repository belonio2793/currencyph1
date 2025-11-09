import React, { useEffect, useRef, useState, useCallback } from 'react'
import { PHILIPPINES_CITIES, getCityById, convertLatLngToGameCoords, convertGameCoordsToLatLng } from '../../data/philippinesGeography'

export default function IsometricGameMap({
  properties = [],
  character = null,
  onPropertyClick = null,
  city = 'Manila',
  onCharacterMove = null,
  mapSettings = {},
  cosmetics = null
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
  const [avatarPos, setAvatarPos] = useState({ x: 150, y: 175 })
  const [avatarFacing, setAvatarFacing] = useState(1)
  const [avatarMoving, setAvatarMoving] = useState(false)
  const [selectedCity, setSelectedCity] = useState(city)
  const [cityData, setCityData] = useState(null)
  const keysPressed = useRef({})
  const animationRef = useRef(null)
  const avatarAnimationFrame = useRef(0)

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
    const city = getCityById(selectedCity.toLowerCase().replace(/\s+/g, '-'))
    setCityData(city || null)
  }, [selectedCity])

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

  const drawIsometricTile = useCallback((ctx, screenX, screenY, color, height = 0, isHovered = false) => {
    const w = TILE_SIZE / 2
    const h = TILE_SIZE / 4

    // Main tile with gradient
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + w, screenY + h)
    ctx.lineTo(screenX, screenY + h * 2)
    ctx.lineTo(screenX - w, screenY + h)
    ctx.closePath()
    ctx.fill()

    // Add subtle highlight
    const gradient = ctx.createLinearGradient(screenX - w, screenY, screenX, screenY + h * 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
    ctx.fillStyle = gradient
    ctx.fill()

    // Border
    ctx.strokeStyle = isHovered ? 'rgba(255, 200, 50, 0.9)' : 'rgba(0, 0, 0, 0.2)'
    ctx.lineWidth = isHovered ? 2.5 : 1.5
    ctx.stroke()

    // Add glow effect when hovered
    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 200, 50, 0.3)'
      ctx.lineWidth = 4
      ctx.stroke()
    }

    // 3D height effect
    if (height > 0) {
      ctx.fillStyle = adjustBrightness(color, -25)
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(screenX, screenY - height)
      ctx.lineTo(screenX - w, screenY - height + h)
      ctx.lineTo(screenX - w, screenY + h)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = adjustBrightness(color, -45)
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(screenX + w, screenY + h)
      ctx.lineTo(screenX + w, screenY + h - height)
      ctx.lineTo(screenX, screenY - height)
      ctx.closePath()
      ctx.fill()

      // Add edge highlighting to 3D
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(screenX, screenY - height)
      ctx.lineTo(screenX - w, screenY - height + h)
      ctx.stroke()
    }
  }, [])

  const adjustBrightness = (color, percent) => {
    const num = parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) + amt
    const G = (num >> 8 & 0x00FF) + amt
    const B = (num & 0x0000FF) + amt
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1)
  }

  const drawAvatar = useCallback((ctx, screenX, screenY) => {
    const size = AVATAR_SIZE
    const isRunning = avatarMoving

    // Get cosmetics colors
    const { COSMETICS, getCosmeticOption } = require('../../lib/characterCosmetics')
    const skinColor = cosmetics ? getCosmeticOption('skinTones', cosmetics.skinTone)?.hex : '#fdbf5f'
    const hairColor = cosmetics ? getCosmeticOption('hairColors', cosmetics.hairColor)?.hex : '#1a1a1a'
    const outfit = cosmetics ? COSMETICS.outfits.find(o => o.id === cosmetics.outfit) : null
    const topColor = outfit?.top || '#3f51b5'
    const bottomColor = outfit?.bottom || '#2196f3'

    ctx.save()
    if (avatarFacing === -1) {
      ctx.scale(-1, 1)
      screenX = -screenX - size
    }

    // Draw body (shirt)
    ctx.fillStyle = topColor
    ctx.fillRect(screenX + 4, screenY, size - 8, size / 3)

    // Draw pants/bottom
    ctx.fillStyle = bottomColor
    ctx.fillRect(screenX + 4, screenY + size / 3, size - 8, size / 3)

    // Draw head with skin tone
    ctx.fillStyle = skinColor
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 6, 8, 0, Math.PI * 2)
    ctx.fill()

    // Draw eyes
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(screenX + size / 2 - 2, screenY - 8, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(screenX + size / 2 + 2, screenY - 8, 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw hair
    ctx.fillStyle = hairColor
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 10, 8, Math.PI, 0, true)
    ctx.fill()

    // Draw legs with animation
    const legOffset = isRunning ? Math.sin(avatarAnimationFrame.current * 0.1) * 4 : 0
    ctx.fillStyle = '#333'
    ctx.fillRect(screenX + 6, screenY + size / 3 + size / 3, 5, size / 3 + legOffset)
    ctx.fillRect(screenX + size - 11, screenY + size / 3 + size / 3, 5, size / 3 - legOffset)

    ctx.restore()

    if (isRunning) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.font = 'bold 10px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Moving', screenX + size / 2 - (avatarFacing === -1 ? -size : 0), screenY - 20)
    }
  }, [avatarFacing, avatarMoving, cosmetics])


  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = '#6ba54a'
    ctx.fillRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2

    ctx.save()
    ctx.translate(centerX - cameraPos.x * zoom, centerY - cameraPos.y * zoom)
    ctx.scale(zoom, zoom)

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

    for (let gridX = 0; gridX < GRID_WIDTH; gridX++) {
      for (let gridY = 0; gridY < GRID_HEIGHT; gridY++) {
        const isRoad = gridX % 4 === 0 || gridY % 4 === 0
        const isoPos = gridToIsometric(gridX, gridY)

        if (isRoad) {
          ctx.fillStyle = '#4a5568'
          ctx.globalAlpha = 0.6
          drawIsometricTile(ctx, isoPos.x, isoPos.y, '#4a5568', 0, false)
          ctx.globalAlpha = 1
        } else {
          const gameX = (gridX / GRID_WIDTH) * MAP_WIDTH
          const gameY = (gridY / GRID_HEIGHT) * MAP_HEIGHT
          const prop = getPropertyAtGamePos(gameX, gameY)

          if (prop) {
            const color = PROPERTY_COLORS[prop.property_type] || PROPERTY_COLORS.default
            const upgradeLevel = prop.upgrade_level || 0
            // Height increases with upgrade level: base 3px + 2px per upgrade level
            const baseHeight = 3 + (upgradeLevel * 2)
            const valueHeight = Math.min(10, Math.log(prop.current_value || 100000) / 10)
            const height = baseHeight + valueHeight
            const isHovered = prop.id === hoveredPropertyId
            const isOwned = prop.owner_id

            // Brighten color based on upgrade level
            let displayColor = color
            if (isHovered) {
              displayColor = adjustBrightness(color, 30)
            } else if (upgradeLevel > 0) {
              displayColor = adjustBrightness(color, Math.min(40, upgradeLevel * 5))
            }

            drawIsometricTile(
              ctx,
              isoPos.x,
              isoPos.y,
              displayColor,
              isOwned ? height : 0,
              isHovered || upgradeLevel > 0
            )

            // Show property name and tier indicator
            if (isOwned) {
              ctx.fillStyle = upgradeLevel > 0 ? '#ffd700' : 'white'
              ctx.font = `bold ${upgradeLevel > 0 ? '11px' : '10px'} Arial`
              ctx.textAlign = 'center'
              ctx.fillText(
                prop.name ? prop.name.substring(0, 10) : 'Prop',
                isoPos.x,
                isoPos.y - 3
              )

              // Draw tier indicator
              if (upgradeLevel > 0) {
                ctx.fillStyle = '#ffd700'
                ctx.font = 'bold 8px Arial'
                ctx.fillText(
                  `★${upgradeLevel}`,
                  isoPos.x,
                  isoPos.y + 5
                )
              }
            }
          } else {
            drawIsometricTile(ctx, isoPos.x, isoPos.y, adjustBrightness('#6ba54a', -10), 0, false)
          }
        }
      }
    }

    const avatarScreenPos = gameToIsometric(avatarPos.x, avatarPos.y)
    drawAvatar(ctx, avatarScreenPos.x - AVATAR_SIZE / 2, avatarScreenPos.y - AVATAR_SIZE)

    ctx.restore()
  }, [cameraPos, zoom, hoveredPropertyId, properties, gridToIsometric, gameToIsometric, getPropertyAtGamePos, drawIsometricTile, drawAvatar, avatarPos])

  const moveAvatar = useCallback((direction) => {
    const speed = mapSettings.avatarSpeed || 2
    const maxX = MAP_WIDTH
    const maxY = MAP_HEIGHT

    setAvatarPos(prev => {
      let newX = prev.x
      let newY = prev.y
      let newFacing = avatarFacing

      switch (direction) {
        case 'up':
          newY = Math.max(0, prev.y - speed)
          break
        case 'down':
          newY = Math.min(maxY, prev.y + speed)
          break
        case 'left':
          newX = Math.max(0, prev.x - speed)
          newFacing = -1
          break
        case 'right':
          newX = Math.min(maxX, prev.x + speed)
          newFacing = 1
          break
        default:
          return prev
      }

      setAvatarFacing(newFacing)
      setAvatarMoving(true)

      if (onCharacterMove) {
        if (cityData) {
          const latLng = convertGameCoordsToLatLng(newX, newY, cityData, MAP_WIDTH, MAP_HEIGHT)
          onCharacterMove({ x: newX, y: newY, lat: latLng.lat, lng: latLng.lng, city: selectedCity })
        } else {
          onCharacterMove({ x: newX, y: newY, city: selectedCity })
        }
      }

      setCameraPos({ x: newX - 75, y: newY - 87 })

      return { x: newX, y: newY }
    })
  }, [avatarFacing, mapSettings, onCharacterMove, cityData, selectedCity])

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
        setCameraPos(prev => ({
          x: prev.x - deltaX,
          y: prev.y - deltaY
        }))
        setDragStart({ x: e.clientX, y: e.clientY })
      } else {
        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const isoX = (clientX - centerX) / zoom + cameraPos.x
        const isoY = (clientY - centerY) / zoom + cameraPos.y

        const gridPos = isometricToGrid(isoX, isoY)
        const gameX = (gridPos.x / GRID_WIDTH) * MAP_WIDTH
        const gameY = (gridPos.y / GRID_HEIGHT) * MAP_HEIGHT
        // Don't show hover effects or tooltips
        // Tiles are managed via the Properties tab instead
        setHoveredPropertyId(null)
        setTooltipData(null)
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
      }
    }

    const handleWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)))
    }

    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          moveAvatar('up')
          e.preventDefault()
          break
        case 's':
        case 'arrowdown':
          moveAvatar('down')
          e.preventDefault()
          break
        case 'a':
        case 'arrowleft':
          moveAvatar('left')
          e.preventDefault()
          break
        case 'd':
        case 'arrowright':
          moveAvatar('right')
          e.preventDefault()
          break
        default:
          break
      }
    }

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    const animate = () => {
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
  }, [draw, isometricToGrid, getPropertyAtGamePos, onPropertyClick, cameraPos, zoom, isDragging, dragStart, moveAvatar])

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
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div ref={containerRef} className="flex-1 relative bg-gradient-to-b from-green-300 to-green-100" style={{ overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-grab active:cursor-grabbing"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  )
}
