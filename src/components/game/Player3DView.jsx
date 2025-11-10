import React, { useEffect, useRef } from 'react'
import { World3D } from '../../lib/world3D'

export default function Player3DView({
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
  const keysRef = useRef({})
  const rafRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const world = new World3D(containerRef.current)
    world.cameraConfig.mode = 'isometric'
    world.cameraConfig.showNameplates = false
    world.start()
    worldRef.current = world

    // property click handler
    world.setPropertyClickHandler((prop) => {
      if (placingProperty) return // ignore when placing
      if (onPropertyClick) onPropertyClick(prop)
    })

    // add main player
    const id = (character && character.id) || `guest-${Math.random().toString(36).slice(2,8)}`
    playerIdRef.current = id
    ;(async () => {
      try {
        await world.addPlayer(id, (character && character.name) || 'Player', null, 0, 0)
      } catch (e) {
        console.warn('addPlayer failed', e)
      }
    })()

    // keyboard handlers for basic movement
    const handleDown = (e) => { keysRef.current[e.key.toLowerCase()] = true }
    const handleUp = (e) => { keysRef.current[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)

    // placement click handler: raycast to ground and call onConfirmPlace
    const onClick = (e) => {
      if (!placingProperty) return
      try {
        const rect = world.renderer.domElement.getBoundingClientRect()
        const mouse = {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((e.clientY - rect.top) / rect.height) * 2 + 1
        }
        world.raycaster.setFromCamera(mouse, world.camera)
        // intersect with ground plane (y ~ 0)
        const ground = world.scene.getObjectByName('groundPlane')
        if (ground) {
          const intersects = world.raycaster.intersectObject(ground)
          if (intersects && intersects.length) {
            const pt = intersects[0].point
            // convert world coords to DB location_x/location_y
            const worldWidth = 6000
            const worldHeight = 6000
            const locX = Math.round(((pt.x + (worldWidth/2)) / (worldWidth/2)) * 300)
            const locY = Math.round(((pt.z + (worldHeight/2)) / (worldHeight/2)) * 350)

            const GRID_W = Math.max(40, Math.floor((mapSettings?.sizeMultiplier || 10) * 40))
            const GRID_H = Math.max(30, Math.floor((mapSettings?.sizeMultiplier || 10) * 30))
            const gx = Math.max(0, Math.min(GRID_W - 1, Math.round(locX / (300 / GRID_W))))
            const gy = Math.max(0, Math.min(GRID_H - 1, Math.round(locY / (350 / GRID_H))))

            if (onConfirmPlace) onConfirmPlace({ x: locX, y: locY, gridX: gx, gridY: gy })
          }
        }
      } catch (err) { console.warn('placement click failed', err) }
    }

    world.renderer.domElement.addEventListener('click', onClick)

    // main loop: handle movement
    let last = performance.now()
    const loop = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const keys = keysRef.current
      const speed = (mapSettings?.avatarSpeed || 2) * 60
      let dx = 0, dz = 0
      if (keys['w'] || keys['arrowup']) dz -= 1
      if (keys['s'] || keys['arrowdown']) dz += 1
      if (keys['a'] || keys['arrowleft']) dx -= 1
      if (keys['d'] || keys['arrowright']) dx += 1
      const len = Math.hypot(dx, dz)
      if (len > 0) {
        dx /= len; dz /= len
        const playerId = playerIdRef.current
        if (playerId && world.players.has(playerId)) {
          const player = world.players.get(playerId)
          const nx = player.group.position.x + dx * speed * dt
          const nz = player.group.position.z + dz * speed * dt
          world.updatePlayerPosition(playerId, nx, nz)
          world.movePlayer(playerId, speed * dt)
          // report back to parent
          if (onCharacterMove) onCharacterMove({ x: nx, y: nz, city: character?.current_location || 'Manila' })
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      try {
        window.removeEventListener('keydown', handleDown)
        window.removeEventListener('keyup', handleUp)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        world.renderer.domElement.removeEventListener('click', onClick)
      } catch (e) {}
      try { world.destroy() } catch (e) {}
      worldRef.current = null
    }
  }, [])

  // sync properties when they change
  useEffect(() => {
    if (!worldRef.current) return
    try { worldRef.current.renderProperties(properties) } catch (e) { console.warn('renderProperties failed', e) }
  }, [properties])

  // update player name or position when character prop changes
  useEffect(() => {
    const world = worldRef.current
    const id = playerIdRef.current
    if (!world || !id) return
    try {
      // update nameplate if changed
      if (character && world.players.has(id)) {
        const entry = world.players.get(id)
        // simple name update by recreating nameplate texture - left as noop for now
      }
    } catch (e) {}
  }, [character])

  return (
    <div className="w-full h-full relative bg-slate-900">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
