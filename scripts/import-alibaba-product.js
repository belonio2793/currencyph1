import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabaseUrl = process.env.VITE_PROJECT_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Sample product data from Alibaba
// In production, you'd scrape this from the actual URL
const sampleProducts = [
  {
    sku: 'ALIPHONE-001',
    name: '17 Pro Max Smart Phone',
    slug: '17-pro-max-smart-phone',
    description: 'Latest flagship smartphone with advanced features',
    long_description: 'Experience the future of mobile technology with the 17 Pro Max Smart Phone. Features cutting-edge processor, stunning display, and advanced camera system.',
    brand: 'Premium Brand',
    base_price: 599.99,
    selling_price: 599.99,
    final_price: 599.99,
    cost_price: 300.00,
    discount_percentage: 0,
    currency: 'PHP',
    weight_kg: 0.25,
    dimensions_cm: { width: 8, height: 17, depth: 0.8 },
    is_active: true,
    is_featured: true,
    is_bestseller: false,
    total_stock: 100,
    reorder_level: 10,
    supplier_name: 'Alibaba Supplier',
    origin_country: 'China',
    warranty_months: 12,
    return_days: 30,
    tags: 'smartphone,mobile,electronics,flagship',
    rating: 4.5,
    review_count: 234,
    sales_count: 1200,
    alibaba_url: 'https://www.alibaba.com/product-detail/17-Pro-Max-Smart-Phone-Factory_1601599069237.html',
    alibaba_product_id: '1601599069237',
    alibaba_shop_name: 'Premium Electronics',
    alibaba_min_order: 1,
    alibaba_shipping_cost: 50.00,
    images: [
      {
        image_url: 'https://via.placeholder.com/600x600?text=17+Pro+Max+Front',
        alt_text: '17 Pro Max Front View',
        is_primary: true,
        position: 0
      },
      {
        image_url: 'https://via.placeholder.com/600x600?text=17+Pro+Max+Back',
        alt_text: '17 Pro Max Back View',
        is_primary: false,
        position: 1
      },
      {
        image_url: 'https://via.placeholder.com/600x600?text=17+Pro+Max+Side',
        alt_text: '17 Pro Max Side View',
        is_primary: false,
        position: 2
      }
    ]
  },
  {
    sku: 'ALIPHONE-002',
    name: 'Ultra Pro Max Smartphone',
    slug: 'ultra-pro-max-smartphone',
    description: 'Premium smartphone with exceptional performance',
    long_description: 'The Ultra Pro Max delivers unmatched speed and reliability with its latest processor technology and premium design.',
    brand: 'Premium Electronics',
    base_price: 749.99,
    selling_price: 649.99,
    final_price: 649.99,
    cost_price: 350.00,
    discount_percentage: 13.33,
    discount_amount: 100.00,
    currency: 'PHP',
    weight_kg: 0.28,
    dimensions_cm: { width: 8.5, height: 18, depth: 0.85 },
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    total_stock: 200,
    reorder_level: 20,
    supplier_name: 'Alibaba Electronics',
    origin_country: 'China',
    warranty_months: 24,
    return_days: 30,
    tags: 'smartphone,mobile,electronics,premium,bestseller',
    rating: 4.8,
    review_count: 567,
    sales_count: 3400,
    alibaba_url: 'https://www.alibaba.com/product-detail/Ultra-Pro-Max_1601599069238.html',
    alibaba_product_id: '1601599069238',
    alibaba_shop_name: 'Premium Electronics',
    alibaba_min_order: 1,
    alibaba_shipping_cost: 50.00,
    images: [
      {
        image_url: 'https://via.placeholder.com/600x600?text=Ultra+Pro+Max+Front',
        alt_text: 'Ultra Pro Max Front',
        is_primary: true,
        position: 0
      },
      {
        image_url: 'https://via.placeholder.com/600x600?text=Ultra+Pro+Max+Back',
        alt_text: 'Ultra Pro Max Back',
        is_primary: false,
        position: 1
      }
    ]
  },
  {
    sku: 'ALIPHONE-003',
    name: 'Standard Pro Smartphone',
    slug: 'standard-pro-smartphone',
    description: 'Reliable and affordable smartphone',
    long_description: 'A perfect balance of performance and affordability. The Standard Pro offers excellent value with solid performance.',
    brand: 'Tech Electronics',
    base_price: 349.99,
    selling_price: 299.99,
    final_price: 299.99,
    cost_price: 150.00,
    discount_percentage: 14.28,
    discount_amount: 50.00,
    currency: 'PHP',
    weight_kg: 0.20,
    dimensions_cm: { width: 7.5, height: 16, depth: 0.75 },
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    total_stock: 500,
    reorder_level: 50,
    supplier_name: 'Alibaba Supplier',
    origin_country: 'China',
    warranty_months: 12,
    return_days: 30,
    tags: 'smartphone,mobile,electronics,budget,bestseller',
    rating: 4.3,
    review_count: 345,
    sales_count: 5600,
    alibaba_url: 'https://www.alibaba.com/product-detail/Standard-Pro_1601599069239.html',
    alibaba_product_id: '1601599069239',
    alibaba_shop_name: 'Tech Electronics',
    alibaba_min_order: 1,
    alibaba_shipping_cost: 45.00,
    images: [
      {
        image_url: 'https://via.placeholder.com/600x600?text=Standard+Pro+Front',
        alt_text: 'Standard Pro Front',
        is_primary: true,
        position: 0
      }
    ]
  }
]

async function importProducts() {
  try {
    console.log('Starting product import...')

    // 1. Create or get category
    const { data: categories, error: catError } = await supabase
      .from('shop_categories')
      .select('*')
      .eq('slug', 'smartphones')
      .single()

    let categoryId
    if (catError && catError.code === 'PGRST116') {
      // Category doesn't exist, create it
      const { data: newCat, error: createCatError } = await supabase
        .from('shop_categories')
        .insert([
          {
            name: 'Smartphones',
            slug: 'smartphones',
            description: 'Latest smartphones and mobile devices',
            is_active: true,
            display_order: 1
          }
        ])
        .select()

      if (createCatError) throw createCatError
      categoryId = newCat[0].id
      console.log('Created category:', categoryId)
    } else if (catError) {
      throw catError
    } else {
      categoryId = categories.id
      console.log('Using existing category:', categoryId)
    }

    // 2. Import products
    for (const product of sampleProducts) {
      const { images, ...productData } = product

      const { data: existingProduct } = await supabase
        .from('shop_products')
        .select('id')
        .eq('sku', product.sku)
        .single()

      let productId

      if (!existingProduct) {
        const { data: newProduct, error: productError } = await supabase
          .from('shop_products')
          .insert([
            {
              ...productData,
              category_id: categoryId,
              slug: product.slug
            }
          ])
          .select()

        if (productError) throw productError
        productId = newProduct[0].id
        console.log(`Created product: ${product.name} (${productId})`)
      } else {
        productId = existingProduct.id
        console.log(`Product already exists: ${product.name}`)
        continue
      }

      // 3. Add product images
      if (images && images.length > 0) {
        const imageRows = images.map(img => ({
          product_id: productId,
          image_url: img.image_url,
          alt_text: img.alt_text,
          is_primary: img.is_primary,
          position: img.position
        }))

        const { error: imageError } = await supabase
          .from('shop_product_images')
          .insert(imageRows)

        if (imageError) throw imageError
        console.log(`Added ${images.length} images to product`)
      }
    }

    console.log('✅ Import completed successfully!')
  } catch (error) {
    console.error('❌ Import failed:', error.message)
    process.exit(1)
  }
}

importProducts()
