import * as THREE from 'three'
import { getMapTexture } from './googleMapsIntegration'

/**
 * Map Tile Manager - Handles dynamic loading of map tiles for different Philippines regions
 * This allows the 3D world to display satellite imagery that corresponds to real locations
 */
export class MapTileManager {
  constructor(scene, baseScale = 1) {
    this.scene = scene
    this.baseScale = baseScale
    this.activeTiles = new Map()
    this.tileMeshes = new Map()
    this.tileSize = 1000 // Size of each tile in world units
    this.loadDistance = 3000 // Distance from player to load new tiles
    this.currentCenter = { x: 0, z: 0, lat: 14.5995, lng: 120.9842 }
    
    // Major Philippine cities for reference
    this.cityLocations = {
      manila: { x: 0, z: 0, lat: 14.5995, lng: 120.9842, zoom: 15 },
      cebu: { x: 500, z: -800, lat: 10.3157, lng: 123.8854, zoom: 14 },
      davao: { x: -600, z: -1400, lat: 7.1108, lng: 125.6423, zoom: 14 },
      cagayan: { x: 400, z: -200, lat: 8.4874, lng: 124.6487, zoom: 14 },
      iloilo: { x: -400, z: -300, lat: 10.6918, lng: 122.5635, zoom: 14 },
      bacolod: { x: -350, z: -280, lat: 10.3932, lng: 122.9749, zoom: 14 },
      zamboanga: { x: -700, z: -1100, lat: 6.9271, lng: 122.0724, zoom: 14 },
      quezon: { x: 100, z: 150, lat: 14.6760, lng: 121.0437, zoom: 15 },
      makati: { x: 50, z: -50, lat: 14.5560, lng: 121.0227, zoom: 16 },
      pasig: { x: 200, z: 100, lat: 14.5794, lng: 121.5734, zoom: 15 }
    }
  }

  /**
   * Get the city location closest to world coordinates
   */
  getNearestCity(x, z) {
    let nearest = null
    let minDist = Infinity
    
    for (const [name, city] of Object.entries(this.cityLocations)) {
      const dist = Math.hypot(city.x - x, city.z - z)
      if (dist < minDist) {
        minDist = dist
        nearest = { name, ...city }
      }
    }
    
    return nearest
  }

  /**
   * Update player position and load nearby tiles
   */
  async updatePlayerPosition(playerX, playerZ) {
    const nearestCity = this.getNearestCity(playerX, playerZ)
    if (!nearestCity) return

    // Calculate tile indices based on position
    const tileX = Math.round(playerX / this.tileSize)
    const tileZ = Math.round(playerZ / this.tileSize)

    // Load tiles in a 3x3 grid around player
    const tilesToLoad = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const tx = tileX + dx
        const tz = tileZ + dz
        const key = `${tx},${tz}`
        
        if (!this.activeTiles.has(key)) {
          tilesToLoad.push({ key, tx, tz, nearestCity })
        }
      }
    }

    // Unload distant tiles
    const tilesToUnload = []
    for (const [key, tile] of this.activeTiles.entries()) {
      const [tx, tz] = key.split(',').map(Number)
      const worldX = tx * this.tileSize
      const worldZ = tz * this.tileSize
      const dist = Math.hypot(worldX - playerX, worldZ - playerZ)
      
      if (dist > this.loadDistance * 2) {
        tilesToUnload.push(key)
      }
    }

    // Unload distant tiles
    for (const key of tilesToUnload) {
      this.unloadTile(key)
    }

    // Load new tiles
    await Promise.all(tilesToLoad.map(tile => this.loadTile(tile)))
  }

  /**
   * Load a single map tile
   */
  async loadTile({ key, tx, tz, nearestCity }) {
    try {
      // Calculate lat/lng offset from nearest city based on tile position
      const latOffset = (tz * this.tileSize) / 111320 // ~111km per degree latitude
      const lngOffset = (tx * this.tileSize) / (111320 * Math.cos(nearestCity.lat * Math.PI / 180))
      
      const lat = nearestCity.lat - latOffset
      const lng = nearestCity.lng + lngOffset

      // Load texture from Google Maps
      const texture = await getMapTexture(lat, lng, nearestCity.zoom, 512)

      // Create tile mesh
      const geometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize)
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.0
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.x = -Math.PI / 2
      mesh.receiveShadow = true
      mesh.position.set(tx * this.tileSize, -0.5, tz * this.tileSize)

      this.scene.add(mesh)

      // Create low-poly instanced buildings to give a game-like city look
      const buildingsGroup = new THREE.Group()
      const buildingCount = 60
      const boxGeom = new THREE.BoxGeometry(20, 1, 20)
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.6, metalness: 0.1 })
      const instanced = new THREE.InstancedMesh(boxGeom, boxMat, buildingCount)
      instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      // Determine density factor based on distance to city center (closer -> denser/taller)
      const cityCenterX = nearestCity.x || 0
      const cityCenterZ = nearestCity.z || 0
      const tileCenterX = tx * this.tileSize
      const tileCenterZ = tz * this.tileSize
      const distToCity = Math.hypot(tileCenterX - cityCenterX, tileCenterZ - cityCenterZ)
      const density = Math.max(0.2, 1 - distToCity / 4000)

      const dummy = new THREE.Object3D()
      let placed = 0
      for (let i = 0; i < buildingCount; i++) {
        const px = tileCenterX + (Math.random() - 0.5) * this.tileSize * 0.9
        const pz = tileCenterZ + (Math.random() - 0.5) * this.tileSize * 0.9
        // Simple exclusion radius near water could be implemented later
        const baseHeight = 20 + Math.random() * 120
        const height = baseHeight * (0.5 + Math.random() * 1.5) * density
        dummy.position.set(px, height / 2 - 0.5, pz)
        dummy.scale.set(1, height / 20, 1)
        dummy.updateMatrix()
        instanced.setMatrixAt(i, dummy.matrix)
        placed++
      }
      instanced.castShadow = true
      instanced.receiveShadow = true
      buildingsGroup.add(instanced)
      this.scene.add(buildingsGroup)

      this.activeTiles.set(key, { lat, lng, texture })
      this.tileMeshes.set(key, { mesh, buildings: buildingsGroup })

      console.log(`Loaded tile ${key} for ${nearestCity.name} (buildings: ${placed})`)
    } catch (err) {
      console.warn(`Failed to load tile ${key}:`, err)
    }
  }

  /**
   * Unload a tile
   */
  unloadTile(key) {
    const mesh = this.tileMeshes.get(key)
    if (mesh) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      if (mesh.material.map) {
        mesh.material.map.dispose()
      }
      mesh.material.dispose()
    }
    
    this.activeTiles.delete(key)
    this.tileMeshes.delete(key)
    console.log(`Unloaded tile ${key}`)
  }

  /**
   * Clear all tiles
   */
  clearAllTiles() {
    for (const key of this.activeTiles.keys()) {
      this.unloadTile(key)
    }
  }

  /**
   * Get statistics about loaded tiles
   */
  getStats() {
    return {
      activeTiles: this.activeTiles.size,
      loadDistance: this.loadDistance,
      tileSize: this.tileSize,
      nearestCity: this.getNearestCity(0, 0)
    }
  }
}
