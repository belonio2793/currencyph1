import React, { useState, useEffect, useRef } from 'react'
import { World2D, CITY_COORDS, CITY_MAPS } from '../../lib/world2D'
import { WorldSync } from '../../lib/worldSync'
import { NPCAIEngine, ConversationUI } from '../../lib/npcAI'

export default function World2DRenderer({ character, userId, city = 'Manila' }) {
  const canvasRef = useRef(null)
  const worldRef = useRef(null)
  const syncRef = useRef(null)
  const aiRef = useRef(null)
  const conversationRef = useRef(null)
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 })

  const [otherPlayers, setOtherPlayers] = useState([])
  const [nearbyNPCs, setNearbyNPCs] = useState([])
  const [chatUI, setChatUI] = useState({ isOpen: false, npc: null, messages: [] })
  const [playerInput, setPlayerInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const keysPressed = useRef({})
  const gameLoopRef = useRef(null)

  // Initialize world
  useEffect(() => {
    if (!character) return

    // Create world instance
    worldRef.current = new World2D(city, userId, character.name)

    // Initialize AI engine
    aiRef.current = new NPCAIEngine(import.meta?.env?.VITE_X_API_KEY || import.meta?.env?.X_API_KEY || window?.X_API_KEY)

    // Initialize conversation UI
    conversationRef.current = new ConversationUI()

    // Initialize real-time sync
    syncRef.current = new WorldSync(userId, character.id, city)
    syncRef.current.connect().then(() => {
      syncRef.current.on('playerUpdate', (players) => setOtherPlayers(players))
    })

    // Set initial camera to fit the map and center on player when available
    setTimeout(() => {
      const canvas = canvasRef.current
      const world = worldRef.current
      if (!canvas || !world) return
      const map = world.mapData
      const fitZoom = Math.min(canvas.width / map.width, canvas.height / map.height)
      const zoom = Math.max(0.2, Math.min(2, fitZoom))
      cameraRef.current.zoom = zoom
      cameraRef.current.x = Math.max(0, world.player.x - canvas.width / (2 * zoom))
      cameraRef.current.y = Math.max(0, world.player.y - canvas.height / (2 * zoom))
    }, 50)

    return () => {
      if (syncRef.current) syncRef.current.disconnect()
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current)
    }
  }, [character, userId, city])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !worldRef.current) return

    const ctx = canvas.getContext('2d')
    const world = worldRef.current

    const gameLoop = () => {
      // Update world state
      world.update()

      // Get nearby NPCs
      const nearby = world.getNearbyNPCs(150)
      setNearbyNPCs(nearby)

      // Sync position
      syncRef.current?.broadcastMove(world.player.x, world.player.y, world.player.direction)

      // Render (pass current camera)
      renderWorld(ctx, canvas, world, otherPlayers, cameraRef.current)

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => cancelAnimationFrame(gameLoopRef.current)
  }, [otherPlayers])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          worldRef.current.movePlayer(worldRef.current.player.x, worldRef.current.player.y - 10)
          e.preventDefault()
          break
        case 's':
        case 'arrowdown':
          worldRef.current.movePlayer(worldRef.current.player.x, worldRef.current.player.y + 10)
          e.preventDefault()
          break
        case 'a':
        case 'arrowleft':
          worldRef.current.movePlayer(worldRef.current.player.x - 10, worldRef.current.player.y)
          e.preventDefault()
          break
        case 'd':
        case 'arrowright':
          worldRef.current.movePlayer(worldRef.current.player.x + 10, worldRef.current.player.y)
          e.preventDefault()
          break
        default:
          break
      }
    }

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Handle canvas click for movement
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Convert screen coords to world coords using camera zoom/position
    const camera = cameraRef.current
    const worldX = clickX / camera.zoom + camera.x
    const worldY = clickY / camera.zoom + camera.y

    worldRef.current.movePlayer(worldX, worldY)
  }

  // Handle NPC interaction
  const handleNPCClick = (npc) => {
    conversationRef.current.openChat(npc)
    setChatUI({ isOpen: true, npc, messages: [{ sender: npc.name, text: `Hi, I'm ${npc.name}! What can I help you with?` }] })
    setPlayerInput('')
  }

  // Handle canvas wheel zoom
  const handleWheel = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const cam = cameraRef.current
    const prevZoom = cam.zoom || 1
    const delta = -e.deltaY
    const factor = delta > 0 ? 1.1 : 0.9
    const newZoom = Math.max(0.2, Math.min(3, prevZoom * factor))

    // Compute world coord under mouse before and after zoom, adjust camera to keep mouse focus
    const worldX = mx / prevZoom + cam.x
    const worldY = my / prevZoom + cam.y
    cam.zoom = newZoom
    cam.x = worldX - mx / newZoom
    cam.y = worldY - my / newZoom
  }

  // Handle chat send
  const handleSendMessage = async () => {
    if (!playerInput.trim() || !chatUI.npc) return

    setChatUI(prev => ({
      ...prev,
      messages: [...prev.messages, { sender: 'You', text: playerInput }]
    }))

    setChatLoading(true)

    try {
      const response = await aiRef.current.chat(
        chatUI.npc,
        playerInput,
        character.name,
        city
      )

      setChatUI(prev => ({
        ...prev,
        messages: [...prev.messages, { sender: chatUI.npc.name, text: response }]
      }))

      // Broadcast chat
      syncRef.current?.broadcastChat(playerInput, chatUI.npc.id)
    } catch (error) {
      console.error('Chat error:', error)
    }

    setPlayerInput('')
    setChatLoading(false)
  }

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden relative">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={handleCanvasClick}
        className="w-full h-full bg-slate-800 cursor-crosshair block"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 text-white pointer-events-none">
        <div className="bg-black/50 p-3 rounded border border-slate-600">
          <p className="text-sm font-bold">{character.name}</p>
          <p className="text-xs text-slate-400">📍 {city}</p>
          <p className="text-xs text-slate-400">Position: {Math.round(worldRef.current?.player.x || 0)}, {Math.round(worldRef.current?.player.y || 0)}</p>
        </div>
      </div>

      {/* Nearby NPCs */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
        {nearbyNPCs.length > 0 && (
          <div className="bg-black/70 p-3 rounded border border-emerald-600">
            <p className="text-xs text-emerald-400 font-bold mb-2">Nearby NPCs ({nearbyNPCs.length})</p>
            <div className="space-y-1">
              {nearbyNPCs.map(npc => (
                <button
                  key={npc.id}
                  onClick={() => handleNPCClick(npc)}
                  className="block text-left text-xs text-slate-300 hover:text-emerald-400 p-2 bg-slate-800 rounded w-full text-left hover:bg-slate-700 transition-colors"
                >
                  {npc.emoji} {npc.name} ({npc.role})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {chatUI.isOpen && chatUI.npc && (
        <div className="absolute inset-0 bg-black/70 flex items-end justify-center z-50 pointer-events-auto">
          <div className="bg-slate-800 border border-slate-600 rounded-t-lg w-full max-w-md p-4 max-h-96 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-100">{chatUI.npc.emoji} {chatUI.npc.name}</h3>
                <p className="text-xs text-slate-400">{chatUI.npc.role}</p>
              </div>
              <button
                onClick={() => setChatUI({ isOpen: false, npc: null, messages: [] })}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-3 space-y-2 bg-slate-900 rounded p-3 max-h-48">
              {chatUI.messages.map((msg, idx) => (
                <div key={idx} className={msg.sender === 'You' ? 'text-right' : 'text-left'}>
                  <p className={`text-xs font-bold ${msg.sender === 'You' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {msg.sender}
                  </p>
                  <p className="text-xs text-slate-300 bg-slate-800 rounded p-2 inline-block max-w-xs">
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Say something..."
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                disabled={chatLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={chatLoading}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {chatLoading ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls Help */}
      <div className="absolute top-4 right-4 text-white pointer-events-none">
        <div className="bg-black/50 p-2 rounded border border-slate-600 text-xs text-slate-400">
          <p>WASD/Arrows to move</p>
          <p>Click to walk</p>
          <p>Click NPC to talk</p>
        </div>
      </div>
    </div>
  )
}

// Utility functions
function getCameraPos() {
  // Legacy helper: read from cameraRef if available in runtime
  try {
    return (window && window.__cameraRef && window.__cameraRef.current) || { x: 0, y: 0, zoom: 1 }
  } catch (e) {
    return { x: 0, y: 0, zoom: 1 }
  }
}

function renderWorld(ctx, canvas, world, otherPlayers, camera) {
  const tileSize = 32

  // Clear canvas (screen-space)
  ctx.save()
  ctx.setTransform(1,0,0,1,0,0)
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Apply camera transform: scale then translate
  const cam = camera || { x: 0, y: 0, zoom: 1 }
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(-cam.x, -cam.y)

  // Draw grid in world-space
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1 / Math.max(0.0001, cam.zoom)
  const worldViewWidth = canvas.width / cam.zoom
  const worldViewHeight = canvas.height / cam.zoom
  const cols = Math.ceil(worldViewWidth / tileSize) + 2
  const rows = Math.ceil(worldViewHeight / tileSize) + 2

  for (let i = 0; i <= cols; i++) {
    ctx.beginPath()
    ctx.moveTo(i * tileSize, 0)
    ctx.lineTo(i * tileSize, worldViewHeight)
    ctx.stroke()
  }
  for (let j = 0; j <= rows; j++) {
    ctx.beginPath()
    ctx.moveTo(0, j * tileSize)
    ctx.lineTo(worldViewWidth, j * tileSize)
    ctx.stroke()
  }

  // Draw buildings
  world.mapData.buildings.forEach(building => {
    ctx.fillStyle = '#475569'
    ctx.fillRect(building.x, building.y, building.width, building.height)

    ctx.fillStyle = '#94a3b8'
    ctx.font = `${10 / cam.zoom}px Arial`
    ctx.fillText(building.name, building.x + 5, building.y + 15)
  })

  // Draw NPCs
  world.npcs.forEach(npc => {
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.arc(npc.x, npc.y, 8, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = `${12 / cam.zoom}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(npc.emoji, npc.x, npc.y + 2)
  })

  // Draw other players
  otherPlayers.forEach(player => {
    ctx.fillStyle = '#8b5cf6'
    ctx.beginPath()
    ctx.arc(player.x, player.y, 7, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#e0e7ff'
    ctx.font = `${10 / cam.zoom}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(player.character_name, player.x, player.y - 12)
  })

  // Draw player
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(world.player.x, world.player.y, 10, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.font = `${14 / cam.zoom}px Arial`
  ctx.textAlign = 'center'
  ctx.fillText('👤', world.player.x, world.player.y + 1)

  ctx.restore()
}
