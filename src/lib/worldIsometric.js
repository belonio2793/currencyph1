import * as THREE from 'three'

// Lightweight isometric world renderer tailored for the Player View
// - Orthographic isometric camera
// - Tile grid rendering with instanced plane geometry
// - Simple avatar meshes with overhead progress bars (canvas sprites)
// - Click handling (tiles, avatars)

import * as THREE from 'three'
import { supabase } from './supabaseClient'

export class WorldIsometric {
  constructor(container, opts = {}) {
    this.container = container
    this.opts = opts || {}
    this.width = container.clientWidth || 800
    this.height = container.clientHeight || 600

    this.scene = new THREE.Scene()
    this.camera = null
    this.renderer = null
    this.animationId = null

    this.players = new Map()
    this.tiles = []
    this.tileGroup = new THREE.Group()
    this.scene.add(this.tileGroup)

    // Property system: placed properties and inventory
    this.properties = new Map() // propertyId -> { id, type, x, z, level, mesh }
    this.inventory = [] // available property blueprints
    this._placementMode = false
    this._placementPrototype = null

    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    this.onTileClick = null
    this.onPlayerClick = null

    this._init()
  }

  _init() {
    // derive scene sizing based on map dimensions for a more expansive feel
    const cols = this.opts.cols || 30
    const rows = this.opts.rows || 20
    const tileSize = this.opts.tileSize || 40
    const maxDim = Math.max(cols * tileSize, rows * tileSize)
    const viewSize = Math.max(800, Math.ceil(maxDim * 1.0))

    const aspect = Math.max(0.1, this.width / this.height)
    this.camera = new THREE.OrthographicCamera(
      (-viewSize * aspect) / 2,
      (viewSize * aspect) / 2,
      viewSize / 2,
      -viewSize / 2,
      -2000,
      2000
    )

    // place camera at an isometric vantage that scales with scene size
    this.camera.position.set(viewSize * 0.9, viewSize * 0.55, viewSize * 0.9)
    this.camera.up.set(0, 1, 0)
    this.cameraTarget = new THREE.Vector3(0, 0, 0)
    this.camera.lookAt(this.cameraTarget)
    this.camera.zoom = 1
    this.camera.updateProjectionMatrix()

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x071228, 1)
    this.renderer.domElement.style.display = 'block'
    try { this.container.style.background = 'linear-gradient(180deg,#071228 0%,#0f1b2b 60%)' } catch(e){}
    this.container.appendChild(this.renderer.domElement)

