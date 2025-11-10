import React, { useEffect, useRef } from 'react'
import React, { useEffect, useRef } from 'react'
import { WorldIsometric } from '../../lib/worldIsometric'

export default function PlayerIsometricView({
  properties = [],
  character = null,
  initialAvatarPos = null,
  onCharacterMove = null,
  mapSettings = {},
  placingProperty = null,
  onConfirmPlace = null,
  onCancelPlace = null,
  onPropertyClick = null,
  onWorldReady = null
}) {
  const containerRef = useRef(null)
  const worldRef = useRef(null)
  const playerIdRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const world = new WorldIsometric(containerRef.current, { cols: Math.max(20, Math.floor((mapSettings.sizeMultiplier || 10) * 3)), rows: Math.max(12, Math.floor((mapSettings.sizeMultiplier || 10) * 2)), tileSize: 48 })
    worldRef.current = world
    if (typeof onWorldReady === 'function') onWorldReady(world)

    // click handlers
    world.setTileClickHandler((grid) => {
      if (placingProperty) return
      if (onPropertyClick) onPropertyClick({ grid })
    })

    world.setPlayerClickHandler((pl) => {
      if (placingProperty) return
      if (onPropertyClick) onPropertyClick({ player: pl })
    })

    // add player
    const id = (character && character.id) || `guest-${Math.random().toString(36).slice(2,8)}`
    playerIdRef.current = id
    const startPos = initialAvatarPos ? { x: initialAvatarPos.x, z: initialAvatarPos.y } : { x: 0, z: 0 }
    try { world.addPlayer(id, (character && character.name) || 'Player', 0x00a8ff, startPos.x, startPos.z) } catch(e) {}

    return () => {
      try { world.destroy() } catch(e) {}
      worldRef.current = null
    }
  }, [])

  // sync properties to simple markers: here we'll color tiles for properties
  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    try {
      // reset all tiles color
      for (const t of world.tiles) {
        if (t && t.material) t.material.color.setHex(0x6b6b75)
      }
      for (const p of properties || []) {
        const gx = Math.max(0, Math.min(world.cols-1, Math.round((p.location_x || 0) / (300 / world.cols))))
        const gy = Math.max(0, Math.min(world.rows-1, Math.round((p.location_y || 0) / (350 / world.rows))))
        const idx = gy * world.cols + gx
        const tile = world.tiles[idx]
        if (tile && tile.material) {
          tile.material.color.setHex(p.owner_id ? 0x4caf50 : 0xffd166)
        }
      }
    } catch (e) { console.warn('sync properties failed', e) }
  }, [properties])

  // Expose simple API: start job for current player
  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    // attach to DOM for external use
    return () => {}
  }, [])

  return (
    <div className="w-full h-full relative bg-transparent">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
