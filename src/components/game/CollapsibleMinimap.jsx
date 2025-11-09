import React, { useState, useRef, useEffect, useCallback } from 'react'

export default function CollapsibleMinimap({
  properties = [],
  character = null,
  avatarPos = { x: 150, y: 175 },
  zoom = 1,
  cameraPos = { x: 0, y: 0 },
  onMinimapClick = null,
  city = 'Manila'
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const MAP_WIDTH = 300
  const MAP_HEIGHT = 350
  const MINI_MAP_WIDTH = isExpanded ? 250 : 80
  const MINI_MAP_HEIGHT = isExpanded ? 200 : 65

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, MINI_MAP_WIDTH, MINI_MAP_HEIGHT)

    // Draw background
    const gradient = ctx.createLinearGradient(0, 0, MINI_MAP_WIDTH, MINI_MAP_HEIGHT)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(1, '#16213e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, MINI_MAP_WIDTH, MINI_MAP_HEIGHT)

    // Draw grid
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.15)'
    ctx.lineWidth = 0.5
    const gridStep = isExpanded ? 25 : 10
    for (let i = 0; i <= MINI_MAP_WIDTH; i += gridStep) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, MINI_MAP_HEIGHT)
      ctx.stroke()
    }
    for (let i = 0; i <= MINI_MAP_HEIGHT; i += gridStep) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(MINI_MAP_WIDTH, i)
      ctx.stroke()
    }

    // Draw properties
    const scaleX = MINI_MAP_WIDTH / MAP_WIDTH
    const scaleY = MINI_MAP_HEIGHT / MAP_HEIGHT

    properties.forEach(prop => {
      if (!prop.location_x || !prop.location_y) return

      const px = (prop.location_x % MAP_WIDTH) * scaleX
      const py = (prop.location_y % MAP_HEIGHT) * scaleY
      const size = isExpanded ? 6 : 3

      const color = PROPERTY_COLORS[prop.property_type] || PROPERTY_COLORS.default
      ctx.fillStyle = color
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.arc(px, py, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
    })

    // Draw character avatar
    if (character || avatarPos) {
      const charX = (avatarPos.x % MAP_WIDTH) * scaleX
      const charY = (avatarPos.y % MAP_HEIGHT) * scaleY

      // Glow effect
      const glowGradient = ctx.createRadialGradient(charX, charY, 0, charX, charY, isExpanded ? 12 : 6)
      glowGradient.addColorStop(0, 'rgba(100, 200, 255, 0.6)')
      glowGradient.addColorStop(1, 'rgba(100, 200, 255, 0)')
      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(charX, charY, isExpanded ? 12 : 6, 0, Math.PI * 2)
      ctx.fill()

      // Avatar circle
      ctx.fillStyle = '#00d4ff'
      ctx.beginPath()
      ctx.arc(charX, charY, isExpanded ? 5 : 2.5, 0, Math.PI * 2)
      ctx.fill()

      // Avatar border
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Draw camera view (viewport indicator)
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)'
    ctx.lineWidth = isExpanded ? 2 : 1
    const viewportSize = Math.min(MINI_MAP_WIDTH * 0.3, MINI_MAP_HEIGHT * 0.3)
    const viewportX = (cameraPos.x / MAP_WIDTH) * MINI_MAP_WIDTH
    const viewportY = (cameraPos.y / MAP_HEIGHT) * MINI_MAP_HEIGHT
    ctx.strokeRect(
      viewportX - viewportSize / 2,
      viewportY - viewportSize / 2,
      viewportSize,
      viewportSize
    )

    // Draw border
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, MINI_MAP_WIDTH, MINI_MAP_HEIGHT)

  }, [properties, character, avatarPos, cameraPos, isExpanded])

  const handleMinimapClick = (e) => {
    if (!canvasRef.current || !onMinimapClick) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Convert minimap coordinates back to game world
    const worldX = (x / MINI_MAP_WIDTH) * MAP_WIDTH
    const worldY = (y / MINI_MAP_HEIGHT) * MAP_HEIGHT

    onMinimapClick({ x: worldX, y: worldY })
  }

  return (
    <div
      ref={containerRef}
      className={`absolute top-2 left-2 transition-all duration-300 z-40 ${
        isExpanded ? 'w-64 h-52' : 'w-24 h-20'
      }`}
      style={{
        background: 'rgba(20, 20, 40, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '2px solid rgba(150, 200, 255, 0.5)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(100, 200, 255, 0.1)',
        padding: '8px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2" style={{ height: '24px' }}>
        {isExpanded && (
          <h3 className="text-xs font-bold text-cyan-300" style={{ textShadow: '0 0 10px rgba(0, 212, 255, 0.5)' }}>
            MINIMAP
          </h3>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-auto p-1 rounded hover:bg-cyan-500/20 transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <span className="text-cyan-300 text-xs font-bold">
            {isExpanded ? '−' : '+'}
          </span>
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={MINI_MAP_WIDTH}
        height={MINI_MAP_HEIGHT}
        onClick={handleMinimapClick}
        className="w-full border border-cyan-500/30 rounded bg-slate-900 cursor-crosshair"
        style={{
          display: 'block',
          imageRendering: 'pixelated'
        }}
      />

      {/* Legend */}
      {isExpanded && (
        <div className="mt-2 text-xs space-y-1" style={{ color: 'rgba(150, 200, 255, 0.7)' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00d4ff' }}></span>
            <span>Player</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2196f3' }}></span>
            <span>Business</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ff9800' }}></span>
            <span>House</span>
          </div>
        </div>
      )}

      {/* Expanded Info */}
      {isExpanded && character && (
        <div className="mt-2 pt-2 border-t border-cyan-500/20 text-xs" style={{ color: 'rgba(150, 200, 255, 0.6)' }}>
          <div>Level {character.level || 1}</div>
          <div>{character.properties?.length || 0} properties</div>
        </div>
      )}
    </div>
  )
}
