import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { getMapTexture, createMapSky } from './googleMapsIntegration'
import { MapTileManager } from './mapTileManager'
import { latLngToWorldCoords } from './mapUtils'
import { PropertyBuildingRenderer, StreetGridRenderer, PropertyMarkerEnhanced } from './world3DEnhancements'

const gltfLoader = new GLTFLoader()
const modelCache = new Map()

export class World3D {
  constructor(container, mapCenter = { lat: 14.5995, lng: 120.9842 }) {
    this.container = container
    this.mapCenter = mapCenter
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.Fog(0x1a1a2e, 2000, 8000)

    // Camera settings with presets
    this.cameraConfig = {
      mode: 'firstperson', // firstperson, topdown, isometric, thirdperson, freecam
      height: 600,
      distance: 400,
      angle: 45,
      fov: 75,
      baseFov: 75,
      zoom: 1.2,
      enableShadows: true,
      enableFog: true,
      showNameplates: true
    }

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      this.cameraConfig.fov,
      container.clientWidth / container.clientHeight,
      0.1,
      8000
    )
    this.camera.position.set(0, 600, 400)

    // Setup renderer with better quality
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      precision: 'highp'
    })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowShadowMap
    this.renderer.shadowMap.resolution = 2048
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.container.appendChild(this.renderer.domElement)

    // Scene setup
    this.setupLighting()
    this.setupEnvironment()
    this.setupGround()

    // Initialize map tile manager for dynamic Philippines regions
    this.mapTileManager = new MapTileManager(this.scene)

    // Initialize rendering enhancers
    this.buildingRenderer = new PropertyBuildingRenderer(this.scene)
    this.streetRenderer = new StreetGridRenderer(this.scene)
    this.streetRenderer.createStreetGrid(6000, 200)

    // Players and NPCs
    this.players = new Map()
    this.npcs = new Map()
    this.selectedPlayer = null

    // Property markers group
    this.propertyMarkers = new Map()
    this.propertiesGroup = new THREE.Group()
    this.propertiesGroup.name = 'propertiesGroup'
    this.scene.add(this.propertiesGroup)

    // Animation and state
    this.animationFrameId = null
    this.clock = new THREE.Clock()
    this.deltaTime = 0

    // Raycaster for interactions
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    // Handle window resize
    this.onWindowResize = () => this.handleResize()
    window.addEventListener('resize', this.onWindowResize)

    // Listen for interaction clicks
    this.onMouseClick = (e) => this.handleMouseClick(e)
    this.renderer.domElement.addEventListener('click', this.onMouseClick)
  }
  
  setupLighting() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambientLight)

    // Directional light (sun)
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2)
    this.sunLight.position.set(1000, 1200, 800)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.width = 4096
    this.sunLight.shadow.mapSize.height = 4096
    this.sunLight.shadow.camera.left = -3000
    this.sunLight.shadow.camera.right = 3000
    this.sunLight.shadow.camera.top = 3000
    this.sunLight.shadow.camera.bottom = -3000
    this.sunLight.shadow.camera.far = 5000
    this.sunLight.shadow.bias = -0.0001
    this.scene.add(this.sunLight)

    // Hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x1a1a2e, 0.4)
    this.scene.add(hemiLight)
  }

  setupEnvironment() {
    // Create Philippines tropical sky
    createMapSky(this.scene, 5000)
  }
  
  setupGround() {
    // Create ground with Google Maps satellite imagery
    const groundGeometry = new THREE.PlaneGeometry(6000, 6000)

    // Create fallback texture while loading Google Maps
    const fallbackCanvas = document.createElement('canvas')
    fallbackCanvas.width = 256
    fallbackCanvas.height = 256
    const ctx = fallbackCanvas.getContext('2d')
    ctx.fillStyle = '#2a8c4a'
    ctx.fillRect(0, 0, 256, 256)

    const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas)
    fallbackTexture.magFilter = THREE.LinearFilter
    fallbackTexture.minFilter = THREE.LinearMipmapLinearFilter

    const groundMaterial = new THREE.MeshStandardMaterial({
      map: fallbackTexture,
      roughness: 0.8,
      metalness: 0.0
    })

    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    ground.position.y = -0.5
    ground.name = 'groundPlane'
    this.scene.add(ground)

    // Load Google Maps satellite imagery asynchronously
    this.loadGoogleMapsTexture(ground, this.mapCenter.lat, this.mapCenter.lng)

    // Add a subtle grid helper
    const gridHelper = new THREE.GridHelper(5000, 50, 0x444444, 0x222222)
    gridHelper.position.y = 0.1
    this.scene.add(gridHelper)
  }

  async loadGoogleMapsTexture(groundMesh, lat, lng) {
    try {
      const mapTexture = await getMapTexture(lat, lng, 13, 512)
      groundMesh.material.map = mapTexture
      groundMesh.material.needsUpdate = true
    } catch (err) {
      console.warn('Failed to load Google Maps texture:', err)
    }
  }

  renderProperties(properties = [], worldWidth = 6000, worldHeight = 6000) {
    try {
      this.clearProperties()

      for (const prop of properties) {
        try {
          let x, y

          if (prop.lat != null && prop.lng != null) {
            const lat = prop.lat || prop.latitude || prop.location_lat
            const lng = prop.lng || prop.longitude || prop.location_lng
            const coords = latLngToWorldCoords(worldWidth, worldHeight, lat, lng)
            x = coords.x
            y = coords.y
          } else if (prop.location_x != null && prop.location_y != null) {
            x = (prop.location_x / 300) * (worldWidth / 2) - (worldWidth / 2)
            y = (prop.location_y / 350) * (worldHeight / 2) - (worldHeight / 2)
          } else {
            continue
          }

          const marker = PropertyMarkerEnhanced.createAdvancedMarker(prop, prop.owner_id ? 0x4caf50 : 0xffd166)
          marker.position.set(x, 0, y)

          const building = this.buildingRenderer.createPropertyBuilding(
            prop.id,
            { x, y },
            prop.property_type || 'shop',
            prop.current_value || prop.price || 50000
          )

          this.propertyMarkers.set(prop.id, { prop, marker, building })
          this.propertiesGroup.add(marker)
        } catch (e) {
          console.warn('Failed to create property marker for', prop && prop.id, e)
        }
      }
    } catch (err) {
      console.warn('renderProperties error:', err)
    }
  }

  clearProperties() {
    try {
      for (const [id, entry] of this.propertyMarkers) {
        if (entry && entry.marker) {
          this.propertiesGroup.remove(entry.marker)
          this.buildingRenderer.removeBuilding(id)
        }
      }
      this.propertyMarkers.clear()
    } catch (err) {
      console.warn('clearProperties error:', err)
    }
  }

  _createPropertyMarker(prop, x, y) {
    // Create a canvas texture with price text
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = 'rgba(20,20,30,0.8)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Price
    ctx.fillStyle = '#ffd166'
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    const priceText = prop.price ? `₱${Number(prop.price).toLocaleString()}` : '₱0'
    ctx.fillText(priceText, canvas.width / 2, 50)

    // Owner or status
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px Arial'
    const ownerText = prop.owner_id ? `Owner: ${prop.owner_name || prop.owner_id.substring(0,6)}` : 'For Sale'
    ctx.fillText(ownerText, canvas.width / 2, 85)

    const tex = new THREE.CanvasTexture(canvas)
    tex.encoding = THREE.sRGBEncoding
    const material = new THREE.SpriteMaterial({ map: tex, transparent: true })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(120, 60, 1)
    sprite.position.set(x, 10, y)
    sprite.userData = { propertyId: prop.id }

    // Add subtle billboard base
    const baseGeom = new THREE.CylinderGeometry(6, 6, 4, 8)
    const baseMat = new THREE.MeshStandardMaterial({ color: prop.owner_id ? 0x2a9d8f : 0xe76f51 })
    const base = new THREE.Mesh(baseGeom, baseMat)
    base.rotation.x = -Math.PI/2
    base.position.set(x, 2, y)

    const group = new THREE.Group()
    group.add(base)
    group.add(sprite)
    group.userData = { property: prop }

    return group
  }

  updateCameraPosition(playerPos = { x: 0, z: 0 }) {
    const config = this.cameraConfig
    const target = new THREE.Vector3(playerPos.x, 0, playerPos.z)

    switch (config.mode) {
      case 'topdown':
        this.camera.position.set(
          playerPos.x,
          config.height * config.zoom,
          playerPos.z
        )
        this.camera.lookAt(playerPos.x, 0, playerPos.z)
        break

      case 'isometric':
        const distance = config.distance / config.zoom
        const angle = (config.angle * Math.PI) / 180
        this.camera.position.set(
          playerPos.x + distance * Math.cos(angle),
          (config.height * config.zoom) / 1.5,
          playerPos.z + distance * Math.sin(angle)
        )
        this.camera.lookAt(playerPos.x, 40, playerPos.z)
        break

      case 'thirdperson':
        const tpDistance = 250 / config.zoom
        this.camera.position.set(
          playerPos.x,
          (150 * config.zoom),
          playerPos.z + tpDistance
        )
        this.camera.lookAt(playerPos.x, 60, playerPos.z)
        break

      case 'firstperson':
        try {
          const player = this.players.get(this.selectedPlayer)
          if (player) {
            const p = player.group.position
            const rot = player.group.rotation.y || 0
            const headY = 60 // approximate head height
            // Place camera at player's head
            this.camera.position.set(p.x, headY, p.z)
            // Compute forward vector and look slightly ahead
            const lookAtX = p.x + Math.sin(rot) * 10
            const lookAtY = p.y + headY - 2
            const lookAtZ = p.z + Math.cos(rot) * 10
            this.camera.lookAt(lookAtX, lookAtY, lookAtZ)
          }
        } catch (e) {
          // ignore
        }
        break

      case 'freecam':
        // Freecam position is not automatically updated
        break
    }
  }
  
  setCameraMode(mode, config = {}) {
    this.cameraConfig.mode = mode
    if (config.height !== undefined) this.cameraConfig.height = config.height
    if (config.distance !== undefined) this.cameraConfig.distance = config.distance
    if (config.angle !== undefined) this.cameraConfig.angle = config.angle
    if (config.fov !== undefined) {
      this.cameraConfig.fov = config.fov
      this.camera.fov = config.fov
      this.camera.updateProjectionMatrix()
    }
    if (config.zoom !== undefined) this.cameraConfig.zoom = Math.max(0.3, Math.min(3, config.zoom))
    if (config.enableShadows !== undefined) this.cameraConfig.enableShadows = config.enableShadows
    if (config.enableFog !== undefined) {
      this.cameraConfig.enableFog = config.enableFog
      if (this.scene.fog) {
        this.scene.fog.visible = config.enableFog
      }
    }
    if (config.showNameplates !== undefined) this.cameraConfig.showNameplates = config.showNameplates
  }

  setZoom(zoomLevel) {
    const z = Math.max(0.3, Math.min(3, zoomLevel))
    this.cameraConfig.zoom = z
    try {
      // adjust camera FOV to simulate zoom for firstperson/thirdperson
      const base = this.cameraConfig.baseFov || this.cameraConfig.fov || 75
      const newFov = Math.max(20, Math.min(100, base / z))
      this.camera.fov = newFov
      this.camera.updateProjectionMatrix()
    } catch(e) {}
  }

  async loadAvatarModel(url) {
    if (!url) {
      throw new Error('Avatar URL is required')
    }

    if (modelCache.has(url)) {
      return modelCache.get(url).clone()
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Avatar loading timeout'))
      }, 15000)

      const onSuccess = (model) => {
        clearTimeout(timeout)

        // Setup shadows
        model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true
            node.receiveShadow = true
          }
          if (node.isSkinnedMesh) {
            node.castShadow = true
            node.receiveShadow = true
          }
        })

        // Cache and clone
        modelCache.set(url, model)
        resolve(model.clone())
      }

      const onError = (error) => {
        clearTimeout(timeout)
        console.error('Avatar loading error:', error)
        reject(error)
      }

      // Load as GLTF
      gltfLoader.load(url, (gltf) => onSuccess(gltf.scene), undefined, onError)
    })
  }

  createSimpleAvatar(name, color = 0x0ea5a5) {
    const group = new THREE.Group()

    // Head
    const headGeometry = new THREE.SphereGeometry(10, 32, 32)
    const material = new THREE.MeshStandardMaterial({ color })
    const head = new THREE.Mesh(headGeometry, material)
    head.position.y = 30
    head.castShadow = true
    head.receiveShadow = true
    group.add(head)

    // Body
    const bodyGeometry = new THREE.BoxGeometry(8, 20, 8)
    const body = new THREE.Mesh(bodyGeometry, material)
    body.position.y = 10
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    // Left arm
    const armGeometry = new THREE.BoxGeometry(4, 18, 4)
    const leftArm = new THREE.Mesh(armGeometry, material)
    leftArm.position.set(-8, 12, 0)
    leftArm.castShadow = true
    leftArm.receiveShadow = true
    group.add(leftArm)

    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, material)
    rightArm.position.set(8, 12, 0)
    rightArm.castShadow = true
    rightArm.receiveShadow = true
    group.add(rightArm)

    // Legs
    const legGeometry = new THREE.BoxGeometry(4, 18, 4)
    const leftLeg = new THREE.Mesh(legGeometry, material)
    leftLeg.position.set(-4, -8, 0)
    leftLeg.castShadow = true
    leftLeg.receiveShadow = true
    group.add(leftLeg)

    const rightLeg = new THREE.Mesh(legGeometry, material)
    rightLeg.position.set(4, -8, 0)
    rightLeg.castShadow = true
    rightLeg.receiveShadow = true
    group.add(rightLeg)

    return group
  }
  
  async addPlayer(userId, name, avatarUrl, x = 0, z = 0) {
    try {
      let model = null

      // Try loading the avatar model if URL is provided
      if (avatarUrl) {
        try {
          model = await this.loadAvatarModel(avatarUrl)
        } catch (e) {
          console.warn('Failed to load avatar, using fallback:', e)
          model = this.createSimpleAvatar(name, 0x00a8ff)
        }
      } else {
        // Create a simple avatar if no URL
        model = this.createSimpleAvatar(name, 0x00a8ff)
      }

      // Container for player (model + nameplate)
      const group = new THREE.Group()
      group.position.set(x, 0, z)
      group.add(model)

      // Nameplate (only if enabled)
      if (this.cameraConfig.showNameplates) {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#00f5ff'
        ctx.shadowColor = '#000000'
        ctx.shadowBlur = 4
        ctx.font = 'bold 32px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(name, 128, 40)

        const texture = new THREE.CanvasTexture(canvas)
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
        const sprite = new THREE.Sprite(spriteMaterial)
        sprite.scale.set(100, 25, 1)
        sprite.position.y = 80
        group.add(sprite)
      }

      this.scene.add(group)

      // Store with animation state
      this.players.set(userId, {
        group,
        model,
        targetPos: { x, z },
        velocity: { x: 0, z: 0 },
        isMoving: false,
        direction: 0,
        animations: null
      })

      // If this is the first player added, select it
      if (this.players.size === 1) {
        this.selectedPlayer = userId
      }

      return group
    } catch (e) {
      console.error('Failed to add player:', e)
      throw e
    }
  }
  
  updatePlayerPosition(userId, x, z) {
    const player = this.players.get(userId)
    if (!player) return

    player.targetPos = { x, z }
    player.isMoving = true

    // Update map tiles based on player position
    if (this.mapTileManager) {
      this.mapTileManager.updatePlayerPosition(x, z).catch(err => {
        console.warn('Failed to update map tiles:', err)
      })
    }
  }

  movePlayer(userId, speed = 8) {
    const player = this.players.get(userId)
    if (!player) return

    const { group, targetPos } = player
    const dx = targetPos.x - group.position.x
    const dz = targetPos.z - group.position.z
    const dist = Math.hypot(dx, dz)

    if (dist > speed * 0.1) {
      const moveX = (dx / dist) * speed
      const moveZ = (dz / dist) * speed

      group.position.x += moveX
      group.position.z += moveZ

      // Smooth rotation to face direction
      const targetRotation = Math.atan2(dx, dz)
      const angleDiff = targetRotation - group.rotation.y

      // Normalize angle difference to [-PI, PI]
      let normalizedDiff = angleDiff
      while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI
      while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI

      group.rotation.y += normalizedDiff * 0.1 // Smooth rotation
      player.direction = group.rotation.y

      player.isMoving = true
    } else {
      group.position.x = targetPos.x
      group.position.z = targetPos.z
      player.isMoving = false
    }
  }
  
  removePlayer(userId) {
    const player = this.players.get(userId)
    if (player) {
      this.scene.remove(player.group)
      this.players.delete(userId)
      if (this.selectedPlayer === userId) {
        this.selectedPlayer = this.players.keys().next().value || null
      }
    }
  }

  addNPC(id, name, x = 0, z = 0, color = 0xff8844) {
    // Create a simple NPC avatar
    const npcModel = this.createSimpleAvatar(name, color)

    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.add(npcModel)

    // Nameplate (only if enabled)
    if (this.cameraConfig.showNameplates) {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffaa00'
      ctx.shadowColor = '#000000'
      ctx.shadowBlur = 4
      ctx.font = 'bold 32px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(name, 128, 40)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.scale.set(100, 25, 1)
      sprite.position.y = 80
      group.add(sprite)
    }

    this.scene.add(group)
    this.npcs.set(id, {
      group,
      model: npcModel,
      targetPos: { x, z },
      direction: 0,
      isMoving: false
    })
  }

  moveNPC(id, speed = 3) {
    const npc = this.npcs.get(id)
    if (!npc) return

    const { group, targetPos } = npc
    const dx = targetPos.x - group.position.x
    const dz = targetPos.z - group.position.z
    const dist = Math.hypot(dx, dz)

    if (dist > speed * 0.1) {
      group.position.x += (dx / dist) * speed
      group.position.z += (dz / dist) * speed

      // Smooth rotation
      const targetRotation = Math.atan2(dx, dz)
      const angleDiff = targetRotation - group.rotation.y

      let normalizedDiff = angleDiff
      while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI
      while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI

      group.rotation.y += normalizedDiff * 0.1
      npc.direction = group.rotation.y
      npc.isMoving = true
    } else {
      npc.isMoving = false
    }
  }

  setNPCTarget(id, x, z) {
    const npc = this.npcs.get(id)
    if (npc) {
      npc.targetPos = { x, z }
    }
  }
  
  handleMouseClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)

    const playersArray = Array.from(this.players.values()).map(p => p.group)
    const npcsArray = Array.from(this.npcs.values()).map(n => n.group)
    const propertiesArray = Array.from(this.propertyMarkers.values()).map(p => p.marker)
    const allObjects = [...playersArray, ...npcsArray, ...propertiesArray]

    const intersects = this.raycaster.intersectObjects(allObjects, true)

    if (intersects.length > 0) {
      const clicked = intersects[0].object

      for (const [id, entry] of this.propertyMarkers) {
        if (entry.marker.children.includes(clicked) || entry.marker === clicked || this._isDescendant(entry.marker, clicked)) {
          if (this.onPropertyClicked) {
            this.onPropertyClicked(entry.prop)
          }
          return
        }
      }

      for (const [userId, player] of this.players) {
        if (player.group.children.includes(clicked) || player.group === clicked || player.group.getObjectById(clicked.id)) {
          this.selectedPlayer = userId
          return
        }
      }
    }
  }

  _isDescendant(parent, child) {
    if (!parent || !child) return false
    let node = child.parent
    while (node) {
      if (node === parent) return true
      node = node.parent
    }
    return false
  }

  setPropertyClickHandler(callback) {
    this.onPropertyClicked = callback
  }

  render() {
    this.deltaTime = this.clock.getDelta()

    // Update player positions with smooth movement
    this.players.forEach((_, userId) => this.movePlayer(userId, 12))

    // Update NPC positions with AI-like behavior
    this.npcs.forEach((npc, id) => {
      this.moveNPC(id, 4)

      // Randomly change NPC target to simulate AI
      if (!npc.isMoving || Math.random() < 0.001) {
        const randomX = (Math.random() - 0.5) * 1000
        const randomZ = (Math.random() - 0.5) * 1000
        this.setNPCTarget(id, randomX, randomZ)
      }
    })

    // Update camera if tracking player (not in freecam)
    if (this.cameraConfig.mode !== 'freecam' && this.selectedPlayer) {
      const player = this.players.get(this.selectedPlayer)
      if (player) {
        this.updateCameraPosition({
          x: player.group.position.x,
          z: player.group.position.z
        })
      }
    }

    // Render scene
    this.renderer.render(this.scene, this.camera)
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate())
    this.render()
  }

  start() {
    this.animate()
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
  }

  handleResize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight

    if (width === 0 || height === 0) return

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  destroy() {
    this.stop()
    window.removeEventListener('resize', this.onWindowResize)
    this.renderer.domElement.removeEventListener('click', this.onMouseClick)

    // Clean up geometries and materials
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose())
        } else {
          object.material.dispose()
        }
      }
    })

    this.renderer.dispose()
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }

    this.players.clear()
    this.npcs.clear()
    modelCache.clear()

    // Clean up map tile manager
    if (this.mapTileManager) {
      this.mapTileManager.clearAllTiles()
    }
  }
}
