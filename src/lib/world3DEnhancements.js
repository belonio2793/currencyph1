import * as THREE from 'three'

export class PropertyBuildingRenderer {
  constructor(scene) {
    this.scene = scene
    this.buildings = new Map()
  }

  createPropertyBuilding(propertyId, position, type, value) {
    const building = this.createBuildingMesh(type, value)
    building.position.set(position.x, 0, position.y)
    building.userData = { propertyId, type, value }
    
    this.buildings.set(propertyId, building)
    this.scene.add(building)
    
    return building
  }

  createBuildingMesh(type, value) {
    const group = new THREE.Group()
    
    const heightMultiplier = Math.min(3, 0.1 + (Math.log(value + 1) / Math.log(1000000)))
    const baseHeight = 40
    const buildingHeight = baseHeight * heightMultiplier
    
    const colors = {
      house: 0xff9800,
      business: 0x2196f3,
      farm: 0x4caf50,
      shop: 0xe91e63,
      factory: 0x9c27b0
    }
    
    const color = colors[type] || 0x00bcd4
    
    const geometry = new THREE.BoxGeometry(30, buildingHeight, 30)
    // Use toon material for stylized look
    const material = new THREE.MeshToonMaterial({
      color,
      flatShading: true,
      metalness: 0.05,
      roughness: 0.6
    })

    const building = new THREE.Mesh(geometry, material)
    building.castShadow = true
    building.receiveShadow = true
    building.position.y = buildingHeight / 2

    // Outline: create a slightly scaled back-face black mesh to simulate cel outline
    try {
      const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })
      const outlineMesh = new THREE.Mesh(geometry.clone(), outlineMat)
      outlineMesh.scale.multiplyScalar(1.03)
      outlineMesh.position.copy(building.position)
      group.add(outlineMesh)
    } catch(e) { /* ignore outline failures */ }

    group.add(building)

    const roofGeometry = new THREE.ConeGeometry(22, 15, 4)
    const roofMaterial = new THREE.MeshToonMaterial({
      color: 0x8b4513,
      flatShading: true
    })
    const roof = new THREE.Mesh(roofGeometry, roofMaterial)
    roof.castShadow = true
    roof.receiveShadow = true
    roof.position.y = buildingHeight + 7.5
    roof.rotation.y = Math.PI / 4

    // roof outline
    try {
      const rOutline = new THREE.Mesh(roofGeometry.clone(), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide }))
      rOutline.scale.multiplyScalar(1.02)
      rOutline.position.copy(roof.position)
      group.add(rOutline)
    } catch(e) {}

    group.add(roof)

    this.addWindowsToBuilding(building, buildingHeight)

    return group
  }

  addWindowsToBuilding(building, height) {
    const windowCount = Math.ceil(height / 15)
    const windowSize = 8
    const spacing = 12
    
    for (let i = 0; i < windowCount; i++) {
      for (let j = 0; j < 2; j++) {
        const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, 0.5)
        const windowMaterial = new THREE.MeshStandardMaterial({
          color: 0xffff00,
          emissive: 0xffff00,
          emissiveIntensity: 0.3,
          metalness: 0.8
        })
        
        const window = new THREE.Mesh(windowGeometry, windowMaterial)
        window.position.z = 15.5
        window.position.y = (i + 1) * spacing + 5
        window.position.x = (j === 0 ? -8 : 8)
        
        building.add(window)
      }
    }
  }

  removeBuilding(propertyId) {
    const building = this.buildings.get(propertyId)
    if (building) {
      this.scene.remove(building)
      this.buildings.delete(propertyId)
    }
  }

  updateBuildingColor(propertyId, owned) {
    const building = this.buildings.get(propertyId)
    if (building) {
      const mainMesh = building.children[0]
      if (mainMesh && mainMesh.material) {
        if (owned) {
          mainMesh.material.color.setHex(0x4caf50)
          mainMesh.material.emissive.setHex(0x2e7d32)
          mainMesh.material.emissiveIntensity = 0.3
        }
      }
    }
  }

  clearAllBuildings() {
    for (const [id] of this.buildings) {
      this.removeBuilding(id)
    }
  }
}

export class StreetGridRenderer {
  constructor(scene) {
    this.scene = scene
    this.streets = []
  }

  createStreetGrid(gridSize = 6000, tileSize = 200) {
    // Use a thicker, darker line for stylized crisp grid
    const material = new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 2 })

    for (let i = -gridSize / 2; i <= gridSize / 2; i += tileSize) {
      const points = [
        new THREE.Vector3(i + 0.5, 0.11, -gridSize / 2),
        new THREE.Vector3(i + 0.5, 0.11, gridSize / 2)
      ]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geometry, material)
      this.scene.add(line)
      this.streets.push(line)

      const points2 = [
        new THREE.Vector3(-gridSize / 2, 0.11, i + 0.5),
        new THREE.Vector3(gridSize / 2, 0.11, i + 0.5)
      ]
      const geometry2 = new THREE.BufferGeometry().setFromPoints(points2)
      const line2 = new THREE.Line(geometry2, material)
      this.scene.add(line2)
      this.streets.push(line2)
    }
  }

  addStreetLabel(position, name) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillRect(0, 0, 256, 64)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(name, 128, 40)
    
    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(150, 40, 1)
    sprite.position.set(position.x, 50, position.z)
    
    this.scene.add(sprite)
    this.streets.push(sprite)
  }

  clearStreets() {
    for (const street of this.streets) {
      this.scene.remove(street)
    }
    this.streets = []
  }
}

export class PropertyMarkerEnhanced {
  static createAdvancedMarker(property, color = 0xffd166) {
    const group = new THREE.Group()
    
    const geometry = new THREE.BoxGeometry(3, 30, 3)
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.4
    })
    const pole = new THREE.Mesh(geometry, material)
    pole.castShadow = true
    pole.receiveShadow = true
    group.add(pole)
    
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    
    ctx.fillStyle = 'rgba(20,20,30,0.9)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.strokeStyle = color === 0xffd166 ? '#ffd166' : '#4caf50'
    ctx.lineWidth = 3
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    const displayName = property.name || property.property_type
    ctx.fillText(displayName.substring(0, 15), canvas.width / 2, 80)
    
    ctx.fillStyle = '#ffd166'
    ctx.font = 'bold 56px Arial'
    const priceText = `₱${Number(property.current_value || 0).toLocaleString()}`
    ctx.fillText(priceText.substring(0, 12), canvas.width / 2, 160)
    
    ctx.fillStyle = '#4caf50'
    ctx.font = '32px Arial'
    const revenueText = `₱${Number(property.revenue_per_day || 0).toLocaleString()}/day`
    ctx.fillText(revenueText.substring(0, 20), canvas.width / 2, 220)
    
    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      sizeAttenuation: true
    })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(150, 75, 1)
    sprite.position.y = 50
    group.add(sprite)
    
    group.userData = { propertyId: property.id, isMarker: true }
    
    return group
  }
}
