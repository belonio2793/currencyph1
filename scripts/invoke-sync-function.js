import fetch from 'node-fetch'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

async function run() {
  try {
    const url = `${PROJECT_URL.replace(/\/$/, '')}/functions/v1/sync-wallet-balances`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ limit_per_wallet: 10 })
    })
    const j = await resp.json().catch(() => null)
    console.log('Status:', resp.status)
    console.log(JSON.stringify(j, null, 2))
  } catch (e) {
    console.error('Error invoking function:', e)
    process.exit(1)
  }
}

run()
