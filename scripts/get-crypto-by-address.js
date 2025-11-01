import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADDR = process.env.ADDR || 'J21aSxn39SiHpu1bw6ze5wkcuw8AXkNwELWKLL3d1QG3'

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function run() {
  try {
    const { data, error } = await supabase.from('wallets_crypto').select('*').eq('address', ADDR)
    if (error) {
      console.error('Error querying wallets_crypto:', error)
    } else {
      console.log('Count:', data.length)
      console.log(JSON.stringify(data, null, 2))
    }
  } catch (e) {
    console.error('Unexpected error:', e)
    process.exit(1)
  }
}

run()
