// Utility functions for WebMercator projection and tile rendering (MapTiler)
const MAPTILER_KEY = 'Epg2ZBCTb2mrWoiUKQRL'
const TILE_SIZE = 256

// Philippines bounds and center
export const PHILIPPINES_CENTER = { lat: 12.8797, lng: 121.7740 }
export const PHILIPPINES_BOUNDS = { north: 20.63, south: 4.6724, west: 116.1196, east: 128.3154 }

function degToRad(deg) { return deg * Math.PI / 180 }

// Convert lat/lng to WebMercator pixel coordinates at zoom z
export function latLngToPixels(lat, lon, z) {
  const sinLat = Math.sin(degToRad(lat))
  const z2 = Math.pow(2, z)
  const x = ((lon + 180) / 360) * TILE_SIZE * z2
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * TILE_SIZE * z2
  return { x, y }
}

// Convert pixels to tile coordinate
function pixelToTile(px, py) {
  return { tx: Math.floor(px / TILE_SIZE), ty: Math.floor(py / TILE_SIZE) }
}

function tileUrl(z, x, y) {
  return `https://api.maptiler.com/tiles/streets/${z}/${x}/${y}.png?key=${MAPTILER_KEY}`
}

const tileCache = new Map()

function loadTile(z, x, y) {
  const key = `${z}_${x}_${y}`
  if (tileCache.has(key)) return tileCache.get(key)
  const img = new Image()
  img.crossOrigin = 'Anonymous'
  const p = new Promise((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
  })
  img.src = tileUrl(z, x, y)
  tileCache.set(key, p)
  return p
}

// Draw visible tiles given camera and world mapping
export async function drawTiles(ctx, canvas, cam, worldWidth, worldHeight) {
  if (!ctx || !cam) return
  // Use base tile zoom for country-level
  const z = 6
  // Compute mercator pixel bounds for Philippines
  const westPx = latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.west, z).x // note using south lat for consistent span
  const eastPx = latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.east, z).x
  const northPx = latLngToPixels(PHILIPPINES_BOUNDS.north, PHILIPPINES_BOUNDS.west, z).y
  const southPx = latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.west, z).y

  const philWidthPx = Math.abs(eastPx - westPx)
  const philHeightPx = Math.abs(southPx - northPx)

  // Map world coordinates to mercator pixels via scaling to bounds
  const scaleX = philWidthPx / Math.max(1, worldWidth)
  const scaleY = philHeightPx / Math.max(1, worldHeight)
  const scale = Math.max(0.0001, (scaleX + scaleY) / 2)

  // Compute world center mapping: world (0,0) -> top-left of bounds
  const worldToPixel = (wx, wy) => {
    const px = westPx + wx * scale
    const py = northPx + wy * scale
    return { px, py }
  }

  // Compute camera pixel position (top-left pixel in mercator coordinates)
  const camPx = worldToPixel(cam.x, cam.y)
  // visible pixel rectangle in mercator space
  const viewLeft = camPx.px
  const viewTop = camPx.py
  const viewRight = viewLeft + canvas.width / Math.max(0.0001, cam.zoom)
  const viewBottom = viewTop + canvas.height / Math.max(0.0001, cam.zoom)

  // tile range
  const leftTile = Math.floor(viewLeft / TILE_SIZE)
  const rightTile = Math.floor(viewRight / TILE_SIZE)
  const topTile = Math.floor(viewTop / TILE_SIZE)
  const bottomTile = Math.floor(viewBottom / TILE_SIZE)

  // For each tile, draw if available (synchronously attempt to draw cached ones)
  const drawPromises = []
  for (let tx = leftTile - 1; tx <= rightTile + 1; tx++) {
    for (let ty = topTile - 1; ty <= bottomTile + 1; ty++) {
      const px = tx * TILE_SIZE
      const py = ty * TILE_SIZE
      const screenX = (px - viewLeft) * cam.zoom
      const screenY = (py - viewTop) * cam.zoom
      const key = `${z}_${tx}_${ty}`
      if (tileCache.has(key)) {
        const cached = tileCache.get(key)
        // cached may be Promise
        Promise.resolve(cached).then(img => {
          try { ctx.drawImage(img, screenX, screenY, TILE_SIZE * cam.zoom, TILE_SIZE * cam.zoom) } catch(e){}
        }).catch(()=>{})
      } else {
        const p = loadTile(z, tx, ty).then(img => {
          try { ctx.drawImage(img, screenX, screenY, TILE_SIZE * cam.zoom, TILE_SIZE * cam.zoom) } catch (e){}
        }).catch(()=>{})
        drawPromises.push(p)
      }
    }
  }

  // return a promise that resolves when requested tiles loaded
  return Promise.allSettled(drawPromises)
}

// Convert lat/lng to world coordinates given world dimensions
export function latLngToWorldCoords(worldWidth, worldHeight, lat, lng, z = 6) {
  // mercator pixels for bounds
  const westPx = latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.west, z).x
  const eastPx = latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.east, z).x
  const northPx = latLngToPixels(PHILIPPINES_BOUNDS.north, PHILIPPINES_BOUNDS.west, z).y

  const philWidthPx = Math.abs(eastPx - westPx)
  const philHeightPx = Math.abs(latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.west, z).y - northPx)
  const scaleX = philWidthPx / Math.max(1, worldWidth)
  const scaleY = philHeightPx / Math.max(1, worldHeight)
  const scale = Math.max(0.0001, (scaleX + scaleY) / 2)

  const px = westPx + (lng - PHILIPPINES_BOUNDS.west) / (PHILIPPINES_BOUNDS.east - PHILIPPINES_BOUNDS.west) * philWidthPx
  const py = northPx + (PHILIPPINES_BOUNDS.north - lat) / (PHILIPPINES_BOUNDS.north - PHILIPPINES_BOUNDS.south) * philHeightPx

  // Convert back to world coordinates
  const wx = (px - westPx) / scale
  const wy = (py - northPx) / scale
  return { x: wx, y: wy }
}

// Convert world coordinates back to lat/lng
export function worldToLatLng(worldWidth, worldHeight, wx, wy, z = 6) {
  const westPx = latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.west, z).x
  const eastPx = latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.east, z).x
  const northPx = latLngToPixels(PHILIPPINES_BOUNDS.north, PHILIPPINES_BOUNDS.west, z).y

  const philWidthPx = Math.abs(eastPx - westPx)
  const philHeightPx = Math.abs(latLngToPixels(PHILIPPINES_BOUNDS.south, PHILIPPINES_BOUNDS.west, z).y - northPx)
  const scaleX = philWidthPx / Math.max(1, worldWidth)
  const scaleY = philHeightPx / Math.max(1, worldHeight)
  const scale = Math.max(0.0001, (scaleX + scaleY) / 2)

  const px = westPx + wx * scale
  const py = northPx + wy * scale

  const z2 = Math.pow(2, z)
  const lon = (px / (TILE_SIZE * z2)) * 360 - 180
  const n = Math.PI - (2 * Math.PI * py) / (TILE_SIZE * z2)
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { lat, lng: lon }
}
