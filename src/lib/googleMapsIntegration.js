import * as THREE from 'three'

// Map tile integrations and stylized game-textures (MapTiler preferred when available)
const MAPTILER_KEY = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_MAPTILER_KEY || import.meta.env?.MAPTILER_API_KEY || '')
  : (typeof process !== 'undefined' ? (process.env?.VITE_MAPTILER_KEY || process.env?.MAPTILER_API_KEY || '') : '')

const GOOGLE_API_KEY = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_GOOGLE_API_KEY || import.meta.env?.GOOGLE_API_KEY || '')
  : (typeof process !== 'undefined' ? (process.env?.VITE_GOOGLE_API_KEY || process.env?.GOOGLE_API_KEY || '') : '')

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
 * Return a game-stylized THREE.Texture by posterizing / pixelating the source image.
 */
function stylizeTexture(baseTexture, size = 512) {
  try {
    const img = baseTexture.image
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // Draw source image scaled to canvas
    ctx.drawImage(img, 0, 0, size, size)

    // Pixelate: draw to small canvas then scale up
    const small = document.createElement('canvas')
    const smallSize = Math.max(32, Math.floor(size / 8))
    small.width = smallSize
    small.height = smallSize
    const sctx = small.getContext('2d')
    sctx.drawImage(canvas, 0, 0, smallSize, smallSize)

    // Posterize / quantize colors on small canvas
    const imageData = sctx.getImageData(0, 0, smallSize, smallSize)
    const data = imageData.data
    const levels = 5 // fewer levels -> more stylized
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.floor(data[i] / 255 * (levels - 1)) * Math.floor(255 / (levels - 1))
      data[i + 1] = Math.floor(data[i + 1] / 255 * (levels - 1)) * Math.floor(255 / (levels - 1))
      data[i + 2] = Math.floor(data[i + 2] / 255 * (levels - 1)) * Math.floor(255 / (levels - 1))
    }
    sctx.putImageData(imageData, 0, 0)

    // Scale back up to main canvas (nearest neighbor to keep blockiness)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, size, size)

    const outTex = new THREE.CanvasTexture(canvas)
    outTex.magFilter = THREE.NearestFilter
    outTex.minFilter = THREE.NearestMipMapNearestFilter
    outTex.generateMipmaps = true
    return outTex
  } catch (err) {
    console.warn('Stylize failed, returning original texture', err)
    return baseTexture
  }
}

/**
 * Generate a map texture from available providers (MapTiler preferred) and stylize for game look
 * @param {number} lat
 * @param {number} lng
 * @param {number} zoom
 * @param {number} size
 */
export async function getMapTexture(lat, lng, zoom = 15, size = 512) {
  const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${zoom}_${size}`
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)

  try {
    const url = buildStaticMapURL(lat, lng, zoom, size)
    const baseTexture = await loadTextureFromURL(url)

    // Apply stylization to fit a game aesthetic
    const styled = stylizeTexture(baseTexture, size)
    textureCache.set(cacheKey, styled)
    return styled
  } catch (err) {
    console.warn('Failed to load map texture, using fallback:', err)
    const fb = createFallbackTexture()
    textureCache.set(cacheKey, fb)
    return fb
  }
}

/**
 * Build static map URL using MapTiler (preferred) or Google as fallback
 */
function buildStaticMapURL(lat, lng, zoom, size = 512) {
  const z = Math.min(20, Math.max(0, Math.floor(zoom)))
  if (MAPTILER_KEY) {
    // MapTiler Static Maps endpoint (raster)
    // Example: https://api.maptiler.com/maps/streets/static/{lon},{lat},{z}/{w}x{h}.png?key=KEY
    const style = 'streets' // could be 'streets', 'hybrid', 'satellite'
    const width = Math.min(1024, size)
    const height = Math.min(1024, size)
    const base = `https://api.maptiler.com/maps/${style}/static/${lng},${lat},${z}/${width}x${height}.png?key=${MAPTILER_KEY}`
    return base
  }

  if (GOOGLE_API_KEY) {
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: z,
      size: `${size}x${size}`,
      maptype: 'satellite',
      key: GOOGLE_API_KEY
    })
    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  }

  // No provider keys - use a simple tile placeholder service
  return `https://tiles.wmflabs.org/hikebike/15/0/0.png`
}

/**
 * Load a texture from a URL and return THREE.Texture
 */
function loadTextureFromURL(url) {
  return new Promise((resolve, reject) => {
    const textureLoader = new THREE.TextureLoader()
    textureLoader.setCrossOrigin('')
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
 * Create a fallback procedural texture when map provider fails
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

// Remaining helper functions (generatePhilippinesTerrain, createMapGroundPlane, createMapSky, etc.)
export async function generatePhilippinesTerrain() {
  const tiles = []
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

export function createMapSky(scene, size = 5000) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#87CEEB')
  gradient.addColorStop(0.5, '#B0E0E6')
  gradient.addColorStop(1, '#FFE4B5')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 256)
  const texture = new THREE.CanvasTexture(canvas)
  const geometry = new THREE.SphereGeometry(size, 32, 32)
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)
  return mesh
}

export function generateTerrainElevation(width, height) {
  const elevation = []
  for (let y = 0; y < height; y++) {
    const row = []
    for (let x = 0; x < width; x++) {
      const h1 = Math.sin(x / 50) * 0.3
      const h2 = Math.sin(y / 50) * 0.2
      const h3 = Math.sin((x + y) / 100) * 0.1
      const h4 = Math.sin((x - y) / 80) * 0.15
      const mountainEffect = Math.sin(x / width * Math.PI) * 0.4
      const value = (h1 + h2 + h3 + h4 + mountainEffect + Math.random() * 0.1) * 100
      row.push(Math.max(0, value))
    }
    elevation.push(row)
  }
  return elevation
}

export function createDisplacementMap(elevationData) {
  const width = elevationData[0].length
  const height = elevationData.length
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
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

export function getPhilippinesPOIs() {
  return [
    { name: 'Manila', type: 'city', lat: 14.5995, lng: 120.9842, population: 1846513 },
    { name: 'Cebu City', type: 'city', lat: 10.3157, lng: 123.8854, population: 798634 },
    { name: 'Davao City', type: 'city', lat: 7.1108, lng: 125.6423, population: 1428606 },
    { name: 'Boracay Island', type: 'beach', lat: 11.9676, lng: 121.9254 },
    { name: 'Palawan', type: 'region', lat: 9.7489, lng: 118.7383 },
    { name: 'Banaue Rice Terraces', type: 'landmark', lat: 16.8103, lng: 121.1744 },
    { name: 'Intramuros', type: 'landmark', lat: 14.5963, lng: 120.9749 },
    { name: 'Laguna', type: 'province', lat: 14.3500, lng: 121.2833 },
    { name: 'Cavite', type: 'province', lat: 14.3566, lng: 120.8939 },
    { name: 'Bulacan', type: 'province', lat: 14.7500, lng: 121.1667 }
  ]
}

export function clearTextureCache() {
  textureCache.clear()
}




/**
 * Create a sky mesh using Google Maps imagery
 * @param {THREE.Scene} scene - Three.js scene
 * @param {number} size - Sky dome size
 */


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
