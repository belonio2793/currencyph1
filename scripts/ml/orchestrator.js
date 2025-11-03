import exportData from './export_data.js'
import train from './train.js'
import { createClient } from '@supabase/supabase-js'
import path from 'path'

const SUPABASE_URL = process.env.PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE URL or SERVICE_ROLE_KEY in environment. Set SUPABASE_SERVICE_ROLE_KEY and PROJECT_URL.')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const MODELS_DIR = path.resolve(process.cwd(), 'data', 'ml', 'models')

async function saveModelRecord(checkpointPath) {
  try {
    const ckpt = JSON.parse(require('fs').readFileSync(checkpointPath, 'utf8'))
    const payload = { worker_name: 'ml_orchestrator', last_run: new Date(), state: { checkpoint: ckpt } }
    await supabase.from('worker_checkpoints').insert([payload])
    console.log('Saved model checkpoint metadata to worker_checkpoints')
  } catch (err) {
    console.warn('Failed to save model record:', err)
  }
}

async function orchestrate() {
  try {
    const exportPath = await exportData()
    const modelPath = await train(exportPath)
    await saveModelRecord(modelPath)
    console.log('ML orchestrator iteration complete')
  } catch (err) {
    console.error('ML orchestrator failed:', err)
  }
}

if (require.main === module) {
  // Simple loop: run once then exit. For continuous, run under supervisor or cron.
  orchestrate().catch(err => process.exit(1))
}

export default orchestrate
