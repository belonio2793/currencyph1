import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'

const TILE_WIDTH = 64
const TILE_HEIGHT = 32

export class IsometricTileRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })
    this.tileCache = new Map()
    this.maxCacheSize = 100
  }

  screenToIsometric(x, y) {
    const ix = (x / TILE_WIDTH + y / TILE_HEIGHT) / 2
    const iy = (y / TILE_HEIGHT - x / TILE_WIDTH) / 2
    return { ix: Math.floor(ix), iy: Math.floor(iy) }
  }

  isometricToScreen(ix, iy) {
    const x = (ix - iy) * (TILE_WIDTH / 2)
    const y = (ix + iy) * (TILE_HEIGHT / 2)
    return { x, y }
  }

  drawTile(ix, iy, type = 'grass', color = '#90EE90') {
    const { x, y } = this.isometricToScreen(ix, iy)
    const centerX = x + this.canvas.width / 2
    const centerY = y + this.canvas.height / 2

    const points = [
      { x: centerX, y: centerY - TILE_HEIGHT / 2 },
      { x: centerX + TILE_WIDTH / 2, y: centerY },
      { x: centerX, y: centerY + TILE_HEIGHT / 2 },
      { x: centerX - TILE_WIDTH / 2, y: centerY }
    ]

    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y)
    }
    this.ctx.closePath()
    this.ctx.fill()

    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    this.ctx.lineWidth = 1
    this.ctx.stroke()
  }

  drawBuilding(ix, iy, building) {
    const { x, y } = this.isometricToScreen(ix, iy)
    const centerX = x + this.canvas.width / 2
    const centerY = y + this.canvas.height / 2

    const width = TILE_WIDTH * 0.8
    const height = TILE_HEIGHT * building.height

    this.ctx.fillStyle = building.color || '#8B4513'
    this.ctx.fillRect(centerX - width / 2, centerY - height, width, height)

    this.ctx.strokeStyle = '#000'
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(centerX - width / 2, centerY - height, width, height)

    if (building.emoji) {
      this.ctx.font = 'bold 20px Arial'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText(building.emoji, centerX, centerY - height / 2)
    }
  }

  drawCharacter(ix, iy, character) {
    const { x, y } = this.isometricToScreen(ix, iy)
    const centerX = x + this.canvas.width / 2
    const centerY = y + this.canvas.height / 2

    this.ctx.fillStyle = '#FF6B6B'
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, 8, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.strokeStyle = '#FF0000'
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    this.ctx.fillStyle = '#fff'
    this.ctx.font = 'bold 16px Arial'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('🧑', centerX, centerY)
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  manageCacheSize() {
    if (this.tileCache.size > this.maxCacheSize) {
      const entriesToDelete = this.tileCache.size - this.maxCacheSize + 10
      let deleted = 0
      for (const key of this.tileCache.keys()) {
        if (deleted >= entriesToDelete) break
        this.tileCache.delete(key)
        deleted++
      }
    }
  }
}

export default function IsometricMapOptimizer({
  character,
  properties = [],
  gridSize = 32,
  onTileClick,
  zoom = 1,
  cameraX = 0,
  cameraY = 0,
  onCameraMove
}) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const animationFrameRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [displayedTiles, setDisplayedTiles] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (!rendererRef.current) {
      rendererRef.current = new IsometricTileRenderer(canvas)
    }

    const renderer = rendererRef.current
    const visibleRange = Math.ceil(Math.sqrt(Math.pow(canvas.width, 2) + Math.pow(canvas.height, 2)) / Math.hypot(TILE_WIDTH, TILE_HEIGHT)) + 5

    const renderFrame = () => {
      renderer.clear()

      let tilesRendered = 0

      for (let ix = -visibleRange; ix < visibleRange; ix++) {
        for (let iy = -visibleRange; iy < visibleRange; iy++) {
          const color = (ix + iy) % 2 === 0 ? '#A0E7A0' : '#90EE90'
          renderer.drawTile(ix, iy, 'grass', color)
          tilesRendered++
        }
      }

      properties.forEach((prop) => {
        const ix = (prop.location_x || 0) / TILE_WIDTH
        const iy = (prop.location_y || 0) / TILE_HEIGHT
        renderer.drawBuilding(ix, iy, {
          color: '#8B4513',
          height: 2 + (prop.upgrade_level || 0) * 0.5,
          emoji: '🏠'
        })
        tilesRendered++
      })

      if (character) {
        const charIx = (character.position?.x || 0) / TILE_WIDTH
        const charIy = (character.position?.y || 0) / TILE_HEIGHT
        renderer.drawCharacter(charIx, charIy, character)
        tilesRendered++
      }

      setDisplayedTiles(tilesRendered)
      animationFrameRef.current = requestAnimationFrame(renderFrame)
    }

    animationFrameRef.current = requestAnimationFrame(renderFrame)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [character, properties])

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    if (!onCameraMove) return

    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y

    onCameraMove({
      x: cameraX + dx,
      y: cameraY + dy
    })

    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-green-100 to-green-50 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 bg-gradient-to-b from-green-50 to-green-100 cursor-grab active:cursor-grabbing"
      />

      <div className="p-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-400 flex items-center justify-between">
        <span>Tiles rendered: {displayedTiles} | Zoom: {(zoom * 100).toFixed(0)}%</span>
        <span>Tile size: {TILE_WIDTH}×{TILE_HEIGHT}</span>
      </div>
    </div>
  )
}
