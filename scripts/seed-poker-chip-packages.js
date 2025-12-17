import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const chipPackages = [
  {
    chip_amount: 1000,
    bonus_chips: 200,
    usd_price: 2.99,
    display_order: 1,
    is_first_purchase_special: true,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    chip_amount: 2500,
    bonus_chips: 500,
    usd_price: 4.99,
    display_order: 2,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    chip_amount: 5000,
    bonus_chips: 1500,
    usd_price: 9.99,
    display_order: 3,
    is_first_purchase_special: false,
    is_most_popular: true,
    is_flash_sale: false
  },
  {
    chip_amount: 10000,
    bonus_chips: 3000,
    usd_price: 17.99,
    display_order: 4,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    chip_amount: 25000,
    bonus_chips: 7500,
    usd_price: 39.99,
    display_order: 5,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    chip_amount: 50000,
    bonus_chips: 20000,
    usd_price: 69.99,
    display_order: 6,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    chip_amount: 100000,
    bonus_chips: 50000,
    usd_price: 119.99,
    display_order: 7,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    chip_amount: 250000,
    bonus_chips: 150000,
    usd_price: 249.99,
    display_order: 8,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: false
  },
  {
    chip_amount: 500000,
    bonus_chips: 300000,
    usd_price: 449.99,
    display_order: 9,
    is_first_purchase_special: false,
    is_most_popular: false,
    is_flash_sale: true
  }
]

async function seed() {
  try {
    console.log('Starting to seed poker chip packages...')

    // First, delete existing packages
    const { error: deleteErr } = await supabase
      .from('poker_chip_packages')
      .delete()
      .gte('id', 0)

    if (deleteErr) {
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
