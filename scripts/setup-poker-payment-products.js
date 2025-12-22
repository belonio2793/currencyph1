import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// The merchant UUID for currency.ph
const MERCHANT_ID = '336c05a0-3b97-417b-90c4-eca4560346cf'

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

async function setupPokerPaymentProducts() {
  try {
    console.log(`Setting up payment products for poker chips under merchant ${MERCHANT_ID}...`)

    // Check if merchant exists
    const { data: merchant, error: merchantErr } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', MERCHANT_ID)
      .single()

    if (merchantErr || !merchant) {
      console.error('❌ Merchant not found:', MERCHANT_ID)
      process.exit(1)
    }

    console.log(`✓ Found merchant: ${merchant.merchant_name}`)

    // Check for existing poker products
    const { data: existingProducts, error: existingErr } = await supabase
      .from('products')
      .select('*')
      .eq('merchant_id', MERCHANT_ID)
      .like('name', '%Chips%')

    if (existingErr) {
      console.error('Error checking existing products:', existingErr)
      process.exit(1)
    }

    if (existingProducts && existingProducts.length > 0) {
      console.log(`⚠️  Found ${existingProducts.length} existing poker chip products`)
      console.log('Skipping creation to avoid duplicates.')
      console.log('\nExisting products:')
      existingProducts.forEach(p => {
        console.log(`- ${p.name} (ID: ${p.id})`)
      })
      process.exit(0)
    }

    console.log(`\nCreating ${chipPackages.length} payment products...`)

    // Create products and prices for each chip package
    const productsWithPrices = []

    for (const pkg of chipPackages) {
      try {
        // Create product
        const { data: product, error: productErr } = await supabase
          .from('products')
          .insert([
            {
              merchant_id: MERCHANT_ID,
              name: pkg.name,
              description: `${pkg.chip_amount.toLocaleString()} chips${pkg.bonus_chips > 0 ? ` + ${pkg.bonus_chips.toLocaleString()} bonus` : ''}`,
              is_active: true,
              metadata: {
                chip_amount: pkg.chip_amount,
                bonus_chips: pkg.bonus_chips,
                total_chips: pkg.chip_amount + pkg.bonus_chips,
                display_order: pkg.display_order,
                is_first_purchase_special: pkg.is_first_purchase_special,
                is_most_popular: pkg.is_most_popular,
                is_flash_sale: pkg.is_flash_sale,
                product_type: 'poker_chips'
              }
            }
          ])
          .select()
          .single()

        if (productErr) {
          console.error(`Error creating product ${pkg.name}:`, productErr)
          continue
        }

        console.log(`✓ Created product: ${product.name} (ID: ${product.id})`)

        // Create price for the product
        const { data: price, error: priceErr } = await supabase
          .from('prices')
          .insert([
            {
              merchant_id: MERCHANT_ID,
              product_id: product.id,
              amount: pkg.usd_price,
              currency: 'USD',
              type: 'one_time',
              is_active: true,
              metadata: {
                chip_amount: pkg.chip_amount,
                bonus_chips: pkg.bonus_chips
              }
            }
          ])
          .select()
          .single()

        if (priceErr) {
          console.error(`Error creating price for ${pkg.name}:`, priceErr)
          continue
        }

        console.log(`  ✓ Created price: $${pkg.usd_price.toFixed(2)} USD`)

        productsWithPrices.push({
          product,
          price,
          chipPackage: pkg
        })
      } catch (err) {
        console.error(`Error setting up ${pkg.name}:`, err)
        continue
      }
    }

    console.log(`\n✅ Successfully created ${productsWithPrices.length} poker chip payment products!\n`)

    console.log('Payment Products Summary:')
    console.log('========================')
    productsWithPrices.forEach(item => {
      console.log(`${item.chipPackage.name}`)
      console.log(`  Product ID: ${item.product.id}`)
      console.log(`  Price ID: ${item.price.id}`)
      console.log(`  Chips: ${item.chipPackage.chip_amount.toLocaleString()} + ${item.chipPackage.bonus_chips.toLocaleString()} bonus = ${(item.chipPackage.chip_amount + item.chipPackage.bonus_chips).toLocaleString()} total`)
      console.log(`  Price: $${item.chipPackage.usd_price.toFixed(2)}`)
      console.log()
    })

    process.exit(0)
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(1)
  }
}

setupPokerPaymentProducts()
