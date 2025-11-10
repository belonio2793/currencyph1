import * as THREE from 'three'

// Lightweight isometric world renderer tailored for the Player View
// - Orthographic isometric camera
// - Tile grid rendering with instanced plane geometry
// - Simple avatar meshes with overhead progress bars (canvas sprites)
// - Click handling (tiles, avatars)

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

    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    this.onTileClick = null
    this.onPlayerClick = null

    this._init()
  }

  _init() {
    // orthographic camera sized for isometric styled view
    const aspect = Math.max(0.1, this.width / this.height)
    const viewSize = 800
    this.camera = new THREE.OrthographicCamera(
      (-viewSize * aspect) / 2,
      (viewSize * aspect) / 2,
      viewSize / 2,
      -viewSize / 2,
      -2000,
      2000
    )

    // rotate to approximate isometric angle
    const angle = (35 * Math.PI) / 180
    // position further away for larger maps
    this.camera.position.set(1200, 1200, 1200)
    this.camera.up.set(0, 1, 0)
    // camera target for panning
    this.cameraTarget = new THREE.Vector3(0,0,0)
    this.camera.lookAt(this.cameraTarget)
    this.camera.updateProjectionMatrix()

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.container.appendChild(this.renderer.domElement)

    // soft ambient + directional
    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    this.scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 0.6)
    dir.position.set(100, 200, 100)
    this.scene.add(dir)

    // create tile grid
    this._createTiles({ cols: this.opts.cols || 30, rows: this.opts.rows || 20, tileSize: this.opts.tileSize || 40 })

    // event listeners
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(this.container)
    this.renderer.domElement.addEventListener('click', (e) => this._onClick(e))

    // prepare a plane for mouse-world intersections
    this._plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0)
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
      // adjust camera zoom instead of moving camera for orthographic
      const factor = 1 + (delta > 0 ? 0.08 : -0.08)
      this.camera.zoom = Math.max(0.2, Math.min(3, (this.camera.zoom || 1) * factor))
      this.camera.updateProjectionMatrix()
    }

    this.renderer.domElement.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    this.renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // store cleanup so destroy can remove them
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

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize - halfW + tileSize / 2
        const z = r * tileSize - halfH + tileSize / 2

        const geo = new THREE.PlaneGeometry(tileSize - 2, tileSize - 2)
        const mat = new THREE.MeshStandardMaterial({ color: 0x6b6b75, emissive: 0x000000, roughness: 0.8, metalness: 0 })
        const plane = new THREE.Mesh(geo, mat)
        plane.rotation.x = -Math.PI / 2
        plane.position.set(x, 0, z)
        plane.userData = { type: 'tile', grid: { x: c, y: r } }
        this.tileGroup.add(plane)
        this.tiles.push(plane)
      }
    }

    // add crisp grid lines using LineSegments
    const lines = new THREE.Group()
    const material = new THREE.LineBasicMaterial({ color: 0x111111 })
    for (let r = 0; r <= rows; r++) {
      const points = [
        new THREE.Vector3(-halfW, 0.11, r * tileSize - halfH),
        new THREE.Vector3(halfW, 0.11, r * tileSize - halfH)
      ]
      const geom = new THREE.BufferGeometry().setFromPoints(points)
      lines.add(new THREE.Line(geom, material))
    }
    for (let c = 0; c <= cols; c++) {
      const points = [
        new THREE.Vector3(c * tileSize - halfW, 0.11, -halfH),
        new THREE.Vector3(c * tileSize - halfW, 0.11, halfH)
      ]
      const geom = new THREE.BufferGeometry().setFromPoints(points)
      lines.add(new THREE.Line(geom, material))
    }
    this.scene.add(lines)
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
    const viewSize = 800
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

  destroy() {
    this.stop()
    try { this.renderer.domElement.removeEventListener('click', this._onClick) } catch(e) {}
    try { this.resizeObserver.disconnect() } catch(e) {}
    try { this.container.removeChild(this.renderer.domElement) } catch(e) {}
    this.players.clear()
  }
}
