import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function callFunction(slug, body = {}) {
  const url = `${PROJECT_URL.replace(/\/$/, '')}/functions/v1/${slug}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify(body),
    timeout: 4500
  }).catch(e => ({ error: e.message }))
  try {
    const j = await resp.json().catch(() => null)
    return { status: resp.status, body: j }
  } catch (e) {
    return { status: null, body: String(e) }
  }
}

async function run() {
  console.log('Calling enqueue-sync-wallets...')
  const enq = await callFunction('enqueue-sync-wallets', { max: 10, recent_window_minutes: 5 })
  console.log('Enqueue response:', JSON.stringify(enq, null, 2))

  console.log('\nChecking wallet_sync_jobs (recent 10)')
  const { data: jobs, error: jobsErr } = await supabase.from('wallet_sync_jobs').select('*').order('created_at', { ascending: false }).limit(10)
  if (jobsErr) console.error('Error querying jobs:', jobsErr)
  else console.log(JSON.stringify(jobs || [], null, 2))

  console.log('\nCalling process-sync-job...')
  const proc = await callFunction('process-sync-job', { limit_per_wallet: 1 })
  console.log('Process response:', JSON.stringify(proc, null, 2))

  console.log('\nRe-checking wallet_sync_jobs (recent 10)')
  const { data: jobs2, error: jobsErr2 } = await supabase.from('wallet_sync_jobs').select('*').order('created_at', { ascending: false }).limit(10)
  if (jobsErr2) console.error('Error querying jobs:', jobsErr2)
  else console.log(JSON.stringify(jobs2 || [], null, 2))

  console.log('\nChecking wallets_house sample (recent 10)')
  const { data: houses, error: housesErr } = await supabase.from('wallets_house').select('*').order('updated_at', { ascending: false }).limit(10)
  if (housesErr) console.error('Error querying wallets_house:', housesErr)
  else console.log(JSON.stringify(houses || [], null, 2))
}

run().catch(e => { console.error('Unexpected error', e); process.exit(1) })
