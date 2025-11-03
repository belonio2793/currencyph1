import React, { useEffect, useRef, useState, useCallback } from 'react'

export default function IsometricGameMap({
  properties = [],
  character = null,
  onPropertyClick = null,
  city = 'Manila'
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [hoveredPropertyId, setHoveredPropertyId] = useState(null)
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [tooltipPos, setTooltipPos] = useState(null)
  const [tooltipData, setTooltipData] = useState(null)
  const keysPressed = useRef({})
  const animationRef = useRef(null)

  const TILE_SIZE = 64
  const GRID_WIDTH = 24
  const GRID_HEIGHT = 18
  const STREET_WIDTH = 0.2
  const STREET_COLOR = '#4a5568'
  const GRASS_COLOR = '#6ba54a'

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

  const gridToIsometric = useCallback((gridX, gridY) => {
    const isoX = (gridX - gridY) * (TILE_SIZE / 2)
    const isoY = (gridX + gridY) * (TILE_SIZE / 4)
    return { x: isoX, y: isoY }
  }, [])

  const isometricToGrid = useCallback((isoX, isoY) => {
    const col = (isoX / (TILE_SIZE / 2))
    const row = (isoY / (TILE_SIZE / 4))
    const gridX = (col + row) / 2
    const gridY = (row - col) / 2
    return { x: Math.round(gridX), y: Math.round(gridY) }
  }, [])

  const getPropertyAtGridPos = useCallback((gridX, gridY) => {
    if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) return null
    return properties.find(p => {
      if (!p.location_x || !p.location_y) return false
      const px = Math.floor((p.location_x % 300) / (300 / GRID_WIDTH))
      const py = Math.floor((p.location_y % 350) / (350 / GRID_HEIGHT))
      const px2 = Math.round(px)
      const py2 = Math.round(py)
      return (px2 === gridX || px2 === gridX - 1 || px2 === gridX + 1) &&
             (py2 === gridY || py2 === gridY - 1 || py2 === gridY + 1)
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

  const drawLegend = useCallback((ctx, width, height) => {
    const legendX = 20
    const legendY = 20
    const itemHeight = 24
    const boxSize = 12

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(legendX - 10, legendY - 10, 200, 180)

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.strokeRect(legendX - 10, legendY - 10, 200, 180)

    ctx.fillStyle = 'white'
    ctx.font = 'bold 14px Arial'
    ctx.fillText('Property Types', legendX, legendY + 15)

    let y = legendY + 40
    Object.entries(PROPERTY_COLORS).forEach(([type, color]) => {
      if (type === 'default') return
      ctx.fillStyle = color
      ctx.fillRect(legendX, y, boxSize, boxSize)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(legendX, y, boxSize, boxSize)

      ctx.fillStyle = '#ccc'
      ctx.font = '12px Arial'
      ctx.fillText(type.charAt(0).toUpperCase() + type.slice(1), legendX + 20, y + 10)
      y += itemHeight
    })

    ctx.fillStyle = '#aaa'
    ctx.font = '11px Arial'
    ctx.fillText('Click properties to manage', legendX, height - 30)
    ctx.fillText('Right-click to center', legendX, height - 10)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = GRASS_COLOR
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
          ctx.fillStyle = STREET_COLOR
          ctx.globalAlpha = 0.6
          drawIsometricTile(ctx, isoPos.x, isoPos.y, STREET_COLOR, 0, false)
          ctx.globalAlpha = 1
        } else {
          const prop = getPropertyAtGridPos(gridX, gridY)
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
            drawIsometricTile(ctx, isoPos.x, isoPos.y, adjustBrightness(GRASS_COLOR, -10), 0, false)
          }
        }
      }
    }

    ctx.restore()
    drawLegend(ctx, width, height)
  }, [cameraPos, zoom, hoveredPropertyId, properties, gridToIsometric, getPropertyAtGridPos, drawIsometricTile, drawLegend])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const clientX = e.clientX - rect.left
      const clientY = e.clientY - rect.top

      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const isoX = (clientX - centerX) / zoom + cameraPos.x
      const isoY = (clientY - centerY) / zoom + cameraPos.y

      const gridPos = isometricToGrid(isoX, isoY)
      const prop = getPropertyAtGridPos(Math.round(gridPos.x), Math.round(gridPos.y))

      if (prop) {
        setHoveredPropertyId(prop.id)
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        setTooltipData(prop)
      } else {
        setHoveredPropertyId(null)
        setTooltipData(null)
      }
    }

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      const clientX = e.clientX - rect.left
      const clientY = e.clientY - rect.top

      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const isoX = (clientX - centerX) / zoom + cameraPos.x
      const isoY = (clientY - centerY) / zoom + cameraPos.y

      const gridPos = isometricToGrid(isoX, isoY)
      const prop = getPropertyAtGridPos(Math.round(gridPos.x), Math.round(gridPos.y))

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
    }

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    const animate = () => {
      const speed = 50 / zoom
      let moved = false

      if (keysPressed.current['arrowup'] || keysPressed.current['w']) {
        setCameraPos(prev => ({ ...prev, y: prev.y - speed }))
        moved = true
      }
      if (keysPressed.current['arrowdown'] || keysPressed.current['s']) {
        setCameraPos(prev => ({ ...prev, y: prev.y + speed }))
        moved = true
      }
      if (keysPressed.current['arrowleft'] || keysPressed.current['a']) {
        setCameraPos(prev => ({ ...prev, x: prev.x - speed }))
        moved = true
      }
      if (keysPressed.current['arrowright'] || keysPressed.current['d']) {
        setCameraPos(prev => ({ ...prev, x: prev.x + speed }))
        moved = true
      }

      draw()
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(animationRef.current)
    }
  }, [draw, gridToIsometric, isometricToGrid, getPropertyAtGridPos, onPropertyClick, cameraPos, zoom])

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

  return (
    <div ref={containerRef} className="w-full h-full relative bg-gradient-to-b from-green-300 to-green-100" style={{ overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-move"
        style={{ display: 'block' }}
      />

      {tooltipData && tooltipPos && (
        <div
          className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-600 text-xs pointer-events-none shadow-lg z-10"
          style={{
            left: `${tooltipPos.x + 10}px`,
            top: `${tooltipPos.y + 10}px`,
            maxWidth: '200px'
          }}
        >
          <p className="font-bold text-sm mb-1">{tooltipData.name || 'Property'}</p>
          <p className="text-slate-300 text-xs">Type: {tooltipData.property_type}</p>
          <p className="text-yellow-400 text-xs">Value: P{(tooltipData.current_value || 0).toLocaleString()}</p>
          {tooltipData.owner_id && <p className="text-green-400 text-xs">Owned ✓</p>}
          {!tooltipData.owner_id && <p className="text-blue-400 text-xs">Available for purchase</p>}
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-slate-800/80 text-slate-300 px-4 py-3 rounded-lg border border-slate-600 text-xs pointer-events-none">
        <p className="font-bold text-white mb-1">Controls</p>
        <p>🖱️ Scroll to zoom</p>
        <p>⌨️ WASD or Arrow Keys to pan</p>
        <p>🖱️ Click property to manage</p>
        <p className="text-slate-400 mt-2">📍 {city} • 🏠 {properties.length} properties</p>
      </div>

      <div className="absolute top-4 right-4 bg-slate-800/80 text-slate-300 px-4 py-2 rounded-lg border border-slate-600 text-xs pointer-events-none">
        <p>Zoom: {(zoom * 100).toFixed(0)}%</p>
        <p>Pan: {Math.round(cameraPos.x)}, {Math.round(cameraPos.y)}</p>
      </div>
    </div>
  )
}
