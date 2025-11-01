import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function run() {
  try {
    const { data, error } = await supabase.from('wallets_house').select('*').eq('network', 'solana')
    if (error) {
      console.error('Error querying wallets_house:', error)
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
