import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspect() {
  try {
    console.log('Attempting to get table schema information...\n')

    // Try to insert with minimal data to see what columns are available
    const { data, error } = await supabase
      .from('poker_chip_packages')
      .insert([
        {
          name: 'Test Package'
        }
      ])
      .select()

    if (error) {
      console.log('Error details:', error)
      console.log('\nTrying alternative column names...')

      // Maybe the column names are different, try some alternatives
      const alternatives = [
        { pkg_name: 'Test', pkg_chips: 1000, pkg_price: 9.99 },
        { package_name: 'Test', total_chips: 1000, price: 9.99 },
        { title: 'Test', chips: 1000, amount: 9.99 }
      ]

      for (const alt of alternatives) {
        const { error: altError } = await supabase
          .from('poker_chip_packages')
          .insert([alt])
          .select()

        if (!altError) {
          console.log('\n✓ Found working columns:', Object.keys(alt))
          process.exit(0)
        }
      }
    } else {
      console.log('✓ Successfully inserted minimal record')
      console.log('Returned data:', data)
    }

    process.exit(1)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

inspect()
