import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const chipPackages = [
  { name: '280K Chips', chips_amount: 280000, bonus_chips: 0, usd_price: 4.99, display_order: 1 },
  { name: '1M Chips', chips_amount: 1000000, bonus_chips: 100000, usd_price: 4.99, display_order: 2 },
  { name: '560K Chips', chips_amount: 560000, bonus_chips: 0, usd_price: 9.99, display_order: 3 },
  { name: '1.3M Chips', chips_amount: 1300000, bonus_chips: 200000, usd_price: 19.99, display_order: 4 },
  { name: '3M Chips', chips_amount: 3000000, bonus_chips: 500000, usd_price: 34.99, display_order: 5 },
  { name: '5M Chips', chips_amount: 5000000, bonus_chips: 1000000, usd_price: 49.99, display_order: 6 },
  { name: '9M Chips', chips_amount: 9000000, bonus_chips: 2000000, usd_price: 74.99, display_order: 7 },
  { name: '14M Chips', chips_amount: 14000000, bonus_chips: 5000000, usd_price: 99.99, display_order: 8 },
  { name: '20M Chips - Flash Sale', chips_amount: 20000000, bonus_chips: 10000000, usd_price: 149.99, display_order: 9 }
]

async function seed() {
  try {
    console.log('Seeding poker chip packages...')
    const { data, error } = await supabase
      .from('poker_chip_packages')
      .insert(chipPackages)
      .select()

    if (error) {
      console.error('Error:', error)
      process.exit(1)
    }

    console.log(`\n✅ Successfully seeded ${data.length} chip packages:\n`)
    data.forEach(pkg => {
      const bonus = pkg.bonus_chips > 0 ? ` +${pkg.bonus_chips.toLocaleString()}` : ''
      console.log(`  ${pkg.name.padEnd(30)} ${String(pkg.chips_amount).padStart(10)} chips${bonus}`)
    })

    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

seed()
