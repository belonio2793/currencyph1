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
    console.log('Checking network_transactions (recent 10 rows)')
    const { data, error } = await supabase
      .from('network_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error querying network_transactions:', error)
    } else {
      console.log('Count:', data.length)
      console.log(JSON.stringify(data.slice(0,5), null, 2))
    }
  } catch (e) {
    console.error('Unexpected error:', e)
    process.exit(1)
  }
}

run()
