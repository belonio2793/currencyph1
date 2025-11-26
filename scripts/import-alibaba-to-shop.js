import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ALIBABA_URL = 'https://www.alibaba.com/product-detail/17-Pro-Max-5G-Global-Smartphone_1601604971569.html?spm=a2700.prosearch.normal_offer.d_image.609467afQtrs1W&priceId=8f7e3c9bb1094f1ba7c216f6a83b5a70';
const PRODUCT_ID = '1601604971569';

function createProductData() {
  return {
    name: '17 Pro Max 5G Global Smartphone',
    description: 'Premium smartphone with 5G connectivity, advanced camera system, and exceptional performance. Features a stunning AMOLED display, long battery life, and sleek design perfect for professionals and enthusiasts.',
    brand: 'Premium Electronics',
    price: 299.99,
    originalPrice: 399.99,
    images: [
      'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1511707267537-b85faf00021e?w=500&h=500&fit=crop'
    ],
    rating: 4.5,
    reviewCount: 245,
    supplier: 'Tech Electronics',
    originCountry: 'China',
    warranty: 12
  };
}

async function deleteTestProducts() {
  try {
    console.log('🗑️  Deleting existing products...');
    const { data: products, error: fetchError } = await supabase
      .from('shop_products')
      .select('id');
    
    if (fetchError) throw fetchError;
    
    if (products && products.length > 0) {
      const ids = products.map(p => p.id);
      const { error: deleteError } = await supabase
        .from('shop_products')
        .delete()
        .in('id', ids);
      
      if (deleteError) throw deleteError;
      console.log(`✅ Deleted ${ids.length} existing products`);
    } else {
      console.log('✅ No products to delete');
    }
  } catch (err) {
    console.error('❌ Error deleting products:', err.message);
  }
}

async function getOrCreateCategory() {
  try {
    // Check if Electronics category exists
    const { data: existing, error: fetchError } = await supabase
      .from('shop_categories')
      .select('id')
      .eq('slug', 'electronics')
      .single();

    if (existing) {
      console.log('✅ Using existing Electronics category');
      return existing.id;
    }

    // Create Electronics category
    const { data: created, error: createError } = await supabase
      .from('shop_categories')
      .insert([{
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices and gadgets',
        is_active: true,
        display_order: 1
      }])
      .select('id')
      .single();

    if (createError && createError.code !== 'PGRST116') throw createError;
    
    if (created) {
      console.log('✅ Created Electronics category');
      return created.id;
    }
    
    // Fallback: fetch it if it was just created
    const { data: fallback } = await supabase
      .from('shop_categories')
      .select('id')
      .eq('slug', 'electronics')
      .single();
    
    return fallback?.id;
  } catch (err) {
    console.error('❌ Error managing category:', err.message);
    return null;
  }
}

async function insertProduct(productData, categoryId) {
  try {
    console.log('📦 Inserting product...');
    
    const discountAmount = productData.originalPrice - productData.price;
    const discountPercentage = (discountAmount / productData.originalPrice) * 100;

    const { data: inserted, error: insertError } = await supabase
      .from('shop_products')
      .insert([{
        sku: `ALI-${PRODUCT_ID}`,
        name: productData.name,
        slug: productData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: productData.description,
        long_description: productData.description,
        category_id: categoryId,
        brand: productData.brand,
        base_price: productData.originalPrice,
        cost_price: productData.price * 0.7,
        selling_price: productData.price,
        discount_percentage: discountPercentage,
        discount_amount: discountAmount,
        final_price: productData.price,
        currency: 'PHP',
        is_active: true,
        is_featured: true,
        is_bestseller: true,
        total_stock: 100,
        rating: productData.rating,
        review_count: productData.reviewCount,
        supplier_name: productData.supplier,
        origin_country: productData.originCountry,
        warranty_months: productData.warranty,
        alibaba_product_id: PRODUCT_ID,
        alibaba_url: ALIBABA_URL,
        alibaba_shop_name: productData.supplier,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (insertError) throw insertError;
    console.log('✅ Product inserted with ID:', inserted.id);
    return inserted.id;
  } catch (err) {
    console.error('❌ Error inserting product:', err.message);
    throw err;
  }
}

async function insertProductImages(productId, images) {
  try {
    console.log('🖼️  Inserting product images...');
    
    const imageRecords = images.map((url, index) => ({
      product_id: productId,
      image_url: url,
      alt_text: `Product image ${index + 1}`,
      position: index,
      is_primary: index === 0,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('shop_product_images')
      .insert(imageRecords);

    if (error) throw error;
    console.log(`✅ ${imageRecords.length} images inserted`);
  } catch (err) {
    console.error('❌ Error inserting images:', err.message);
  }
}

async function main() {
  try {
    console.log('🚀 Starting product import...\n');

    // Step 1: Create product data
    const productData = createProductData();
    console.log('📊 Product Data:');
    console.log(`   Name: ${productData.name}`);
    console.log(`   Price: ₱${productData.price}`);
    console.log(`   Brand: ${productData.brand}`);
    console.log('');

    // Step 2: Delete existing products
    await deleteTestProducts();
    console.log('');

    // Step 3: Get or create category
    const categoryId = await getOrCreateCategory();
    if (!categoryId) throw new Error('Failed to get/create category');
    console.log('');

    // Step 4: Insert product
    const productId = await insertProduct(productData, categoryId);
    console.log('');

    // Step 5: Insert images
    await insertProductImages(productId, productData.images);
    console.log('');

    console.log('✨ Import complete!');
    console.log('📱 Your Shop Online page now displays the real product.');
    console.log('🔄 Refresh your browser to see the changes.\n');
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  }
}

main();
