import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function cleanupWalletsHouse() {
  console.log('Fetching all crypto wallets...\n')
  
  const { data: allWallets, error: fetchError } = await supabase
    .from('wallets_house')
    .select('*')
    .eq('wallet_type', 'crypto')

  if (fetchError) {
    console.error('Error fetching:', fetchError)
    process.exit(1)
  }

  // IDs to delete - these are wrong or duplicate entries
  const idsToDelete = [
    '011077d5-0208-44f7-9cb3-4680fad49894', // SOL with USDC address (wrong)
  ]

  // Filter out PENDING addresses and null currency_name entries (except specific ones to keep)
  const keepIds = new Set()
  const toDeleteIds = new Set(idsToDelete)

  allWallets.forEach(wallet => {
    // Delete entries with PENDING addresses
    if (wallet.address === 'PENDING') {
      toDeleteIds.add(wallet.id)
      return
    }

    // Delete entries with null/empty currency names (unless from coinsph)
    if (!wallet.currency_name && wallet.provider !== 'coinsph') {
      toDeleteIds.add(wallet.id)
      return
    }

    // Delete duplicate currency codes (keep coinsph provider, latest by ID)
    // This is a simplified approach - keeps the first valid entry per currency+network
    const key = `${wallet.currency}_${wallet.network}`
    if (!keepIds.has(key)) {
      keepIds.add(key)
    } else if (wallet.provider === 'internal' || !wallet.currency_name) {
      toDeleteIds.add(wallet.id)
    }
  })

  console.log(`Found ${toDeleteIds.size} entries to delete:`)
  Array.from(toDeleteIds).forEach(id => {
    const wallet = allWallets.find(w => w.id === id)
    console.log(`- ${wallet.currency || 'UNKNOWN'} (${wallet.network}): ${wallet.address}`)
  })

  if (toDeleteIds.size === 0) {
    console.log('No entries to delete!')
    return
  }

  console.log('\nDeleting incorrect entries...')
  const { error: deleteError } = await supabase
    .from('wallets_house')
    .delete()
    .in('id', Array.from(toDeleteIds))

  if (deleteError) {
    console.error('Error deleting:', deleteError)
    process.exit(1)
  }

  console.log(`✓ Deleted ${toDeleteIds.size} entries`)
  console.log('\nRemaining crypto wallets:')
  
  const { data: remaining } = await supabase
    .from('wallets_house')
    .select('*')
    .eq('wallet_type', 'crypto')
    .order('currency', { ascending: true })

  remaining.forEach((wallet, idx) => {
    console.log(`${idx + 1}. ${wallet.currency} (${wallet.currency_name}) - ${wallet.network}`)
  })
}

cleanupWalletsHouse()
