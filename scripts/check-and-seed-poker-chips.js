import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const chipPackages = [
  {
    name: '280K Chips',
    chips_amount: 280000,
    bonus_chips: 0,
    chips_price: 4.99,
    display_order: 1,
    is_first_purchase_special: true,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '1M Chips',
    chips_amount: 1000000,
    bonus_chips: 100000,
    chips_price: 4.99,
    display_order: 2,
    is_first_purchase_special: true,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '560K Chips',
    chips_amount: 560000,
    bonus_chips: 0,
    chips_price: 9.99,
    display_order: 3,
    is_first_purchase_special: false,
    is_most_popular: true,
    is_flash_sale: false
  },
  {
    name: '1.3M Chips',
    chips_amount: 1300000,
    bonus_chips: 200000,
    chips_price: 19.99,
    display_order: 4,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '3M Chips',
    chips_amount: 3000000,
    bonus_chips: 500000,
    chips_price: 34.99,
    display_order: 5,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '5M Chips',
    chips_amount: 5000000,
    bonus_chips: 1000000,
    chips_price: 49.99,
    display_order: 6,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '9M Chips',
    chips_amount: 9000000,
    bonus_chips: 2000000,
    chips_price: 74.99,
    display_order: 7,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '14M Chips',
    chips_amount: 14000000,
    bonus_chips: 5000000,
    chips_price: 99.99,
    display_order: 8,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '20M Chips - Flash Sale',
    chips_amount: 20000000,
    bonus_chips: 10000000,
    chips_price: 149.99,
    display_order: 9,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: true
  }
]

async function checkAndSeed() {
  try {
    console.log('Checking if poker_chip_packages table exists...')

    // Try to query the table
    const { data, error } = await supabase
      .from('poker_chip_packages')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('❌ Error: poker_chip_packages table not found or inaccessible')
      console.log('\nThe table needs to be created. Follow these steps:')
      console.log('1. Go to Supabase SQL Editor')
      console.log('2. Run the migration: supabase/migrations/add_poker_chip_system.sql')
      console.log('3. Then run this script again')
      process.exit(1)
    }

    const existingCount = data && Array.isArray(data) ? data.length : 0
    console.log(`✓ Table exists (currently has ${existingCount} packages)`)

    // Clear existing and insert new
    if (existingCount > 0) {
      console.log('Clearing existing packages...')
      const { error: deleteError } = await supabase
        .from('poker_chip_packages')
        .delete()
        .gt('display_order', 0)

      if (deleteError) {
        console.warn('Could not delete all packages:', deleteError)
      }
    }

    console.log('Inserting new chip packages...')
    const { data: inserted, error: insertError } = await supabase
      .from('poker_chip_packages')
      .insert(chipPackages)
      .select()

    if (insertError) {
      console.error('Error inserting packages:', insertError)
      process.exit(1)
    }

    console.log(`\n✅ Successfully seeded ${inserted.length} chip packages:\n`)
    inserted.forEach(pkg => {
      const bonusInfo = pkg.bonus_chips > 0 ? ` + ${pkg.bonus_chips.toLocaleString()} bonus` : ''
      const badge = pkg.is_first_purchase_special ? '⭐ First Purchase' : pkg.is_most_popular ? '⭐ Most Popular' : pkg.is_flash_sale ? '🔥 Flash Sale' : ''
      console.log(`  ${pkg.name.padEnd(25)} ${String(pkg.chip_amount).padStart(10)} chips${bonusInfo} - $${pkg.usd_price} ${badge}`)
    })

    console.log('\n✅ Poker chip packages ready!')
    process.exit(0)
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(1)
  }
}

checkAndSeed()
