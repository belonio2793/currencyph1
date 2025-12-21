import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fetchAddresses() {
  console.log('Fetching crypto addresses from wallets_house...\n')
  
  const { data, error } = await supabase
    .from('wallets_house')
    .select('*')
    .eq('wallet_type', 'crypto')
    .order('currency', { ascending: true })

  if (error) {
    console.error('Error fetching:', error)
    process.exit(1)
  }

  console.log(`Found ${data.length} crypto wallet entries:\n`)
  data.forEach((wallet, idx) => {
    console.log(`${idx + 1}. ${wallet.currency} (${wallet.currency_name})`)
    console.log(`   Address: ${wallet.address}`)
    console.log(`   Network: ${wallet.network}`)
    console.log(`   Provider: ${wallet.provider}`)
    console.log(`   ID: ${wallet.id}`)
    console.log('')
  })
}

fetchAddresses()
