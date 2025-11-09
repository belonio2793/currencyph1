import React, { useEffect, useRef, useState, useCallback } from 'react'

export default function PlayerView({
  properties = [],
  character = null,
  onPropertyClick = null,
  mapSettings = {},
  initialAvatarPos = null,
  onCharacterMove = null,
  placingProperty = null,
  onConfirmPlace = null,
  onCancelPlace = null
}) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const keys = useRef({})
  const vel = useRef({ x: 0, y: 0 })
  const lastTime = useRef(performance.now())
  const [avatarPos, setAvatarPos] = useState(initialAvatarPos || { x: 200, y: 200 })
  const [avatarAngle, setAvatarAngle] = useState(0)
  const [isMoving, setIsMoving] = useState(false)

  const TILE = 48
  const GRID_W = Math.max(40, Math.floor((mapSettings?.sizeMultiplier || 10) * 40))
  const GRID_H = Math.max(30, Math.floor((mapSettings?.sizeMultiplier || 10) * 30))
  const MAP_W = GRID_W * TILE
  const MAP_H = GRID_H * TILE

  const gridToIso = useCallback((gx, gy) => {
    const x = (gx - gy) * (TILE / 2)
    const y = (gx + gy) * (TILE / 4)
    return { x, y }
  }, [])

  const isoToGrid = useCallback((ix, iy) => {
    const col = ix / (TILE / 2)
    const row = iy / (TILE / 4)
    const gx = Math.round((col + row) / 2)
    const gy = Math.round((row - col) / 2)
    return { x: gx, y: gy }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const handleDown = (e) => {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return
      keys.current[e.key.toLowerCase()] = true
      if (["arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) e.preventDefault()
    }
    const handleUp = (e) => {
      keys.current[e.key.toLowerCase()] = false
    }
    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)
    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup', handleUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    const draw = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // camera centered on avatar
      const cx = w / 2
      const cy = h / 2

      ctx.save()
      ctx.translate(cx - avatarPos.x, cy - avatarPos.y)

      // draw simple grid tiles
      const startX = Math.floor((avatarPos.x - cx) / TILE) - 4
      const endX = Math.floor((avatarPos.x + cx) / TILE) + 4
      const startY = Math.floor((avatarPos.y - cy) / TILE) - 4
      const endY = Math.floor((avatarPos.y + cy) / TILE) + 4

      for (let gx = startX; gx <= endX; gx++) {
        for (let gy = startY; gy <= endY; gy++) {
          const screenX = gx * TILE
          const screenY = gy * TILE
          ctx.fillStyle = (gx + gy) % 2 === 0 ? '#2b3b2f' : '#243428'
          ctx.fillRect(screenX, screenY, TILE - 2, TILE - 2)
        }
      }

      // draw properties
      for (const p of properties || []) {
        const px = p.location_x || 0
        const py = p.location_y || 0
        ctx.fillStyle = '#ffcc66'
        ctx.fillRect(px - 12, py - 12, 24, 24)
      }

      // ghost placement
      if (placingProperty && typeof onConfirmPlace === 'function') {
        // draw ghost at mouse if available via global pointer
        // fallback: snap to avatar
        ctx.save()
        ctx.globalAlpha = 0.7
        ctx.fillStyle = '#66ccff'
        ctx.fillRect(Math.round(avatarPos.x)-16, Math.round(avatarPos.y)-48, 32, 32)
        ctx.restore()
      }

      // avatar
      ctx.save()
      ctx.translate(avatarPos.x, avatarPos.y)
      ctx.fillStyle = '#2c6ac7'
      ctx.fillRect(-12, -28, 24, 28)
      ctx.fillStyle = '#f4d8b0'
      ctx.beginPath()
      ctx.arc(0, -34, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.restore()

      // HUD overlays
      ctx.setTransform(1,0,0,1,0,0)
    }

    const animate = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime.current) / 1000)
      lastTime.current = now

      // input
      const input = { x: 0, y: 0 }
      if (keys.current['w'] || keys.current['arrowup']) input.y -= 1
      if (keys.current['s'] || keys.current['arrowdown']) input.y += 1
      if (keys.current['a'] || keys.current['arrowleft']) input.x -= 1
      if (keys.current['d'] || keys.current['arrowright']) input.x += 1

      // normalize
      let il = Math.hypot(input.x, input.y)
      if (il > 0) { input.x/=il; input.y/=il }

      const sprint = keys.current['shift'] ? 1.8 : 1
      const top = (mapSettings?.avatarSpeed || 2) * 120 * sprint
      // accelerate towards target
      vel.current.x += (input.x * top - vel.current.x) * Math.min(1, dt * 12)
      vel.current.y += (input.y * top - vel.current.y) * Math.min(1, dt * 12)

      // move
      const dx = vel.current.x * dt
      const dy = vel.current.y * dt
      setAvatarPos(prev => {
        const nx = Math.max(0, Math.min(MAP_W, prev.x + dx))
        const ny = Math.max(0, Math.min(MAP_H, prev.y + dy))
        if (onCharacterMove) onCharacterMove({ x: nx, y: ny })
        return { x: nx, y: ny }
      })

      setIsMoving(Math.hypot(vel.current.x, vel.current.y) > 1)

      draw()
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationRef.current)
  }, [properties, placingProperty, mapSettings, onCharacterMove])

  // allow clicking on canvas to place
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onClick = (e) => {
      if (!placingProperty) return
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left)
      const y = (e.clientY - rect.top)
      // convert to world coords (camera centered on avatar)
      const w = canvas.width / (window.devicePixelRatio || 1)
      const h = canvas.height / (window.devicePixelRatio || 1)
      const worldX = avatarPos.x - w/2 + x
      const worldY = avatarPos.y - h/2 + y
      const gx = Math.max(0, Math.min(GRID_W-1, Math.round(worldX / TILE)))
      const gy = Math.max(0, Math.min(GRID_H-1, Math.round(worldY / TILE)))
      const gameX = gx * TILE + TILE/2
      const gameY = gy * TILE + TILE/2
      if (onConfirmPlace) onConfirmPlace({ x: gameX, y: gameY, gridX: gx, gridY: gy })
    }
    canvas.addEventListener('click', onClick)
    return () => canvas.removeEventListener('click', onClick)
  }, [placingProperty, avatarPos, onConfirmPlace])

  return (
    <div className="w-full h-full relative bg-slate-900">
      <canvas ref={canvasRef} className="w-full h-full block" style={{ display: 'block', touchAction: 'none' }} />
      <div className="absolute bottom-4 left-4 text-xs text-slate-300 bg-slate-800/60 backdrop-blur border border-slate-600 rounded px-3 py-3">
        <div className="font-semibold mb-2">Controls</div>
        <div className="space-y-1 text-slate-400">
          <div>📍 <kbd className="bg-slate-700 px-1.5 rounded">WASD</kbd> or <kbd className="bg-slate-700 px-1.5 rounded">Arrows</kbd> - Move</div>
          <div>⚡ <kbd className="bg-slate-700 px-1.5 rounded">Shift</kbd> + Move - Sprint</div>
          <div>👆 Click - Place when in placement mode</div>
        </div>
      </div>
    </div>
  )
}
