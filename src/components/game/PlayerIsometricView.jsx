import React, { useEffect, useRef, useState } from 'react'
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

  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)

  const applyZoomToWorld = (z) => {
    try {
      const world = worldRef.current
      if (!world || !world.camera) return
      world.camera.zoom = Math.max(0.3, Math.min(3, z))
      try { world.camera.updateProjectionMatrix() } catch(e){}
      try { if (typeof world.handleResize === 'function') world.handleResize() } catch(e){}
      try { if (typeof world.render === 'function') world.render() } catch(e){}
    } catch (e) { console.warn('applyZoomToWorld failed', e) }
  }

  const setZoomLevel = (z) => {
    zoomRef.current = z
    setZoom(z)
    applyZoomToWorld(z)
  }

  const zoomIn = () => setZoomLevel(Math.min(3, (zoomRef.current || 1) + 0.25))
  const zoomOut = () => setZoomLevel(Math.max(0.3, (zoomRef.current || 1) - 0.25))
  const zoomReset = () => setZoomLevel(1)

  useEffect(() => {
    if (!containerRef.current) return

    let mounted = true

    // Wait for container to have a non-zero size (helps when parent uses flex or height is set later)
    const waitForSize = () => new Promise((resolve) => {
      const el = containerRef.current
      if (!el) return resolve()
      if (el.clientWidth > 0 && el.clientHeight > 0) return resolve()

      // Use ResizeObserver when available
      let ro = null
      const timeout = setTimeout(() => {
        try { if (ro) ro.disconnect() } catch(e){}
        resolve()
      }, 500)

      try {
        ro = new ResizeObserver(() => {
          if (!el) return
          if (el.clientWidth > 0 && el.clientHeight > 0) {
            clearTimeout(timeout)
            try { if (ro) ro.disconnect() } catch(e){}
            resolve()
          }
        })
        ro.observe(el)
      } catch (e) {
        // fallback: short delay
        setTimeout(() => resolve(), 100)
      }
    })

    const init = async () => {
      await waitForSize()
      if (!mounted || !containerRef.current) return

      // Significantly larger grid for expansive exploration
      const world = new WorldIsometric(containerRef.current, { cols: Math.max(80, Math.floor((mapSettings.sizeMultiplier || 10) * 8)), rows: Math.max(50, Math.floor((mapSettings.sizeMultiplier || 10) * 5)), tileSize: 36 })
      worldRef.current = world
      try { if (typeof onWorldReady === 'function') onWorldReady(world) } catch(e){}

      // ensure container is focusable for keyboard input
      try {
        if (containerRef.current) {
          containerRef.current.tabIndex = 0
          const onDownFocus = () => { try { containerRef.current.focus() } catch(e){} }
          containerRef.current.addEventListener('mousedown', onDownFocus)
          // cleanup on destroy
          world._onContainerFocusCleanup = () => { try { containerRef.current.removeEventListener('mousedown', onDownFocus) } catch(e){} }
        }
      } catch(e) {}

      // click handlers
      try {
        world.setTileClickHandler((grid) => {
          if (placingProperty) return
          if (onPropertyClick) onPropertyClick({ grid })
        })

        world.setPlayerClickHandler((pl) => {
          if (placingProperty) return
          if (onPropertyClick) onPropertyClick({ player: pl })
        })
      } catch(e) { console.warn('world handler setup failed', e) }

      // add player
      try {
        const id = (character && character.id) || `guest-${Math.random().toString(36).slice(2,8)}`
        playerIdRef.current = id
        const startPos = initialAvatarPos ? { x: initialAvatarPos.x, z: initialAvatarPos.y } : { x: 0, z: 0 }
        world.addPlayer(id, (character && character.name) || 'Player', 0x00a8ff, startPos.x, startPos.z)
      } catch(e) { console.warn('addPlayer failed', e) }

      // Trigger an initial resize to ensure renderer matches container
      try { world.handleResize() } catch(e) {}

      // expose cleanup
      return
    }

    let cleanupPromise = null
    init().then((res) => { cleanupPromise = res }).catch((e) => { console.warn('init world failed', e) })

    return () => {
      mounted = false
      try {
        const world = worldRef.current
        if (world && world._onContainerFocusCleanup) try { world._onContainerFocusCleanup() } catch(e){}
        try { world && world.destroy() } catch(e) {}
      } catch(e) {}
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
  // Movement: keyboard handlers (WASD + Arrow keys)
  useEffect(() => {
    const keys = { current: {} }
    const rafRef = { current: null }
    const world = worldRef.current
    if (!world) return

    const handleDown = (e) => {
      const k = e.key.toLowerCase()
      if (['arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault()
      keys.current[k] = true
    }
    const handleUp = (e) => {
      const k = e.key.toLowerCase()
      keys.current[k] = false
    }
    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)

    let last = performance.now()
    const speed = (mapSettings?.avatarSpeed || 2) * 60
    const loop = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      try {
        const pid = playerIdRef.current
        if (pid && world && world.players && world.players.has(pid)) {
          const player = world.players.get(pid)
          let dx = 0, dz = 0
          const k = keys.current
          if (k['w'] || k['arrowup']) dz -= 1
          if (k['s'] || k['arrowdown']) dz += 1
          if (k['a'] || k['arrowleft']) dx -= 1
          if (k['d'] || k['arrowright']) dx += 1
          const len = Math.hypot(dx, dz)
          if (len > 0) {
            dx /= len; dz /= len
            const nx = player.group.position.x + dx * speed * dt
            const nz = player.group.position.z + dz * speed * dt
            // update position (smooth by delta time)
            player.group.position.x = nx
            player.group.position.z = nz

            // smooth rotation to face movement direction (360°)
            try {
              const targetAngle = Math.atan2(dx, dz)
              const cur = (player.group.rotation && player.group.rotation.y) || 0
              const angleDiff = ((targetAngle - cur + Math.PI) % (Math.PI * 2)) - Math.PI
              const rotSpeed = 8 // how quickly the avatar turns
              player.group.rotation.y = cur + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), rotSpeed * dt)
            } catch (e) { /* ignore rotation errors */ }

            // notify parent
            if (typeof onCharacterMove === 'function') {
              try { onCharacterMove({ x: nx, y: nz, city: character?.current_location || 'Manila' }) } catch(e) {}
            }
          }
        }
      } catch (e) { console.warn('movement loop error', e) }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      try {
        window.removeEventListener('keydown', handleDown)
        window.removeEventListener('keyup', handleUp)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      } catch(e){}
    }
  }, [mapSettings, character])

  // Drag-and-drop handlers for container
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
  const handleDrop = async (e) => {
    e.preventDefault()
    try {
      const world = worldRef.current
      if (!world) return
      const payload = e.dataTransfer.getData('application/json')
      if (!payload) return
      const data = JSON.parse(payload)
      const rect = containerRef.current.getBoundingClientRect()
      const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX)
      const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY)
      const pt = world._getMouseWorld(clientX, clientY)
      if (pt) {
        const uid = (character && character.id) || null
        await world.placePropertyAt({ x: pt.x, z: pt.z }, uid)
      }
    } catch (err) { console.warn('drop failed', err) }
  }

  // If WebGL failed to mount inside WorldIsometric, create a simple 2D canvas renderer as a recreation
  const fallbackCanvasRef = useRef(null)
  useEffect(() => {
    const world = worldRef.current
    const container = containerRef.current
    if (!container) return

    // detect if three renderer is present
    const hasThreeCanvas = world && world.renderer && world.renderer.domElement && world.renderer.domElement.parentNode
    if (hasThreeCanvas) {
      // ensure any previous fallback is removed
      if (fallbackCanvasRef.current) {
        try { container.removeChild(fallbackCanvasRef.current) } catch(e){}
        fallbackCanvasRef.current = null
      }
      return
    }

    // create fallback canvas
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.background = 'transparent'
    canvas.className = 'fallback-isometric-canvas'
    canvas.setAttribute('data-engine', 'fallback-isometric')
    container.appendChild(canvas)
    fallbackCanvasRef.current = canvas

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    const cols = (world && world.cols) || Math.max(80, Math.floor((mapSettings.sizeMultiplier || 10) * 8))
    const rows = (world && world.rows) || Math.max(50, Math.floor((mapSettings.sizeMultiplier || 10) * 5))

    const resize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      ctx.setTransform(dpr,0,0,dpr,0,0)
      draw()
    }

    const draw = () => {
      if (!ctx) return
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      // background
      ctx.clearRect(0,0,w,h)
      ctx.fillStyle = '#071228'
      ctx.fillRect(0,0,w,h)

      // tile grid
      const baseCellW = Math.max(6, Math.floor(w / cols))
      const baseCellH = Math.max(6, Math.floor(h / rows))
      const cellW = Math.max(4, Math.floor(baseCellW * (zoomRef.current || 1)))
      const cellH = Math.max(4, Math.floor(baseCellH * (zoomRef.current || 1)))
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cellW
          const y = r * cellH
          ctx.fillStyle = (c + r) % 2 === 0 ? '#5b6470' : '#53606f'
          ctx.fillRect(x+1, y+1, cellW-2, cellH-2)
        }
      }

      // roads
      ctx.fillStyle = '#2b2b2b'
      for (let r = 0; r <= rows; r++) if (r % 6 === 0) ctx.fillRect(0, r*cellH, w, Math.max(2, Math.floor(cellH*0.6)))
      for (let c = 0; c <= cols; c++) if (c % 6 === 0) ctx.fillRect(c*cellW, 0, Math.max(2, Math.floor(cellW*0.6)), h)

      // properties
      try {
        for (const p of properties || []) {
          const gx = Math.max(0, Math.min(cols-1, Math.round((p.location_x || 0) / (300 / cols))))
          const gy = Math.max(0, Math.min(rows-1, Math.round((p.location_y || 0) / (350 / rows))))
          const x = gx * cellW + cellW/2
          const y = gy * cellH + cellH/2
          ctx.fillStyle = p.owner_id ? '#4caf50' : '#ffd166'
          ctx.beginPath()
          ctx.arc(x, y, Math.max(6, Math.min(cellW, cellH) * 0.28), 0, Math.PI*2)
          ctx.fill()
        }
      } catch(e) {}

      // player marker (approximate)
      try {
        const pid = playerIdRef.current
        if (pid && world && world.players && world.players.has(pid)) {
          const pl = world.players.get(pid)
          const wx = pl.group.position.x
          const wz = pl.group.position.z
          const gx = Math.floor((wx + (cols* (world.tileSize || 36))/2) / (cols*(world.tileSize || 36)) * cols)
          const gy = Math.floor((wz + (rows*(world.tileSize || 36))/2) / (rows*(world.tileSize || 36)) * rows)
          const x = (gx+0.5) * cellW
          const y = (gy+0.5) * cellH
          ctx.fillStyle = '#00a8ff'
          ctx.beginPath()
          ctx.arc(x, y, Math.max(6, Math.min(cellW, cellH) * 0.35), 0, Math.PI*2)
          ctx.fill()
        }
      } catch(e) {}
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    let rafId = null
    const anim = () => { draw(); rafId = requestAnimationFrame(anim) }
    rafId = requestAnimationFrame(anim)

    return () => {
      try { if (rafId) cancelAnimationFrame(rafId) } catch(e){}
      try { ro.disconnect() } catch(e){}
      try { if (fallbackCanvasRef.current) container.removeChild(fallbackCanvasRef.current) } catch(e){}
      fallbackCanvasRef.current = null
    }
  }, [worldRef.current, properties, mapSettings, character])

  // helper for dragstart
  const onDragStartItem = (e, type) => {
    try {
      e.dataTransfer.setData('application/json', JSON.stringify({ type }))
      e.dataTransfer.effectAllowed = 'copy'
      // enter placement preview
      const world = worldRef.current
      const uid = (character && character.id) || null
      if (world) world.enablePlacementMode({ type }, uid)
    } catch (err) { console.warn('dragstart failed', err) }
  }

  const onDragEndItem = (e) => {
    try {
      const world = worldRef.current
      if (world) world.enablePlacementMode(null)
    } catch (err) { console.warn('dragend failed', err) }
  }

  return (
    <div className="w-full h-full relative bg-transparent">
      <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: 200 }} onDragOver={handleDragOver} onDrop={handleDrop} />

      {/* Zoom Controls Overlay */}
      <div className="absolute right-4 top-4 z-50 flex flex-col gap-2">
        <button onClick={zoomIn} aria-label="Zoom in" className="w-10 h-10 bg-white/6 hover:bg-white/10 rounded flex items-center justify-center text-white font-bold">+</button>
        <button onClick={zoomOut} aria-label="Zoom out" className="w-10 h-10 bg-white/6 hover:bg-white/10 rounded flex items-center justify-center text-white font-bold">−</button>
        <button onClick={zoomReset} aria-label="Reset zoom" className="w-10 h-8 bg-white/6 hover:bg-white/10 rounded flex items-center justify-center text-white text-xs">reset</button>
      </div>

      {/* Property UI Overlay */}
      <div className="absolute left-4 bottom-4 z-40 w-64">
        <div className="bg-white/5 backdrop-blur p-3 rounded shadow border border-white/5">
          <div className="text-sm font-semibold text-white mb-2">Properties</div>
          <div className="flex flex-col gap-2">
            {['house','shop','factory'].map(type => (
              <div key={type} className="flex items-center justify-between bg-white/3 p-2 rounded">
                <div className="text-xs text-white capitalize">{type}</div>
                <div className="flex gap-2">
                  <button
                    draggable
                    onDragStart={(e) => onDragStartItem(e, type)}
                    onDragEnd={onDragEndItem}
                    onClick={async () => {
                      try {
                        const world = worldRef.current
                        const uid = (character && character.id) || null
                        if (world) world.enablePlacementMode({ type }, uid)
                      } catch (e) { console.warn('enter placement failed', e) }
                    }}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                  >Place</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
