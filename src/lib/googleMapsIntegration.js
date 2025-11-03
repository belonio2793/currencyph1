import * as THREE from 'three'

// Get Google API key from environment
const GOOGLE_API_KEY = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_GOOGLE_API_KEY || import.meta.env?.GOOGLE_API_KEY || 'AIzaSyC1hNFq1m4sL2WevJSfP4sAVQ5dJ_jRCHc')
  : (typeof process !== 'undefined' ? (process.env?.VITE_GOOGLE_API_KEY || process.env?.GOOGLE_API_KEY || 'AIzaSyC1hNFq1m4sL2WevJSfP4sAVQ5dJ_jRCHc') : 'AIzaSyC1hNFq1m4sL2WevJSfP4sAVQ5dJ_jRCHc')

// Philippines center and bounds
export const PHILIPPINES_CENTER = { lat: 12.8797, lng: 121.7740 }
export const PHILIPPINES_BOUNDS = {
  north: 20.63,
  south: 4.6724,
  west: 116.1196,
  east: 128.3154
}

// Cache for map tiles and textures
const textureCache = new Map()
const tileCache = new Map()

/**
 * Generate a satellite map texture from Google Static Maps API
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} zoom - Map zoom level (0-21)
 * @param {number} size - Texture size in pixels (max 640)
 * @returns {Promise<THREE.Texture>}
 */
