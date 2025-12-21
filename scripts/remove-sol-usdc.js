import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function removeIncorrectSOL() {
  console.log('Finding SOL entry with USDC address: J21aSxn39SiHpu1bw6ze5wkcuw8AXkNwELWKLL3d1QG3\n')
  
  const { data: wallets, error: fetchError } = await supabase
    .from('wallets_house')
    .select('*')
    .eq('address', 'J21aSxn39SiHpu1bw6ze5wkcuw8AXkNwELWKLL3d1QG3')
    .eq('currency', 'SOL')

  if (fetchError) {
    console.error('Error fetching:', fetchError)
    process.exit(1)
  }

  if (wallets.length === 0) {
    console.log('❌ Entry not found')
    process.exit(1)
  }

  console.log(`Found ${wallets.length} entry to delete:`)
  wallets.forEach(w => {
    console.log(`- ${w.currency} (${w.currency_name}): ${w.address}`)
    console.log(`  Network: ${w.network}`)
    console.log(`  ID: ${w.id}`)
  })

  const idToDelete = wallets[0].id

  console.log(`\nDeleting entry ${idToDelete}...`)
  const { error: deleteError } = await supabase
    .from('wallets_house')
    .delete()
    .eq('id', idToDelete)

  if (deleteError) {
    console.error('Error deleting:', deleteError)
    process.exit(1)
  }

  console.log('✓ Entry deleted successfully')

  // Show remaining SOL entries
  const { data: remaining } = await supabase
    .from('wallets_house')
    .select('*')
    .eq('currency', 'SOL')

  console.log(`\nRemaining SOL entries: ${remaining.length}`)
  remaining.forEach(w => {
    console.log(`- ${w.currency}: ${w.address}`)
  })
}

removeIncorrectSOL()
