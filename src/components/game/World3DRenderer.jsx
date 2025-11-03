import React, { useState, useEffect, useRef } from 'react'
import { World3D } from '../../lib/world3D'
import { supabase } from '../../lib/supabaseClient'
import { gameAPI } from '../../lib/gameAPI'
import { WorldSync } from '../../lib/worldSync'
import { NPCAIEngine, ConversationUI } from '../../lib/npcAI'
import GameSettings from './GameSettings'
import { listPropertiesByCity, subscribeToProperties } from '../../lib/propertyAPI'

export default function World3DRenderer({ character, userId, city = 'Manila', onWorldReady = null }) {
  const containerRef = useRef(null)
  const world3DRef = useRef(null)
  const syncRef = useRef(null)
  const aiRef = useRef(null)
  const conversationRef = useRef(null)

  const [otherPlayers, setOtherPlayers] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [chatUI, setChatUI] = useState({ isOpen: false, npc: null, messages: [] })
  const [playerInput, setPlayerInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [streetViewOpen, setStreetViewOpen] = useState(false)
  const [streetViewImage, setStreetViewImage] = useState(null)
  const [streetViewCoords, setStreetViewCoords] = useState(null)
  const panoramaDivRef = useRef(null)
  const panoramaRef = useRef(null)

  const [positionInfo, setPositionInfo] = useState(null) // {lat,lng,street,city,x,z}

  const keysPressed = useRef({})
  const lastSaveTimeRef = useRef(0)

  // Initialize 3D world
  useEffect(() => {
    if (!containerRef.current || !character) return

    // Get avatar URL once for use throughout this effect
    const avatarUrl = gameAPI.getAvatarUrl(character?.appearance) ||
                      gameAPI.getAvatarThumbnail(character?.appearance)

    try {
      const mapCenter = { lat: 14.5995, lng: 120.9842 } // Manila default
      const world3D = new World3D(containerRef.current, mapCenter)
      world3DRef.current = world3D

      // Force first-person camera for immersive experience
      try { world3D.setCameraMode('firstperson', { fov: 75, zoom: 1.0 }) } catch(e) {}

      // Notify parent component that world is ready
      if (onWorldReady) {
        onWorldReady(world3D)
      }

      // Log for debugging
      console.log('Loading 3D World for character:', {
        charId: character.id,
        charName: character.name,
        hasAppearance: !!character?.appearance,
        hasAvatarUrl: !!avatarUrl,
        avatarUrlPreview: avatarUrl ? avatarUrl.substring(0, 80) + '...' : 'None'
      })

      if (!avatarUrl) {
        console.warn('⚠️ No avatar URL found - will use fallback avatar', {
          charId: character.id,
          appearance: character?.appearance
        })
      }

      // Load saved character position from localStorage
      let startX = 0, startZ = 0
      try {
        const savedPosition = localStorage.getItem(`character_position_${character.id}`)
        if (savedPosition) {
          const pos = JSON.parse(savedPosition)
          startX = pos.x || 0
          startZ = pos.z || 0
          console.log('✓ Loaded saved character position:', { x: startX, z: startZ })
        }
      } catch (err) {
        console.warn('Failed to load saved position:', err)
      }

      // Add player to 3D world with avatar URL (fallback creates simple avatar if null)
      world3D.addPlayer(userId, character.name, avatarUrl, startX, startZ)
        .then(() => console.log('✓ Player added to 3D world successfully'))
        .catch(err => {
          console.warn('Failed to load avatar, using fallback:', err.message)
          // Fallback is handled inside addPlayer with simple avatar creation
        })

      // Load NPCs
      const npcCount = 5 + Math.floor(Math.random() * 5)
      for (let i = 0; i < npcCount; i++) {
        const x = (Math.random() - 0.5) * 800
        const z = (Math.random() - 0.5) * 800
        world3D.addNPC(`npc-${i}`, `NPC ${i + 1}`, x, z)
      }

      // Start rendering
      world3D.start()
    } catch (error) {
      console.error('Failed to initialize 3D world:', error)
    }

    // Initialize AI engine
    try {
      aiRef.current = new NPCAIEngine(
        import.meta?.env?.VITE_X_API_KEY ||
        import.meta?.env?.X_API_KEY ||
        window?.X_API_KEY
      )
    } catch (err) {
      console.warn('Failed to initialize NPC AI engine:', err)
    }

    // Initialize conversation UI
    try {
      conversationRef.current = new ConversationUI()
    } catch (err) {
      console.warn('Failed to initialize conversation UI:', err)
    }

    // Initialize real-time sync
    try {
      syncRef.current = new WorldSync(userId, character.id, city)
      syncRef.current.connect().then(() => {
        // Update presence with avatar
        try {
          syncRef.current.updatePresence({
            name: character.name,
            x: 0,
            y: 0,
            direction: 0,
            rpm_avatar: avatarUrl
          })
        } catch(e) {
          console.warn('Could not update presence:', e)
        }
        syncRef.current.on('playerUpdate', (players) => setOtherPlayers(players))

        // Poll for our lastPresence to update HUD
        try {
          const poll = setInterval(() => {
            try {
              const pres = syncRef.current?.lastPresence || null
              if (pres) {
                setPositionInfo({
                  lat: pres.lat || null,
                  lng: pres.lng || null,
                  street: pres.street || pres.display_name || null,
                  city: pres.locality || pres.city || null,
                  x: pres.x || 0,
                  z: pres.y || 0
                })
              }
            } catch(e){}
          }, 500)
          // store poll ref so cleanup can clear it
          syncRef.current._pollInterval = poll
        } catch(e) { console.warn('Failed to start presence poll:', e) }

      }).catch(err => {
        console.warn('Failed to connect world sync:', err)
      })
    } catch (err) {
      console.warn('Failed to initialize world sync:', err)
    }

    // Keyboard input - prevent default scrolling for game controls
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase()
      keysPressed.current[key] = true

      // Prevent default scrolling for arrow keys and WASD
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault()
      }

      // Zoom keys
      if (key === '+' || key === '=' ) {
        try { world3DRef.current?.setZoom((world3DRef.current.cameraConfig.zoom || 1) * 1.2) } catch(e){}
      }
      if (key === '-' || key === '_') {
        try { world3DRef.current?.setZoom((world3DRef.current.cameraConfig.zoom || 1) * 0.8) } catch(e){}
      }

      // Handle special keys
      if (key === 'escape') {
        e.preventDefault()
        setShowSettings(true)
      }
    }
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase()
      keysPressed.current[key] = false

      // Prevent default scrolling for arrow keys and WASD
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Game loop for movement and updates
    const gameLoop = setInterval(() => {
      const world3D = world3DRef.current
      if (!world3D) return

      const player = world3D.players.get(userId)
      if (!player) return

      let dx = 0, dz = 0
      const moveSpeed = 15 // Faster movement

      if (keysPressed.current['w'] || keysPressed.current['arrowup']) dz -= moveSpeed
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) dz += moveSpeed
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) dx -= moveSpeed
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) dx += moveSpeed

      if (dx !== 0 || dz !== 0) {
        const newX = player.group.position.x + dx
        const newZ = player.group.position.z + dz
        world3D.updatePlayerPosition(userId, newX, newZ)
        syncRef.current?.updatePresence({
          name: character.name,
          x: newX,
          y: newZ,
          direction: Math.atan2(dx, dz) * (180 / Math.PI),
          rpm_avatar: avatarUrl
        })

        // Save character position to localStorage (debounced - max once per 500ms)
        const now = Date.now()
        if (now - lastSaveTimeRef.current > 500) {
          try {
            localStorage.setItem(`character_position_${character.id}`, JSON.stringify({
              x: newX,
              z: newZ,
              timestamp: now
            }))
            lastSaveTimeRef.current = now
          } catch (err) {
            console.warn('Failed to save character position:', err)
          }
        }
      }
    }, 50)

    return () => {
      clearInterval(gameLoop)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)

      // Save final position before cleanup
      if (world3DRef.current) {
        const player = world3DRef.current.players.get(userId)
        if (player) {
          try {
            localStorage.setItem(`character_position_${character.id}`, JSON.stringify({
              x: player.group.position.x,
              z: player.group.position.z,
              timestamp: Date.now()
            }))
          } catch (err) {
            console.warn('Failed to save final character position:', err)
          }
        }
        world3DRef.current.destroy()
      }

      // Clear presence poll and disconnect world sync (persist last presence)
      try {
        if (syncRef.current) {
          if (syncRef.current._pollInterval) {
            clearInterval(syncRef.current._pollInterval)
            syncRef.current._pollInterval = null
          }
          try { syncRef.current.disconnect() } catch(e) { console.warn('Failed to disconnect world sync:', e) }
        }
      } catch(e) { console.warn('Error during world cleanup:', e) }
    }
  }, [character, userId, city])

  // Add other players to 3D world
  useEffect(() => {
    if (!world3DRef.current) return

    otherPlayers.forEach(player => {
      if (!world3DRef.current.players.has(player.user_id)) {
        const avatarUrl = player.rpm_avatar || null
        if (avatarUrl) {
          world3DRef.current.addPlayer(
            player.user_id,
            player.character_name || player.name,
            avatarUrl,
            player.x || 0,
            player.y || 0
          )
        }
      } else {
        // Update position
        world3DRef.current.updatePlayerPosition(
          player.user_id,
          player.x || 0,
          player.y || 0
        )
      }
    })
  }, [otherPlayers])

  const handleSendMessage = async () => {
    if (!playerInput.trim()) return

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
    } catch (error) {
      console.error('Chat error:', error)
    }

    setPlayerInput('')
    setChatLoading(false)
  }

  useEffect(() => {
    if (!streetViewOpen || !streetViewCoords || !panoramaDivRef.current) return

    const key = import.meta.env?.VITE_GOOGLE_API_KEY || import.meta.env?.GOOGLE_API_KEY || ''
    if (!key) {
      console.warn('Google API key missing for Street View')
      return
    }

    let cancelled = false
    const loadGoogleMaps = () => new Promise((resolve, reject) => {
      if (window.google && window.google.maps && window.google.maps.StreetViewPanorama) return resolve(window.google.maps)
      const existing = document.querySelector('script[data-google-maps]')
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google.maps))
        existing.addEventListener('error', (e) => reject(e))
        return
      }
      const s = document.createElement('script')
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`
      s.defer = true
      s.async = true
      s.setAttribute('data-google-maps', '1')
      s.onload = () => resolve(window.google.maps)
      s.onerror = (e) => reject(e)
      document.head.appendChild(s)
    })

    loadGoogleMaps().then(() => {
      if (cancelled) return
      try {
        const panorama = new window.google.maps.StreetViewPanorama(panoramaDivRef.current, {
          position: { lat: streetViewCoords.lat, lng: streetViewCoords.lng },
          pov: { heading: 0, pitch: 0 },
          visible: true,
          motionTracking: true,
          linksControl: true,
          panControl: true,
          addressControl: false,
          fullscreenControl: true
        })
        panoramaRef.current = panorama
      } catch (e) {
        console.warn('Failed to create Street View Panorama:', e)
      }
    }).catch((err) => {
      console.warn('Google Maps JS API failed to load for Street View:', err)
    })

    return () => {
      cancelled = true
      try {
        if (panoramaRef.current) {
          try { panoramaRef.current.setVisible(false) } catch(e){}
          panoramaRef.current = null
        }
      } catch (e) {}
    }
  }, [streetViewOpen, streetViewCoords])

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden relative">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* HUD - Player Info (Top Left) */}
      <div className="absolute top-4 left-4 text-white pointer-events-none z-30">
        <div className="bg-black/70 backdrop-blur-sm p-4 rounded-lg border border-slate-600/50 flex items-center gap-3">
          {(() => {
            const thumbnailUrl = gameAPI.getAvatarThumbnail(character?.appearance) || gameAPI.getAvatarUrl(character?.appearance)
            return thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={character.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-blue-400"
                onError={() => console.warn('Failed to load avatar thumbnail:', thumbnailUrl)}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs text-slate-300 border-2 border-slate-600 font-bold">
                {character.name?.charAt(0) || '?'}
              </div>
            )
          })()}
          <div>
            <p className="text-sm font-bold text-slate-100">{character.name}</p>
            <p className="text-xs text-slate-400">Location: {city}</p>
            <p className="text-xs text-slate-400">Level <span className="text-cyan-400 font-bold">{character.level || 0}</span></p>
            <p className="text-xs text-slate-500 mt-1">Balance: P{(character.money || 0).toLocaleString()}</p>
            {positionInfo ? (
              <div className="mt-2 text-xs text-slate-300">
                <div>Lat: {positionInfo.lat ? positionInfo.lat.toFixed(5) : '—'}</div>
                <div>Lng: {positionInfo.lng ? positionInfo.lng.toFixed(5) : '—'}</div>
                <div className="truncate">{positionInfo.street || positionInfo.city || ''}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Controls & Camera Info (Top Right) */}
      <div className="absolute top-4 right-4 text-white pointer-events-none z-30 space-y-2">
        <div className="bg-black/70 backdrop-blur-sm p-3 rounded-lg border border-slate-600/50">
          <p className="text-xs font-bold text-slate-200 mb-2">CONTROLS</p>
          <p className="text-xs text-slate-400"><span className="text-slate-200">WASD</span> / Arrows to move</p>
          <p className="text-xs text-slate-400"><span className="text-slate-200">Click</span> to interact</p>
          <p className="text-xs text-slate-400"><span className="text-slate-200">ESC</span> for settings</p>
        </div>

        <div className="bg-black/70 backdrop-blur-sm p-3 rounded-lg border border-slate-600/50">
          <p className="text-xs font-bold text-slate-200 mb-1">CAMERA</p>
          <p className="text-xs text-cyan-400">{world3DRef.current?.cameraConfig?.mode?.toUpperCase() || 'ISOMETRIC'}</p>
        </div>
      </div>

      {/* Action Buttons (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-40 pointer-events-auto flex flex-col gap-2">
        <button
          onClick={() => setShowSettings(true)}
          className="px-4 py-2 bg-transparent hover:bg-white/10 text-white rounded-lg font-medium flex items-center gap-2 transition-all border border-white/30 hover:border-white/50"
          title="Open game settings (ESC)"
        >
          Settings
        </button>
        <button
          onClick={async () => {
            try {
              const world3D = world3DRef.current
              if (!world3D) return
              const player = world3D.players.get(userId)
              if (!player) return alert('Player not ready')

              // Use mapTileManager to approximate lat/lng
              const mtm = world3D.mapTileManager
              const nearest = mtm ? mtm.getNearestCity(player.group.position.x, player.group.position.z) : null
              const latLng = (function() {
                if (!nearest || !mtm) return { lat: world3D.mapCenter.lat, lng: world3D.mapCenter.lng }
                const latOffset = (player.group.position.z) / 111320
                const lngOffset = (player.group.position.x) / (111320 * Math.cos(nearest.lat * Math.PI / 180))
                return { lat: nearest.lat - latOffset, lng: nearest.lng + lngOffset }
              })()

              const key = import.meta.env?.VITE_GOOGLE_API_KEY || import.meta.env?.GOOGLE_API_KEY || ''
              if (!key) return alert('Google API key not configured (VITE_GOOGLE_API_KEY)')

              const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${latLng.lat},${latLng.lng}&key=${key}`
              try {
                const res = await fetch(metaUrl)
                const data = await res.json()
                if (data && data.status === 'OK') {
                  const img = `https://maps.googleapis.com/maps/api/streetview?size=1280x720&location=${latLng.lat},${latLng.lng}&fov=90&heading=0&pitch=0&key=${key}`
                  setStreetViewImage(img)
                  setStreetViewCoords({ lat: latLng.lat, lng: latLng.lng })
                  setStreetViewOpen(true)
                } else {
                  alert('No Street View imagery available at this location')
                }
              } catch (err) {
                console.warn('Street View metadata fetch failed', err)
                alert('Street View API error')
              }
            } catch (e) {
              console.warn('Street View open failed', e)
            }
          }}
          className="px-4 py-2 bg-transparent hover:bg-white/10 text-white rounded-lg font-medium flex items-center gap-2 transition-all border border-white/30 hover:border-white/50"
        >
          Street View
        </button>
      </div>

      {/* Zoom controls (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-40">
        <div className="bg-black/60 rounded border border-slate-700 p-2 flex flex-col gap-2">
          <button aria-label="Zoom in" onClick={() => { try { world3DRef.current?.setZoom((world3DRef.current.cameraConfig.zoom || 1) * 1.2) } catch(e){} }} className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded">+</button>
          <button aria-label="Zoom out" onClick={() => { try { world3DRef.current?.setZoom((world3DRef.current.cameraConfig.zoom || 1) * 0.8) } catch(e){} }} className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded">−</button>
        </div>
      </div>

      {/* Street View modal */}
      {streetViewOpen && (
        <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => { setStreetViewOpen(false); setStreetViewImage(null); setStreetViewCoords(null); }}>
          <div className="relative w-full max-w-4xl h-[70vh] bg-black rounded" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-2 right-2 z-60 px-3 py-1 bg-slate-700 rounded" onClick={()=>{ setStreetViewOpen(false); setStreetViewImage(null); setStreetViewCoords(null); }}>Close</button>

            {/* Panorama container (initialized by Google Maps JS API) */}
            <div ref={panoramaDivRef} className="w-full h-full rounded overflow-hidden" style={{ background: '#000' }} />

            {/* Fallback: static image shown until panorama loads or if API unavailable */}
            {!streetViewCoords && streetViewImage && (
              <img src={streetViewImage} alt="Street View" className="w-full h-full object-cover rounded absolute inset-0" />
            )}

          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatUI.isOpen && chatUI.npc && (
        <div className="absolute inset-0 bg-black/70 flex items-end justify-center z-50 pointer-events-auto">
          <div className="bg-slate-800 border border-slate-600 rounded-t-lg w-full max-w-md p-4 max-h-96 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-100">{chatUI.npc.name}</h3>
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

      {/* Game Settings Modal */}
      {showSettings && (
        <GameSettings 
          world3D={world3DRef.current} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  )
}