export async function getMapTexture(lat, lng, zoom = 15, size = 512) {
  const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${zoom}_${size}`
  
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)
  }

  try {
    const url = buildStaticMapURL(lat, lng, zoom, size)
    const texture = await loadTextureFromURL(url)
    textureCache.set(cacheKey, texture)
    return texture
  } catch (err) {
    console.warn('Failed to load Google Maps texture, using fallback:', err)
    return createFallbackTexture()
  }
}

/**
 * Build Google Static Maps API URL
 */
function buildStaticMapURL(lat, lng, zoom, size = 512) {
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: Math.min(21, Math.max(0, Math.floor(zoom))),
    size: `${size}x${size}`,
    maptype: 'satellite',
    key: GOOGLE_API_KEY
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

/**
 * Load a texture from a URL
 */
function loadTextureFromURL(url) {
  return new Promise((resolve, reject) => {
    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(
      url,
      (texture) => {
        texture.magFilter = THREE.LinearFilter
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.generateMipmaps = true
        resolve(texture)
      },
      undefined,
      (err) => reject(err)
    )
  })
}

/**
 * Create a fallback procedural texture when Google Maps fails
 */
function createFallbackTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  // Green base for terrain
  ctx.fillStyle = '#2a8c4a'
  ctx.fillRect(0, 0, 512, 512)

  // Add some procedural noise for realism
  const imageData = ctx.getImageData(0, 0, 512, 512)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.random() * 30
    data[i] += noise // R
    data[i + 1] += noise // G
    data[i + 2] += noise * 0.5 // B
  }
  ctx.putImageData(imageData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  return texture
}

/**
 * Generate terrain tiles for the 3D world based on Philippines regions
 * @returns {Promise<Array>} Array of tile objects with position and metadata
 */
export async function generatePhilippinesTerrain() {
  const tiles = []
  
  // Major Philippine cities and regions with their coordinates
  const regions = [
    { name: 'Manila', lat: 14.5995, lng: 120.9842, zoom: 16 },
    { name: 'Cebu', lat: 10.3157, lng: 123.8854, zoom: 15 },
    { name: 'Davao', lat: 7.1108, lng: 125.6423, zoom: 15 },
    { name: 'Cagayan de Oro', lat: 8.4874, lng: 124.6487, zoom: 15 },
    { name: 'Iloilo', lat: 10.6918, lng: 122.5635, zoom: 15 },
    { name: 'Bacolod', lat: 10.3932, lng: 122.9749, zoom: 15 },
    { name: 'Zamboanga', lat: 6.9271, lng: 122.0724, zoom: 15 },
    { name: 'Quezon City', lat: 14.6760, lng: 121.0437, zoom: 15 },
    { name: 'Makati', lat: 14.5560, lng: 121.0227, zoom: 16 },
    { name: 'Pasig', lat: 14.5794, lng: 121.5734, zoom: 15 }
  ]

  for (const region of regions) {
    try {
      const texture = await getMapTexture(region.lat, region.lng, region.zoom, 512)
      tiles.push({
        name: region.name,
        lat: region.lat,
        lng: region.lng,
        texture: texture,
        zoom: region.zoom
      })
    } catch (err) {
      console.warn(`Failed to load terrain for ${region.name}:`, err)
    }
  }

  return tiles
}

/**
 * Create a ground plane with Google Maps satellite imagery
 * @param {THREE.Scene} scene - Three.js scene
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} size - Ground plane size in world units
 * @returns {Promise<THREE.Mesh>}
 */
export async function createMapGroundPlane(scene, lat = 12.8797, lng = 121.7740, size = 6000) {
  try {
    const texture = await getMapTexture(lat, lng, 13, 512)
    
    const geometry = new THREE.PlaneGeometry(size, size)
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0.1
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.receiveShadow = true
    scene.add(mesh)
    
    return mesh
  } catch (err) {
    console.warn('Failed to create map ground plane:', err)
    // Return default ground plane as fallback
    const geometry = new THREE.PlaneGeometry(size, size)
    const material = new THREE.MeshStandardMaterial({
      color: 0x2a8c4a,
      roughness: 0.8
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    scene.add(mesh)
    return mesh
  }
}

/**
 * Create a sky mesh using Google Maps imagery
 * @param {THREE.Scene} scene - Three.js scene
 * @param {number} size - Sky dome size
 */
export function createMapSky(scene, size = 5000) {
  // Create a gradient sky for Philippines tropical climate
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  // Sky gradient (bright tropical sky)
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#87CEEB') // Light blue at top
  gradient.addColorStop(0.5, '#B0E0E6') // Sky blue in middle
  gradient.addColorStop(1, '#FFE4B5') // Warm horizon

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 256)

  const texture = new THREE.CanvasTexture(canvas)
  const geometry = new THREE.SphereGeometry(size, 32, 32)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide
  })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)
  return mesh
}

/**
 * Get elevation data for Philippines region (procedural approximation)
 * Note: Real elevation would require Google Elevation API which has strict quotas
 */
export function generateTerrainElevation(width, height) {
  const elevation = []
  
  // Simple Perlin-like noise simulation for terrain variation
  for (let y = 0; y < height; y++) {
    const row = []
    for (let x = 0; x < width; x++) {
      // Mix of sin waves to create terrain features
      const h1 = Math.sin(x / 50) * 0.3
      const h2 = Math.sin(y / 50) * 0.2
      const h3 = Math.sin((x + y) / 100) * 0.1
      const h4 = Math.sin((x - y) / 80) * 0.15
      
      // Higher elevation for mountain regions (western side represents Cordillera)
      const mountainEffect = Math.sin(x / width * Math.PI) * 0.4
      
      // Base elevation with some randomness
      const value = (h1 + h2 + h3 + h4 + mountainEffect + Math.random() * 0.1) * 100
      row.push(Math.max(0, value))
    }
    elevation.push(row)
  }
  
  return elevation
}

/**
 * Create a displacement map for terrain from elevation data
 */
export function createDisplacementMap(elevationData) {
  const width = elevationData[0].length
  const height = elevationData.length
  
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  
  // Find min/max for normalization
  let min = Infinity, max = -Infinity
  for (let row of elevationData) {
    for (let val of row) {
      min = Math.min(min, val)
      max = Math.max(max, val)
    }
  }
  
  const range = max - min || 1
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const normalized = (elevationData[y][x] - min) / range
      const val = Math.floor(normalized * 255)
      data[idx] = val
      data[idx + 1] = val
      data[idx + 2] = val
      data[idx + 3] = 255
    }
  }
  
  ctx.putImageData(imageData, 0, 0)
  return new THREE.CanvasTexture(canvas)
}

/**
 * Load POIs (Points of Interest) for Philippines
 * This is a static list but could be extended with real data
 */
export function getPhilippinesPOIs() {
  return [
    // Major cities
    { name: 'Manila', type: 'city', lat: 14.5995, lng: 120.9842, population: 1846513 },
    { name: 'Cebu City', type: 'city', lat: 10.3157, lng: 123.8854, population: 798634 },
    { name: 'Davao City', type: 'city', lat: 7.1108, lng: 125.6423, population: 1428606 },
    
    // Tourist attractions
    { name: 'Boracay Island', type: 'beach', lat: 11.9676, lng: 121.9254 },
    { name: 'Palawan', type: 'region', lat: 9.7489, lng: 118.7383 },
    { name: 'Banaue Rice Terraces', type: 'landmark', lat: 16.8103, lng: 121.1744 },
    { name: 'Intramuros', type: 'landmark', lat: 14.5963, lng: 120.9749 },
    
    // Provinces
    { name: 'Laguna', type: 'province', lat: 14.3500, lng: 121.2833 },
    { name: 'Cavite', type: 'province', lat: 14.3566, lng: 120.8939 },
    { name: 'Bulacan', type: 'province', lat: 14.7500, lng: 121.1667 }
  ]
}

/**
 * Clear texture cache to free memory
 */
export function clearTextureCache() {
  textureCache.clear()
}
