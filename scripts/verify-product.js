import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyProduct() {
  try {
    console.log('\n🔍 Verifying product import...\n');

    // Check products
    const { data: products, error: productsError } = await supabase
      .from('shop_products')
      .select('id, name, brand, final_price, is_active');

    if (productsError) throw productsError;

    console.log(`📦 Total products in database: ${products.length}`);
    if (products.length > 0) {
      console.log('\nActive Products:');
      products.forEach(p => {
        console.log(`  ✓ ${p.name}`);
        console.log(`    Price: ₱${p.final_price} | Brand: ${p.brand} | Active: ${p.is_active}`);
      });
    }

    // Check images
    const { data: images, error: imagesError } = await supabase
      .from('shop_product_images')
      .select('product_id, is_primary');

    if (imagesError) throw imagesError;

    console.log(`\n🖼️  Total product images: ${images.length}`);

    // Check categories
    const { data: categories, error: categoriesError } = await supabase
      .from('shop_categories')
      .select('id, name, is_active')
      .eq('is_active', true);

    if (categoriesError) throw categoriesError;

    console.log(`\n🏷️  Active categories: ${categories.length}`);
    categories.forEach(c => {
      console.log(`  ✓ ${c.name}`);
    });

    console.log('\n✨ Verification complete!');
    console.log('\nYour Shop Online page is ready with:');
    console.log(`  • ${products.length} product(s)`);
    console.log(`  • ${images.length} image(s)`);
    console.log(`  • ${categories.length} categor(ies)\n`);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

verifyProduct();
