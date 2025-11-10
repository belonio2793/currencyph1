import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// Lightweight self-contained 3D world renderer using three.js
// - Renders a pleasant grid + ground
// - Shows property markers and a player marker
// - Supports zoom in/out/reset and pointer click to place properties

export default function World3DRenderer({
  properties = [],
  character = null,
  onPropertyPlace = null, // (worldPos) => Promise
  onPropertyClick = null,
  initialAvatarPos,
  avatarStyle = { id: 1, name: 'Golden Classic', color: 0xd4a574, emissive: 0x6b5a3a },
  className = ''
}) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const playerRef = useRef(null)
  const playerLabelRef = useRef(null)
  const gltfModelRef = useRef(null)
  const markersRef = useRef(new Map())
  const [zoom, setZoom] = useState(3.5)
  const [cameraFollowEnabled, setCameraFollowEnabled] = useState(true)
  const cameraFollowRef = useRef(true)
  const [isFocused, setIsFocused] = useState(false)

  // Helper to create canvas texture for text
  const createTextTexture = (text, fontSize = 64) => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#00d4ff'
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    return texture
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // make container focusable for selection + keyboard
    try { container.tabIndex = 0 } catch(e){}

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x071228)
    sceneRef.current = scene

    // camera (positioned for 350% default zoom)
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 10000)
    camera.position.set(0, 57, 114)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // simple lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 0.6)
    dir.position.set(200, 400, 100)
    scene.add(dir)

    // ground plane
    const gridSize = 2000
    const divisions = 40
    const grid = new THREE.GridHelper(gridSize, divisions, 0x2b3946, 0x111621)
    grid.position.y = 0
    scene.add(grid)

    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0c1420, roughness: 1 })
    const groundGeo = new THREE.PlaneGeometry(gridSize, gridSize)
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.5
    scene.add(ground)

    // create player avatar group depending on selected model
    const playerGroup = new THREE.Group()
    const avatarMat = new THREE.MeshStandardMaterial({
      color: avatarStyle?.color || 0xd4a574,
      metalness: 0.6,
      roughness: 0.4,
      emissive: avatarStyle?.emissive || 0x6b5a3a,
      emissiveIntensity: 0.2
    })

    const addLabel = (name) => {
      const labelTexture = createTextTexture(name || 'Player', 48)
      const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture, emissive: 0x00d4ff, emissiveIntensity: 0.3, transparent: true })
      const labelGeo = new THREE.PlaneGeometry(60, 20)
      const labelMesh = new THREE.Mesh(labelGeo, labelMat)
      labelMesh.position.y = 35
      labelMesh.rotation.x = 0
      playerGroup.add(labelMesh)
      playerLabelRef.current = labelMesh
    }

    const model = (avatarStyle && avatarStyle.model) || (avatarStyle && avatarStyle.name && avatarStyle.name.toLowerCase()) || 'humanoid'

    if (model === 'dog' || model === 'cat' || model === 'detective_dog') {
      // simple quadruped
      const body = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 10), avatarMat)
      body.position.y = 8
      playerGroup.add(body)

      const head = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), avatarMat)
      head.position.set(12, 14, 0)
      playerGroup.add(head)

      // legs
      const legGeo = new THREE.BoxGeometry(3, 8, 3)
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(legGeo, avatarMat)
        const x = i < 2 ? -6 : 6
        const z = (i % 2 === 0) ? -3 : 3
        leg.position.set(x, 4, z)
        playerGroup.add(leg)
      }

      // ears for cat/dog
      const earGeo = new THREE.ConeGeometry(2, 4, 6)
      const earL = new THREE.Mesh(earGeo, avatarMat)
      earL.rotation.z = 0.3
      earL.position.set(14, 18, -2)
      playerGroup.add(earL)
      const earR = earL.clone()
      earR.position.set(14, 18, 2)
      playerGroup.add(earR)

      addLabel(character?.name || 'Player')
    } else if (model === 'fireman' || model === 'chef' || model === 'doctor' || model === 'ninja' || model === 'detective') {
      // humanoid with a hat/helmet
      const head = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 16), avatarMat)
      head.position.y = 34
      playerGroup.add(head)

      const body = new THREE.Mesh(new THREE.CapsuleGeometry(7, 18, 4, 8), avatarMat)
      body.position.y = 14
      playerGroup.add(body)

      const armGeo = new THREE.CapsuleGeometry(3.5, 14, 4, 8)
      const leftArm = new THREE.Mesh(armGeo, avatarMat)
      leftArm.position.set(-12, 16, 0)
      leftArm.rotation.z = Math.PI / 2.2
      playerGroup.add(leftArm)
      const rightArm = leftArm.clone()
      rightArm.position.set(12, 16, 0)
      rightArm.rotation.z = -Math.PI / 2.2
      playerGroup.add(rightArm)

      const legGeo = new THREE.CapsuleGeometry(3.5, 14, 4, 8)
      const leftLeg = new THREE.Mesh(legGeo, avatarMat)
      leftLeg.position.set(-5, 2, 0)
      playerGroup.add(leftLeg)
      const rightLeg = leftLeg.clone()
      rightLeg.position.set(5, 2, 0)
      playerGroup.add(rightLeg)

      // helmet or hat
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 4, 12), avatarMat)
      hat.position.y = 40
      playerGroup.add(hat)

      addLabel(character?.name || 'Player')
    } else if (model === 'robot') {
      // blocky robot
      const body = new THREE.Mesh(new THREE.BoxGeometry(16, 20, 10), avatarMat)
      body.position.y = 16
      playerGroup.add(body)

      const head = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), avatarMat)
      head.position.y = 32
      playerGroup.add(head)

      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6), avatarMat)
      antenna.position.set(0, 38, 0)
      playerGroup.add(antenna)

      addLabel(character?.name || 'Player')
    } else if (model === 'unicorn' || model === 'fairy') {
      // fantasy creature - unicorn
      const body = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 8), avatarMat)
      body.position.y = 8
      playerGroup.add(body)

      const head = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), avatarMat)
      head.position.set(10, 14, 0)
      playerGroup.add(head)

      const horn = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6, 8), avatarMat)
      horn.position.set(13, 18, 0)
      horn.rotation.z = Math.PI / 2
      playerGroup.add(horn)

      addLabel(character?.name || 'Player')
    } else {
      // default humanoid
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(10, 4), avatarMat)
      head.position.y = 34
      playerGroup.add(head)

      const body = new THREE.Mesh(new THREE.CapsuleGeometry(7, 18, 4, 8), avatarMat)
      body.position.y = 14
      playerGroup.add(body)

      const armGeo = new THREE.CapsuleGeometry(4, 16, 4, 8)
      const leftArm = new THREE.Mesh(armGeo, avatarMat)
      leftArm.position.set(-13, 16, 0)
      leftArm.rotation.z = Math.PI / 2.2
      playerGroup.add(leftArm)

      const rightArm = new THREE.Mesh(armGeo, avatarMat)
      rightArm.position.set(13, 16, 0)
      rightArm.rotation.z = -Math.PI / 2.2
      playerGroup.add(rightArm)

      const legGeo = new THREE.CapsuleGeometry(4, 16, 4, 8)
      const leftLeg = new THREE.Mesh(legGeo, avatarMat)
      leftLeg.position.set(-5, 2, 0)
      playerGroup.add(leftLeg)
      const rightLeg = new THREE.Mesh(legGeo, avatarMat)
      rightLeg.position.set(5, 2, 0)
      playerGroup.add(rightLeg)

      addLabel(character?.name || 'Player')
    }

    scene.add(playerGroup)
    playerRef.current = playerGroup
    const avatarX = initialAvatarPos?.x ?? 0
    const avatarZ = initialAvatarPos?.z ?? 0
    playerGroup.position.set(avatarX, 0, avatarZ)


    // controls (orbit) - dynamic import to avoid build surprises
    let controls = null
    let controlsModule = null
    import('three/examples/jsm/controls/OrbitControls').then((mod) => {
      controlsModule = mod
      controls = new mod.OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 0, 0)
      controls.enablePan = true
      controls.enableDamping = true
      controls.dampingFactor = 0.12
      controls.zoomSpeed = 1.0
      controlsRef.current = controls
    }).catch(() => { /* ignore if unavailable */ })

    // resize
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // focus/selection visuals: show yellow highlight only when container is focused and avatar can be moved
    const onFocus = () => { try { setIsFocused(true) } catch(e){} }
    const onBlur = () => { try { setIsFocused(false) } catch(e){} }
    container.addEventListener('focus', onFocus)
    container.addEventListener('blur', onBlur)

    // keyboard movement
    const keys = { current: {} }
    const handleKeyDown = (e) => {
      if (document.activeElement !== container) return
      const k = e.key.toLowerCase()
      if (['arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault()
      keys.current[k] = true
    }
    const handleKeyUp = (e) => {
      if (document.activeElement !== container) return
      const k = e.key.toLowerCase()
      keys.current[k] = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // click handler for placing properties
    const onClick = async (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycasterRef.current.setFromCamera(mouseRef.current, camera)
      const intersects = raycasterRef.current.intersectObject(ground)
      if (intersects && intersects.length) {
        const pt = intersects[0].point
        // snap to grid
        const snap = 10
        const x = Math.round(pt.x / snap) * snap
        const z = Math.round(pt.z / snap) * snap
        if (typeof onPropertyPlace === 'function') {
          try { await onPropertyPlace({ x, z }) } catch (err) { console.warn('onPropertyPlace failed', err) }
        }
      }
    }
    renderer.domElement.addEventListener('click', onClick)

    // animation loop with movement
    let rafId = null
    let prevTime = null
    const speed = 200 // units per second
    const cameraOffset = { x: 0, y: 57, z: 114 } // offset from player for 350% zoom
    const animate = (time) => {
      const now = time || performance.now()
      const dt = prevTime ? Math.min(0.05, (now - prevTime) / 1000) : 0
      prevTime = now

      // movement only when container focused
      try {
        const player = playerRef.current
        if (player && document.activeElement === container) {
          let dx = 0, dz = 0
          const k = keys.current
          if (k['w'] || k['arrowup']) dz -= 1
          if (k['s'] || k['arrowdown']) dz += 1
          if (k['a'] || k['arrowleft']) dx -= 1
          if (k['d'] || k['arrowright']) dx += 1
          const len = Math.hypot(dx, dz)
          if (len > 0) {
            dx /= len; dz /= len
            player.position.x += dx * speed * dt
            player.position.z += dz * speed * dt
            // rotate body to face movement
            try { player.rotation.y = Math.atan2(dx, dz) } catch(e){}
          }
        }
      } catch (e) { /* ignore movement errors */ }

      // camera follow: keep camera centered on player (if enabled)
      try {
        const player = playerRef.current
        if (player && camera && cameraFollowRef.current) {
          const playerX = player.position.x
          const playerZ = player.position.z
          camera.position.x = playerX + cameraOffset.x
          camera.position.y = cameraOffset.y
          camera.position.z = playerZ + cameraOffset.z
          camera.lookAt(playerX, 0, playerZ)
          if (controlsRef.current) {
            controlsRef.current.target.set(playerX, 0, playerZ)
          }
        }
      } catch (e) { /* ignore camera follow errors */ }

      renderer.render(scene, camera)
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      try { cancelAnimationFrame(rafId) } catch (e) {}
      try { renderer.domElement.removeEventListener('click', onClick) } catch (e) {}
      try { window.removeEventListener('resize', onResize) } catch (e) {}
      try { container.removeEventListener('focus', onFocus) } catch(e){}
      try { container.removeEventListener('blur', onBlur) } catch(e){}
      try { window.removeEventListener('keydown', handleKeyDown) } catch(e){}
      try { window.removeEventListener('keyup', handleKeyUp) } catch(e){}
      try { if (controlsRef.current) controlsRef.current.dispose() } catch(e){}
      try { if (container && container.__removeModel) container.__removeModel() } catch(e){}
      try { renderer.dispose() } catch(e) {}
      try { container.removeChild(renderer.domElement) } catch(e) {}
      sceneRef.current = null
      rendererRef.current = null
      cameraRef.current = null
      controlsRef.current = null
    }
  }, [])

  // sync properties markers
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // remove old markers
    const markers = markersRef.current
    markers.forEach((mesh, id) => {
      try { scene.remove(mesh) } catch(e){}
    })
    markers.clear()

    // create new markers
    properties.forEach((p) => {
      try {
        const g = new THREE.Group()
        const color = p.owner_id ? 0x4caf50 : 0xffd166
        const geom = new THREE.BoxGeometry(12, 12, 12)
        const mat = new THREE.MeshStandardMaterial({ color })
        const m = new THREE.Mesh(geom, mat)
        m.position.y = 6
        g.add(m)
        g.position.set((p.location_x || 0), 0, (p.location_y || 0))
        scene.add(g)
        markers.set(p.id || `${p.type}-${Math.random().toString(36).slice(2,6)}`, g)
      } catch (e) { console.warn('marker create failed', e) }
    })
  }, [properties])

  // sync player
  useEffect(() => {
    const player = playerRef.current
    const labelMesh = playerLabelRef.current
    if (!player) return
    if (character && (character.position_x !== undefined || character.position_y !== undefined)) {
      const x = character.position_x || 0
      const z = character.position_y || 0
      player.position.set(x, 0, z)
    }
    if (character && character.name && labelMesh) {
      const newTexture = createTextTexture(character.name, 48)
      labelMesh.material.map = newTexture
      labelMesh.material.transparent = true
      labelMesh.material.needsUpdate = true
    }
  }, [character])

  // sync camera follow toggle to ref for use in animation loop
  useEffect(() => {
    cameraFollowRef.current = cameraFollowEnabled
  }, [cameraFollowEnabled])

  // load GLTF model when avatarStyle changes
  useEffect(() => {
    const modelUrl = avatarStyle?.model_url
    const player = playerRef.current
    const renderer = rendererRef.current
    if (!player || !renderer) return

    // remove previous
    try { if (gltfModelRef.current) { player.remove(gltfModelRef.current); gltfModelRef.current = null } } catch(e){}

    if (!modelUrl) return
    if (!renderer._modelCache) renderer._modelCache = new Map()
    const cache = renderer._modelCache
    let cancelled = false

    const load = async () => {
      try {
        if (cache.has(modelUrl)) {
          const cached = cache.get(modelUrl)
          const instance = cached.clone()
          const scale = (avatarStyle && avatarStyle.model_scale) || 1
          const off = (avatarStyle && avatarStyle.model_offset) || { x:0, y:0, z:0 }
          instance.scale.set(scale, scale, scale)
          instance.position.set(off.x || 0, off.y || 0, off.z || 0)
          player.add(instance)
          gltfModelRef.current = instance
          return
        }
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader')
        const loader = new GLTFLoader()
        loader.load(modelUrl, (gltf) => {
          if (cancelled) return
          const sceneModel = gltf.scene || gltf.scenes?.[0]
          if (!sceneModel) return
          cache.set(modelUrl, sceneModel)
          const instance = sceneModel.clone()
          const scale = (avatarStyle && avatarStyle.model_scale) || 1
          const off = (avatarStyle && avatarStyle.model_offset) || { x:0, y:0, z:0 }
          instance.scale.set(scale, scale, scale)
          instance.position.set(off.x || 0, off.y || 0, off.z || 0)
          player.add(instance)
          gltfModelRef.current = instance
        }, undefined, (err) => { console.warn('GLTF load error', err) })
      } catch (e) { console.warn('Failed to load GLTF', e) }
    }

    load()

    return () => {
      cancelled = true
      try { if (gltfModelRef.current) { player.remove(gltfModelRef.current); gltfModelRef.current = null } } catch(e){}
    }
  }, [avatarStyle, character])

  // zoom controls exposed
  const zoomIn = () => {
    const cam = cameraRef.current
    if (!cam) return
    cam.position.multiplyScalar(0.85)
    setZoom((z) => z * 1.15)
  }
  const zoomOut = () => {
    const cam = cameraRef.current
    if (!cam) return
    cam.position.multiplyScalar(1.15)
    setZoom((z) => z * 0.85)
  }
  const zoomReset = () => {
    const cam = cameraRef.current
    if (!cam) return
    cam.position.set(0, 57, 114)
    setZoom(3.5)
  }

  const zoomPercentage = Math.round(zoom * 100)

  return (
    <div ref={containerRef} className={`w-full h-full relative ${className}`}>
      {/* Highlight only when focused and avatar movable */}
      {isFocused && <div className="pointer-events-none absolute inset-0 border-4 border-[#ffd133] rounded-sm" /> }
      <div className="absolute right-4 top-4 z-50 flex flex-col gap-2">
        <button onClick={zoomIn} className="w-10 h-10 bg-white/6 hover:bg-white/10 rounded flex items-center justify-center text-white font-bold">+</button>
        <div className="px-2 py-1 bg-white/6 rounded flex items-center justify-center text-white text-xs font-semibold whitespace-nowrap">
          {zoomPercentage}%
        </div>
        <button onClick={zoomOut} className="w-10 h-10 bg-white/6 hover:bg-white/10 rounded flex items-center justify-center text-white font-bold">−</button>
        <button onClick={zoomReset} className="w-10 h-8 bg-white/6 hover:bg-white/10 rounded flex items-center justify-center text-white text-xs">reset</button>
        <button
          onClick={() => setCameraFollowEnabled(!cameraFollowEnabled)}
          className={`w-10 h-10 rounded flex items-center justify-center text-xs font-bold transition-colors ${
            cameraFollowEnabled
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-white/6 hover:bg-white/10 text-white'
          }`}
          title={cameraFollowEnabled ? 'Camera follow enabled' : 'Camera follow disabled'}
        >
          📷
        </button>
      </div>
    </div>
  )
}