    // lighting: toon-friendly hemisphere and directional
    const hemi = new THREE.HemisphereLight(0x8899bb, 0x101820, 0.6)
    this.scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xe6f3ff, 0.7)
    dir.position.set(viewSize * 0.3, viewSize * 0.8, viewSize * 0.2)
    dir.castShadow = false
    this.scene.add(dir)

    // subtle fog for depth
    this.scene.fog = new THREE.FogExp2(0x071228, Math.max(0.00035, 0.00035 * (viewSize / 800)))

    // stylized ground and tiles
    this._createTiles({ cols, rows, tileSize })

    // interactions
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(this.container)
    this.renderer.domElement.addEventListener('click', (e) => this._onClick(e))

    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this._isDragging = false
    this._dragStartWorld = new THREE.Vector3()
    this._dragStartCam = new THREE.Vector3()
    this._dragStartTarget = new THREE.Vector3()

    this._getMouseWorld = (clientX, clientY) => {
      const rect = this.renderer.domElement.getBoundingClientRect()
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1
      const ny = -((clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera)
      const pt = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(this._plane, pt)
      return pt
    }

    const onPointerDown = (e) => {
      if (e.button !== 0) return
      this._isDragging = true
      this._dragStartWorld.copy(this._getMouseWorld(e.clientX, e.clientY) || new THREE.Vector3())
      this._dragStartCam.copy(this.camera.position)
      this._dragStartTarget.copy(this.cameraTarget)
      this.renderer.domElement.style.cursor = 'grabbing'
    }
    const onPointerMove = (e) => {
      if (!this._isDragging) return
      const cur = this._getMouseWorld(e.clientX, e.clientY) || new THREE.Vector3()
      const delta = new THREE.Vector3().subVectors(this._dragStartWorld, cur)
      const newCam = new THREE.Vector3().addVectors(this._dragStartCam, delta)
      const newTarget = new THREE.Vector3().addVectors(this._dragStartTarget, delta)
      this.camera.position.copy(newCam)
      this.cameraTarget.copy(newTarget)
      this.camera.lookAt(this.cameraTarget)
    }
    const onPointerUp = (e) => {
      this._isDragging = false
      this.renderer.domElement.style.cursor = 'default'
    }
    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY
      const factor = 1 + (delta > 0 ? 0.08 : -0.08)
      this.camera.zoom = Math.max(0.3, Math.min(3, (this.camera.zoom || 1) * factor))
      this.camera.updateProjectionMatrix()
    }

    this.renderer.domElement.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    this.renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    this._inputCleanup = () => {
      try { this.renderer.domElement.removeEventListener('pointerdown', onPointerDown) } catch(e){}
      try { window.removeEventListener('pointermove', onPointerMove) } catch(e){}
      try { window.removeEventListener('pointerup', onPointerUp) } catch(e){}
      try { this.renderer.domElement.removeEventListener('wheel', onWheel) } catch(e){}
    }

    this.start()
  }

  _createTiles({ cols = 30, rows = 20, tileSize = 40 } = {}) {
    this.cols = cols
    this.rows = rows
    this.tileSize = tileSize

    // clear previous
    this.tileGroup.clear()
    this.tiles = []

    const halfW = (cols * tileSize) / 2
    const halfH = (rows * tileSize) / 2

    // create a subtle patterned texture via canvas for tiles
    const texCanvas = document.createElement('canvas')
    texCanvas.width = 64
    texCanvas.height = 64
    const ctx = texCanvas.getContext('2d')
    ctx.fillStyle = '#53606f'
    ctx.fillRect(0,0,64,64)
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    for (let i=0;i<8;i++) { ctx.fillRect(i*8,0,4,64) }
    const tileTexture = new THREE.CanvasTexture(texCanvas)
    tileTexture.wrapS = tileTexture.wrapT = THREE.RepeatWrapping
    tileTexture.repeat.set(1,1)

    const baseMat = new THREE.MeshToonMaterial({ map: tileTexture, color: 0x5b6470 })

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize - halfW + tileSize / 2
        const z = r * tileSize - halfH + tileSize / 2

        const geo = new THREE.PlaneGeometry(tileSize - 1.5, tileSize - 1.5)
        const mat = baseMat.clone()
        // subtle variation
        const h = 0.9 + (Math.sin(c * 12.9898 + r * 78.233) * 43758.5453 % 0.1)
        mat.color = mat.color.clone()
        mat.color.setHex(mat.color.getHex() * 1)
        const plane = new THREE.Mesh(geo, mat)
        plane.rotation.x = -Math.PI / 2
        plane.position.set(x, 0, z)
        plane.userData = { type: 'tile', grid: { x: c, y: r } }
        plane.receiveShadow = false
        this.tileGroup.add(plane)
        this.tiles.push(plane)
      }
    }

    // simple procedural road network (every ~6 tiles create a road)
    const roadGroup = new THREE.Group()
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8, metalness: 0.1 })
    const roadWidth = Math.max(8, Math.floor(tileSize * 0.4))
    for (let r = 0; r <= rows; r++) {
      if (r % 6 === 0) {
        const z = r * tileSize - halfH
        const geom = new THREE.BoxGeometry(cols * tileSize + roadWidth, 0.2, roadWidth)
        const road = new THREE.Mesh(geom, roadMat)
        road.position.set(0, 0.05, z)
        road.receiveShadow = false
        roadGroup.add(road)
      }
    }
    for (let c = 0; c <= cols; c++) {
      if (c % 6 === 0) {
        const x = c * tileSize - halfW
        const geom = new THREE.BoxGeometry(roadWidth, 0.2, rows * tileSize + roadWidth)
        const road = new THREE.Mesh(geom, roadMat)
        road.position.set(x, 0.05, 0)
        road.receiveShadow = false
        roadGroup.add(road)
      }
    }
    this.scene.add(roadGroup)

    // soft grid lines using thin boxes for crispness
    const gridGroup = new THREE.Group()
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x0f1620 })
    for (let r = 0; r <= rows; r++) {
      const z = r * tileSize - halfH
      const geom = new THREE.BoxGeometry(cols * tileSize + 2, 0.2, 0.6)
      const line = new THREE.Mesh(geom, lineMat)
      line.position.set(0, 0.11, z)
      gridGroup.add(line)
    }
    for (let c = 0; c <= cols; c++) {
      const x = c * tileSize - halfW
      const geom = new THREE.BoxGeometry(0.6, 0.2, rows * tileSize + 2)
      const line = new THREE.Mesh(geom, lineMat)
      line.position.set(x, 0.11, 0)
      gridGroup.add(line)
    }
    this.scene.add(gridGroup)

    // slight ground plane fade at edges
    const groundGeo = new THREE.PlaneGeometry(cols * tileSize * 2, rows * tileSize * 2)
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x0c1420, transparent: true, opacity: 0.9 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.5
    this.scene.add(ground)
  }

  addPlayer(id, name = 'Player', color = 0x00a8ff, x = 0, z = 0) {
    // simple stylized avatar: capsule-like (box + head)
    if (this.players.has(id)) return this.players.get(id).group

    const group = new THREE.Group()
    const bodyGeo = new THREE.BoxGeometry(18, 28, 12)
    const mat = new THREE.MeshToonMaterial({ color, flatShading: true })
    const body = new THREE.Mesh(bodyGeo, mat)
    body.position.y = 14
    group.add(body)

    const headGeo = new THREE.SphereGeometry(8, 12, 12)
    const head = new THREE.Mesh(headGeo, mat)
    head.position.y = 32
    group.add(head)

    group.position.set(x, 0, z)
    group.userData = { id }

    // name sprite
    const nameCanvas = document.createElement('canvas')
    nameCanvas.width = 256
    nameCanvas.height = 64
    const ctx = nameCanvas.getContext('2d')
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, nameCanvas.width, nameCanvas.height)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(name.substring(0, 12), nameCanvas.width / 2, 40)
    const tex = new THREE.CanvasTexture(nameCanvas)
    const spriteMat = new THREE.SpriteMaterial({ map: tex })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.scale.set(120, 30, 1)
    sprite.position.y = 60
    group.add(sprite)

    this.scene.add(group)

    this.players.set(id, { group, body, head, sprite, job: null })
    return group
  }

  updatePlayerPosition(id, x, z) {
    const pl = this.players.get(id)
    if (!pl) return
    pl.group.position.set(x, 0, z)
  }

  removePlayer(id) {
    const pl = this.players.get(id)
    if (!pl) return
    this.scene.remove(pl.group)
    this.players.delete(id)
  }

  startPlayerJob(id, jobName, duration = 3000, onProgress = null, onComplete = null) {
    const pl = this.players.get(id)
    if (!pl) return
    if (pl.job && pl.job.active) return
    const start = performance.now()
    pl.job = { name: jobName, start, duration, active: true, onProgress, onComplete }

    // attach overhead progress sprite
    const { group } = pl
    const barCanvas = document.createElement('canvas')
    barCanvas.width = 256
    barCanvas.height = 64
    const ctx = barCanvas.getContext('2d')
    const tex = new THREE.CanvasTexture(barCanvas)
    const sprMat = new THREE.SpriteMaterial({ map: tex })
    const spr = new THREE.Sprite(sprMat)
    spr.scale.set(120, 30, 1)
    spr.position.set(0, 78, 0)
    group.add(spr)
    pl.job.sprite = { spr, tex, canvas: barCanvas, ctx }

    // ticker
    const tick = () => {
      if (!pl.job || !pl.job.active) return
      const now = performance.now()
      const elapsed = now - pl.job.start
      const pct = Math.min(1, elapsed / pl.job.duration)
      // update canvas
      try {
        const c = pl.job.sprite.canvas
        const ctx2 = pl.job.sprite.ctx
        ctx2.clearRect(0,0,c.width,c.height)
        ctx2.fillStyle = 'rgba(0,0,0,0.6)'
        ctx2.fillRect(0,0,c.width,c.height)
        ctx2.fillStyle = '#2ee6a7'
        ctx2.fillRect(10,20,(c.width-20)*pct,24)
        ctx2.fillStyle = '#fff'
        ctx2.font = 'bold 20px Arial'
        ctx2.textAlign = 'center'
        ctx2.fillText(Math.floor(pct*100) + '%', c.width/2, 38)
        pl.job.sprite.tex.needsUpdate = true
      } catch(e) {}

      if (typeof pl.job.onProgress === 'function') {
        try { pl.job.onProgress(Math.floor(pct*100)) } catch(e) {}
      }

      if (pct >= 1) {
        pl.job.active = false
        if (typeof pl.job.onComplete === 'function') {
          try { pl.job.onComplete() } catch(e) {}
        }
        // schedule cleanup
        setTimeout(() => {
          try { group.remove(pl.job.sprite.spr) } catch(e) {}
          pl.job = null
        }, 300)
      } else {
        setTimeout(tick, 120)
      }
    }
    setTimeout(tick, 120)
  }

  _onClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    // convert mouse to world by casting ray from camera
    this.raycaster.setFromCamera(this.mouse, this.camera)

    // If placing a property, prefer plane intersection and place
    if (this._placementMode) {
      const pt = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(this._plane, pt)
      if (pt) {
        // Use stored owner id if available
        try { this.placePropertyAt({ x: Math.round(pt.x), z: Math.round(pt.z) }, this._placementOwnerId) } catch(e) { console.warn('placePropertyAt failed', e) }
      }
      return
    }

    const intersects = this.raycaster.intersectObjects(Array.from(this.players.values()).map(p => p.group).concat(this.tiles), true)
    if (intersects && intersects.length) {
      const hit = intersects[0].object
      // walk up to find group with userData
      let node = hit
      while (node && !node.userData) node = node.parent
      if (node && node.userData && node.userData.type === 'tile') {
        if (this.onTileClick) this.onTileClick(node.userData.grid)
        return
      }
      // check player groups
      const pl = Array.from(this.players.values()).find(p => p.group === hit || p.group.children.includes(hit) || p.group.getObjectById(hit.id))
      if (pl) {
        if (this.onPlayerClick) this.onPlayerClick(pl)
        return
      }
    }
  }

  setTileClickHandler(cb) { this.onTileClick = cb }
  setPlayerClickHandler(cb) { this.onPlayerClick = cb }

  handleResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.width = w; this.height = h
    this.renderer.setSize(w, h)
    const aspect = Math.max(0.1, w / h)
    const cols = this.cols || (this.opts.cols || 30)
    const rows = this.rows || (this.opts.rows || 20)
    const tileSize = this.tileSize || (this.opts.tileSize || 40)
    const maxDim = Math.max(cols * tileSize, rows * tileSize)
    const viewSize = Math.max(800, Math.ceil(maxDim * 1.0))
    this.camera.left = (-viewSize * aspect) / 2
    this.camera.right = (viewSize * aspect) / 2
    this.camera.top = viewSize / 2
    this.camera.bottom = -viewSize / 2
    // keep existing zoom
    try { this.camera.updateProjectionMatrix() } catch(e) {}
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate())
    this.render()
  }

  start() { if (!this.animationId) this.animate() }
  stop() { if (this.animationId) cancelAnimationFrame(this.animationId); this.animationId = null }

  /* Property management API */
  async loadPropertiesForOwner(ownerId) {
    if (!ownerId) return []
    try {
      const { data, error } = await supabase.from('game_properties').select('*').eq('owner_id', ownerId)
      if (error) throw error
      // create meshes for each property
      data.forEach(p => {
        if (!this.properties.has(p.id)) {
          const mesh = this._createPropertyMesh(p.type, p.level)
          mesh.position.set(p.x || 0, 0, p.z || 0)
          mesh.userData = { propertyId: p.id }
          this.scene.add(mesh)
          this.properties.set(p.id, Object.assign({}, p, { mesh }))
        }
      })
      return data
    } catch (err) {
      console.warn('loadPropertiesForOwner failed', err)
      return []
    }
  }

  async saveProperty(property) {
    try {
      const payload = Object.assign({}, property)
      delete payload.mesh
      const { data, error } = await supabase.from('game_properties').upsert([payload]).select().single()
      if (error) throw error
      // update local map
      if (this.properties.has(data.id)) {
        const curr = this.properties.get(data.id)
        Object.assign(curr, data)
        this.properties.set(data.id, curr)
      } else {
        const mesh = this._createPropertyMesh(data.type, data.level)
        mesh.position.set(data.x || 0, 0, data.z || 0)
        mesh.userData = { propertyId: data.id }
        this.scene.add(mesh)
        this.properties.set(data.id, Object.assign({}, data, { mesh }))
      }
      return data
    } catch (err) {
      console.warn('saveProperty failed', err)
      return null
    }
  }

  addInventoryItem(item) {
    // item: { type, label, baseCost }
    this.inventory.push(item)
  }

  enablePlacementMode(item, ownerId = null) {
    // item: inventory item to place, e.g. {type:'house', label:'House'}
    this._placementMode = Boolean(item)
    this._placementPrototype = item || null
    this._placementOwnerId = ownerId || null
    // create a ghost mesh to follow mouse
    if (this._placementMode && this._placementPrototype) {
      if (!this._placementGhost) this._placementGhost = this._createPropertyMesh(this._placementPrototype.type, 0, true)
      this.scene.add(this._placementGhost)
      const moveHandler = (e) => {
        const rect = this.renderer.domElement.getBoundingClientRect()
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
        this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera)
        const pt = new THREE.Vector3()
        this.raycaster.ray.intersectPlane(this._plane, pt)
        if (pt) {
          this._placementGhost.position.set(Math.round(pt.x), 0, Math.round(pt.z))
        }
      }
      this._placementMoveHandler = moveHandler
      window.addEventListener('pointermove', moveHandler)
    } else {
      try { if (this._placementGhost) this.scene.remove(this._placementGhost) } catch(e){}
      try { if (this._placementMoveHandler) window.removeEventListener('pointermove', this._placementMoveHandler) } catch(e){}
      this._placementGhost = null
      this._placementMoveHandler = null
      this._placementOwnerId = null
    }
  }

  async placePropertyAt(point, ownerId = null) {
    // point: { x, z } world coordinates
    if (!this._placementMode || !this._placementPrototype) return null
    const prop = {
      owner_id: ownerId,
      type: this._placementPrototype.type,
      level: 0,
      x: Math.round(point.x),
      z: Math.round(point.z),
      placed: true
    }
    const saved = await this.saveProperty(prop)
    // turn off placement mode after placing
    this.enablePlacementMode(null)
    return saved
  }

  _createPropertyMesh(type = 'house', level = 0, ghost = false) {
    // Simple stylized box for now
    const colorMap = { house: 0xffcc77, shop: 0x77ccff, factory: 0xcc77ff }
    const color = colorMap[type] || 0x88cc88
    const geom = new THREE.BoxGeometry(20, 20 + level * 6, 20)
    const mat = new THREE.MeshStandardMaterial({ color, transparent: ghost, opacity: ghost ? 0.6 : 1.0, roughness: 0.6, metalness: 0.1 })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.position.y = (20 + level * 6) / 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  /* End property management API */

  destroy() {
    this.stop()
    try { this.renderer.domElement.removeEventListener('click', this._onClick) } catch(e) {}
    try { this.resizeObserver.disconnect() } catch(e) {}
    try { this.container.removeChild(this.renderer.domElement) } catch(e) {}
    try { if (this._inputCleanup) this._inputCleanup() } catch(e) {}
    this.players.clear()
    // cleanup properties
    try { this.properties.forEach(p => { if (p.mesh) this.scene.remove(p.mesh) }) } catch(e) {}
    this.properties.clear()
  }
}
