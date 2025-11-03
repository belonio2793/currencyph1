import React, { useState, useEffect, useRef } from 'react'
import { World3D } from '../../lib/world3D'
import { supabase } from '../../lib/supabaseClient'
import { gameAPI } from '../../lib/gameAPI'
import { WorldSync } from '../../lib/worldSync'
import { NPCAIEngine, ConversationUI } from '../../lib/npcAI'
import GameSettings from './GameSettings'

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

  const keysPressed = useRef({})

  // Initialize 3D world
  useEffect(() => {
    if (!containerRef.current || !character) return

    try {
      const mapCenter = { lat: 14.5995, lng: 120.9842 } // Manila default
      const world3D = new World3D(containerRef.current, mapCenter)
      world3DRef.current = world3D

      // Notify parent component that world is ready
      if (onWorldReady) {
        onWorldReady(world3D)
      }

      // Get avatar URL using safe helper
      const avatarUrl = gameAPI.getAvatarUrl(character?.appearance) ||
                        gameAPI.getAvatarThumbnail(character?.appearance)

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

      // Add player to 3D world with avatar URL (fallback creates simple avatar if null)
      world3D.addPlayer(userId, character.name, avatarUrl, 0, 0)
        .then(() => console.log('✓ Player added to 3D world successfully'))
        .catch(err => {
          console.warn('Failed to load avatar, using fallback:', err.message)
          // Fallback is handled inside addPlayer with simple avatar creation
        })
    } catch (error) {
      console.error('Failed to initialize 3D world:', error)
    }

    // Initialize AI engine
    aiRef.current = new NPCAIEngine(
      import.meta?.env?.VITE_X_API_KEY || 
      import.meta?.env?.X_API_KEY || 
      window?.X_API_KEY
    )

    // Initialize conversation UI
    conversationRef.current = new ConversationUI()

    // Initialize real-time sync
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

    // Keyboard input
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase()
      keysPressed.current[key] = true

      // Handle special keys
      if (key === 'escape') {
        setShowSettings(true)
      }
    }
    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Game loop for movement and updates
    const gameLoop = setInterval(() => {
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
      }
    }, 50)

    return () => {
      clearInterval(gameLoop)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      world3D.destroy()
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

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden relative">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* HUD - Player Info (Top Left) */}
      <div className="absolute top-4 left-4 text-white pointer-events-none z-30">
        <div className="bg-black/70 backdrop-blur-sm p-4 rounded-lg border border-slate-600/50 flex items-center gap-3">
          {character?.appearance && (character.appearance.rpm?.thumbnail ||
            character.appearance.rpm?.meta?.imageUrl ||
            character.appearance.rpm?.meta?.avatarUrl) ? (
            <img
              src={character.appearance.rpm?.thumbnail ||
                   character.appearance.rpm?.meta?.imageUrl ||
                   character.appearance.rpm?.meta?.avatarUrl}
              alt="avatar"
              className="w-14 h-14 rounded-full object-cover border-2 border-blue-400"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400 border-2 border-slate-600">
              No<br/>Avatar
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-slate-100">{character.name}</p>
            <p className="text-xs text-slate-400">📍 {city}</p>
            <p className="text-xs text-slate-400">Level <span className="text-cyan-400 font-bold">{character.level || 0}</span></p>
            <p className="text-xs text-slate-500 mt-1">💰 {(character.money || 0).toLocaleString()} PHP</p>
          </div>
        </div>
      </div>

      {/* Controls & Camera Info (Top Right) */}
      <div className="absolute top-4 right-4 text-white pointer-events-none z-30 space-y-2">
        <div className="bg-black/70 backdrop-blur-sm p-3 rounded-lg border border-slate-600/50">
          <p className="text-xs font-bold text-slate-200 mb-2">⌨️ CONTROLS</p>
          <p className="text-xs text-slate-400"><span className="text-slate-200">WASD</span> / Arrows to move</p>
          <p className="text-xs text-slate-400"><span className="text-slate-200">Click</span> to interact</p>
          <p className="text-xs text-slate-400"><span className="text-slate-200">ESC</span> for settings</p>
        </div>

        <div className="bg-black/70 backdrop-blur-sm p-3 rounded-lg border border-slate-600/50">
          <p className="text-xs font-bold text-slate-200 mb-1">📷 CAMERA</p>
          <p className="text-xs text-cyan-400">{world3DRef.current?.cameraConfig?.mode?.toUpperCase() || 'ISOMETRIC'}</p>
        </div>
      </div>

      {/* Action Buttons (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-40 pointer-events-auto flex flex-col gap-2">
        <button
          onClick={() => setShowSettings(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg"
          title="Open game settings (ESC)"
        >
          ⚙️ Settings
        </button>
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
