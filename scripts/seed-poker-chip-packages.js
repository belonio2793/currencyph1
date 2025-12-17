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
    chip_amount: 280000,
    bonus_chips: 0,
    usd_price: 4.99,
    display_order: 1,
    is_first_purchase_special: true,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '1M Chips',
    chip_amount: 1000000,
    bonus_chips: 100000,
    usd_price: 4.99,
    display_order: 2,
    is_first_purchase_special: true,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '560K Chips',
    chip_amount: 560000,
    bonus_chips: 0,
    usd_price: 9.99,
    display_order: 3,
    is_first_purchase_special: false,
    is_most_popular: true,
    is_flash_sale: false
  },
  {
    name: '1.3M Chips',
    chip_amount: 1300000,
    bonus_chips: 200000,
    usd_price: 19.99,
    display_order: 4,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '3M Chips',
    chip_amount: 3000000,
    bonus_chips: 500000,
    usd_price: 34.99,
    display_order: 5,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '5M Chips',
    chip_amount: 5000000,
    bonus_chips: 1000000,
    usd_price: 49.99,
    display_order: 6,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '9M Chips',
    chip_amount: 9000000,
    bonus_chips: 2000000,
    usd_price: 74.99,
    display_order: 7,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '14M Chips',
    chip_amount: 14000000,
    bonus_chips: 5000000,
    usd_price: 99.99,
    display_order: 8,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    name: '20M Chips - Flash Sale',
    chip_amount: 20000000,
    bonus_chips: 10000000,
    usd_price: 149.99,
    display_order: 9,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: true
  }
]

async function seed() {
  try {
    console.log('Starting to seed poker chip packages...')

    // First, delete existing packages (if any)
    const { error: deleteErr } = await supabase
      .from('poker_chip_packages')
      .delete()
      .neq('id', 'null')

    if (deleteErr && deleteErr.code !== 'PGRST116') {
      console.warn('Could not delete existing packages:', deleteErr)
    }

    // Insert new packages
    const { data, error } = await supabase
      .from('poker_chip_packages')
      .insert(chipPackages)
      .select()

    if (error) {
      console.error('Error seeding packages:', error)
      process.exit(1)
    }

    console.log(`Successfully seeded ${data.length} chip packages:`)
    data.forEach(pkg => {
      console.log(`- ${pkg.chip_amount} chips + ${pkg.bonus_chips} bonus = ${pkg.chip_amount + pkg.bonus_chips} total (${pkg.is_first_purchase_special ? 'First Purchase' : pkg.is_most_popular ? 'Most Popular' : pkg.is_flash_sale ? 'Flash Sale' : 'Regular'})`)
    })

    process.exit(0)
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(1)
  }
}

seed()
