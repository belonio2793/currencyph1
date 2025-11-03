import React, { useEffect, useRef, useState, useCallback } from 'react'
import { PHILIPPINES_CITIES, getCityById, convertLatLngToGameCoords, convertGameCoordsToLatLng } from '../../data/philippinesGeography'

export default function IsometricGameMap({
  properties = [],
  character = null,
  onPropertyClick = null,
  city = 'Manila',
  onCharacterMove = null,
  mapSettings = {}
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

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(screenX, screenY)
    ctx.lineTo(screenX + w, screenY + h)
    ctx.lineTo(screenX, screenY + h * 2)
    ctx.lineTo(screenX - w, screenY + h)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = isHovered ? 'rgba(255, 255, 0, 0.8)' : 'rgba(0, 0, 0, 0.15)'
    ctx.lineWidth = isHovered ? 2 : 1
    ctx.stroke()

    if (height > 0) {
      ctx.fillStyle = adjustBrightness(color, -20)
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(screenX, screenY - height)
      ctx.lineTo(screenX - w, screenY - height + h)
      ctx.lineTo(screenX - w, screenY + h)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = adjustBrightness(color, -40)
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(screenX + w, screenY + h)
      ctx.lineTo(screenX + w, screenY + h - height)
      ctx.lineTo(screenX, screenY - height)
      ctx.closePath()
      ctx.fill()
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

    ctx.save()
    if (avatarFacing === -1) {
      ctx.scale(-1, 1)
      screenX = -screenX - size
    }

    ctx.fillStyle = '#ff6b6b'
    ctx.fillRect(screenX + 4, screenY, size - 8, size / 3)

    ctx.fillStyle = '#fdbf5f'
    ctx.beginPath()
    ctx.arc(screenX + size / 2, screenY - 6, 8, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.arc(screenX + size / 2 - 2, screenY - 8, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(screenX + size / 2 + 2, screenY - 8, 2, 0, Math.PI * 2)
    ctx.fill()

    const legOffset = isRunning ? Math.sin(avatarAnimationFrame.current * 0.1) * 4 : 0
    ctx.fillStyle = '#333'
    ctx.fillRect(screenX + 6, screenY + size / 3, 5, size / 2 + legOffset)
    ctx.fillRect(screenX + size - 11, screenY + size / 3, 5, size / 2 - legOffset)

    ctx.restore()

    if (isRunning) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = 'bold 10px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('🏃', screenX + size / 2 - (avatarFacing === -1 ? -size : 0), screenY - 20)
    }
  }, [avatarFacing, avatarMoving])

  const drawLegend = useCallback((ctx, width, height) => {
    const legendX = 20
    const legendY = 20
    const itemHeight = 22
    const boxSize = 14
    const legendWidth = 230

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(legendX - 10, legendY - 10, legendWidth, 190)

    ctx.strokeStyle = 'rgba(100, 150, 200, 0.4)'
    ctx.lineWidth = 2
    ctx.strokeRect(legendX - 10, legendY - 10, legendWidth, 190)

    ctx.fillStyle = '#60a5fa'
    ctx.font = 'bold 14px Arial'
    ctx.fillText('Property Types', legendX, legendY + 15)

    let y = legendY + 38
    const colorEntries = Object.entries(PROPERTY_COLORS).filter(([type]) => type !== 'default')
    colorEntries.forEach(([type, color]) => {
      ctx.fillStyle = color
      ctx.fillRect(legendX, y - 10, boxSize, boxSize)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(legendX, y - 10, boxSize, boxSize)

      ctx.fillStyle = '#e0e7ff'
      ctx.font = '11px Arial'
      ctx.fillText(type.charAt(0).toUpperCase() + type.slice(1), legendX + 24, y - 2)
      y += itemHeight
    })

    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px Arial'
    ctx.fillText('Drag map • Click properties', legendX, height - 40)
    ctx.fillText(`${selectedCity} • WASD to move avatar`, legendX, height - 25)
  }, [selectedCity])

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
            const height = Math.min(20, 5 + Math.log(prop.current_value || 100000) / 10)
            const isHovered = prop.id === hoveredPropertyId
            const isOwned = prop.owner_id

            drawIsometricTile(
              ctx,
              isoPos.x,
              isoPos.y,
              isHovered ? adjustBrightness(color, 30) : color,
              isOwned ? height : 0,
              isHovered
            )

            if (isHovered || prop.owner_id) {
              ctx.fillStyle = 'white'
              ctx.font = 'bold 10px Arial'
              ctx.textAlign = 'center'
              ctx.fillText(
                prop.name ? prop.name.substring(0, 10) : 'Prop',
                isoPos.x,
                isoPos.y
              )
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
    drawLegend(ctx, width, height)
  }, [cameraPos, zoom, hoveredPropertyId, properties, gridToIsometric, gameToIsometric, getPropertyAtGamePos, drawIsometricTile, drawAvatar, drawLegend, avatarPos, selectedCity])

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

        <div className="absolute top-4 left-4 bg-slate-800/80 text-slate-300 px-4 py-3 rounded-lg border border-slate-600 text-xs pointer-events-auto z-20">
          <p className="font-bold text-white mb-2">City Selection</p>
          <div className="space-y-1">
            {PHILIPPINES_CITIES.slice(0, 3).map(c => (
              <button
                key={c.id}
                onClick={() => handleCityChange(c.name)}
                className={`block w-full text-left px-2 py-1 rounded transition-colors ${
                  selectedCity === c.name
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute top-4 right-4 bg-slate-800/80 text-slate-300 px-4 py-2 rounded-lg border border-slate-600 text-xs pointer-events-none">
          <p>📍 Pos: ({Math.round(avatarPos.x)}, {Math.round(avatarPos.y)})</p>
          <p>🔍 Zoom: {(zoom * 100).toFixed(0)}%</p>
        </div>
      </div>

      <div className="bg-slate-800 border-t border-slate-700 text-slate-300 px-4 py-3 text-xs">
        <p className="font-bold text-white mb-2">Controls</p>
        <div className="grid grid-cols-3 gap-4">
          <p>🖱️ Drag to pan • Scroll to zoom</p>
          <p>⌨️ WASD or Arrows to move avatar</p>
          <p>🖱️ Click property to manage</p>
        </div>
      </div>
    </div>
  )
}
