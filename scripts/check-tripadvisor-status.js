import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStatus() {
  console.log('\n📊 TripAdvisor Data Status Report\n');
  console.log('='.repeat(70));

  try {
    // Total listings
    const { count: totalCount } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true });

    console.log(`\n📋 Total Listings: ${totalCount}`);

    // Listings with tripadvisor_id
    const { count: withIdCount } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true })
      .not('tripadvisor_id', 'is', null);

    const idPercentage = ((withIdCount / totalCount) * 100).toFixed(1);
    console.log(`✅ With TripAdvisor ID: ${withIdCount} (${idPercentage}%)`);

    const missingIdCount = totalCount - withIdCount;
    const missingIdPercentage = ((missingIdCount / totalCount) * 100).toFixed(1);
    console.log(`❌ Missing TripAdvisor ID: ${missingIdCount} (${missingIdPercentage}%)`);

    // Listings with photos
    const { count: withPhotosCount } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true })
      .not('photo_urls', 'is', null)
      .gt('photo_count', 0);

    const photosPercentage = ((withPhotosCount / totalCount) * 100).toFixed(1);
    console.log(`\n🖼️  With Photos: ${withPhotosCount} (${photosPercentage}%)`);

    const missingPhotosCount = totalCount - withPhotosCount;
    const missingPhotosPercentage = ((missingPhotosCount / totalCount) * 100).toFixed(1);
    console.log(`❌ Missing Photos: ${missingPhotosCount} (${missingPhotosPercentage}%)`);

    // Both missing
    const { count: bothMissing } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true })
      .or('tripadvisor_id.is.null,photo_urls.is.null');

    console.log(`\n⚠️  Need Enrichment (ID or photos): ${bothMissing}`);

    // By category
    console.log(`\n📁 By Category:`);
    const { data: byCategory } = await supabase
      .from('nearby_listings')
      .select('category, id', { count: 'exact', head: true })
      .order('category');

    const { data: categoryStats } = await supabase
      .rpc('get_category_stats');

    if (categoryStats) {
      for (const stat of categoryStats) {
        console.log(`   ${stat.category}: ${stat.total} listings`);
      }
    }

    // By city
    console.log(`\n🏙️  Top Cities:`);
    const { data: cityStats } = await supabase
      .from('nearby_listings')
      .select('city')
      .limit(1000)
      .order('city');

    const cityCounts = {};
    cityStats?.forEach(item => {
      if (item.city) {
        cityCounts[item.city] = (cityCounts[item.city] || 0) + 1;
      }
    });

    const sortedCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [city, count] of sortedCities) {
      const { count: cityWithId } = await supabase
        .from('nearby_listings')
        .select('id', { count: 'exact', head: true })
        .eq('city', city)
        .not('tripadvisor_id', 'is', null);

      const cityPercentage = ((cityWithId / count) * 100).toFixed(0);
      console.log(`   ${city}: ${count} listings (${cityPercentage}% with ID)`);
    }

    // Sample missing data
    console.log(`\n📝 Sample Listings Needing ID:`);
    const { data: needingId } = await supabase
      .from('nearby_listings')
      .select('id, name, city, category')
      .is('tripadvisor_id', null)
      .limit(5);

    if (needingId?.length > 0) {
      needingId.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.name} (${item.city})`);
      });
    }

    // Statistics
    console.log(`\n📈 Quick Stats:`);
    const { data: completeness } = await supabase
      .from('nearby_listings')
      .select('tripadvisor_id, photo_urls, verified');

    let complete = 0;
    let withId = 0;
    let withPhotos = 0;
    let verified = 0;

    completeness?.forEach(item => {
      if (item.tripadvisor_id && item.photo_urls?.length > 0) complete++;
      if (item.tripadvisor_id) withId++;
      if (item.photo_urls?.length > 0) withPhotos++;
      if (item.verified) verified++;
    });

    console.log(`   Fully Complete: ${complete}/${totalCount} (${((complete/totalCount)*100).toFixed(1)}%)`);
    console.log(`   Verified: ${verified}/${totalCount}`);

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    if (missingIdCount > 0) {
      console.log(`   1️⃣  Run: npm run fill-tripadvisor-final`);
      console.log(`      → Will find ${missingIdCount} missing TripAdvisor IDs`);
    }
    if (missingPhotosCount > 0) {
      console.log(`   2️⃣  After ID fill, run: npm run fill-tripadvisor-advanced`);
      console.log(`      → Will fetch photos for ${missingPhotosCount} listings`);
    }
    if (missingIdCount === 0 && missingPhotosCount === 0) {
      console.log(`   ✅ All data is complete! No enrichment needed.`);
    }

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkStatus();
