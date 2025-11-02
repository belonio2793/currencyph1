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
    const groundGeometry = new THREE.PlaneGeometry(5000, 5000)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a4a3a,
      roughness: 0.8,
      metalness: 0.2
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    
    // Grid helper for reference
    const gridHelper = new THREE.GridHelper(5000, 50, 0x444444, 0x222222)
    gridHelper.position.y = 0.01
    this.scene.add(gridHelper)
  }
  
  updateCameraPosition(playerPos = { x: 0, z: 0 }) {
    const config = this.cameraConfig
    
    switch (config.mode) {
      case 'topdown':
        this.camera.position.set(playerPos.x, config.height, playerPos.z)
        this.camera.lookAt(playerPos.x, 0, playerPos.z)
        break
        
      case 'isometric':
        const distance = config.distance / config.zoom
        const angle = (config.angle * Math.PI) / 180
        this.camera.position.set(
          playerPos.x + distance * Math.cos(angle),
          config.height / config.zoom,
          playerPos.z + distance * Math.sin(angle)
        )
        this.camera.lookAt(playerPos.x, 50, playerPos.z)
        break
        
      case 'thirdperson':
        const tpDistance = 300 / config.zoom
        this.camera.position.set(
          playerPos.x,
          200 / config.zoom,
          playerPos.z + tpDistance
        )
        this.camera.lookAt(playerPos.x, 100, playerPos.z)
        break
        
      case 'freecam':
        // Freecam position is controlled separately
        break
    }
  }
  
  setCameraMode(mode, config = {}) {
    this.cameraConfig.mode = mode
    if (config.height) this.cameraConfig.height = config.height
    if (config.distance) this.cameraConfig.distance = config.distance
    if (config.angle !== undefined) this.cameraConfig.angle = config.angle
    if (config.fov) {
      this.cameraConfig.fov = config.fov
      this.camera.fov = config.fov
      this.camera.updateProjectionMatrix()
    }
    if (config.zoom) this.cameraConfig.zoom = config.zoom
  }
  
  setZoom(zoomLevel) {
    this.cameraConfig.zoom = Math.max(0.5, Math.min(3, zoomLevel))
  }
  
  async loadAvatarModel(url) {
    if (modelCache.has(url)) {
      return modelCache.get(url).clone()
    }
    
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene
          
          // Setup shadows
          model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true
              node.receiveShadow = true
            }
          })
          
          // Cache and clone
          modelCache.set(url, model)
          resolve(model.clone())
        },
        undefined,
        reject
      )
    })
  }
  
  async addPlayer(userId, name, avatarUrl, x, z) {
    try {
      const model = await this.loadAvatarModel(avatarUrl)
      model.position.set(x, 0, z)
      
      // Container for player (model + nameplate)
      const group = new THREE.Group()
      group.position.set(x, 0, z)
      group.add(model)
      
      // Nameplate
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#00f5ff'
      ctx.font = 'bold 32px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(name, 128, 40)
      
      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.scale.set(100, 25, 1)
      sprite.position.y = 100
      group.add(sprite)
      
      this.scene.add(group)
      this.players.set(userId, { group, model, targetPos: { x, z } })
    } catch (e) {
      console.error('Failed to load avatar model:', e)
    }
  }
  
  updatePlayerPosition(userId, x, z) {
    const player = this.players.get(userId)
    if (!player) return
    
    player.targetPos = { x, z }
  }
  
  movePlayer(userId, speed = 5) {
    const player = this.players.get(userId)
    if (!player) return
    
    const { group, targetPos } = player
    const dx = targetPos.x - group.position.x
    const dz = targetPos.z - group.position.z
    const dist = Math.hypot(dx, dz)
    
    if (dist > speed) {
      group.position.x += (dx / dist) * speed
      group.position.z += (dz / dist) * speed
      
      // Rotate to face direction
      group.rotation.y = Math.atan2(dx, dz)
    } else {
      group.position.x = targetPos.x
      group.position.z = targetPos.z
    }
  }
  
  removePlayer(userId) {
    const player = this.players.get(userId)
    if (player) {
      this.scene.remove(player.group)
      this.players.delete(userId)
    }
  }
  
  addNPC(id, name, x, z) {
    const geometry = new THREE.ConeGeometry(20, 60, 8)
    const material = new THREE.MeshStandardMaterial({ color: 0xff6b6b })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.add(mesh)
    
    // Nameplate
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffaa00'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(name, 128, 40)
    
    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(100, 25, 1)
    sprite.position.y = 80
    group.add(sprite)
    
    this.scene.add(group)
    this.npcs.set(id, { group, targetPos: { x, z } })
  }
  
  moveNPC(id, speed = 2) {
    const npc = this.npcs.get(id)
    if (!npc) return
    
    const { group, targetPos } = npc
    const dx = targetPos.x - group.position.x
    const dz = targetPos.z - group.position.z
    const dist = Math.hypot(dx, dz)
    
    if (dist > speed) {
      group.position.x += (dx / dist) * speed
      group.position.z += (dz / dist) * speed
      group.rotation.y = Math.atan2(dx, dz)
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
