import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const OUT_DIR = path.resolve(process.cwd(), 'data', 'ml')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const SUPABASE_URL = process.env.PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE URL or SERVICE_ROLE_KEY in environment. Set SUPABASE_SERVICE_ROLE_KEY and PROJECT_URL.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function exportData() {
  console.log('Exporting ML dataset...')

  // Export properties + recent transactions + price history + positions
  const out = { properties: [], transactions: [], price_history: [], positions: [] }

  try {
    const { data: properties } = await supabase.from('properties').select('*')
    const { data: transactions } = await supabase.from('property_transactions').select('*').limit(10000)
    const { data: priceHistory } = await supabase.from('property_valuations').select('*').order('calculated_at', { ascending: false }).limit(50000)
    const { data: positions } = await supabase.from('world_positions').select('*').order('recorded_at', { ascending: false }).limit(50000)

    out.properties = properties || []
    out.transactions = transactions || []
    out.price_history = priceHistory || []
    out.positions = positions || []

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outPath = path.join(OUT_DIR, `ml_export_${timestamp}.json`)
    fs.writeFileSync(outPath, JSON.stringify(out))
    console.log('ML export written to', outPath)
    return outPath
  } catch (err) {
    console.error('ML export failed:', err)
    throw err
  }
}

if (require.main === module) {
  exportData().catch(err => process.exit(1))
}

export default exportData
