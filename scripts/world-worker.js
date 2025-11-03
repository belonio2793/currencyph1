import { createClient } from '@supabase/supabase-js'

// World worker: iterative, extensible loop that updates property valuations, runs world-gen steps,
// and persists checkpoints. Designed to be safe, restartable, and configurable via env vars.

const SUPABASE_URL = process.env.PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE URL or SERVICE_ROLE_KEY in environment. Set SUPABASE_SERVICE_ROLE_KEY and PROJECT_URL.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const WORKER_NAME = process.env.WORKER_NAME || 'world_worker_v1'
const BASE_INTERVAL_MS = parseInt(process.env.WORKER_BASE_INTERVAL_MS || '5000', 10)
const MAX_INTERVAL_MS = parseInt(process.env.WORKER_MAX_INTERVAL_MS || '60000', 10)
const BACKOFF_FACTOR = parseFloat(process.env.WORKER_BACKOFF_FACTOR || '1.15')

let intervalMs = BASE_INTERVAL_MS
let shouldStop = false
let iteration = 0

async function loadLastCheckpoint() {
  try {
    const { data, error } = await supabase
      .from('worker_checkpoints')
      .select('*')
      .eq('worker_name', WORKER_NAME)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error) {
      // no checkpoint is ok
      return null
    }
    return data || null
  } catch (err) {
    console.warn('Failed to load checkpoint:', err.message || err)
    return null
  }
}

async function saveCheckpoint(state = {}) {
  try {
    const payload = { worker_name: WORKER_NAME, last_run: new Date(), state }
    const { data, error } = await supabase.from('worker_checkpoints').insert([payload]).select().single()
    if (error) console.warn('Checkpoint save warning:', error.message || error)
    return data
  } catch (err) {
    console.warn('Failed to save checkpoint:', err.message || err)
    return null
  }
}

// Simple valuation algorithm: base price * (1 + demandFactor) * marketTrend
function computeValuation(property) {
  const base = Number(property.price || 100)
  // demand multiplier: small random perturbation + simulated demand based on timestamps/metadata
  const demand = (property.metadata && property.metadata.demand) ? Number(property.metadata.demand) : (Math.random() * 0.2)
  const trend = (property.metadata && property.metadata.trend) ? (property.metadata.trend === 'up' ? 1.02 : (property.metadata.trend === 'down' ? 0.98 : 1.0)) : 1.0
  const newVal = Math.max(1, Math.round(base * (1 + demand) * trend))
  return newVal
}

async function runIteration() {
  iteration++
  console.log(`Worker iteration ${iteration} - running valuation update...`)

  try {
    // Fetch a batch of properties to update (limit to avoid large queries)
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .limit(200)

    if (error) throw error
    if (!properties || properties.length === 0) {
      console.log('No properties found to update')
      return { updated: 0 }
    }

    const updates = []
    const valuationInserts = []

    for (const prop of properties) {
      const newPrice = computeValuation(prop)
      if (Number(prop.price || 0) !== Number(newPrice)) {
        updates.push({ id: prop.id, price: newPrice, updated_at: new Date() })
        valuationInserts.push({ property_id: prop.id, valuation: newPrice, source: 'algorithmic' })
      }
    }

    // Bulk update properties (if any)
    if (updates.length > 0) {
      // Supabase doesn't support multi-row update in single query; update sequentially but efficiently
      for (const u of updates) {
        await supabase.from('properties').update({ price: u.price, updated_at: u.updated_at }).eq('id', u.id)
      }

      // Insert valuations history
      await supabase.from('property_valuations').insert(valuationInserts)
      console.log(`Updated ${updates.length} properties valuations`)    
    } else {
      console.log('No price changes computed this iteration')
    }

    // Save a lightweight checkpoint state
    await saveCheckpoint({ iteration, updated: updates.length, timestamp: new Date().toISOString() })

    // Reset backoff on success
    intervalMs = Math.max(BASE_INTERVAL_MS, Math.floor(intervalMs / BACKOFF_FACTOR))

    return { updated: updates.length }
  } catch (err) {
    console.error('Iteration failed:', err?.message || err)
    // exponential backoff up to max
    intervalMs = Math.min(MAX_INTERVAL_MS, Math.floor(intervalMs * BACKOFF_FACTOR))
    return { error: err }
  }
}

async function workerLoop() {
  console.log('Starting world worker loop (press Ctrl+C to stop)')
  const last = await loadLastCheckpoint()
  if (last) console.log('Loaded last checkpoint:', last.id, last.last_run)

  while (!shouldStop) {
    const start = Date.now()
    await runIteration()
    const elapsed = Date.now() - start
    const wait = Math.max(1000, intervalMs - elapsed)
    await new Promise(r => setTimeout(r, wait))
  }

  // On graceful stop, save final checkpoint
  await saveCheckpoint({ iteration, stopped_at: new Date().toISOString() })
  console.log('Worker stopped gracefully')
}

process.on('SIGINT', async () => {
  console.log('SIGINT received: stopping worker...')
  shouldStop = true
})
process.on('SIGTERM', async () => {
  console.log('SIGTERM received: stopping worker...')
  shouldStop = true
})

// Start
workerLoop().catch(async (err) => {
  console.error('Worker loop crashed:', err)
  await saveCheckpoint({ iteration, crashed: true, error: String(err) })
  process.exit(1)
})
