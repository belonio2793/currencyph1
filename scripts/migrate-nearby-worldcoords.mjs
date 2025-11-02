import { createClient } from '@supabase/supabase-js'
import process from 'process'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL or SERVICE_ROLE_KEY missing in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const PH_BOUNDS = { north: 20.63, south: 4.6724, west: 116.1196, east: 128.3154 }
const TILE_SIZE = 256

function degToRad(deg) { return deg * Math.PI / 180 }
function latLngToPixels(lat, lon, z) {
  const sinLat = Math.sin(degToRad(lat))
  const z2 = Math.pow(2, z)
  const x = ((lon + 180) / 360) * TILE_SIZE * z2
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * TILE_SIZE * z2
  return { x, y }
}

function latLngToWorldCoords(worldWidth, worldHeight, lat, lng, z = 6) {
  const westPx = latLngToPixels(PH_BOUNDS.south, PH_BOUNDS.west, z).x
  const eastPx = latLngToPixels(PH_BOUNDS.south, PH_BOUNDS.east, z).x
  const northPx = latLngToPixels(PH_BOUNDS.north, PH_BOUNDS.west, z).y
  const philWidthPx = Math.abs(eastPx - westPx)
  const philHeightPx = Math.abs(latLngToPixels(PH_BOUNDS.south, PH_BOUNDS.west, z).y - northPx)
  const scaleX = philWidthPx / Math.max(1, worldWidth)
  const scaleY = philHeightPx / Math.max(1, worldHeight)
  const scale = Math.max(0.0001, (scaleX + scaleY) / 2)

  const px = westPx + (lng - PH_BOUNDS.west) / (PH_BOUNDS.east - PH_BOUNDS.west) * philWidthPx
  const py = northPx + (PH_BOUNDS.north - lat) / (PH_BOUNDS.north - PH_BOUNDS.south) * philHeightPx

  const wx = (px - westPx) / scale
  const wy = (py - northPx) / scale
  return { x: wx, y: wy }
}

async function migrate(batchSize = 500) {
  let offset = 0
  let updated = 0
  const worldWidth = 20000
  const worldHeight = 20000

  while (true) {
    console.log(`Fetching batch offset=${offset}`)
    const { data, error } = await supabase
      .from('nearby_listings')
      .select('id, latitude, longitude')
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error('Fetch error', error)
      break
    }
    if (!data || data.length === 0) break

    const updates = []
    for (const row of data) {
      const lat = parseFloat(row.latitude)
      const lng = parseFloat(row.longitude)
      if (!lat || !lng) continue
      const pos = latLngToWorldCoords(worldWidth, worldHeight, lat, lng)
      updates.push({ id: row.id, world_x: Math.round(pos.x), world_y: Math.round(pos.y) })
    }

    if (updates.length > 0) {
      const { error: upErr } = await supabase
        .from('nearby_listings')
        .upsert(updates, { onConflict: 'id' })
      if (upErr) {
        console.error('Upsert error', upErr)
        break
      }
      updated += updates.length
      console.log(`Updated ${updates.length} rows (total ${updated})`)
    }

    offset += batchSize
  }

  console.log('Migration complete. Total updated:', updated)
}

await migrate()
