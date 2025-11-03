import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'

const gltfLoader = new GLTFLoader()
const fbxLoader = new FBXLoader()
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
      mode: 'isometric', // topdown, isometric, thirdperson, freecam
      height: 600,
      distance: 400,
      angle: 45,
      fov: 75,
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

    // Players and NPCs
    this.players = new Map()
    this.npcs = new Map()
    this.selectedPlayer = null

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
    // Add some atmospheric elements
    const skyGeometry = new THREE.SphereGeometry(5000, 32, 32)
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87CEEB,
      side: THREE.BackSide
    })
    const sky = new THREE.Mesh(skyGeometry, skyMaterial)
    this.scene.add(sky)
  }
  
  setupGround() {
    // Create a more interesting ground with texture
    const groundGeometry = new THREE.PlaneGeometry(6000, 6000)

    // Create a canvas texture for ground
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    // Draw a grid pattern
    ctx.fillStyle = '#2a4a3a'
    ctx.fillRect(0, 0, 256, 256)
    ctx.strokeStyle = '#1a3a2a'
    ctx.lineWidth = 1
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath()
      ctx.moveTo(i * 16, 0)
      ctx.lineTo(i * 16, 256)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * 16)
      ctx.lineTo(256, i * 16)
      ctx.stroke()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.repeat.set(16, 16)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping

    const groundMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0.0
    })

    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    ground.position.y = -0.5
    this.scene.add(ground)

    // Add a subtle grid helper
    const gridHelper = new THREE.GridHelper(5000, 50, 0x444444, 0x222222)
    gridHelper.position.y = 0.1
    this.scene.add(gridHelper)
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
    this.cameraConfig.zoom = Math.max(0.3, Math.min(3, zoomLevel))
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

      // Try loading as GLTF first
      gltfLoader.load(url, (gltf) => onSuccess(gltf.scene), undefined, (err) => {
        // Fall back to FBX if GLTF fails
        fbxLoader.load(url, onSuccess, undefined, onError)
      })
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
  
  render() {
    const deltaTime = this.clock.getDelta()
    
    // Update player positions
    this.players.forEach((_, userId) => this.movePlayer(userId, 5))
    
    // Update NPC positions
    this.npcs.forEach((_, id) => this.moveNPC(id, 2))
    
    // Update camera if tracking player
    const firstPlayer = this.players.values().next().value
    if (firstPlayer && this.cameraConfig.mode !== 'freecam') {
      this.updateCameraPosition({
        x: firstPlayer.group.position.x,
        z: firstPlayer.group.position.z
      })
    }
    
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
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }
  
  destroy() {
    this.stop()
    window.removeEventListener('resize', this.onWindowResize)
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
    this.players.clear()
    this.npcs.clear()
    modelCache.clear()
  }
}
