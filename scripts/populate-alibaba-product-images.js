import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_PROJECT_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Real Alibaba image URLs extracted from the product page
const alibabaProductImages = [
  {
    product_name: '17 Pro Max Smart Phone',
    images: [
      {
        image_url: 'https://sc04.alicdn.com/kf/Ha2b8500aab2f4bec9c20075cfcdd3644e.jpg',
        alt_text: '17 Pro Max Smart Phone - Main View',
        is_primary: true,
        position: 0
      },
      {
        image_url: 'https://sc04.alicdn.com/kf/H7e54a8e67ded4752a8630d52bfdb5c37G.jpg',
        alt_text: '17 Pro Max Smart Phone - Side View',
        is_primary: false,
        position: 1
      },
      {
        image_url: 'https://sc04.alicdn.com/kf/Hd63bfe4d29c74261a304626ec5d60175o.jpg',
        alt_text: '17 Pro Max Smart Phone - Back View',
        is_primary: false,
        position: 2
      },
      {
        image_url: 'https://sc04.alicdn.com/kf/H699f67c5760d47e3a99553a50be87926s.jpg',
        alt_text: '17 Pro Max Smart Phone - Display',
        is_primary: false,
        position: 3
      },
      {
        image_url: 'https://sc04.alicdn.com/kf/H82fb5116006546ecaf5a259f1b3376557.jpg',
        alt_text: '17 Pro Max Smart Phone - Camera',
        is_primary: false,
        position: 4
      },
      {
        image_url: 'https://sc04.alicdn.com/kf/Hf62aa847728a403c80e5287a9b43abcbF.jpg',
        alt_text: '17 Pro Max Smart Phone - Specs',
        is_primary: false,
        position: 5
      }
    ]
  }
]

async function populateProductImages() {
  try {
    console.log('🚀 Starting image population from Alibaba extraction...\n')

    for (const productData of alibabaProductImages) {
      console.log(`📦 Processing: ${productData.product_name}`)

      // Find product by name
      const { data: products, error: searchError } = await supabase
        .from('shop_products')
        .select('id')
        .ilike('name', `%${productData.product_name}%`)
        .limit(1)

      if (searchError) {
        console.error(`❌ Error searching for product: ${searchError.message}`)
        continue
      }

      if (!products || products.length === 0) {
        console.warn(`⚠️  Product not found: ${productData.product_name}`)
        console.log(`   Trying to find by SKU or create entry...\n`)
        continue
      }

      const productId = products[0].id
      console.log(`   ✓ Found product ID: ${productId}`)

      // Delete existing images for this product
      const { error: deleteError } = await supabase
        .from('shop_product_images')
        .delete()
        .eq('product_id', productId)

      if (deleteError) {
        console.error(`   ❌ Error deleting old images: ${deleteError.message}`)
        continue
      }

      // Insert new images
      const { data: insertedImages, error: insertError } = await supabase
        .from('shop_product_images')
        .insert(
          productData.images.map(img => ({
            product_id: productId,
            image_url: img.image_url,
            alt_text: img.alt_text,
            is_primary: img.is_primary,
            position: img.position
          }))
        )

      if (insertError) {
        console.error(`   ❌ Error inserting images: ${insertError.message}`)
        continue
      }

      console.log(`   ��� Inserted ${productData.images.length} images`)
      console.log(`   Images:`)
      productData.images.forEach((img, i) => {
        const badge = img.is_primary ? '⭐' : '  '
        console.log(`     ${badge} [${i}] ${img.image_url.split('/').pop()}`)
      })
      console.log()
    }

    console.log('✅ Image population complete!')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

populateProductImages()
