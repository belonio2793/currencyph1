import React, { useState, useEffect, useRef } from 'react'
import { gameAPI } from '../../lib/gameAPI'

const PHILIPPINES_LOCATIONS = {
  'Manila': { x: 100, y: 100, region: 'NCR' },
  'Cebu': { x: 150, y: 180, region: 'Visayas' },
  'Davao': { x: 200, y: 280, region: 'Mindanao' },
  'Iloilo': { x: 120, y: 160, region: 'Visayas' },
  'Cagayan de Oro': { x: 180, y: 250, region: 'Mindanao' },
  'Bacolod': { x: 110, y: 170, region: 'Visayas' },
  'Quezon City': { x: 105, y: 95, region: 'NCR' },
  'Makati': { x: 98, y: 105, region: 'NCR' },
  'Baguio': { x: 70, y: 50, region: 'Cordillera' },
  'Legaspi': { x: 130, y: 130, region: 'Bicol' }
}

const ENEMIES = [
  { type: 'mosquito', level: 1, rarity: 'common' },
  { type: 'rat', level: 2, rarity: 'common' },
  { type: 'pest', level: 3, rarity: 'uncommon' }
]

export default function GameWorld({ character, onCombat, combatActive, onPositionUpdate }) {
  const [visibleArea, setVisibleArea] = useState('Manila')
  const [worldPos, setWorldPos] = useState({ x: 100, y: 100 })
  const [velocity, setVelocity] = useState({ x: 0, y: 0 })
  const [showEnemies, setShowEnemies] = useState(false)
  const [nearbyEnemies, setNearbyEnemies] = useState([])
  const canvasRef = useRef(null)
  const keysPressed = useRef({})
  const dragStart = useRef(null)
  const lastPositionUpdate = useRef(0)

  const TILE_SIZE = 40
  const MAP_WIDTH = 300
  const MAP_HEIGHT = 350
  const VIEW_SIZE = 8
  const BASE_SPEED = 2
  const ACCELERATION = 0.8
  const FRICTION = 0.92
  const MAX_VELOCITY = 6

  // Set up continuous movement loop
  useEffect(() => {
    const updatePosition = () => {
      setWorldPos(prevPos => {
        setVelocity(prevVel => {
          let newVelX = prevVel.x * FRICTION
          let newVelY = prevVel.y * FRICTION

          // Apply acceleration based on pressed keys
          if (keysPressed.current['ArrowUp'] || keysPressed.current['w'] || keysPressed.current['W']) {
            newVelY = Math.max(newVelY - ACCELERATION, -MAX_VELOCITY)
          }
          if (keysPressed.current['ArrowDown'] || keysPressed.current['s'] || keysPressed.current['S']) {
            newVelY = Math.min(newVelY + ACCELERATION, MAX_VELOCITY)
          }
          if (keysPressed.current['ArrowLeft'] || keysPressed.current['a'] || keysPressed.current['A']) {
            newVelX = Math.max(newVelX - ACCELERATION, -MAX_VELOCITY)
          }
          if (keysPressed.current['ArrowRight'] || keysPressed.current['d'] || keysPressed.current['D']) {
            newVelX = Math.min(newVelX + ACCELERATION, MAX_VELOCITY)
          }

          // Apply velocity to position
          let newX = Math.max(0, Math.min(MAP_WIDTH - 1, prevPos.x + newVelX))
          let newY = Math.max(0, Math.min(MAP_HEIGHT - 1, prevPos.y + newVelY))

          // Update position
          setWorldPos(pos => ({
            x: newX,
            y: newY
          }))

          // Update visible area
          const now = Date.now()
          if (now - lastPositionUpdate.current > 100) {
            lastPositionUpdate.current = now

            let closest = null
            let closestDist = Infinity

            Object.entries(PHILIPPINES_LOCATIONS).forEach(([name, pos]) => {
              const dist = Math.hypot(pos.x - newX, pos.y - newY)
              if (dist < closestDist) {
                closestDist = dist
                closest = name
              }
            })

            if (closest && closestDist < 15) {
              setVisibleArea(closest)
              if (onPositionUpdate) {
                onPositionUpdate(newX, newY, closest)
              }
            }

            // Random encounters
            if (Math.random() > 0.98) {
              generateNearbyEnemies()
            }
          }

          return { x: newVelX, y: newVelY }
        })

        return prevPos
      })
    }

    const animationInterval = setInterval(updatePosition, 16) // ~60fps
    return () => clearInterval(animationInterval)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(key)) {
        keysPressed.current[key] = true
        e.preventDefault()
      }
    }

    const handleKeyUp = (e) => {
      const key = e.key
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(key)) {
        keysPressed.current[key] = false
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    drawMap()
  }, [worldPos, nearbyEnemies])

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    dragStart.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      worldX: worldPos.x,
      worldY: worldPos.y
    }
  }

  const handleMouseMove = (e) => {
    if (!dragStart.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    const deltaX = (dragStart.current.x - currentX) / TILE_SIZE
    const deltaY = (dragStart.current.y - currentY) / TILE_SIZE

    const newX = Math.max(0, Math.min(MAP_WIDTH - 1, dragStart.current.worldX + deltaX))
    const newY = Math.max(0, Math.min(MAP_HEIGHT - 1, dragStart.current.worldY + deltaY))

    setWorldPos({ x: newX, y: newY })
    setVelocity({ x: 0, y: 0 })
  }

  const handleMouseUp = () => {
    dragStart.current = null
  }

  const generateNearbyEnemies = () => {
    const enemies = []
    const count = Math.floor(Math.random() * 3) + 1

    for (let i = 0; i < count; i++) {
      const enemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)]
      enemies.push({
        id: Math.random(),
        type: enemy.type,
        level: enemy.level + Math.floor(character.level / 5),
        x: worldPos.x + (Math.random() - 0.5) * 20,
        y: worldPos.y + (Math.random() - 0.5) * 20
      })
    }

    setNearbyEnemies(enemies)
    setShowEnemies(true)
  }

  const handleClickMap = (e) => {
    // Only navigate if it's a quick click (not a drag)
    if (!dragStart.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const clickX = (e.clientX - rect.left) / TILE_SIZE
      const clickY = (e.clientY - rect.top) / TILE_SIZE

      const viewX = Math.floor(worldPos.x) - VIEW_SIZE / 2
      const viewY = Math.floor(worldPos.y) - VIEW_SIZE / 2

      const targetX = Math.max(0, Math.min(MAP_WIDTH - 1, viewX + clickX))
      const targetY = Math.max(0, Math.min(MAP_HEIGHT - 1, viewY + clickY))

      setWorldPos({ x: targetX, y: targetY })
    }
  }

  const generateNearbyEnemies = () => {
    const enemies = []
    const count = Math.floor(Math.random() * 3) + 1

    for (let i = 0; i < count; i++) {
      const enemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)]
      enemies.push({
        id: Math.random(),
        type: enemy.type,
        level: enemy.level + Math.floor(character.level / 5),
        x: worldPos.x + (Math.random() - 0.5) * 20,
        y: worldPos.y + (Math.random() - 0.5) * 20
      })
    }

    setNearbyEnemies(enemies)
    setShowEnemies(true)
  }

  const handleCombat = async (enemy) => {
    try {
      await onCombat(enemy.type, enemy.level)
      setNearbyEnemies(nearbyEnemies.filter(e => e.id !== enemy.id))
    } catch (err) {
      console.error('Combat error:', err)
    }
  }

  const drawMap = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = VIEW_SIZE * TILE_SIZE
    const height = VIEW_SIZE * TILE_SIZE

    canvas.width = width
    canvas.height = height

    // Background
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 1
    for (let i = 0; i <= VIEW_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * TILE_SIZE, 0)
      ctx.lineTo(i * TILE_SIZE, height)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, i * TILE_SIZE)
      ctx.lineTo(width, i * TILE_SIZE)
      ctx.stroke()
    }

    // Locations
    const viewX = worldPos.x - VIEW_SIZE / 2
    const viewY = worldPos.y - VIEW_SIZE / 2

    Object.entries(PHILIPPINES_LOCATIONS).forEach(([name, pos]) => {
      const screenX = (pos.x - viewX) * TILE_SIZE
      const screenY = (pos.y - viewY) * TILE_SIZE

      if (screenX > -TILE_SIZE && screenX < width && screenY > -TILE_SIZE && screenY < height) {
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath()
        ctx.arc(screenX, screenY, 8, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#e0f2fe'
        ctx.font = '10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(name, screenX, screenY - 15)
      }
    })

    // Enemies
    nearbyEnemies.forEach(enemy => {
      const screenX = (enemy.x - viewX) * TILE_SIZE
      const screenY = (enemy.y - viewY) * TILE_SIZE

      if (screenX > -TILE_SIZE && screenX < width && screenY > -TILE_SIZE && screenY < height) {
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.rect(screenX - 6, screenY - 6, 12, 12)
        ctx.fill()

        ctx.fillStyle = '#fecaca'
        ctx.font = 'bold 8px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('!', screenX, screenY + 3)
      }
    })

    // Player
    const playerScreenX = (VIEW_SIZE / 2) * TILE_SIZE
    const playerScreenY = (VIEW_SIZE / 2) * TILE_SIZE

    ctx.fillStyle = '#10b981'
    ctx.beginPath()
    ctx.arc(playerScreenX, playerScreenY, 10, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(playerScreenX, playerScreenY, 10, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('You', playerScreenX, playerScreenY + 3)
  }

  return (
    <div className="space-y-6">
      {/* Location Info */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Location: {visibleArea}</h2>
            <p className="text-slate-400 text-sm">
              Position: ({Math.floor(worldPos.x)}, {Math.floor(worldPos.y)})
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-sm">Health</p>
            <div className="w-32 bg-slate-700 rounded-full h-4 overflow-hidden mt-1">
              <div 
                className="bg-red-500 h-full transition-all"
                style={{ width: `${(character.health / character.max_health) * 100}%` }}
              />
            </div>
            <p className="text-red-400 text-xs mt-1">{character.health} / {character.max_health}</p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold mb-3">Philippines World Map</h3>
          <p className="text-slate-400 text-sm">⌨️ WASD/Arrows to fly • 🖱️ Drag to pan • Click cities to navigate</p>
        </div>

        <canvas
          ref={canvasRef}
          onClick={handleClickMap}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full border border-slate-600 rounded bg-slate-900 cursor-grab active:cursor-grabbing"
          style={{ maxWidth: '100%', height: 'auto' }}
        />

        <p className="text-slate-400 text-xs mt-3">
          🟢 You • 🔵 Cities • 🔴 Enemies | Velocity: {Math.round(Math.hypot(velocity.x, velocity.y) * 10) / 10}
        </p>
      </div>

      {/* Nearby Enemies */}
      {showEnemies && nearbyEnemies.length > 0 && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-red-400 mb-4">⚠️ Enemies Nearby!</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nearbyEnemies.map(enemy => (
              <div key={enemy.id} className="bg-slate-700 rounded-lg p-4 border border-red-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold capitalize">{enemy.type} (Lv. {enemy.level})</p>
                    <p className="text-xs text-slate-400">Position: ({Math.floor(enemy.x)}, {Math.floor(enemy.y)})</p>
                  </div>
                  <button
                    onClick={() => handleCombat(enemy)}
                    disabled={combatActive}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Trade
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-3">Flight Controls</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-slate-700 rounded p-3">
            <p className="text-slate-400">🕹️ Fly</p>
            <p className="font-bold">↑ ↓ ← → or WASD</p>
          </div>
          <div className="bg-slate-700 rounded p-3">
            <p className="text-slate-400">🖱️ Pan</p>
            <p className="font-bold">Drag the map</p>
          </div>
          <div className="bg-slate-700 rounded p-3">
            <p className="text-slate-400">📍 Navigate</p>
            <p className="font-bold">Click a city</p>
          </div>
          <div className="bg-slate-700 rounded p-3">
            <p className="text-slate-400">⚡ Speed</p>
            <p className="font-bold">{Math.round(Math.hypot(velocity.x, velocity.y) * 10) / 10} units/frame</p>
          </div>
        </div>
        <p className="text-slate-400 text-xs mt-4">
          💡 Tip: Hold movement keys for acceleration! Movement has inertia - release to drift and decelerate naturally.
        </p>
      </div>
    </div>
  )
}
