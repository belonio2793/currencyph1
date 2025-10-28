import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
const checkpointPath = path.join(__dirname, '..', '.enrich-all-checkpoint.json')

let lastCount = 0
let lastTime = Date.now()
let maxRate = 0

async function getEnrichedCount() {
  const { count } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })
    .not('tripadvisor_id', 'is', null)
  return count || 0
}

async function getTotalCount() {
  const { count } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true })
  return count || 0
}

function getCheckpointProgress() {
  try {
    if (fs.existsSync(checkpointPath)) {
      const data = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'))
      return Object.keys(data.processed).length
    }
  } catch (e) {}
  return 0
}

function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function clearScreen() {
  console.clear()
}

async function monitor() {
  console.log('🔍 REAL-TIME ENRICHMENT MONITOR\n')
  console.log('Press Ctrl+C to stop monitoring\n')

  while (true) {
    const totalListings = await getTotalCount()
    const enrichedCount = await getEnrichedCount()
    const checkpointCount = getCheckpointProgress()
    
    const currentTime = Date.now()
    const timeDiff = (currentTime - lastTime) / 1000
    const countDiff = enrichedCount - lastCount
    const rate = timeDiff > 0 ? (countDiff / timeDiff).toFixed(2) : 0
    
    if (rate > maxRate) maxRate = rate

    const percent = totalListings > 0 ? ((enrichedCount / totalListings) * 100).toFixed(1) : 0
    const remaining = totalListings - enrichedCount
    const estimatedTime = rate > 0 ? remaining / rate : 0

    clearScreen()
    console.log('═'.repeat(70))
    console.log('🔄 ENRICHMENT IN PROGRESS')
    console.log('═'.repeat(70))
    console.log()
    
    console.log(`📊 Status: ${enrichedCount}/${totalListings} (${percent}%)`)
    console.log()
    
    // Progress bar
    const barLength = 50
    const filledLength = Math.round((enrichedCount / totalListings) * barLength)
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
    console.log(`   [${bar}]`)
    console.log()

    console.log(`⏱️  Processing Rate: ${rate} items/sec (max: ${maxRate}/sec)`)
    console.log(`⏳ Estimated Time Remaining: ${formatTime(estimatedTime * 1000)}`)
    console.log(`🔍 Checkpoint Progress: ${checkpointCount} processed`)
    console.log()

    if (enrichedCount === lastCount) {
      console.log('⚠️  No progress in last check - may be rate limited')
    } else if (enrichedCount > lastCount) {
      console.log(`✅ Just processed ${countDiff} listings`)
    }

    console.log()
    console.log('═'.repeat(70))
    
    if (enrichedCount >= totalListings) {
      console.log('✨ ENRICHMENT COMPLETE!')
      console.log('═'.repeat(70))
      process.exit(0)
    }

    lastCount = enrichedCount
    lastTime = currentTime

    // Update every 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
}

monitor().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
