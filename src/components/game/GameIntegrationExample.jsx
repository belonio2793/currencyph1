// Example of how to integrate all game systems into PlayCurrency
// This shows best practices for using all the new features together

import React, { useState, useEffect, useRef } from 'react'
import CollapsibleMinimap from './CollapsibleMinimap'
import { RewardsContainer, showReward } from './FloatingRewards'
import PropertyManagementOverlay from './PropertyManagementOverlay'
import EnhancedLeaderboard from './EnhancedLeaderboard'
import AchievementsPanel from './AchievementsPanel'
import {
  AnimatedStatDisplay,
  AnimatedProgressBar,
  AnimatedButton,
  StatusBadge,
  LoadingSpinner
} from './GameUIEnhancements'
import { CharacterMovement, CameraController } from '../../lib/gameMovementSystem'
import { soundManager, playSounds } from '../../lib/gameSoundSystem'
import { AchievementTracker } from '../../lib/gameAchievementSystem'
import { tradingSystem, marketplace } from '../../lib/gameTradingSystem'

export function GameIntegrationExample({ character, userId, onUpdate }) {
  // Movement system
  const movementRef = useRef(new CharacterMovement())
  const cameraRef = useRef(new CameraController())
  const keysRef = useRef({})
  const animationFrameRef = useRef(null)

  // Achievement tracking
  const achievementsRef = useRef(new AchievementTracker(character?.id))

  // UI state
  const [showProperties, setShowProperties] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [avatarPos, setAvatarPos] = useState({ x: 150, y: 175 })
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  // Initialize movement system
  useEffect(() => {
    const movement = movementRef.current
    if (character?.location_x && character?.location_y) {
      movement.setPosition(character.location_x, character.location_y)
    }
  }, [character?.id])

  // Handle keyboard input for movement
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        keysRef.current[e.key.toLowerCase()] = true
        e.preventDefault()
      }
    }

    const handleKeyUp = (e) => {
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        keysRef.current[e.key.toLowerCase()] = false
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

  // Game loop for movement and camera
  useEffect(() => {
    const movement = movementRef.current
    const camera = cameraRef.current

    const gameLoop = () => {
      // Get input from pressed keys
      const inputVector = { x: 0, y: 0 }

      if (keysRef.current['w'] || keysRef.current['arrowup']) inputVector.y = -1
      if (keysRef.current['s'] || keysRef.current['arrowdown']) inputVector.y = 1
      if (keysRef.current['a'] || keysRef.current['arrowleft']) inputVector.x = -1
      if (keysRef.current['d'] || keysRef.current['arrowright']) inputVector.x = 1

      // Update movement
      movement.applyInput(inputVector)
      movement.update(16) // 60fps

      // Update camera
      camera.update(movement.position.x, movement.position.y, 16)

      // Update UI
      setAvatarPos({ ...movement.position })
      setCameraPos({ ...camera.position })

      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Handle map click for pathfinding
  const handleMapClick = (x, y) => {
    movementRef.current.moveTo(x, y)
  }

  // Handle minimap click
  const handleMinimapClick = (coords) => {
    handleMapClick(coords.x, coords.y)
    playSounds.click()
  }

  // Handle work completion - show floating rewards
  const handleWorkComplete = (job) => {
    showReward('money', job.reward, { x: window.innerWidth / 2, y: window.innerHeight / 2 })
    showReward('xp', job.xp)
    playSounds.reward()

    // Check achievements
    const newAchievements = achievementsRef.current.updateStats({
      jobsCompleted: (character.jobs_completed || 0) + 1,
      totalEarned: (character.wealth || 0) + job.reward
    })

    newAchievements.forEach(ach => {
      showReward('achievement', ach.title)
      playSounds.achievement()
    })

    onUpdate?.({ wealth: character.wealth + job.reward })
  }

  // Handle property purchase
  const handleBuyProperty = (property) => {
    if (!character || character.wealth < property.price) {
      alert('Not enough wealth!')
      return
    }

    const newWealth = character.wealth - property.price
    const newProperty = {
      ...property,
      id: `prop_${Date.now()}`,
      owner_id: character.id,
      location_x: Math.random() * 300,
      location_y: Math.random() * 350
    }

    showReward('property', property.name)
    playSounds.property()

    // Check achievements
    const newAchievements = achievementsRef.current.updateStats({
      propertiesOwned: (character.properties?.length || 0) + 1,
      totalWealth: newWealth
    })

    newAchievements.forEach(ach => {
      showReward('achievement', ach.title)
    })

    onUpdate?.({
      wealth: newWealth,
      properties: [...(character.properties || []), newProperty]
    })
  }

  // Handle property upgrade
  const handleUpgradeProperty = (propertyId, upgrades) => {
    const upgradeCost = 10000 // Example cost

    if (character.wealth < upgradeCost) {
      alert('Not enough wealth to upgrade!')
      return
    }

    showReward('property', 'Property Upgraded')
    playSounds.property()

    onUpdate?.({
      wealth: character.wealth - upgradeCost,
      properties: character.properties?.map(p => 
        p.id === propertyId ? { ...p, ...upgrades } : p
      )
    })
  }

  // Handle property sale
  const handleSellProperty = (propertyId, salePrice) => {
    showReward('money', salePrice)
    playSounds.reward()

    onUpdate?.({
      wealth: character.wealth + salePrice,
      properties: character.properties?.filter(p => p.id !== propertyId)
    })
  }

  if (!character) {
    return <LoadingSpinner size="lg" />
  }

  const xpPercentage = (character.xp || 0) % 100
  const nextLevelXp = Math.ceil((character.xp || 0) / 100) * 100

  return (
    <div className="w-full h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Floating rewards container */}
      <RewardsContainer />

      {/* Top HUD */}
      <div className="absolute top-4 left-4 right-4 z-30 grid grid-cols-5 gap-3 pointer-events-none">
        <AnimatedStatDisplay
          label="Level"
          value={character.level || 1}
          icon="⭐"
          color="cyan"
        />
        <AnimatedStatDisplay
          label="Wealth"
          value={character.wealth || 0}
          icon="💰"
          color="green"
        />
        <AnimatedStatDisplay
          label="Income/day"
          value={character.income_rate || 0}
          icon="📈"
          color="yellow"
        />
        <AnimatedStatDisplay
          label="Properties"
          value={character.properties?.length || 0}
          icon="🏠"
          color="orange"
        />
        <AnimatedStatDisplay
          label="Jobs Done"
          value={character.jobs_completed || 0}
          icon="💼"
          color="purple"
        />
      </div>

      {/* XP Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-96 z-30 pointer-events-none">
        <AnimatedProgressBar
          value={xpPercentage}
          max={100}
          label={`Level ${character.level || 1}`}
          color="cyan"
        />
      </div>

      {/* Control buttons (top right) */}
      <div className="absolute top-4 right-4 z-30 space-y-2 pointer-events-auto">
        <AnimatedButton
          onClick={() => setShowProperties(true)}
          variant="primary"
          size="sm"
        >
          🏠 Properties
        </AnimatedButton>
        <AnimatedButton
          onClick={() => setShowLeaderboard(true)}
          variant="secondary"
          size="sm"
        >
          🏆 Leaderboard
        </AnimatedButton>
        <AnimatedButton
          onClick={() => setShowAchievements(true)}
          variant="success"
          size="sm"
        >
          🎯 Achievements
        </AnimatedButton>
      </div>

      {/* Status area */}
      <div className="absolute bottom-24 left-4 z-30 space-y-2 pointer-events-none">
        {character.is_working ? (
          <>
            <StatusBadge status="working" label={character.current_job} />
            <div className="text-sm text-slate-400">
              Progress: {character.work_progress || 0}%
            </div>
          </>
        ) : (
          <StatusBadge status="active" label="Ready" />
        )}
      </div>

      {/* Minimap */}
      <CollapsibleMinimap
        properties={character.properties || []}
        character={character}
        avatarPos={avatarPos}
        zoom={zoom}
        cameraPos={cameraPos}
        onMinimapClick={handleMinimapClick}
        city="Manila"
      />

      {/* Property Management Modal */}
      {showProperties && (
        <PropertyManagementOverlay
          properties={character.properties || []}
          character={character}
          onBuyProperty={handleBuyProperty}
          onUpgradeProperty={handleUpgradeProperty}
          onSellProperty={handleSellProperty}
          onClose={() => setShowProperties(false)}
        />
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-lg w-full max-w-4xl">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="text-xl font-bold text-cyan-300">🏆 Leaderboard</h2>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <EnhancedLeaderboard
                leaderboard={[]} // Load from your data source
                currentUserId={userId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-lg w-full max-w-4xl">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="text-xl font-bold text-cyan-300">🏆 Achievements</h2>
              <button
                onClick={() => setShowAchievements(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <AchievementsPanel
                achievements={achievementsRef.current.getAllAchievements()}
                stats={{
                  level: character.level || 1,
                  totalEarned: character.wealth || 0,
                  totalWealth: character.wealth || 0,
                  jobsCompleted: character.jobs_completed || 0,
                  propertiesOwned: character.properties?.length || 0
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Control hints */}
      <div className="fixed bottom-4 left-4 text-xs text-slate-400 pointer-events-none">
        <div>WASD/Arrows: Move</div>
        <div>Click Minimap: Navigate</div>
      </div>
    </div>
  )
}

export default GameIntegrationExample
