import React, { useState, useEffect, useRef } from 'react'
import { World2D, CITY_COORDS, CITY_MAPS } from '../../lib/world2D'
import { drawTiles, latLngToWorldCoords, worldToLatLng } from '../../lib/mapUtils'
import { supabase } from '../../lib/supabaseClient'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { WorldSync } from '../../lib/worldSync'
import { NPCAIEngine, ConversationUI } from '../../lib/npcAI'

export default function World2DRenderer({ character, userId, city = 'Manila' }) {
  const canvasRef = useRef(null)
  const mapDivRef = useRef(null)
  const leafletRef = useRef(null)
  const worldRef = useRef(null)
  const syncRef = useRef(null)
  const aiRef = useRef(null)
  const conversationRef = useRef(null)
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 })
  const [panMode, setPanMode] = useState(false)
  const [showNPCs, setShowNPCs] = useState(false) // hide NPCs by default for clean satellite view
  const draggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const offscreenRef = useRef(null) // for post-processing passes

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

    // Map real-world city coordinates into the world map as buildings/markers
    try {
      const world = worldRef.current
      const mapData = world.mapData
      const worldW = mapData.width
      const worldH = mapData.height
      // Add major cities from CITY_COORDS as buildings
      Object.entries(CITY_COORDS).forEach(([cName, c]) => {
        const pop = c.population || 0
        if (pop < 10000) return // skip tiny places
        const pos = latLngToWorldCoords(worldW, worldH, c.lat, c.lng)
        const bx = Math.max(0, Math.min(worldW - 40, Math.round(pos.x)))
        const by = Math.max(0, Math.min(worldH - 40, Math.round(pos.y)))
        mapData.buildings.push({ x: bx, y: by, width: 60, height: 40, name: cName, type: 'city' })
        // spawn a couple NPCs near the city
        for (let i=0;i< Math.min(3, Math.floor(pop/500000)+1); i++) {
          mapData.npcSpawns.push({ x: bx + 10 + i*12, y: by + 10 + (i%2)*8, templateIdx: i % 6 })
        }
      })

      // Load POIs from Supabase (nearby_listings) and add as small markers
      (async () => {
        try {
          const { data: pois, error } = await supabase
            .from('nearby_listings')
            .select('id, name, latitude, longitude')
            .limit(800)
          if (!error && Array.isArray(pois)) {
            pois.forEach(p => {
              if (!p.latitude || !p.longitude) return
              const pos = latLngToWorldCoords(worldW, worldH, parseFloat(p.latitude), parseFloat(p.longitude))
              const bx = Math.max(0, Math.min(worldW - 10, Math.round(pos.x)))
              const by = Math.max(0, Math.min(worldH - 10, Math.round(pos.y)))
              mapData.buildings.push({ x: bx, y: by, width: 12, height: 12, name: p.name || 'POI', type: 'poi' })
            })
          }
        } catch (err) {
          console.warn('Failed to load POIs:', err)
        }
      })()

    } catch (e) {
      // ignore mapping errors
      console.warn('City mapping failed', e)
    }

    // Set initial camera to street-level view by default and center on player
    setTimeout(() => {
      const canvas = canvasRef.current
      const world = worldRef.current
      if (!canvas || !world) return
      const map = world.mapData

      // target tile zoom (MapTiler zoom level) for street-level detail
      const BASE_TILE_ZOOM = 6
      const TARGET_TILE_ZOOM = 16
      // Compute camera zoom factor so that drawTiles will select TARGET_TILE_ZOOM
      // camZoomOffset = round(log2(cam.zoom)) -> cam.zoom = 2^(TARGET_TILE_ZOOM - BASE_TILE_ZOOM)
      let zoom = Math.pow(2, TARGET_TILE_ZOOM - BASE_TILE_ZOOM)
      // clamp to sensible range
      zoom = Math.max(0.2, Math.min(2048, zoom))

      cameraRef.current.zoom = zoom

      // center on player at this zoom
      cameraRef.current.x = Math.max(0, world.player.x - canvas.width / (2 * zoom))
      cameraRef.current.y = Math.max(0, world.player.y - (canvas.height * 0.5) / zoom)

      // expose for legacy helpers/debugging
      try { window.__cameraRef = cameraRef } catch (e) { /* ignore */ }

      // initialize Leaflet map under the canvas and match zoom
      try {
        if (mapDivRef.current && !leafletRef.current) {
          const map = L.map(mapDivRef.current, { zoomControl: false, attributionControl: false, interactive: false })
          const key = 'Epg2ZBCTb2mrWoiUKQRL'
          const satUrl = `https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key=${key}`
          const sat = L.tileLayer(satUrl, { maxZoom: 19 })
          sat.addTo(map)
          leafletRef.current = map
          // set initial view to player
          const { x: wx, y: wy } = world.player
          const ll = worldToLatLng(map.mapData?.width || world.mapData.width, map.mapData?.height || world.mapData.height, wx, wy)
          // use the target tile zoom for Leaflet as well
          map.setView([ll.lat, ll.lng], TARGET_TILE_ZOOM)
        }
      } catch (e) {
        console.warn('Leaflet init failed', e)
      }
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

    // ensure offscreen canvas for post-processing
    if (!offscreenRef.current) {
      const o = document.createElement('canvas')
      o.width = canvas.width
      o.height = canvas.height
      offscreenRef.current = o
    } else {
      const o = offscreenRef.current
      if (o.width !== canvas.width || o.height !== canvas.height) {
        o.width = canvas.width
        o.height = canvas.height
      }
    }

    // attach mouse events for pan
    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    // cleanup on unmount
    const cleanupMouse = () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    // Attach resize observer to adjust leaflet map size
    let ro
    try {
      if (mapDivRef.current && leafletRef.current) {
        leafletRef.current.invalidateSize()
      }
      ro = new ResizeObserver(() => {
        if (leafletRef.current) leafletRef.current.invalidateSize()
      })
      if (mapDivRef.current) ro.observe(mapDivRef.current)
    } catch (e) {}

    const cleanupResize = () => { try { if (ro && mapDivRef.current) ro.unobserve(mapDivRef.current) } catch(e){} }

    const gameLoop = () => {
      // Update world state
      world.update()

      // Get nearby NPCs (respect toggle to hide NPCs)
      const nearby = showNPCs ? world.getNearbyNPCs(150) : []
      setNearbyNPCs(nearby)

      // Sync position
      syncRef.current?.broadcastMove(world.player.x, world.player.y, world.player.direction)

      // Keep camera centered on player with smoothing (unless panMode active)
      try {
        const cam = cameraRef.current || { x: 0, y: 0, zoom: 1 }
        const zoom = cam.zoom || 1
        if (!panMode) {
          const targetX = world.player.x - canvas.width / (2 * zoom)
          const targetY = world.player.y - (canvas.height * 0.65) / zoom // player lower on screen
          // smoothing factor (0 = snap, 1 = instant follow)
          const smoothing = 0.18
          cam.x = cam.x + (targetX - cam.x) * smoothing
          cam.y = cam.y + (targetY - cam.y) * smoothing
        }

        // Clamp to map bounds so we don't show beyond map edges
        const maxX = Math.max(0, world.mapData.width - canvas.width / zoom)
        const maxY = Math.max(0, world.mapData.height - canvas.height / zoom)
        cam.x = Math.max(0, Math.min(cam.x, maxX))
        cam.y = Math.max(0, Math.min(cam.y, maxY))
      } catch (e) {
        // ignore camera errors
      }

      // Update Leaflet view to follow camera/player when present
      try {
        const map = leafletRef.current
        if (map && world) {
          const cam = cameraRef.current || { x:0,y:0,zoom:1 }
          const worldW = world.mapData.width
          const worldH = world.mapData.height
          const centerWx = cam.x + (canvas.width/(2*cam.zoom))
          const centerWy = cam.y + (canvas.height*(0.65)/cam.zoom)
          const ll = worldToLatLng(worldW, worldH, centerWx, centerWy)
          // estimate tile zoom
          const baseZ = 6
          const tileZoom = Math.max(2, Math.min(19, Math.round(baseZ + Math.log2(cam.zoom))))
          map.setView([ll.lat, ll.lng], tileZoom, { animate: false })
        }
      } catch (e) {}

      // Render (pass current camera and options)
      renderWorld(ctx, canvas, world, otherPlayers, cameraRef.current, { showNPCs })

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(gameLoopRef.current)
      // remove attached listeners
      try { cleanupMouse() } catch(e){}
      try { cleanupResize() } catch(e){}
      try { if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null } } catch(e){}
    }
  }, [otherPlayers, showNPCs])

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

  // Handle canvas click for movement (or start drag for pan)
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    if (panMode) {
      // in pan mode, clicking does not move character
      return
    }

    // Convert screen coords to world coords using camera zoom/position
    const camera = cameraRef.current
    const worldX = clickX / camera.zoom + camera.x
    const worldY = clickY / camera.zoom + camera.y

    worldRef.current.movePlayer(worldX, worldY)
  }

  // Mouse drag handlers for pan
  const handleMouseDown = (e) => {
    if (!panMode) return
    draggingRef.current = true
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseMove = (e) => {
    if (!panMode || !draggingRef.current) return
    const dx = e.clientX - lastMouseRef.current.x
    const dy = e.clientY - lastMouseRef.current.y
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
    const cam = cameraRef.current
    cam.x -= dx / (cam.zoom || 1)
    cam.y -= dy / (cam.zoom || 1)
  }
  const handleMouseUp = () => {
    draggingRef.current = false
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

  // Programmatic zoom (used by buttons). factor >1 zooms in, <1 zooms out
  const handleZoomButton = (factor) => {
    const canvas = canvasRef.current
    const cam = cameraRef.current
    if (!canvas || !cam) return
    const prev = cam.zoom || 1
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const worldCenterX = centerX / prev + cam.x
    const worldCenterY = centerY / prev + cam.y
    const newZoom = Math.max(0.2, Math.min(3, prev * factor))
    cam.zoom = newZoom
    cam.x = worldCenterX - centerX / newZoom
    cam.y = worldCenterY - centerY / newZoom
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
      {/* Leaflet Map (satellite) behind the canvas */}
      <div ref={mapDivRef} className="absolute inset-0 z-0" style={{ filter: 'brightness(0.9) contrast(1.05)' }} />

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        className="absolute inset-0 w-full h-full z-10 cursor-crosshair block"
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

      {/* Zoom controls */}
      <div className="absolute bottom-6 left-6 z-40">
        <div className="bg-black/60 rounded border border-slate-700 p-2 flex flex-col gap-2">
          <button aria-label="Zoom in" onClick={() => handleZoomButton(1.2)} className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded">+</button>
          <button aria-label="Zoom out" onClick={() => handleZoomButton(0.8)} className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded">−</button>
        </div>
      </div>

      {/* NPC toggle */}
      <div className="absolute top-6 right-6 z-40 pointer-events-auto">
        <div className="bg-black/60 rounded border border-slate-700 p-2 flex items-center gap-2 text-xs text-slate-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showNPCs} onChange={(e)=>setShowNPCs(e.target.checked)} className="accent-blue-500" />
            Show NPCs
          </label>
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

function renderWorld(ctx, canvas, world, otherPlayers, camera, options = {}) {
  const tileSize = 32
  const showNPCsOpt = options && options.showNPCs !== undefined ? options.showNPCs : true

  // Clear canvas (screen-space)
  ctx.save()
  ctx.setTransform(1,0,0,1,0,0)
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw map tiles underneath (async-safe - may draw on top later)
  try {
    drawTiles(ctx, canvas, camera || { x: 0, y: 0, zoom: 1 }, world.mapData.width, world.mapData.height)
  } catch (e) {}

  // Apply camera transform: scale then translate
  const cam = camera || { x: 0, y: 0, zoom: 1 }
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(-cam.x, -cam.y)

  // Draw grid in world-space (subtle)
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

  // Draw buildings with slight shadow for depth
  world.mapData.buildings.forEach(building => {
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(building.x + 6, building.y + 6, building.width, building.height)

    ctx.fillStyle = '#475569'
    ctx.fillRect(building.x, building.y, building.width, building.height)

    ctx.fillStyle = '#94a3b8'
    ctx.font = `${10 / cam.zoom}px Arial`
    ctx.fillText(building.name, building.x + 5, building.y + 15)
  })

  // Draw NPCs with depth scale (closer to bottom appear larger) if enabled
  if (showNPCsOpt) {
    world.npcs.forEach(npc => {
      const depthFactor = 1 + ((npc.y - world.player.y) / Math.max(100, world.mapData.height)) * 0.5
      const r = Math.max(4, 8 * depthFactor)
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.arc(npc.x, npc.y, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = `${12 / cam.zoom}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText(npc.emoji, npc.x, npc.y + 2)
    })
  }

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

  // Draw player (centered lower for FP feel)
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(world.player.x, world.player.y, 12, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.font = `${14 / cam.zoom}px Arial`
  ctx.textAlign = 'center'
  ctx.fillText('👤', world.player.x, world.player.y + 1)

  ctx.restore()

  // Post-process: vignette for FP feel
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  const g = ctx.createRadialGradient(canvas.width/2, canvas.height*0.45, canvas.width*0.05, canvas.width/2, canvas.height*0.45, Math.max(canvas.width, canvas.height))
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.15)')
  g.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = g
  ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.restore()

  // Simple bloom + color grade pass using offscreen canvas
  try {
    const o = offscreenRef.current
    if (o) {
      const ox = o.getContext('2d')
      // copy current canvas to offscreen
      ox.clearRect(0,0,o.width,o.height)
      ox.drawImage(canvas, 0, 0)

      // bloom: draw a blurred, brightened version additively
      ox.globalCompositeOperation = 'source-over'
      ox.filter = 'blur(8px) brightness(1.2)'
      ox.drawImage(canvas, 0, 0)

      // draw back to main with lighter blend for glow
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.35
      ctx.drawImage(o, 0, 0)
      ctx.restore()

      // color grade overlay (subtle warm tone)
      ctx.save()
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = 'rgba(255,244,229,0.02)'
      ctx.fillRect(0,0,canvas.width,canvas.height)
      ctx.restore()

      // reset filters
      ox.filter = 'none'
    }
  } catch(e) {
    // ignore post-process errors
  }
}
